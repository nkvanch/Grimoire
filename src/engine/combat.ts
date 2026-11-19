// ============================================================================
// FILE: src/engine/combat.ts
// PROJECT: Initiative Tracker, Concentration Gate & Combat Clock
// ============================================================================
import { pruneSuspensions } from './suspension';
import { Entity, CampaignRules } from './types';
import { recomputeDerived } from './pipeline';
import { tickDurations } from './conditions';
import { rollD20 as rollD20Dice } from './dice';
import { DEFAULT_RULES } from './defaults';
import { tickConcentrationDuration } from './concentration';

/** The suspensions that survive into the creature's next turn. */
function pruneAfterAdvance(e: Entity) {
  const next = pruneSuspensions({ ...e, turnCounter: (e.turnCounter ?? 0) + 1 });
  return next.suspensions;
}
export { actionSpent, isIncapacitated, incapacitationReason, isDead } from './combatState';

// ── Initiative ────────────────────────────────────────────────────────────────

export type InitiativeEntry = {
  entityId:     string;
  name:         string;
  initiative:   number;
  tiebreak:     number;   // DEX modifier used to break equal initiative rolls
  isPlayer:     boolean;
  hasTakenTurn: boolean;
};

export type CombatState = {
  active:      boolean;
  round:       number;
  turnIndex:   number;
  order:       InitiativeEntry[];
  encounterId: string;
  /** Links this "ActiveEncounter" back to the PreparedEncounter template it
   *  was instantiated from, if any — undefined for a manually-assembled
   *  encounter (add party members / spawn monsters directly, the pre-
   *  existing flow). Used only to let "mark completed" find its way back
   *  to the template; never used to write live state back into it. */
  sourcePreparedEncounterId?: string;
};

/** Rolls one entity's initiative — the app-roll convenience, shared by
 *  startEncounter/addToEncounter's roll:true path and by any UI (a per-row
 *  "🎲 Roll" button, "Roll All") that wants the exact same d20 + effective-
 *  DEX-and-bonus math rather than reimplementing it. Entity.derived.initiative
 *  already accounts for effective (not raw) DEX plus any flat initiative
 *  bonus effects (e.g. Alert) — a local reimplementation would silently miss
 *  both. */
export function rollInitiativeValue(entity: Entity): number {
  return rollD20Dice(entity.derived.initiative).total;
}

function initiativeEntryFor(entity: Entity, roll: boolean): InitiativeEntry {
  return {
    entityId:     entity.id,
    name:         entity.identity.name,
    // Table-first (see docs/... table-first resolution): starting combat or
    // adding reinforcements no longer forces an app-generated roll. roll:false
    // (the default a DM reaches by pressing the primary "Start Combat"/"Deploy"
    // button) seeds every entry at 0, stable-sorted by tiebreak alone, so the
    // DM can enter table-rolled results or just reorder rows directly — see
    // CombatantRow's inline initiative editor and setOrder's up/down swap.
    // roll:true (the secondary "🎲 Roll All" convenience) reproduces the
    // exact previous auto-roll-on-start behavior via rollInitiativeValue.
    initiative:   roll ? rollInitiativeValue(entity) : 0,
    tiebreak:     entity.derived.initiative,
    isPlayer:     entity.kind === 'character',
    hasTakenTurn: false,
  };
}

/** Exported (not just used internally) so combatStore's own setInitiative
 *  can share the exact same comparator rather than re-implementing it —
 *  closure fix: the two had drifted into two copies of the identical sort,
 *  a real risk for silent divergence if either one were tweaked later. */
export function sortInitiative(order: InitiativeEntry[]): InitiativeEntry[] {
  return [...order].sort((a, b) =>
    b.initiative - a.initiative ||
    b.tiebreak   - a.tiebreak
  );
}

/**
 * Closure fix (initiative persistence + active-actor stability): every
 * mutation that can re-sort or reorder `combat.order` — a numeric
 * initiative edit, an explicit manual reorder, "Roll All Initiative", or a
 * reinforcement merge — used to leave `turnIndex` as a bare array position.
 * That silently reassigned "whose turn it is" to whichever entity happened
 * to land at that same numeric slot after the mutation, rather than
 * following the entity that actually had the turn. Every one of those call
 * sites now captures `combat.order[combat.turnIndex]?.entityId` BEFORE
 * mutating, then calls this to find that same entity's new position
 * afterward. Falls back to the previous index (clamped to the new order's
 * bounds) only if that entity is no longer present at all — a pure
 * reorder/resort/roll never removes anyone, so that branch is defensive
 * only; a real removal (removeFromEncounter) has its own dedicated
 * re-anchoring logic already, unaffected by this helper.
 */
export function reanchorTurnIndex(
  order: InitiativeEntry[],
  currentEntityId: string | undefined,
  previousIndex: number,
): number {
  if (currentEntityId) {
    const found = order.findIndex(e => e.entityId === currentEntityId);
    if (found >= 0) return found;
  }
  return Math.min(previousIndex, Math.max(0, order.length - 1));
}

/**
 * Starts a combat encounter. `roll` (default true, matching this function's
 * pre-existing behavior for any caller/test that doesn't pass it) controls
 * whether initiative is app-rolled for every entity or left at 0 for
 * manual/table entry. The UI's primary "Start Combat" path explicitly
 * passes `roll: false` — table-first resolution: the DM enters results or
 * reorders rows directly by default — and its secondary "🎲 Roll All
 * Initiative" convenience explicitly passes `roll: true`.
 */
export function startEncounter(
  entities:    Entity[],
  encounterId: string,
  sourcePreparedEncounterId?: string,
  roll = true,
): CombatState {
  const order = sortInitiative(entities.map(e => initiativeEntryFor(e, roll)));

  return {
    active:      true,
    round:       1,
    turnIndex:   0,
    order,
    encounterId,
    sourcePreparedEncounterId,
  };
}

// ── Turn/action economy (A-25) ───────────────────────────────────────────────

/** Fresh turn — all 3 action-economy slots reset to unused. Also the first
 *  call that turns turnState from null into an actively-tracked object.
 *  Also refreshes any CustomResource tagged recharge:'start_of_turn' back
 *  to its maximum — generic (not legendary-action-specific), reusing
 *  CustomResource.recharge's existing open `| string` field the same way
 *  'short_rest'/'long_rest' already work, just ticked from a different
 *  event. First (and currently only) consumer: a monster's Legendary
 *  Actions pool, which refreshes at the start of its own turn rather than
 *  on any rest. */
export function startTurn(entity: Entity, rules: CampaignRules = DEFAULT_RULES): Entity {
  const hasStartOfTurn = entity.resources.custom.some(r => r.recharge === 'start_of_turn');
  const suspensionsEnded = (entity.suspensions?.length ?? 0) !== (pruneAfterAdvance(entity)?.length ?? 0);
  const next: Entity = {
    ...entity,
    turnState: { actionUsed: false, bonusActionUsed: false, reactionUsed: false },
    turnCounter: (entity.turnCounter ?? 0) + 1,
    suspensions: pruneAfterAdvance(entity),
    // Extra Attack sequence closure: a fresh turn always closes out any
    // leftover in-progress Attack-action sequence from before — a new turn
    // means a new Action to spend, never a continuation of an old one.
    attackSequence: null,
    resources: hasStartOfTurn
      ? { ...entity.resources, custom: entity.resources.custom.map(r => r.recharge === 'start_of_turn' ? { ...r, current: r.maximum } : r) }
      : entity.resources,
  };
  // A feature coming back on changes derived numbers, so they are recomputed at that moment.
  return suspensionsEnded ? recomputeDerived(next, rules) : next;
}

/**
 * Extra Attack sequence closure, Part O (Cancel/Done): explicitly closes the
 * entity's currently in-progress Attack-action sequence WITHOUT touching
 * anything else — the Action already spent by the lead attack (if any) stays
 * spent, and any unused attack opportunities are simply discarded. A no-op
 * (returns entity unchanged) when no sequence is active. The UI calls this
 * when the player presses "Done" after a partial sequence, or "Cancel" (also
 * a no-op there specifically, since Cancel before any successful attack
 * means entity.attackSequence was never set in the first place — see
 * applyActionCardUse's own doc comment, actionUse.ts).
 */
export function endAttackSequence(entity: Entity): Entity {
  if (!entity.attackSequence) return entity;
  return { ...entity, attackSequence: null };
}

// stripTransientRuntimeState (Extra Attack sequence closure, Part B) lives
// in types.ts, not here — db/entityRepo.ts's own per-row read path
// (parseEntityRow) is one of its required call sites, and combat.ts
// is imported by store/characterStore.ts, which
// itself imports entityRepo.ts — importing combat.ts from entityRepo.ts
// would create a cycle. types.ts has no such dependency, so the shared
// normalizer is defined there instead and re-exported here for convenience.
export { stripTransientRuntimeState } from './types';

/**
 * The authoritative solo-player "End Turn" mutation — re-audit item 18.
 * Ticks round-based condition durations, ticks a concentration countdown
 * (if any), and starts a fresh turn (resets action economy, refreshes
 * start_of_turn resources) — the exact same composition
 * TabCharacter.tsx's own End Turn button already used inline. Extracted so
 * every entry point (Character tab, Actions tab, Spells tab) calls this
 * ONE function rather than each re-composing the same three calls, which
 * would risk them drifting out of sync over time. Distinct from endTurn()
 * above, which additionally advances a DM's multi-entity initiative order —
 * this is for a solo player with no active CombatState.
 */
export function playerEndTurn(entity: Entity, rules: CampaignRules = DEFAULT_RULES): Entity {
  return startTurn(tickConcentrationDuration(tickDurations(entity, rules), rules));
}

/** Marks one action-economy slot used. A no-op if turnState is null (not
 *  actively tracked — see the type's own doc comment) or already unused-
 *  irrelevant (a 'free'/'passive' actionType never calls this at all —
 *  callers only invoke it for 'action'/'bonus_action'/'reaction' cards). */
export function markActionSlotUsed(
  entity: Entity,
  slot:   'action' | 'bonus_action' | 'reaction',
): Entity {
  if (!entity.turnState) return entity;
  // the turn's own action first, then one granted on top of it (Action Surge)
  if (slot === 'action' && entity.turnState.actionUsed && (entity.turnState.extraActions ?? 0) > 0) {
    return { ...entity, turnState: { ...entity.turnState, extraActions: entity.turnState.extraActions! - 1 } };
  }
  const key = slot === 'action' ? 'actionUsed' : slot === 'bonus_action' ? 'bonusActionUsed' : 'reactionUsed';
  return { ...entity, turnState: { ...entity.turnState, [key]: true } };
}

/** Flips one action-economy slot, for a player directly tapping the
 *  Combat-tab pill rather than using an action card — real play has
 *  actions the app doesn't model as a card at all (Dash/Dodge/Help/Search,
 *  a reaction spent narratively), so a manual correction needs to work in
 *  both directions, unlike markActionSlotUsed's card-use one-way set.
 *  Unlike markActionSlotUsed, this also INITIALIZES turnState (via
 *  startTurn) if it was null — a manual tap is itself "start tracking." */
export function toggleActionEconomy(
  entity: Entity,
  slot:   'action' | 'bonus_action' | 'reaction',
): Entity {
  const base = entity.turnState ? entity : startTurn(entity);
  const key = slot === 'action' ? 'actionUsed' : slot === 'bonus_action' ? 'bonusActionUsed' : 'reactionUsed';
  return { ...base, turnState: { ...base.turnState!, [key]: !base.turnState![key] } };
}

/**
 * Ends the current creature's turn.
 * - Ticks round-based durations on the acting entity.
 * - Advances the turn pointer.
 * - Increments the round counter when the order wraps.
 * - Starts a fresh turn (resets action economy) for whoever's turn is now current.
 */
export function endTurn(
  combat:   CombatState,
  entities: Entity[],
  rules:    CampaignRules = DEFAULT_RULES
): { combat: CombatState; entities: Entity[] } {
  const current = combat.order[combat.turnIndex];

  // Tick durations on the entity whose turn just ended
  const durationTicked = entities.map(e =>
    e.id === current.entityId ? tickConcentrationDuration(tickDurations(e, rules), rules) : e
  );

  // Advance turn pointer; wrap around at the end of the order
  const nextIndex = (combat.turnIndex + 1) % combat.order.length;
  const newRound  = nextIndex === 0 ? combat.round + 1 : combat.round;

  // Reset action economy for whoever's turn is now current.
  const nextEntityId = combat.order[nextIndex]?.entityId;
  const updatedEntities = durationTicked.map(e =>
    e.id === nextEntityId ? startTurn(e) : e
  );

  const updatedOrder = combat.order.map((entry, i) =>
    i === combat.turnIndex ? { ...entry, hasTakenTurn: true } : entry
  );

  // Reset hasTakenTurn when a new round starts
  const finalOrder = newRound > combat.round
    ? updatedOrder.map(e => ({ ...e, hasTakenTurn: false }))
    : updatedOrder;

  return {
    combat: {
      ...combat,
      round:     newRound,
      turnIndex: nextIndex,
      order:     finalOrder,
    },
    entities: updatedEntities,
  };
}

/** Ends the encounter and resets combat state. */
export function endEncounter(combat: CombatState): CombatState {
  return { ...combat, active: false, round: 0, turnIndex: 0, order: [] };
}

/**
 * Inserts reinforcements into an already-active encounter — rolls
 * initiative for the new entities only (reusing the same roll/tiebreak
 * shape startEncounter uses) and merges them into the existing order,
 * re-sorted. Preserves which entity currently has the turn across the
 * re-sort (the pointer is a plain array index, which a mid-array insertion
 * would otherwise silently invalidate).
 *
 * New arrivals are marked hasTakenTurn:false — they'll act once the turn
 * pointer reaches their rolled position. If that position already passed
 * this round, they're effectively skipped until the next round's
 * hasTakenTurn reset (endTurn, above) rather than retroactively inserted
 * into a round already in progress — a deliberate, disclosed
 * simplification (this app never auto-advances turns/rounds on its own;
 * the DM is always the one pressing the button), not an attempt to fully
 * model RAW's "you can act on your normal turn if it hasn't passed yet."
 */
/**
 * `roll` (default true, matching this function's pre-existing behavior)
 * controls whether the new entities' initiative is app-rolled or left at 0
 * for manual/table entry — same table-first default as startEncounter; the
 * UI's primary "Deploy" path passes `roll: false`.
 */
export function addToEncounter(combat: CombatState, newEntities: Entity[], roll = true): CombatState {
  if (!combat.active || newEntities.length === 0) return combat;

  const newEntries = newEntities.map(e => initiativeEntryFor(e, roll));

  const currentEntityId = combat.order[combat.turnIndex]?.entityId;
  const merged = sortInitiative([...combat.order, ...newEntries]);

  return {
    ...combat,
    order:     merged,
    turnIndex: reanchorTurnIndex(merged, currentEntityId, combat.turnIndex),
  };
}

/**
 * Rolls (or re-rolls) initiative for every entity currently in the order —
 * the "🎲 Roll All Initiative" secondary convenience, callable both before
 * anyone has entered a manual value and after (a DM changing their mind).
 * Re-sorts afterward; does not otherwise touch turnIndex/round/hasTakenTurn,
 * matching setOrder's existing "manual DM correction" semantics rather than
 * addToEncounter's turn-pointer-preserving merge (there's no new entity
 * being inserted here, so nothing needs preserving across the resort beyond
 * what setOrder callers already accept).
 */
export function rollAllInitiative(combat: CombatState, entities: Entity[]): CombatState {
  const currentEntityId = combat.order[combat.turnIndex]?.entityId;
  const byId = new Map(entities.map(e => [e.id, e]));
  const order = sortInitiative(combat.order.map(entry => {
    const entity = byId.get(entry.entityId);
    return entity ? { ...entry, initiative: rollInitiativeValue(entity), tiebreak: entity.derived.initiative } : entry;
  }));
  return { ...combat, order, turnIndex: reanchorTurnIndex(order, currentEntityId, combat.turnIndex) };
}

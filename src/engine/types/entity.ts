import type { RulesetId, AbilityGenerationMode, SkillName } from './primitives';
import type { ActionCard, PendingOutcome } from './actionCard';
import type { CharacterOverride, DmOverride } from './dmOverride';
import type { ModeState } from './charClass';
import type { ChoiceState } from './choices';
import type { DurationTracker, ActiveCondition, ConditionMonitor } from './conditions';
import type { Identity, AbilityScores, DerivedStats, SkillBlock, ProficiencyBlock, ResourceBlock, EntitlementRecord } from './entityRuntime';
import type { Effect, FeatureInstance } from './feature';
import type { SpellcastingBlock, InventoryBlock } from './spellInventory';

// ── 6. Entity master type ────────────────────────────────────────────────────

/**
 * Runtime Wild Shape state on an entity. Null when not transformed.
 * Mirrors the DmOverride philosophy: this is a layer applied on top during
 * recomputeDerived, never a mutation of entity.stats/entity.features. Revert
 * (set back to null) restores the entity exactly as it was.
 */
export type WildShapeState = {
  active:      boolean;
  formId:      string;
  /** The beast form's own HP pool while transformed — tracked separately from the player's real HP, which is untouched and resumes exactly where it was on revert. */
  beastHp:     number;
  beastHpMax:  number;
  /** Per the book duration rule (half druid level in hours, minimum 1). */
  expiresAt:   DurationTracker;
};

/**
 * A-25 — the core 5e action economy (action / bonus action / reaction),
 * reset at the start of each of the entity's own turns via startTurn().
 * Deliberately just these 3 slots, not a generic once-per-turn/round
 * limiter system for arbitrary abilities (Sneak Attack-style limits) —
 * that's a separate, harder, still-open design question (even the
 * aspirational architecture-review docs flag it unresolved). Movement-per-
 * turn is also deliberately not tracked here yet — a numeric budget with
 * its own UI, lower urgency than the 3 boolean slots. A reaction resets at
 * the start of the entity's OWN turn but can be spent on any turn (5e's
 * real rule) — that already falls out correctly here: nothing resets it
 * except this entity's own next startTurn() call.
 */
/**
 * An effect this character put on another creature: a mark, an accepted challenge, a curse. Per-target state, not a map: the target is
 * a name the table typed (and a combatant id when it is in an encounter). It is never ended by the app on its own; when its turn
 * mark passes it only shows as due, and a human ends it.
 */
export type TrackedEffect = {
  id:          string;
  name:        string;
  targetName:  string;
  targetId?:   string;
  featureId?:  string;
  /** `owner` only the player, `party` everyone, `dm` the DM and the owner. */
  visibility:  'owner' | 'party' | 'dm';
  /** The owner's turn counter value at which it is due to end. Absent: until ended by hand. */
  dueTurn?:    number;
  /** Whether damage the target takes is added to `recordedDamage` (Death Mark). */
  records?:    boolean;
  recordedDamage?: number;
  /** The owner's turn counter value at which recording closes; damage after it is not added. Absent: records until the effect ends. The effect can be due later than this (Death Mark records to the start of the next turn and resolves at its end). */
  recordsUntilTurn?: number;
  note?:       string;
};

/** An aura of another character that this one is inside: the effects it gives, with the source's numbers already worked out. */
export type ReceivedAura = {
  sourceEntityId: string;
  sourceName:     string;
  featureId:      string;
  label:          string;
  effects:        Effect[];
};

/** A feature that is off until the creature's turn counter reaches `until`. */
export type FeatureSuspension = { featureId: string; until: number; reason?: string };

/** One hit this creature took: what actually landed after resistance, and on which of its own turns. */
export type DamageLogEntry = {
  /** The creature's own turn counter when it happened. */
  turn:    number;
  /** Damage dealt to it after resistance, vulnerability and flat reduction, including what temporary HP absorbed. */
  amount:  number;
  type?:   string;
  source?: string;
};

export type TurnState = {
  actionUsed:      boolean;
  bonusActionUsed: boolean;
  reactionUsed:    boolean;
  /** Further actions this turn, beyond the one `actionUsed` tracks (Action Surge: "take one additional action"). Absent = none. */
  extraActions?:   number;
};

/**
 * Extra Attack sequence closure (single-HIGH final closure): the engine-
 * owned, per-entity record of an IN-PROGRESS Attack action containing
 * multiple attacks (Extra Attack / Multiattack) — replaces the removed
 * `isChainedAttack?: boolean` escape hatch, which let any caller claim "this
 * is a chained attack" and bypass action economy with zero verification
 * (CALLER BOOLEAN ≠ AUTHORITY). This is the single source of truth
 * applyActionCardUse (actionUse.ts) consults to decide whether a given
 * attack is a legitimate continuation of an already-paid-for Attack action.
 *
 * Deliberately NOT a durable/persisted character fact — it exists only for
 * the duration of one Attack action and is cleared (`null`) the moment the
 * sequence closes (exhausted, or the player presses Done/Cancel) or a fresh
 * turn starts (startTurn, combat.ts, resets it alongside turnState). A
 * saved/reloaded character with a leftover non-null value here (e.g. the app
 * closed mid-sequence) is harmless: the next attempt to CONTINUE it either
 * matches (and simply resumes, still bounded by maxAttacks/usedAttacks) or
 * fails the actorId/sequenceId match and is treated as a fresh lead attack.
 *
 * `sequenceId` is an opaque, caller-supplied correlation token (see
 * AttackSequenceUse below) — it is NEVER trusted as authority on its own.
 * The only thing that grants a call "chained" status is an EXACT match
 * against THIS entity's OWN currently-stored AttackSequenceState, which the
 * caller cannot fabricate: a token that doesn't match `entity.attackSequence`
 * (because none exists yet, or it belongs to a different/closed sequence) is
 * always treated as an attempt to start a brand-new, independent lead attack
 * instead — which then pays its own Action normally, and is therefore
 * blocked by ordinary action economy if the Action was already spent this
 * turn. See applyActionCardUse's own doc comment for the full validation.
 */
export type AttackSequenceState = {
  sequenceId:  string;
  /** The Entity.id this sequence belongs to — re-checked on every
   *  continuation attempt so one entity's in-progress sequence can never be
   *  advanced by a call operating on a DIFFERENT entity, even one that
   *  somehow carries a matching sequenceId (Part F — sequence ownership). */
  actorId:     string;
  /** Snapshot of DerivedStats.attackActionAttacks at the moment the LEAD
   *  attack succeeded — the hard ceiling on how many attacks this sequence
   *  may ever execute, regardless of what a later call claims. */
  maxAttacks:  number;
  /** How many attacks (lead + chained) have successfully executed so far.
   *  Only incremented on a SUCCESSFUL attack — a rejected child (stale item,
   *  resource unavailable, incapacitated, wrong card kind, exhausted, etc.)
   *  never advances this (Part J — failure must not advance the count). */
  usedAttacks: number;
};

/**
 * The master entity. Characters, monsters, and NPCs all share this shape.
 *   conditions       = flat active condition list for UI rendering.
 *   conditionMonitor = full runtime state: exhaustion, flags, suppressions.
 *   dmOverrides      = DM stat overrides, applied LAST in recomputeDerived().
 *                      Entity base data is NEVER modified by overrides.
 *                      Cancel = set active:false, values restore automatically.
 *   wildShapeState   = Wild Shape override layer, same non-mutating philosophy
 *                      as dmOverrides — null when not transformed.
 */
export type Entity = {
  id:               string;
  /** The dependency lock (revision pinning, contract LIFE-004): what the character was resolved with, in the desktop app's format.
   *  Read and written through src/engine/ruleset/dnd5ePinning.ts; kept as it is by everything else. */
  pins?:            Record<string, unknown>;
  kind:             'character' | 'monster' | 'npc';
  identity:         Identity;
  stats:            AbilityScores;
  derived:          DerivedStats;
  skills:           SkillBlock;
  proficiencies:    ProficiencyBlock;
  resources:        ResourceBlock;
  spellcasting:     SpellcastingBlock | null;
  inventory:        InventoryBlock;
  conditions:       ActiveCondition[];
  conditionMonitor: ConditionMonitor;
  features:         FeatureInstance[];
  choices:          ChoiceState[];
  characterOverrides?: CharacterOverride[]; // character-owned replacements, before DM overrides
  dmOverrides:      DmOverride[];     // always [] for new entities
  wildShapeState:   WildShapeState | null;
  notes:            string;
  /**
   * The Exploration tab's own structured notes (scratch text + objectives/
   * npcs/clues/locations lists), as its own field — separate from `notes`
   * above, which is the Notes tab's own pure-JSON backstory/session/
   * personal-notes blob. Both tabs used to share the single `notes` field
   * with incompatible serialization schemes (a marker-delimited scheme
   * here, plain JSON there), so using both features on one character
   * silently corrupted and truncated the other's data (audit finding
   * NOTES-CORRUPT-1). Optional so an already-saved character with no
   * exploration notes yet parses fine — TabExploration.tsx's own parseNotes
   * falls back to reading the OLD marker-embedded format out of `notes`
   * for backward compatibility with characters saved before this field
   * existed, but never writes back there again once edited.
   */
  explorationNotes?: string;
  /**
   * Infusion ids (see src/content/infusions/index.ts) this entity currently
   * KNOWS — separate from which items are actually infused right now (that's
   * ItemInstance.infusedWith). Grows via 'infusion'-kind ChoiceDefinitions,
   * same shape as ASI's level-gated choice injection. Optional/defaults to
   * [] so existing saved entities parse unchanged.
   */
  knownInfusionIds?: string[];
  /**
   * Every action card (spells + activatable features + equipped-item
   * attacks) for this entity, computed once by recomputeDerived() —
   * the single choke point every mutation passes through — instead of
   * being regenerated by every consuming component on every render.
   * Optional/defaults to [] so existing saved entities parse unchanged;
   * recomputeDerived() always fills it in on the very next mutation.
   * See src/engine/actionCards.ts's generateAllActionCards().
   */
  actionCards?: ActionCard[];
  /**
   * Action-card ids (Feature.id, a spell id, or a synthetic card id like
   * 'unarmed_strike') the player has starred on the Actions tab, surfaced
   * in the Combat tab's FAVORITES section. Deliberately entity-level and
   * keyed by ActionCard.featureId, NOT stored on the Feature that (maybe)
   * backs the card — Feature.favoriteTag (below, now legacy/read-only for
   * pre-existing saves) only works for cards backed by a real Feature
   * object, which spell-based cards and synthetic cards like Unarmed
   * Strike never have, so favoriting them silently no-op'd. Optional/
   * defaults to [] so existing saved entities parse unchanged; a legacy
   * true Feature.favoriteTag is still honored for backward compat (see
   * TabActions.tsx's isFavoriteCard()) but new toggles only write here.
   */
  favoriteActionIds?: string[];
  /**
   * Which ruleset this character was created under. Undefined = the app's
   * original/default ruleset (5e — every character created before this
   * field existed, and every character created today, since 5.5e content
   * doesn't exist yet). Top-level on Entity rather than nested in Identity
   * because it governs which content pool the character draws from, more
   * fundamental than identity fields like race/class. See the ContentHeader
   * comment in primitives.ts.
   */
  rulesetId?: RulesetId;
  /** Optional named rule-profile overlay; rulesetId remains the base official ruleset. */
  customRuleProfileId?: string;
  /** Creation-only provenance persisted with drafts; totals derive from stats + active rules. */
  creationAbilityMode?: AbilityGenerationMode;
  /**
   * Action/bonus-action/reaction usage for the entity's current turn. Null
   * when not actively tracked (outside combat, or before the first
   * startTurn() call this session) — every consumer (isFeatureAvailable,
   * the Combat tab's pills) treats null as "don't gate/show anything",
   * same optional-overlay philosophy as wildShapeState. Optional/defaults
   * to undefined so existing saved entities parse unchanged.
   */
  turnState?: TurnState | null;
  /**
   * Extra Attack sequence closure: the currently in-progress Attack-action
   * sequence (Extra Attack/Multiattack), if any — see AttackSequenceState's
   * own doc comment for the full model. Null/undefined means "no sequence in
   * progress," true for every entity outside an active multi-attack Attack
   * action, including every character without Extra Attack at all.
   */
  attackSequence?: AttackSequenceState | null;
  /**
   * Item 9 (context-dependent/three-state mechanics) — the player/DM's
   * current answer to each situational fact a currently-held Effect asks
   * about (keyed by Effect.situational.id). Absent key = unanswered
   * (conservative default: the effect does not apply — see
   * Effect.situational's own doc comment). Optional/defaults to {} so
   * existing saved entities parse unchanged.
   */
  situationalAnswers?: Record<string, boolean>;
  /** The active mode of each feature that has modes (engine/featureModes.ts), keyed by feature id, or `instanceId/featureId` for an
   *  item's feature. Absent: the first mode. */
  featureModes?: Record<string, string>;
  /** Mode Group state by group id (engine/modes.ts). Absent for every character with no mode group. */
  modeState?: Record<string, ModeState>;
  weaponMastery?: { picks: string[] };
  /** Heroic Inspiration (2024): whether the character holds it. Never more than one; see engine/heroicInspiration.ts. */
  heroicInspiration?: boolean;
  /** Damage this creature took recently, oldest first and bounded. Answers "half the damage you took since your last turn". See engine/damageLog.ts. */
  damageLog?: DamageLogEntry[];
  /** How many of this creature's own turns have started (advanced by startTurn). Stamps the damage log. Absent = 0. */
  turnCounter?: number;
  /** Features switched off for a time ("if you suffer fire damage, you lose this until the end of your next turn"). See engine/suspension.ts. */
  suspensions?: FeatureSuspension[];
  /** The creature's turn counter when each rider was last used, for once-per-turn limits. */
  riderUse?: Record<string, number>;
  /** Effects this creature has put on other creatures (marks, accepted challenges). See engine/trackedEffects.ts. */
  trackedEffects?: TrackedEffect[];
  /** Features used whose outcome effects wait for the table to say what happened (engine/outcomes.ts). One entry per feature; a rest clears them. */
  pendingOutcomes?: PendingOutcome[];
  /** Auras of other party members this character has marked itself as being inside. See engine/auras.ts. */
  receivedAuras?: ReceivedAura[];
  /**
   * The content packs (ids and minimum versions) this character's class, species, background, feats, spells and items come from,
   * recorded when it is saved. Only ever added to, so removing a pack does not forget what the character was built from.
   * See content/requiredPacks.ts.
   */
  requiredPacks?: { id: string; minVersion?: string }[];
  /**
   * Item 13 (build comparison/checkpoints/loadouts) — named, saved
   * equipment + prepared-spell configurations a player can swap between
   * (e.g. "Dungeon Loadout" vs "Social Loadout"), applied via
   * engine/loadout.ts's applyLoadout(). Deliberately scoped smaller than
   * "checkpoints" (a full character snapshot with restore) or "build
   * comparison" (two hypothetical builds diffed side by side) — both
   * disclosed as separately-scoped, not built here; see loadout.ts's own
   * doc comment for the full reasoning. Optional/defaults to [] so
   * existing saved entities parse unchanged.
   */
  loadouts?: Loadout[];
  /** Deprecated migration evidence only. New recomputations never populate it. */
  effectGrantedProficiencies?: {
    skills: SkillName[]; tools: string[]; weapons: string[]; armor: string[];
    languages?: string[]; spells?: string[]; cantrips?: string[];
  };
  /**
   * Re-audit A01/A29 (minimum commit-safety fix, item 14): monotonically
   * incremented by characterStore.ts on every successfully-applied inbound
   * update (applyIncomingEntity). Purely a conflict-detection
   * signal — lets undo() notice "something else changed this character
   * (a restored backup, say) since this undo entry was
   * captured" instead of blindly restoring an obsolete snapshot over it.
   * NOT a full command/event log or CRDT — that's explicitly out of scope
   * for this pass. Optional/undefined on any entity created before this
   * field existed, or never mutated through the store yet; treated as 0.
   */
  revision?: number;
  /**
   * Closure pass 2 (source ownership): explicit, source-removable
   * proficiency/expertise/language grants — see EntitlementRecord's own doc
   * comment for the full model and what's deliberately NOT stored here
   * (effect-driven grants are derived from active source definitions). Authoritative for the categories it
   * covers; entity.proficiencies.{armor,weapons,tools,languages} and
   * entity.skills.skills[x].{trained,expertise} are DERIVED output,
   * rewritten from this array (unioned with the effect-derived set) on
   * every recomputeDerived pass — see deriveProficienciesFromEntitlements
   * in entitlements.ts. Optional/undefined on any entity created before
   * this field existed; migrateEntity() seeds it once from whatever flat
   * proficiencies/skills the entity already has, tagged sourceKind:'manual'
   * (a conservative migration — an untraceable historical entitlement is
   * treated as permanent, never silently dropped or guessed at).
   */
  entitlements?: EntitlementRecord[];
  /** Once initialized, entitlements and current source definitions are the
   * authoritative grant inputs. Flat proficiency/spell arrays are output only. */
  entitlementInputsVersion?: 1;
};

/**
 * Extra Attack sequence closure (two-issue final closure, Part B): the ONE
 * shared normalizer that strips runtime-only state which must NEVER survive
 * a durable boundary — today, just `attackSequence`. AttackSequenceState's
 * own doc comment (above) already documents it as transient/never-
 * persisted, but a plain Entity is serialized/deserialized generically
 * (SQLite row, portable export/import, backup), so without this
 * an in-progress sequence recorded at save time would come back unchanged
 * on load — a stale, already-paid-for Action-economy bypass a caller could
 * then "continue" with the old sequenceId after a reload.
 *
 * Defined here (types.ts), not combat.ts, specifically so db/entityRepo.ts's
 * own per-row read path (parseEntityRow — the single choke point behind
 * BOTH loadEntity and loadAllEntities/loadEntitiesByKind) can call it
 * without a circular import: combat.ts transitively imports DEFAULT_RULES
 * from store/characterStore.ts, which itself imports entityRepo.ts.
 * types.ts has no such dependency. combat.ts re-exports this for callers
 * that already import turn-economy helpers from there.
 *
 * Called at every durable ingress point a raw/deserialized Entity can enter
 * normal runtime through — entityRepo.ts's parseEntityRow (covers
 * characterStore.ts's boot-time loadCharacters AND any direct loadEntity/
 * loadAllEntities/loadEntitiesByKind caller), applyIncomingEntity (backup
 * restore — see app/backup.tsx), importCharacter, and portable character
 * import (characterPortable.ts) — mirroring the same set of call sites
 * hydrateLegacyItemInstanceIds (itemMechanics.ts) already uses for the
 * equivalent item-identity concern, rather than duplicating ad hoc
 * `{ attackSequence: null }` patches at each one individually.
 *
 * Deliberately narrower than startTurn's own reset (combat.ts): this must
 * run regardless of whether a turn is currently active (a save mid-turn,
 * mid-sequence, then reloaded), whereas startTurn only fires when a NEW turn
 * begins. `turnState` is intentionally left untouched — it has its own,
 * already-correct persistence semantics (a save mid-turn should still show
 * the same action-economy state on reload), and this closure is scoped to
 * `attackSequence` only.
 *
 * A no-op (returns the same reference) when there's nothing to strip,
 * matching this codebase's existing "avoid unnecessary object creation"
 * convention for hydration helpers (see hydrateItemFeatures,
 * characterStore.ts).
 */
export function stripTransientRuntimeState(entity: Entity): Entity {
  if (!entity.attackSequence) return entity;
  return { ...entity, attackSequence: null };
}

/** See Entity.loadouts' doc comment. `equippedItemIds`/`preparedSpellIds`
 *  are itemId/spellId lists, not full instance snapshots — applying a
 *  loadout moves matching items between carried/equipped and re-derives
 *  everything, rather than restoring stored feature/effect data that could
 *  drift from the item's actual current content definition. */
export type Loadout = {
  id:                string;
  name:              string;
  /** Definition ids of the items this loadout equips — kept for
   *  itemRepo.ensureLoaded()/display-name lookups and as the LEGACY
   *  targeting field for a loadout saved before `equippedItemInstanceIds`
   *  existed. Never the sole targeting key for a NEWLY captured loadout —
   *  see `equippedItemInstanceIds`'s own doc comment (item-identity
   *  closure, pass 2 finding E). */
  equippedItemIds:   string[];
  /**
   * Item-identity closure (pass 2, finding E): the OWNED ItemInstance ids
   * this loadout equips — captured alongside `equippedItemIds` above so a
   * loadout can distinguish which SPECIFIC copy of a duplicated stateful
   * item it wants equipped (two identical swords: Loadout 1 equips A,
   * Loadout 2 equips B). Optional so a loadout saved before this field
   * existed still parses; applyLoadout (loadout.ts) falls back to
   * itemId-only matching (first eligible instance — a loadout literally
   * cannot know which historical duplicate it meant) only when this is
   * absent. A loadout captured or re-saved under the current app always
   * populates it.
   */
  equippedItemInstanceIds?: string[];
  preparedSpellIds:  string[];
  createdAt:         number;
};

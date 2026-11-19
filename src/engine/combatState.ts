// ============================================================================
// FILE: src/engine/combatState.ts
// Reads of an entity's combat state that need nothing but the entity. They sit apart from combat.ts so the
// action cards can ask them without importing combat.ts, which itself rebuilds the cards.
// ============================================================================
import { Entity } from './types';

/** Whether the turn has no action left: its own is spent and nothing granted another (Action Surge). */
export function actionSpent(turn: NonNullable<Entity['turnState']>): boolean {
  return turn.actionUsed && !((turn.extraActions ?? 0) > 0);
}

/**
 * 2014 condition-mechanics closure, Part D: every standard condition whose
 * OWN RAW text either grants the Incapacitated condition outright, or is
 * itself defined as "the creature is incapacitated" — Paralyzed, Stunned,
 * and Petrified all read "A/An X creature is incapacitated..." — plus the
 * bare `incapacitated` condition itself (granted directly by some
 * spells/features with no separate named condition of their own — see
 * content/conditions/index.ts). `unconscious` was already checked here
 * before this closure (see isIncapacitated's own prior history); folded
 * into this one list instead of a separate special case so there is exactly
 * ONE authoritative set of "which condition ids block Actions/Reactions",
 * consulted by both isIncapacitated and incapacitationReason below.
 *
 * Ordered — incapacitationReason below returns the FIRST matching label, so
 * this also doubles as a fixed priority when more than one is active at
 * once (deterministic, not "whichever happened to be pushed last").
 */
const INCAPACITATING_CONDITION_IDS: readonly string[] = ['unconscious', 'paralyzed', 'stunned', 'petrified', 'incapacitated'];

/**
 * True if the entity is incapacitated for normal gameplay ActionCard use —
 * either currently at 0 HP, or carrying one of INCAPACITATING_CONDITION_IDS
 * above (independent of HP — e.g. Sleep, Hold Person, a Paralyzed monster at
 * full HP). Deliberately just these existing, authoritative pieces of
 * state — no new flag is introduced; `hp.current === 0` and `entity.conditions`
 * already exist and drive every other part of this app. isFeatureAvailable
 * (actionCards.ts) is the ONE place that consults this for normal-action
 * legality, mirroring isSpellPreparationLegal's own "one authoritative
 * check, used by both card generation and cast-time enforcement" pattern.
 *
 * `hp.maximum > 0` guards against an entity that has never actually been
 * initialized with real hit points (a bare fixture/placeholder — every real
 * character/monster gets a positive max HP immediately on creation) so a
 * freshly-created entity isn't treated as "at 0 HP" before it has any HP
 * concept at all.
 */
export function isIncapacitated(entity: Entity): boolean {
  return (entity.resources.hp.maximum > 0 && entity.resources.hp.current === 0)
    || entity.conditions.some(c => INCAPACITATING_CONDITION_IDS.includes(c.id));
}

/**
 * 2014 condition-mechanics closure: the human-readable reason string for
 * WHY isIncapacitated() is true right now — extracted so every caller (both
 * isFeatureAvailable and generateSpellCard's own separately-computed
 * statusReason, actionCards.ts) shows the actual active cause instead of
 * the old hardcoded "0 HP or else it must be Unconscious" binary guess,
 * which silently mislabeled a Paralyzed/Stunned/Petrified/plain-Incapacitated
 * creature at full HP as "Unconscious". 0 HP is checked first (unchanged
 * from before this closure — the common case), then each condition id in
 * INCAPACITATING_CONDITION_IDS's own fixed priority order. Only ever called
 * when isIncapacitated(entity) is already known true, so the final fallback
 * is unreachable in practice — present only so this always returns a string.
 */
export function incapacitationReason(entity: Entity): string {
  if (entity.resources.hp.maximum > 0 && entity.resources.hp.current === 0) return 'At 0 HP';
  const label: Record<string, string> = {
    unconscious: 'Unconscious', paralyzed: 'Paralyzed', stunned: 'Stunned',
    petrified: 'Petrified', incapacitated: 'Incapacitated',
  };
  for (const id of INCAPACITATING_CONDITION_IDS) {
    if (entity.conditions.some(c => c.id === id)) return label[id];
  }
  return 'Incapacitated';
}

/**
 * True once death-save failures have reached 3 — this engine has no
 * separate "dead" flag (see recordDeathSave's own doc comment). Unlike
 * isIncapacitated, this is a HARD blocker on normal ActionCard use: never
 * offered a Use Anyway override (C12) — a dead creature's own table-first
 * exception is Free Edit/a DM ruling, not a one-off per-action override.
 */
export function isDead(entity: Entity): boolean {
  return entity.resources.deathSaves.failures >= 3;
}

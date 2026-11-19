import type { Ability } from './primitives';

// ── 8. DM Override system ────────────────────────────────────────────────────

/**
 * DM overrides apply on top of fully-computed derived stats.
 * They NEVER modify entity.stats, entity.features, or any base data.
 * Cancelling: set active = false → recomputeDerived restores originals automatically.
 * Multiple overrides on the same stat all apply in order of appliedAt.
 *
 * Override targets are limited to scalar numeric fields in DerivedStats.
 * See DERIVED_NUMERIC_KEYS for the allowed set.
 * savingThrows individual values e.g. "savingThrows.str" are targeted as strings.
 */
export type DmOverrideTarget =
  | 'proficiencyBonus' | 'ac' | 'initiative' | 'speed'
  | 'passivePerception' | 'spellSaveDC' | 'spellAttackBonus'
  | `savingThrows.${Ability}`   // e.g. "savingThrows.str"
  | string;                     // custom homebrew stats

export type CharacterOverride = {
  id:string; entityId:string; stat:DmOverrideTarget; operation:'set'|'add'; value:number;
  label:string; active:boolean; appliedAt:number; cancelledAt:number|null;
};

export type DmOverride = {
  id:          string;
  campaignId:  string;
  entityId:    string;
  dmDeviceId:  string;

  /** Which derived stat is overridden. */
  stat:        DmOverrideTarget;
  operation:   'set' | 'add';
  value:       number;

  /**
   * Human-readable label shown in the audit trail and DM panel.
   * e.g. "Cursed by Artifact", "Encounter buff", "Bless (manual)"
   */
  label:       string;

  /** If true this override is applied in recomputeDerived. If false it is cancelled. */
  active:      boolean;
  appliedAt:   number;
  cancelledAt: number | null;

  /**
   * When to auto-expire:
   *   'manual'           = DM cancels explicitly
   *   'end_of_encounter' = cleared when DM ends the encounter
   *   'end_of_session'   = cleared on long rest
   */
  expiry: 'manual' | 'end_of_encounter' | 'end_of_session';
};

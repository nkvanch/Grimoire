import type { Ability, SkillName, AbilityUseKind } from './primitives';
import type { SenseType } from './entityRuntime';

// ── 5b. Homebrew draft-trait model ───────────────────────────────────────────
// The in-progress shape a single "trait" (racial trait, class/subclass feature)
// is authored in across every homebrew builder, before being compiled into a
// real Feature (+ possibly a ResourceGrant) by buildTraitFeature() in
// src/components/homebrew/TraitEditor.tsx. Lives here (not in that component
// file) so CharClass.levelFeatures — read by the plain-TS progression compiler
// in src/content/classes/progressions.ts — can reference it without a
// components → engine dependency.

export type TraitEffectKind =
  | 'none' | 'ability_score' | 'unarmored_defense' | 'ac_bonus' | 'skill_proficiency' | 'tool_proficiency'
  | 'advantage_disadvantage' | 'sense' | 'movement' | 'movement_condition'
  | 'damage_resistance' | 'damage_immunity' | 'damage_vulnerability'
  | 'spell_grant' | 'resource_ability'
  // Added for engine/editor parity (see docs/EFFECT_AUTHORING_PARITY.md):
  | 'stat_bonus' | 'gear_proficiency' | 'condition_immunity';

/** Stats the 'stat_bonus' kind can modify. Every one is honored by the pipeline (see traitCompiler's STAT_BONUS_TARGETS). */
export type StatBonusTarget =
  | 'speed' | 'initiative' | 'extra_attack' | 'spell_save_dc' | 'spell_attack_bonus'
  | 'passive_perception' | 'passive_investigation' | 'passive_insight' | 'saving_throw';

/** A bonus effect a trait attaches to the character's attacks or spells, as authored in a builder. Compiles to a Rider. */
export type DraftRider = {
  localId:   string;
  name:      string;
  on:        'weapon_attack' | 'cantrip' | 'spell' | 'spell_attack' | 'any_damage';
  /** Extra damage dice ("1d6"), blank for none. */
  dice:      string;
  damageType: string;
  note:      string;
  limit:     'once_per_turn' | 'none';
  /** A flag another ability sets that must be on, and one this clears. */
  requires:  string;
  clears:    string;
  /** Spend one use of this trait's own limited-use pool. */
  usesPool:  boolean;
};

export type DraftTrait = {
  localId:     string;
  name:        string;
  description: string;
  effectKind:  TraitEffectKind;
  // ability_score
  abilityTarget: Ability;
  abilityAmount: string;
  // unarmored_defense
  unarmoredBase:      string;
  unarmoredAbilities: Ability[];
  unarmoredCaps:      Partial<Record<Ability, string>>;
  /**
   * ac_bonus — a flat +N (or -N) AC modifier, stacking additively on top of
   * whatever sets the base (armor, Unarmored Defense, the 10+DEX fallback —
   * see pipeline.ts's acBonus/calculatedBaseAc split). Separate from
   * unarmored_defense because that kind REPLACES the base formula; this one
   * only ever adds to it, so it works for a feat/ring/racial trait granting
   * "+1 AC" regardless of what's providing the base.
   */
  acBonusAmount: string;
  // skill_proficiency
  skillTarget:    SkillName;
  skillExpertise: boolean;
  // tool_proficiency
  toolName: string;
  // advantage_disadvantage
  advDirection: 'advantage' | 'disadvantage';
  advTarget:    string;
  // sense
  senseType:  SenseType;
  senseRange: string;
  // movement
  moveType:  'fly' | 'swim' | 'climb' | 'burrow';
  moveRange: string;
  // movement_condition — immunity to specific conditions' speed-zeroing effect,
  // plus an explicitly-flavor-only note for movement rules the engine has no
  // hook for at all (e.g. difficult terrain — see traitCompiler.ts).
  moveCondTargets: string[];
  moveCondFlavor:  string;
  // damage_resistance / damage_immunity / damage_vulnerability
  damageType: string;
  // spell_grant — an at-will cantrip plus any number of level-gated leveled
  // spells, each independently resource-pool- or spell-slot-consuming.
  spellGrantCantripId: string;
  spellGrantAbility:   Ability;
  spellGrants: {
    localId:      string;
    spellId:      string;
    spellName:    string;
    // Derived from the real Spell's own castingTime when picked in the UI
    // (src/components/homebrew/TraitEditor.tsx) — kept here rather than
    // looked up inside buildTraitFeature() so src/content/traitCompiler.ts
    // never needs to import spell content (it's used by progressions.ts,
    // which must stay import-cycle-safe with the content layer).
    actionType:   'action' | 'bonus_action' | 'reaction';
    unlockLevel:  string;
    mode:         'resource' | 'slot';
    recharge:     'short_rest' | 'long_rest' | 'dawn' | 'monthly' | 'yearly' | 'other';
    rechargeOther: string;
    uses:         string;
    minSlotLevel: string;
  }[];
  // resource_ability (e.g. Chi Pulse: bonus action, 1/rest, heal)
  actionType:      'action' | 'bonus_action' | 'reaction' | 'other';
  actionTypeOther: string;
  recharge:        'short_rest' | 'long_rest' | 'dawn' | 'monthly' | 'yearly' | 'other';
  rechargeOther:   string;
  uses:            string;
  healDice:        string;
  /**
   * Layers a limited-use counter (max uses + recharge, same shape as
   * resource_ability's) on top of ANY effectKind — e.g. a "3/short rest"
   * damage-resistance trait, or Monk's Opportunist (a plain reaction with
   * no coded effect of its own, kind 'none', but still a tracked once-able
   * reaction). Reuses actionType/actionTypeOther/recharge/rechargeOther/uses
   * above rather than duplicating fields — no conflict, since resource_ability
   * and spell_grant already fully own their own resource wiring and ignore
   * this flag (see buildTraitFeature in traitCompiler.ts).
   */
  limitedUse: boolean;
  // stat_bonus: a modifier to speed / initiative / extra attacks / spell DC / spell attack / passive senses / saves.
  statTarget?:      StatBonusTarget;
  /** For statTarget 'saving_throw': which save (or all six). */
  statSaveAbility?: Ability | 'all';
  statOperation?:   'add' | 'set' | 'scale';
  statAmount?:      string;
  // gear_proficiency: a weapon or armor proficiency.
  gearKind?:        'weapon' | 'armor';
  gearName?:        string;
  // condition_immunity: cannot be affected by this condition.
  conditionImmunityTarget?: string;
  // Saving-throw DC for an ability that forces a save (limited-use abilities). See traitCompiler's buildRequiresSave.
  saveEnabled?:     boolean;
  saveAbility?:     Ability;
  /** 'ability' scales with the character (8 + proficiency + that ability's modifier); 'spell' = their spell save DC; 'fixed' = a set number. */
  saveDcMode?:      'ability' | 'spell' | 'fixed';
  saveDcAbility?:   Ability;
  saveDcFixed?:     string;
  // ── Advanced: timing, riders, per-target effects, auras (all optional; absent = none) ───────────────────────────
  /** Bonus effects attached to attacks and spells. */
  riders?:            DraftRider[];
  /** Switch this trait off when the character takes this damage type, until the end of this or the next turn. */
  suspendDamageType?: string;
  suspendUntil?:      'end_of_this_turn' | 'end_of_next_turn';
  /** The ability also uses up this other action-economy slot. */
  alsoCosts?:         'bonus_action' | 'action';
  /** Card effect: temporary hit points, dice may use PB ("PBd6"). */
  tempHpDice?:        string;
  /** Card effect: heal this fraction (0.5, 1) of the damage taken since the start of the turn `healFromDamageTurnsBack` turns ago. */
  healFromDamageFraction?:  string;
  healFromDamageTurnsBack?: string;
  /** Card effect: put a named effect on a target (a mark, a challenge). */
  trackEffectName?:   string;
  trackRecords?:      boolean;
  trackUntil?:        'none' | 'end_of_this_turn' | 'end_of_next_turn';
  /** When the damage it adds up stops being counted, if earlier than it ends (Death Mark counts to the start of the next turn). */
  trackRecordUntil?:  'none' | 'end_of_this_turn' | 'end_of_next_turn';
  /** Aura: a benefit others get while inside it (the table decides who is). */
  auraEnabled?:       boolean;
  auraLabel?:         string;
  auraRange?:         string;
  auraAffects?:       'allies' | 'allies_and_self' | 'enemies';
  auraStat?:          'ac' | 'saves' | 'speed' | 'initiative' | 'resistance';
  auraAmount?:        string;
  auraAddAbility?:    Ability | '';
  auraResistType?:    string;
  /** Derived-stat rules. */
  armorDexCap?:       boolean;
  critImmune?:        boolean;
  critRange?:         string;
  /** AC and speed bonuses this trait gives still apply in a Wild Shape form. */
  appliesInBeastForm?: boolean;
  /** "Use Charisma instead of Strength for ...": the ability replaced, the one used, and which rolls. */
  substituteFrom?:    Ability | '';
  substituteTo?:      Ability | '';
  substituteFor?:     AbilityUseKind[];
  /** Card effect: a movement speed for a while (a fly speed for a minute). */
  grantSpeedType?:    'fly' | 'swim' | 'climb' | 'walk' | '';
  grantSpeedAmount?:  string;
  grantSpeedUnit?:    'rounds' | 'minutes' | 'hours' | 'until_rest';
  grantSpeedFor?:     string;
  /** What the table confirms after using it: on this outcome the trait's own pool regains uses. */
  outcomeOn?:         'none' | 'hit' | 'miss' | 'success' | 'failure';
  outcomeRegain?:     string;
  infusionBonus?:     string;
  /** A card with nothing to track: usable as an action, bonus action or reaction (see actionType) without limit, like Cunning Action. */
  atWill?:            boolean;
  /**
   * Spend from a resource that already exists (a class's Ki, Wild Shape, Rage ...) instead of a pool of this trait's own.
   * Either the resource's id, or `local:<localId of another trait>` for a pool another trait in the same build creates.
   */
  spendsResourceId?:  string;
  /** How much of that resource one use spends (default 1). */
  spendsQuantity?:    string;
  /** This trait's own pool starts at `uses`, then follows the proficiency bonus, an ability modifier, or level × usesPerLevel. */
  usesScaling?:       'none' | 'proficiency' | 'ability' | 'level';
  usesScalingAbility?: Ability;
  usesPerLevel?:      string;
  /** At this trait's level, raise an existing resource's maximum to this number (Superiority Dice 4 → 5 at 7th level). Class and subclass features only. */
  raiseResourceId?:   string;
  raiseResourceTo?:   string;
  /**
   * Set ONLY when a builder hydrates a saved/imported (already-compiled) feature it cannot turn back into an
   * editable effect kind: a one-line summary of the mechanics the compiled feature really carries (see
   * content/featureMechanics.ts). Display-only — it lets the trait row say what the trait does instead of
   * "Flavor only", and tells the save path the mechanics must be kept. Never persisted by the compiler.
   */
  mechanicsSummary?: string;
};

import type { Ability, AbilityUseKind, Action } from './primitives';
import type { FeatureActivation, ActionCardTag, AbilityEffect, OutcomeMap, Rider } from './actionCard';
import type { ResourceGrant } from './leveling';
import type { ChoiceDefinition } from './choices';
import type { SenseType } from './entityRuntime';

// ── 5. Feature & passive Effect system ──────────────────────────────────────

/**
 * FeatureSource.kind includes 'subclass' which must propagate to AuditEntry.sourceKind
 * (see section 9) to prevent type errors when audit.ts reads fi.source.kind.
 */
export type FeatureSource = {
  kind:  'race' | 'class' | 'subclass' | 'background' | 'feat'
       | 'item' | 'spell' | 'condition' | 'campaign' | 'manual';
  // refId stays plain `string`, not branded — the concrete content type it
  // references (RaceId/ClassId/SpellId/...) depends on the sibling `kind`
  // field, so a single branded type here would be wrong for most `kind`
  // values, and a union would force a `kind`-narrowing cast at every read
  // site for no near-term payoff. See the Brand<> comment in
  // primitives.ts.
  refId: string;
};

/**
 * Passive effects. These fire inside recomputeDerived().
 * They modify stats, grant proficiencies, apply conditions, etc.
 * For active (on-use) effects see AbilityEffect in section 10.
 */
export type Effect = {
  type:      'stat_modifier' | 'grant_proficiency' | 'grant_resistance' | 'grant_immunity'
           | 'apply_condition' | 'grant_resource' | 'override_rule' | 'base_ac_formula'
           | 'suppress_condition_effects' | 'condition_immunity'
           // Grants spells/cantrips to known spell list; safe on racial features
           // (initialises spellcasting if not yet active).
           | 'grant_spell'
           // Grants a special sense (darkvision/blindsight/tremorsense/truesight).
           // Aggregated into derived.senses; same type keeps the largest range.
           | 'grant_sense'
           // Grants a non-walking movement speed (fly/swim/climb/burrow).
           // Aggregated into derived.movement; same type keeps the largest value.
           | 'grant_movement'
           // "Use your Charisma modifier instead of Strength for ...": see AbilityUseKind and applyAbilitySubstitutions (pipeline.ts).
           | 'ability_substitute';
  target:    string;
  operation: 'add' | 'multiply' | 'set' | 'advantage' | 'disadvantage'
           | 'resistance' | 'immunity' | 'vulnerability' | 'suppress'
           /**
            * 'scale' — multiply the FULLY RESOLVED stat ("double your speed", "halve your
            * initiative"). Deliberately separate from 'multiply', which the resolver has always
            * applied to the accumulated bonus pool of that target (and which a locked-in audit
            * test documents, and which expertise markers reuse). Applied last, after every
            * set/add, floored to a whole number; several scales multiply together in any order.
            * Supported on ability scores, speed, initiative and AC. See resolver.ts's
            * resolveScaleFactor.
            */
           | 'scale';
  value:     number | string | string[] | null;
  condition: string | null;
  /**
   * Item 9 (context-dependent/three-state mechanics): distinct from
   * `condition` above, which gates on state the ENGINE already tracks
   * (an active flag/condition id). `situational` marks an effect whose
   * applicability depends on a real-world fact the app has no way to
   * observe (positioning, "an ally within 5 feet", "if this is the first
   * attack this turn") — e.g. Pack Tactics. Three real states: unanswered
   * (id absent from Entity.situationalAnswers — conservative default,
   * treated as "No" so a bonus is never silently overstated), explicit
   * Yes (`situationalAnswers[id] === true`), explicit No (`=== false`).
   * See collectAllEffects' gating and TabFeatures.tsx's "Situational
   * Effects" toggle list, the one UI that writes to
   * Entity.situationalAnswers. `id` should be stable/shared across
   * entities carrying the same content (e.g. every Wolf's Pack Tactics
   * uses the same id) so the question only needs answering once per
   * genuinely distinct fact, not once per feature instance.
   */
  situational?: { id: string; question: string } | null;
  /**
   * Re-audit A19: gates an item-sourced effect on "no OTHER currently
   * equipped item is armor or a shield" — the real equipment predicate
   * Bracers of Defense's own RAW text requires ("+2 AC while you are
   * wearing no armor and using no shield") but had no enforcement
   * mechanism at all before this field. Checked against each OTHER
   * equipped ItemInstance's hydrated `wearsArmorOrShield` flag (set once
   * at equip time — see ItemInstance's own doc comment) — deliberately
   * NOT reusing `condition` above, which gates on a REQUIRED active flag/
   * condition, the opposite polarity from this ("requires the ABSENCE of
   * armor/shield"). Optional; absent/false means "no such restriction",
   * unaffected — every existing effect keeps working exactly as before.
   */
  requiresNoArmorOrShield?: boolean;
  formulaAbilities?: Ability[];
  /**
   * "Add your Charisma modifier to X": on a numeric `add` stat_modifier, this ability's final
   * modifier is added to `value` (which may be 0/omitted) when derived stats are computed.
   */
  addAbilityModifier?: Ability;
  /** "Add your proficiency bonus": PB is added to this effect's numeric `value` (Alert's initiative). */
  addProficiencyBonus?: boolean;
  /** The effect does nothing until the character reaches this level (Nature's Ward's resistance at 10). Works on any feature's effect. */
  minLevel?: number;
  /**
   * While in a Wild Shape form the beast's own AC and speed replace yours, and ordinary bonuses stop. An effect with this set still applies
   * on top of the form ("these benefits apply to your normal form and your wild shapes"). Only AC and speed bonuses are read.
   */
  appliesInBeastForm?: boolean;
  /** "...and again whenever you gain a level": this many points per CHARACTER level are added to `value` (Dwarven Toughness: 1). */
  addPerLevel?: number;
  /**
   * On a `set` of an ability score: a floor ("becomes 24 if lower", "rise to at least 22") applied
   * after every other effect, so it can raise the score but never lower a higher one.
   */
  atLeast?: boolean;
  // ── ability_substitute-specific fields ────────────────────────────────────────
  /** The ability whose modifier is replaced, the one used in its place, and which rolls it applies to. The better of the two scores is used (nobody chooses the worse). */
  substituteFrom?: Ability;
  substituteTo?:   Ability;
  substituteFor?:  AbilityUseKind[];
  /**
   * Per-ability cap applied AFTER the modifier is computed, for medium armor.
   * e.g. { dex: 2 } means "add DEX modifier but cap it at +2".
   * Only meaningful when the ability appears in formulaAbilities.
   */
  formulaAbilityCap?: Partial<Record<Ability, number>>;
  // ── grant_spell-specific fields ───────────────────────────────────
  cantripIds?:         string[];
  spellIds?:           string[];
  spellcastingAbility?: Ability;
  /** The choice that picks the ability instead (see grantedSpellAbility.ts); `spellcastingAbility` is the default until it is made. */
  spellcastingAbilityFrom?: string;
  // ── grant_sense-specific fields ───────────────────────────────────
  senseType?:  SenseType;
  senseRange?: number;
  senseNote?:  string;
  // ── grant_movement-specific fields ───────────────────────────────────────────
  movementType?:  'fly' | 'swim' | 'climb' | 'burrow';
  /** Feet. With `movementEqualsSpeed` it is an addition to the Speed (0/absent = exactly the Speed). */
  movementRange?: number;
  /** "A Climb/Swim/Fly Speed equal to your Speed": the range is the character's final walking Speed. */
  movementEqualsSpeed?: boolean;
};

/**
 * A Feature is the universal rule container.
 * Everything in the system grants features: races, classes, backgrounds,
 * items, spells, conditions, and homebrew content.
 *
 * PASSIVE features: have effects[] that fire in recomputeDerived().
 * ACTIVE features:  also have activation + abilityEffects that fire when a card is used.
 * Both can coexist — Rage has passive resistance effects AND active "set flag" effects.
 */
/** One mode of a feature: its name and the effects that apply while it is the active one. */
export type FeatureMode = { id: string; name: string; effects: Effect[] };

export type Feature = {
  id:          string;
  name:        string;
  description: string;
  source:      FeatureSource;
  level:       number | null;
  /** Passive effects — fire in recomputeDerived(). Do not put combat dice here. */
  effects:     Effect[];
  /** Modes the person switches between (a belt that sometimes works the other way round). The active mode's effects apply on top of
   *  `effects`; the first mode is active until another is chosen. See engine/featureModes.ts. */
  modes?:      FeatureMode[];
  actions:     Action[];
  choices:     ChoiceDefinition[];
  /**
   * Choices opened when this feature is granted (a Fighting Style option that lets you learn two Cleric cantrips,
   * Pact of the Tome's cantrips and rituals). Queued once, namespaced to this feature id, and taken back out with it
   * (removeFeature already strips unresolved choices and revokes resolved ones namespaced `${featureId}:`).
   */
  grantsChoices?: ChoiceDefinition[];
  passive:     boolean;

  // ── Active ability fields (optional — undefined = passive feature, no card generated) ──
  /** How this ability is activated. null/undefined = passive, no Action Card generated. */
  activation?:    FeatureActivation;
  /** Classification tags used by the card generator. */
  tags?:          ActionCardTag[];
  /** Active effects that fire when the player uses this ability (NOT in recomputeDerived). */
  abilityEffects?: AbilityEffect[];
  /**
   * Purely descriptive outcome-branch text ("on hit, you also...") — never
   * auto-applied. See OutcomeMap's doc comment. Sibling to abilityEffects
   * (same category: consequences), not nested inside activation (which
   * stays about cost/target/range/save-DC).
   */
  outcomes?: OutcomeMap;
  /**
   * Short, human-readable description of the triggering moment — "Once per
   * turn, when you hit with a weapon attack and have advantage..." for
   * Sneak Attack. Purely descriptive, independent of `activation` (works
   * with or without one): a feature with both gets one extra note line on
   * its action card; a feature with `trigger` but no `activation` (Sneak
   * Attack itself — passive:true, no activation at all) is never given a
   * synthesized fake activation just to be describable — it surfaces
   * instead in TabActions.tsx's TriggeredFeaturesSection, a reference list
   * alongside the existing UniversalActionsSection.
   */
  trigger?: string;
  /**
   * Limited-use pools this feature brings with it (Weight of Authority's reroll uses). Granted by
   * leveling.ts's applyGrant 'feature' case, tagged sourceKind 'feature' + this feature's id, so
   * removeFeature's existing resource cleanup removes them with the feature. Features that pair a
   * separate `resource` grant (every class-progression feature) simply leave this unset.
   */
  resources?: ResourceGrant[];
  /**
   * This feature switches off when the creature takes damage of this type, until the end of this turn or of its next turn
   * (Tree Biology: "if you suffer fire damage, you lose your ability from this feature until the end of your next turn").
   */
  suspendOn?: { damageType: string; until: 'end_of_this_turn' | 'end_of_next_turn' };
  /** Bonus effects this feature adds to attacks and spells ("when you hit, also..."). See engine/riders.ts. */
  riders?: Rider[];
  /**
   * An aura: effects that benefit others. Who is inside it is the table's call (no range is modelled); a player marks themselves as
   * inside and the effects apply to them. See engine/auras.ts. Effects may use addAbilityModifier or addProficiencyBonus, which are
   * worked out from the SOURCE character when the aura is offered.
   */
  aura?: { label?: string; range?: string; affects: 'allies' | 'allies_and_self' | 'enemies'; effects: Effect[] };
  /**
   * Marks this feature as one tier of an upgradeable reward (a DM-granted mid-campaign feature):
   * granting a higher tier of the same `trackId` REPLACES every lower-tier feature of that track
   * instead of stacking with it. See engine/rewardTracks.ts.
   */
  rewardTrack?: { trackId: string; tier: number; trackName: string };
  /**
   * Id of an earlier feature this one REPLACES when granted: the old feature object is removed first
   * so no stale duplicate lingers ("a weapon die becomes 6d6", "a class die becomes a d8").
   * Resource pools are not touched — they are granted separately and keep their spent state.
   */
  upgradeOf?: string;
  /** Player-set: marks this feature as exploration-relevant for the Exploration view filter. */
  explorationTag?: boolean;
  /**
   * LEGACY — superseded by Entity.favoriteActionIds (see its doc comment),
   * which correctly covers spell-based and synthetic action cards this
   * field never could. Kept read-only for backward compat with characters
   * saved before that field existed; new favorite toggles no longer write
   * here (see TabActions.tsx's toggleFavoriteTag()).
   */
  favoriteTag?: boolean;
};

/** Feature with a runtime isActive flag for toggled abilities (Rage, Wild Shape, etc.). */
export type FeatureInstance = Feature & {
  isActive: boolean;
};

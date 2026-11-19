import type { Ability, DamageDieRule } from './primitives';
import type { DurationTracker } from './conditions';
import type { SpellCastingContext } from './entityRuntime';

// ── 10. Action card system ───────────────────────────────────────────────────

/**
 * How an active ability is used.
 * If activation is null/undefined on a Feature, no Action Card is generated.
 */
export type FeatureActivation = {
  actionType:   'action' | 'bonus_action' | 'reaction' | 'free' | 'passive';
  resourceCost: ResourceCost | null;
  range:        string | null;   // "self", "30 feet", "touch", etc.
  target:       'self' | 'single' | 'area' | 'multiple';
  /**
   * 'ki_save_dc' parallels 'spell_save_dc' for Monk's ki-fueled abilities
   * (Stunning Strike, etc.) — Monk has no entity.spellcasting block, so
   * spellSaveDC stays null for it; kiSaveDC (DerivedStats) is the separate,
   * always-WIS-based formula those features need instead.
   * `{ ability }` is the generic version of the same idea for every OTHER
   * non-caster class-feature DC (Barbarian's Intimidating Presence is STR,
   * etc.) — DerivedStats.abilityBasedDC precomputes 8 + prof + mod for all
   * six abilities so any such feature can reference the right one without
   * needing its own bespoke DerivedStats field like kiSaveDC got first.
   */
  requiresSave: { ability: Ability; dc: 'spell_save_dc' | 'ki_save_dc' | { ability: Ability } | number } | null;
  /** The ability also uses up this other slot ("by using both your action and bonus action"). Both must be free to use it. */
  alsoCosts?: 'action' | 'bonus_action';
  options?: ActivationOption[];
  /**
   * The 2014 Druid's Wild Shape: the use-picker lists the Beast forms this character's Druid level (and Circle) allows, built when
   * the card is shown (engine/wildShapeForms.ts), so there is one card instead of one per beast.
   */
  beastFormPicker?: boolean;
};

/**
 * Extra Attack sequence closure: the caller's request to treat one weapon-
 * attack use as part of an Attack-action sequence (Extra Attack/Multiattack)
 * — see AttackSequenceState's own doc comment (section 3, above) for the
 * full authority model this replaces the old, unconstrained
 * `isChainedAttack: true` boolean with. `sequenceId` is generated ONCE by
 * the application/UI layer when it opens the FIRST attack chooser (any
 * opaque unique string — e.g. a uuid, or `${Date.now()}-${Math.random()}`)
 * and passed unchanged on every subsequent attack of that same sequence.
 * Passing this on the first attack of a fresh sequence (entity.attackSequence
 * is null, or doesn't match) is always safe — it behaves EXACTLY like an
 * ordinary single attack (same cost, same action-economy spend) and only
 * additionally marks entity.attackSequence for potential continuation on
 * success. Only a call whose sequenceId matches an entity's OWN currently-
 * active AttackSequenceState is ever treated as a bypass-eligible
 * continuation — see applyActionCardUse (actionUse.ts). Omitted entirely
 * (undefined) for every ordinary, non-Attack-action card use.
 */
export type AttackSequenceUse = {
  sequenceId: string;
};

export type ActivationOption = {
  id:            string;
  label:         string;         // e.g. "2nd-level slot"
  resourceCost?: ResourceCost;
  description?:  string;         // e.g. "+3d8 radiant damage"
  /** Choosing this option transforms into this Beast form (Wild Shape), revalidated against the character when it is used. */
  transformFormId?: string;
};

/** Describes what resource(s) an ability consumes when used. */
export type ResourceCost = {
  /** ID from CustomResource or "spell_slots". */
  resourceId:     string;
  quantity:       number;
  /** For spell slots: minimum tier required (1–9). */
  spellSlotTier?: 1|2|3|4|5|6|7|8|9;
};

/**
 * Active effects fire when a player uses an ability (taps the action card).
 * These do NOT fire in recomputeDerived — that is the passive Effect system.
 * Phase 2 (option A): app shows dice expression, player announces it. No target selection.
 *
 * This variant's id fields (conditionId/resourceId/formId) are left plain
 * `string`, not branded, for now — out of scope for the initial branded-id
 * pass (see the Brand<> comment in primitives.ts); resourceId in
 * particular is often a runtime/grant-authored id rather than a global
 * content-registry id, so it doesn't map cleanly onto one branded type.
 */
export type AbilityEffect =
  | { type: 'damage';           dice: string; damageType: string; saveOnSuccess?: 'half' | 'none';
      /** Scaling dice by character level (Dragonborn's Breath Weapon: 1d10, 2d10 at 5, 3d10 at 11, 4d10 at 17): the
       *  highest tier at or below the character's level replaces `dice` when the card is shown. */
      diceByLevel?: { level: number; dice: string }[] }
  | { type: 'heal';             dice: string; bonusMod?: Ability }
  | { type: 'apply_condition';  conditionId: string; duration: DurationTracker }
  | { type: 'remove_condition'; conditionId: string }
  | { type: 'grant_speed';      speedType: 'fly' | 'swim' | 'climb' | 'walk'; amount: number; duration: DurationTracker }
  | { type: 'transform';        formId: string }
  | { type: 'set_flag';         flag: string; value: boolean }
  | { type: 'spend_resource';   resourceId: string; amount: number }
  | { type: 'restore_resource'; resourceId: string; amount: number | 'full' }
  /** Temporary hit points the ability grants. `dice` may use PB for the proficiency bonus ("PBd6", "PB"). Shown on the card; the player rolls and enters the result (rolls are optional, never mandatory). */
  | { type: 'temp_hp'; dice: string }
  /** Healing equal to a fraction of the damage this creature took since the start of its turn `turnsBack` turns ago (Reformation: 0.5, 1). Deterministic, so it is applied when the card is used. */
  | { type: 'heal_from_damage_taken'; fraction: number; turnsBack: number }
  /** Starts a tracked effect on a target the player names afterwards (a mark, a challenge). */
  | { type: 'track_effect'; name: string; until?: 'end_of_this_turn' | 'end_of_next_turn'; records?: boolean; recordUntil?: 'end_of_this_turn' | 'end_of_next_turn'; visibility?: 'owner' | 'party' | 'dm'; note?: string }
  /** Casts a known spell by id, spending whatever this Feature's own
   * activation.resourceCost specifies (a dedicated pool OR a real spell
   * slot) — NOT entity.spellcasting.known's normal slot-consumption path.
   * See traitCompiler.ts's spell_grant effect kind. */
  | { type: 'cast_spell';       spellId: string };

/**
 * Purely descriptive outcome-branch data for an activated ability — "what
 * happens on a hit/miss/success/failure," for the player to read and
 * self-resolve. NEVER auto-applied: this app shows the dice expression and
 * lets the player announce/apply the result themselves (see AbilityEffect's
 * own doc comment), and outcomes follow the exact same philosophy. `effects`
 * reuses AbilityEffect only for the shape the action-card renderer already
 * knows how to summarize (set_flag, restore_resource, transform); anything
 * else — a compound or free-form consequence — goes in `description`
 * instead of forcing a new AbilityEffect variant to exist just to be
 * describable.
 */
export type OutcomeKey = 'hit' | 'miss' | 'success' | 'failure';
export type ActivationOutcome = { description?: string; effects?: AbilityEffect[] };
export type OutcomeMap = Partial<Record<OutcomeKey, ActivationOutcome>>;

/** Tags used to classify a feature and choose its card type. */
export type ActionCardTag =
  | 'damage' | 'healing' | 'buff' | 'control' | 'utility'
  | 'movement' | 'aoe' | 'concentration' | 'save' | 'attack' | 'transformation';

/** One of 6 card types. Determines card color and template. */
export type ActionCardType = 'damage' | 'healing' | 'buff' | 'control' | 'utility' | 'transformation';

/** Color of an action card in the UI. */
export type ActionCardColor = 'red' | 'green' | 'blue' | 'purple' | 'gray';

/**
 * The compiled, UI-ready representation of a Feature for the Actions tab.
 * Generated by generateActionCards() in actionCards.ts.
 * The same feature may appear in multiple tabs (same card, different context).
 */
export type ActionCard = {
  featureId:  string;
  name:       string;
  cardType:   ActionCardType;
  color:      ActionCardColor;

  /** Layer 1: source and type  e.g. "Lv 3 Spell • Damage" */
  layer1: string;
  /** Layer 2: key effect       e.g. "8d6 Fire • 20 ft radius" */
  layer2: string;
  /** Layer 3: save/attack/note e.g. "Dex Save (half)" — null if not needed */
  layer3: string | null;
  /** One rendered line per populated OutcomeMap entry, e.g. "On hit: ...".
   *  Empty when the source Feature has no `outcomes`. Purely descriptive —
   *  see OutcomeMap's own doc comment. */
  outcomes: string[];
  /** The source Feature's `trigger` text, verbatim — null when it has none
   *  (or has one but no `activation`, in which case it never gets a card
   *  at all; see TriggeredFeaturesSection instead). Purely descriptive. */
  triggerNote: string | null;

  activation:   FeatureActivation;
  resourceCost: ResourceCost | null;

  /** Which sheet tabs this card appears in. Same feature, multiple contexts. */
  tabs: ('actions' | 'spellcasting' | 'features' | 'inventory')[];

  /** Runtime — recomputed on every render. Greyed-out when unavailable. */
  available:         boolean;
  /** e.g. "No 3rd-level spell slots remaining", "Already concentrating" */
  unavailableReason: string | null;
  /**
   * Rules-engine blocker fix (prepared-spell eligibility): true ONLY for a
   * leveled spell card whose entire unavailability is that it isn't
   * prepared — every other legality/cost check (slot availability, action
   * economy, resource cost) already passed. The UI uses this to offer a
   * table-first "Cast Anyway" Quick Override on top of the normal disabled
   * state, instead of requiring Free Edit to force a one-off exception.
   * false/undefined for every non-spell card, every cantrip, and a spell
   * blocked by anything else (or nothing) — see isSpellPreparationLegal's
   * own doc comment (actionCards.ts) for the exact source-aware policy.
   * Optional so the many non-spell ActionCard literals throughout this file
   * don't all need to set it explicitly.
   */
  preparationOverridable?: boolean;
  /**
   * Rules-engine HIGH-batch closure (C): true ONLY when the entity is
   * incapacitated (0 HP or the explicit Unconscious condition — see
   * isIncapacitated, combat.ts) AND that status is the card's ENTIRE
   * remaining unavailability — every other legality check (resource cost,
   * action economy, and for a spell card, preparation) already passed. The
   * UI offers a table-first "Use Anyway" Quick Override on top of the
   * normal disabled state when this is true, mirroring
   * preparationOverridable's own pattern exactly. false/undefined for a
   * healthy entity, a Dead entity (hard blocker, never overridable — see
   * isDead's own doc comment), or a card blocked by anything else.
   */
  incapacitatedOverridable?: boolean;
  /**
   * Rules-engine blocker closure (1B — ActionCard must preserve context):
   * the SpellCastingContext this card was generated to represent — the
   * default/primary one when several exist (see spellCastingContexts
   * below). Undefined for every non-spell card. applyActionCardUse
   * revalidates THIS EXACT context (by contextKey) fresh at execution time
   * rather than silently re-resolving a possibly-different source — if the
   * selected context no longer exists among the entity's current sources,
   * execution fails safely rather than switching source.
   */
  spellCastingContext?: SpellCastingContext;
  /**
   * Every MECHANICALLY DISTINCT candidate context for this spell (collapsed
   * — two contexts with the same ability/policy/legality count as one),
   * only populated (length > 1) when the player actually has a real choice
   * to make (e.g. a Wizard/Sorcerer character's shared spell). The UI shows
   * a "Cast as..." chooser when this has more than one entry; a single-
   * entry or absent array means there's nothing to choose between, so the
   * normal single-tap Cast/Cast-Anyway flow applies unchanged.
   */
  spellCastingContexts?: SpellCastingContext[];
  /**
   * Item-identity closure (pass 2, finding D): when this card was generated
   * from an authored Feature living on a SPECIFIC equipped ItemInstance
   * (not a class/race/feat Feature on entity.features), `sourceKind:'item'`
   * + `sourceId: <that ItemInstance.id>` records exactly which owned copy
   * it came from — `featureId` above stays the plain Feature.id (shared by
   * every instance of the same ItemDefinition, since two identical items
   * carry the identical authored feature), so content/definition lookups by
   * featureId are unaffected. applyActionCardUse (actionUse.ts) revalidates
   * `sourceId` is STILL an equipped instance before executing, and resolves
   * the feature from THAT instance alone — never a flat search across every
   * equipped item's features, which would silently execute a stale card
   * (its instance already removed/unequipped) against an identical
   * remaining copy instead of rejecting it. undefined for every non-item
   * card, and for a card generated before this fix existed (legacy
   * fallback: the old flat-search behavior, unchanged).
   */
  sourceKind?: 'item';
  sourceId?:   string;
  /**
   * Rules-completeness batch (ritual casting): true when this is a spell
   * card AND the spell is ritual-tagged (Spell.ritual) AND at least one of
   * this card's candidate SpellCastingContexts has ritualEligible === true
   * (see that field's own doc comment). Undefined for every non-spell card
   * and every spell that isn't ritual-capable through any source the
   * character currently has. Purely a "should the UI offer a Cast-Normally-
   * vs-Cast-as-Ritual choice at all" signal generated against the BEST-
   * EFFORT/default context; applyActionCardUse revalidates the SPECIFIC
   * selected context's own ritualEligible flag fresh at execution time
   * (never trusts this precomputed card-level flag alone), so a card that
   * over-offers ritual mode for a context that turns out not to support it
   * fails safely at execution rather than casting for free.
   */
  ritualEligible?: boolean;
  /**
   * Extra Attack / action-structure batch: true only for a card that
   * represents an actual weapon-or-unarmed ATTACK usable with the Attack
   * action — the synthetic basic-weapon-attack card, the synthetic Unarmed
   * Strike card, and an equipped item's own authored attack feature (a
   * `damage`-type abilityEffect) WHEN that item is itself a weapon, per the
   * SAME isWeapon() classifier every other weapon check in this codebase
   * already uses (see generateAllActionCards, actionCards.ts, for exactly
   * where each is set). Undefined for every spell card and every non-attack
   * class/race/item feature — those are never eligible for Extra Attack's
   * extra attack opportunities even when they also happen to be
   * `cardType: 'damage'`. This is the ONE signal the player-facing Attack
   * Action sequence (TabActions.tsx) uses to decide which cards to offer as
   * attack choices; it never infers attack-eligibility from `cardType`
   * alone, which also covers non-weapon damage sources like a spell.
   *
   * Extra Attack sequence closure (two-issue final closure, Part A): ALSO
   * requires `activation.actionType === 'action'` — a weapon's own authored
   * attack feature that activates as a Bonus Action or Reaction (deals
   * damage, belongs to a weapon, but isn't a genuine Attack-action attack)
   * must never be true, since that would let it be used as a free Extra
   * Attack continuation. The two hardcoded synthetic cards (basic weapon
   * attack, Unarmed Strike) are unconditionally `actionType: 'action'` by
   * construction, so this never excludes them. `applyActionCardUse`
   * (actionUse.ts) independently re-checks `activation.actionType ===
   * 'action'` at execution time — never trusts this flag alone — so a
   * misclassified or forged `true` here still can't bypass action economy.
   */
  isWeaponAttack?: boolean;
  /** How this attack's damage dice are rolled (Great Weapon Fighting), applied by the roll (dice.ts withDamageDieRule). */
  damageDieRule?: DamageDieRule;
  /** Riders from the character's features that can ride this attack or spell (engine/riders.ts). Absent when none apply. */
  riders?: RiderOffer[];
};

/**
 * A bonus effect that attaches to something else the character does: "when you hit with a weapon attack, also deal 1d6 fire damage",
 * "once per turn, add 1d8 psychic damage to a cantrip or weapon hit". It names what it rides, any extra damage, a note for
 * consequences the app does not apply, how often it may be used, what it costs and the flag that must be on.
 */
export type Rider = {
  id:       string;
  name:     string;
  /** What it can ride. */
  on:       'weapon_attack' | 'cantrip' | 'spell' | 'spell_attack' | 'any_damage';
  damage?:  { dice: string; damageType: string };
  /** Everything else it does, in words (a speed penalty, a push). Table-resolved. */
  note?:    string;
  /** `once_per_turn` is counted on the creature's own turn counter. */
  limit?:   'once_per_turn' | 'none';
  cost?:    ResourceCost;
  /** A flag (set by another ability) that has to be on, for example the empowerment a reaction gave you. */
  requires?: string;
  /** A flag turned off when the rider is used. */
  clears?:  string;
};

/** A used feature whose `outcomes` carry effects, waiting to be confirmed or dismissed. */
export type PendingOutcome = { featureId: string; keys: OutcomeKey[] };

/** One button on a used card: press it if that outcome happened. */
export type OutcomeOffer = { featureId: string; key: OutcomeKey; label: string; effects: string };

export type RiderOffer = {
  riderId: string; featureId: string; name: string;
  damage?: { dice: string; damageType: string };
  note?: string;
  cost?: ResourceCost;
  available: boolean;
  reason: string | null;
};

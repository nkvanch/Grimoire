import type { ClassId, SubclassId, Ability, AttackBonus, SkillName } from './primitives';

// ── 3. Entity runtime schemas ────────────────────────────────────────────────

/** One class the character has taken. `level` is the level in THIS class only — not the character's total level. */
export type ClassLevelEntry = {
  classId:    ClassId;
  subclassId: SubclassId | null;
  level:      number;
};

export type Identity = {
  name:         string;
  /** An icon-sized portrait, a data:image URI (the desktop's identity.portraitUri; content/recordPictures.ts). */
  portraitUri?: string;
  level:        number;
  // raceId/classId (and subRaceId/subclassId/backgroundId) stay plain `string`,
  // not RaceId/ClassId — deliberately NOT branded (see Brand<> comment in
  // primitives.ts). companion.ts's createCompanion sets both raceId and
  // classId to a CompanionTemplate id for kind:'monster' companions (see the
  // `classes` field's doc comment just below), so these fields are polymorphic
  // per Entity.kind, not safe to brand as a single content type.
  raceId:       string;
  subRaceId:    string | null;   // e.g. 'hill_dwarf', 'wood_elf' — null until player picks
  classId:      string;
  subclassId:   string | null;
  backgroundId: string;
  alignment:    string | null;
  xp:           number;
  companionOf?: string | null;
  /**
   * Multiclassing source of truth for kind:'character' entities, one entry
   * per class taken (index 0 = "primary"/first class). Absent on entities
   * that have never gone through a multiclass-aware code path (including
   * every monster/companion/npc entity, which reuse classId as an unrelated
   * template id — see CompanionSection) and on characters saved before this
   * field existed. Always read via getClassLevels(entity) from
   * src/engine/multiclass.ts rather than this field directly, so callers
   * don't have to duplicate the legacy single-class fallback. classId/
   * subclassId/level above stay in sync as a mirror of classes[0] and the
   * level sum — see syncLegacyIdentity() — so every pre-existing reader of
   * those three scalar fields keeps working unchanged for both single- and
   * multi-classed characters.
   */
  classes?: ClassLevelEntry[];
};

export type AbilityScores = Record<Ability, number>;

/** A special sense. `note` carries homebrew flavour like 'in color' or 'heat-based'. */
export type SenseType = 'darkvision' | 'blindsight' | 'tremorsense' | 'truesight';
export type Sense = {
  type:  SenseType;
  range: number;       // feet
  note?: string;       // optional flavour, e.g. 'in color', 'thermal/heat', 'blind beyond'
};

/** Non-walking movement speeds (feet). 0 / undefined means the creature lacks it. */
export type MovementSpeeds = {
  fly?:   number;
  swim?:  number;
  climb?: number;
  burrow?: number;
};

/** Computed from base stats + effects. Never set manually — always recomputed. */
export type DerivedStats = {
  proficiencyBonus:  number;
  ac:                number;
  initiative:        number;
  speed:             number;
  passivePerception: number;
  passiveInvestigation: number;
  passiveInsight:    number;
  senses:            Sense[];
  movement:          MovementSpeeds;
  savingThrows:      Record<Ability, number>;
  attackBonuses:     AttackBonus[];
  spellSaveDC:       number | null;
  spellAttackBonus:  number | null;
  /** 8 + proficiency + WIS mod — Monk's ki-ability save DC (Stunning Strike,
   * etc.). Separate from spellSaveDC because Monk isn't a spellcaster. Null
   * for anyone without Martial Arts. */
  kiSaveDC:          number | null;
  /** True when an effect turns critical hits against this creature into normal hits ("critical hits made against you become normal hits"). */
  critsNegated?:     boolean;
  /** The lowest d20 result that is a critical hit on this creature's own attacks: 20 normally, 19 for an extended range. */
  critRange?:        number;
  /**
   * 8 + proficiency + [ability] mod, precomputed for all six abilities —
   * generic version of kiSaveDC for every OTHER non-caster class feature
   * with its own save DC (Barbarian's Intimidating Presence is STR-based,
   * etc.). Always populated (no gating check needed, unlike kiSaveDC/
   * spellSaveDC) — a Feature's requiresSave.dc references the one it needs
   * via `{ ability: 'str' }` etc.
   */
  abilityBasedDC:    Record<Ability, number>;
  /**
   * Active advantage/disadvantage grants, aggregated from any Effect with
   * operation 'advantage'/'disadvantage' (see resolver.ts's resolveBinary
   * for the neutralization rule — if both are present for the same target,
   * they cancel to straight and don't appear here at all). `target` is a
   * free-text description of what it applies to (e.g. "Wisdom saving
   * throws against being charmed"), matching the same free-text pattern
   * condition content itself now authors for its own self-side roll
   * modifiers (see content/conditions/index.ts's rollModifierFeature, and
   * CONDITION_MECHANICS in TabCharacter.tsx for the UI split) — 5e's
   * variety here is too large to enumerate as a
   * fixed set of targets. Display/reminder only, same as everywhere else
   * in the app with no attack-roll automation: shown to the player so they
   * remember to roll 2d20, not auto-applied to any roll.
   */
  advantageStates:   { target: string; state: 'advantage' | 'disadvantage' }[];
  /**
   * Extra Attack / action-structure batch: how many individual attacks the
   * character's Attack action contains — `1 + resolveExtraAttack(allEffects)`
   * (resolver.ts). Extra Attack-granting features author a `stat_modifier`
   * effect targeting `'extra_attack'` with `operation: 'set'` and a value
   * one less than the total attack count (Fighter 5's value is `1` → 2
   * total attacks); resolveExtraAttack takes the MAXIMUM across every such
   * effect rather than summing them, so a Fighter 5/Paladin 5 multiclass
   * correctly stays at 2, never 3 — see resolveExtraAttack's own doc
   * comment for the full multiclassing rationale. This field describes ONLY
   * how many attack opportunities the Attack action contains; it never
   * implies multiple action-economy spends — a single Attack action with
   * this many attacks still consumes exactly one Action (see
   * applyActionCardUse's `attackSequence` parameter, actionUse.ts, and
   * AttackSequenceState's own doc comment, section 6 below).
   */
  attackActionAttacks: number;
};

/**
 * The scalar numeric fields inside DerivedStats that DM overrides may target.
 * savingThrows and attackBonuses are excluded — they are compound, not scalar.
 */
export const DERIVED_NUMERIC_KEYS = new Set<string>([
  'proficiencyBonus', 'ac', 'initiative', 'speed',
  'passivePerception', 'passiveInvestigation', 'passiveInsight',
  'spellSaveDC', 'spellAttackBonus', 'kiSaveDC',
]);

export type SkillEntry = {
  ability:   Ability;
  trained:   boolean;
  expertise: boolean;
  bonus:     number | null;
};

export type SkillBlock = {
  skills: Record<SkillName, SkillEntry>;
};

export type ProficiencyBlock = {
  armor:        string[];
  weapons:      string[];
  tools:        string[];
  languages:    string[];
  savingThrows: Ability[];
};

export type HPBlock = {
  current: number;
  maximum: number;
  temp:    number;
  /**
   * How much of `maximum` currently comes from effects targeting 'max_hp' (a feature's
   * "+5 maximum hit points"). recomputeDerived resolves the CURRENT bonus from active effects
   * and applies only the DIFFERENCE to `maximum`/`current`, so a tiered reward that REPLACES
   * +5 with +10 nets +5 (never +15) and removing the feature takes its bonus back out.
   * Absent on characters saved before this field existed — read as 0, so nothing changes for them.
   */
  bonusApplied?: number;
  /**
   * The Constitution modifier `maximum` currently reflects (a character's own: items, features, conditions, modes and overrides
   * included, never a Wild Shape beast's). recomputeDerived moves `maximum` by the change times the level whenever the modifier
   * changes, from whatever source (engine/pipeline.ts followConModifier). Absent (saved before this rule): the modifier the old
   * rules kept it in step with, so a maximum an item never changed is put right on the first load (pipeline.ts savedConModifier).
   */
  conModApplied?: number;
};

/** One die-size's own total/remaining count within a mixed hit-dice pool. */
export type HitDicePool = {
  die:       number;
  total:     number;
  remaining: number;
};

/**
 * Tracks the pool of hit dice available for short-rest healing.
 *
 * Bug fix: a multiclass character's hit dice used to be tracked as a
 * single {die, total, remaining} triple — every level-up (in ANY class)
 * unconditionally overwrote `die` with whatever die size that class uses,
 * silently mislabeling every hit die from OTHER classes (e.g. a Fighter
 * 3/Wizard 1 would show 4 d6 hit dice, losing the 3 real d10s, and roll
 * the wrong die size — and wrong average heal — for 3 of the 4 spends).
 *
 * `pools` fixes this by tracking each distinct die size separately once a
 * character actually has more than one. It's absent for single-class
 * characters and multiclass characters whose classes all share one die
 * size (Fighter/Paladin, both d10) — those cases are already exact via
 * `die`/`total`/`remaining` alone, so there's no reason to carry the extra
 * structure. `total`/`remaining` always stay the correct SUM across every
 * pool regardless, so every existing reader that only wants the aggregate
 * count (rest previews, level-up previews, the sheet's progress display)
 * keeps working unchanged.
 */
export type HitDiceBlock = {
  die:       number;   // Die size: 4, 6, 8, 10, or 12. Once `pools` has more
                        // than one entry this is only a display fallback (the
                        // most-recently-added die size) — read `pools` for
                        // anything that needs to be exact.
  total:     number;   // Sum across every pool. Equals character level.
  remaining: number;   // Sum across every pool. How many are left to spend.
  pools?:    HitDicePool[];
};

export type CustomResource = {
  id:       string;
  name:     string;
  current:  number;
  maximum:  number;
  /** Authoritative maximum before source-owned upgrades are applied. */
  baseMaximum?: number;
  recharge: 'short_rest' | 'long_rest' | 'dawn' | 'never' | string;
  /** Maximum equals the character's proficiency bonus ("PB uses per Long Rest"); kept in step on every recompute. */
  perProficiencyBonus?: boolean;
  /** Maximum equals this ability's modifier, minimum 1 (Bardic Inspiration: Charisma); kept in step on every recompute. */
  perAbilityModifier?: Ability;
  /** Maximum equals the character's level times this (Sorcery Points and Focus Points: 1; Lay on Hands: 5). */
  perLevel?: number;
  /** What granted this resource — lets clearClassData (app/creation/class-
   * detail.tsx) tell a class-owned resource pool apart from a racial one and
   * wipe only the former on class (re)selection. Optional so resources on
   * already-serialized characters predating this field stay valid; treated
   * as "not class-owned" (never auto-wiped) when absent. Reuses
   * FeatureSource['kind'], plus 'subrace' since a resource can be granted by
   * a subrace specifically (not just its parent race). */
  sourceKind?: EntitlementSourceKind;
  sourceId?:   string;
};

/** Shared by CustomResource.sourceKind and EntitlementRecord.sourceKind.
 *  A superset of FeatureSource['kind'] (adds 'subrace', since a resource/
 *  entitlement can be granted by a subrace specifically, and 'feature' for
 *  a manually-added custom feature's own grants — see leveling.ts's
 *  removeFeature) — every FeatureSource.kind value is a valid
 *  EntitlementSourceKind, so a granting Feature's own `.source.kind` can
 *  always be used directly to tag an entitlement it produces (e.g. a
 *  grant_spell effect's resulting spell_access/cantrip_access record). */
export type EntitlementSourceKind =
  'race' | 'subrace' | 'subclass' | 'class' | 'background' | 'feat' | 'feature'
  | 'item' | 'spell' | 'condition' | 'campaign' | 'manual';

export type EntitlementKind =
  'skill_proficiency' | 'skill_expertise' | 'tool_proficiency' | 'armor_proficiency' | 'weapon_proficiency' | 'language'
  // Closure pass 3: source-owned spell/cantrip ACCESS (not preparation —
  // see A14, explicitly out of scope). `key` is the spell/cantrip id.
  | 'spell_access' | 'cantrip_access'
  // Closure pass 3 (item 3): tracks WHICH sources currently want a given
  // CustomResource (by its `key` = CustomResource.id) to exist — lets two
  // different sources granting a resource with the same id both register
  // as contributors without either one's removal wiping an entry the OTHER
  // still wants, and without resetting current/spent state on removal of
  // just one contributor. See entitlements.ts's revokeResourceSource.
  | 'resource_grant' | 'resource_upgrade';

/**
 * Closure pass 2 (source ownership): an explicit, typed record of WHY the
 * entity currently has some proficiency/expertise/language — replacing the
 * old approach of inferring provenance from the final flattened array/flag,
 * which can't distinguish "a manual/base grant" from "an active source's
 * grant that happens to produce the same effective value" (removing the
 * source silently erased the manual grant too). Not a general scripting/
 * event system — a plain typed reference, same shape as CustomResource's
 * own sourceKind/sourceId, plus an optional choiceId when the entitlement
 * came from resolving a specific ChoiceState (see ChoiceState.sourceKind/
 * sourceId for how the choice itself is tagged).
 *
 * Effect-driven proficiency grants (grant_proficiency Effects on a Feature
 * that has its own Feature.source) are NOT stored here — they're re-derived
 * fresh from collectAllEffects() every recompute pass, which is already
 * fully source-accurate and naturally self-reconciling (the effect simply
 * stops existing once its granting feature is removed). This array is for
 * the grants that have no backing Feature/Effect at all: raw `proficiency`-
 * kind Grants (race/class/subclass/background/feat progression entries),
 * resolved skill/tool/language choices, and manually-set proficiencies —
 * see recomputeDerived's own use of deriveProficienciesFromEntitlements.
 */
export type EntitlementRecord = {
  kind:       EntitlementKind;
  /** SkillName for skill_proficiency/skill_expertise; a tool/armor/weapon
   *  proficiency string, or a language name, matching whatever string the
   *  existing ProficiencyBlock arrays already store for that category. */
  key:        string;
  sourceKind: EntitlementSourceKind;
  sourceId?:  string;
  choiceId?:  string;
  /** Additive maximum contribution for resource_upgrade records. */
  amount?:    number;
  /** A spell/cantrip the source grants from a given CHARACTER level on (Circle of the Land's level 5/7/9 spells, a lineage spell at 3 and 5). Absent = from the start. */
  minLevel?:  number;
  /**
   * Rules-engine blocker closure (1F — ambiguous legacy/migrated
   * provenance): set ONLY on a sourceKind:'manual' spell_access/
   * cantrip_access record produced by legacy migration
   * (reclassifyManualSpellSources, entitlements.ts) when the spell/cantrip
   * matches 2+ of the character's OWN classes' spell lists — genuine,
   * unresolved ambiguity (e.g. a Wizard/Sorcerer character's legacy
   * Fireball), not an ordinary "no plausible class" manual grant. A plain
   * `manual` record with this field absent/empty means exactly what it
   * always has — an unrestricted, non-gated grant. Runtime (actionCards.ts's
   * resolveSpellCastingContexts) must NOT treat an ambiguous record as
   * automatically legal-with-no-ability-opinion the way a true manual grant
   * is — it instead builds one real casting context PER candidate class id
   * here, each with that class's own actual preparation policy/ability, so
   * the player is offered an explicit source choice rather than the spell
   * silently behaving as globally unrestricted. Never silently collapsed
   * back to a single resolved class — see 1G for the one case that DOES
   * safely auto-resolve (exactly one candidate, handled directly by
   * reclassifyManualSpellSources instead of via this field at all).
   */
  ambiguousClassIds?: string[];
};

/**
 * Rules-engine blocker closure (re-audit, Closure 1 — explicit spell
 * casting context): the ONE unit both preparation legality and casting
 * ability resolve from (see actionCards.ts's resolveSpellCastingContexts/
 * selectSpellCastingContext), and — new this closure — the unit an
 * ActionCard PRESERVES so the exact same context that was shown to the
 * player is the one validated and executed, never silently re-resolved to
 * a different source. Pure runtime/derived data: never persisted as its
 * own authoritative record (see EntitlementRecord for the real ownership
 * data this is derived FROM), and never stores a calculated DC/attack
 * number — those stay recomputed from `castingAbility` at display time
 * (see resolveSpellSaveDC/resolveSpellAttackBonus).
 */
export type SpellCastingContext = {
  /**
   * Stable identity for this EXACT context — deterministic function of
   * sourceKind/sourceId/classId, so the same real-world source always
   * produces the same key across candidate generation, card display, and
   * execution-time revalidation (resolveSpellCastingContexts is re-run
   * fresh at execution; matching by this key, not object identity or array
   * position, is what lets applyActionCardUse detect "this exact source
   * still exists" vs "it disappeared since the card was generated").
   */
  contextKey:        string;
  sourceKind:        EntitlementSourceKind;
  sourceId?:         string;
  /** The owning class, when resolvable — direct 'class' source, an
   *  ambiguous-legacy candidate (see EntitlementRecord.ambiguousClassIds),
   *  or a 'subclass' source resolved to its parent class via the
   *  character's own ClassLevelEntry.subclassId. Undefined for race/feat/
   *  item/genuine-manual/etc sources, which have no class to prepare from. */
  classId?:          string;
  preparationPolicy: SpellPreparationPolicy;
  castingAbility:    Ability;
  /** Preparation-only legality for THIS source. */
  legal:             boolean;
  /** True only for a context built from a grant_spell EFFECT's own
   *  authored spellcastingAbility — the single most specific signal
   *  content can author, so selectSpellCastingContext always prefers it. */
  explicitAbility?:  boolean;
  /** True for a candidate generated from an unresolved-ambiguous legacy
   *  manual entitlement (EntitlementRecord.ambiguousClassIds) — signals
   *  the UI that this context was never confirmed by the player and a
   *  source choice should be offered rather than silently assumed. */
  unresolvedLegacy?: boolean;
  /**
   * Rules-completeness batch (ritual casting): true only when THIS source
   * is a class/subclass whose class has a `CharClass.ritualCastingPolicy`
   * other than `'none'` (see that field's own doc comment) — independent of
   * `legal`/prepared status. A spell is only actually ritual-castable
   * through this context when it is ALSO ritual-tagged content
   * (`Spell.ritual`); this field alone answers "may this SOURCE cast
   * something as a ritual at all," never "is THIS attempt currently legal"
   * (see `ritualLegal` below for that) or "is this specific spell a
   * ritual." Undefined/false for every non-class-rooted source (race/feat/
   * item/manual/etc.) — no ritual-casting policy is modeled for those, so
   * they conservatively never offer ritual mode rather than guessing.
   */
  ritualEligible?: boolean;
  /**
   * Rules-completeness batch (ritual casting), HIGH-fix closure: whether a
   * RITUAL attempt through THIS SPECIFIC context is legal RIGHT NOW —
   * computed from the class's own `ritualCastingPolicy`, deliberately
   * SEPARATE from `legal` (normal-cast preparation legality), because the
   * two genuinely disagree for a `'spellbook'`-policy class: a Wizard's
   * ritual is legal straight from the spellbook whether or not it's
   * prepared (`ritualLegal` true even when `legal` is false), while a
   * `'prepared'`-policy class's ritual (Cleric, Druid) requires the exact
   * same preparation a normal cast does (`ritualLegal` always equals
   * `isPrepared`, same value as `legal` computes to for that policy) — and
   * a `'known'`-policy class (Bard) is unconditionally legal either way,
   * same as `legal` already is for it. `applyActionCardUse` uses THIS field
   * (not `legal`) to gate a `castMode: 'ritual'` attempt, so Cast Anyway
   * (`bypassSpellPreparation`) is never needed for a legal Wizard-spellbook
   * ritual, while it remains available (and required) for an unprepared
   * Cleric/Druid ritual exactly as it already is for a normal cast.
   * Undefined/false wherever `ritualEligible` is false — there is no
   * "legal ritual" through a source that cannot ritual-cast at all.
   */
  ritualLegal?: boolean;
};

/** See CharClass.spellPreparationPolicy's own doc comment for the full
 *  meaning of each value — this is the shared type, referenced both there
 *  and by SpellCastingContext.preparationPolicy (actionCards.ts). */
export type SpellPreparationPolicy = 'known' | 'spellbook_prepared' | 'full_list_prepared' | 'always_available';

/**
 * Death save tracking. Only meaningful while hp.current === 0 and the
 * entity hasn't stabilized. 3 successes -> stable (stops rolling, stays at
 * 0 HP until healed). 3 failures -> dead. A natural 20 on the save
 * instead heals 1 HP and clears both counters (handled in the UI action,
 * not stored as separate state here). Reset on any HP gain above 0 or on
 * stabilizing, per the book rule. See docs/ROADMAP_1.0.md Phase 3.1 and
 * the `deathSavesPersist` house rule in houseRules.ts.
 */
export type DeathSaves = {
  successes: number;   // 0-3
  failures:  number;   // 0-3
  stable:    boolean;  // true once 3 successes are reached
};

export type ResourceBlock = {
  hp:         HPBlock;
  hitDice:    HitDiceBlock;
  speed:      number;
  ac:         number;   // 0 = no armor; pipeline falls back to 10 + DEX
  custom:     CustomResource[];
  deathSaves: DeathSaves;
};

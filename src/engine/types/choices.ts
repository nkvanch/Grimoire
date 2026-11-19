import type { FilterExpression } from './primitives';
import type { Grant } from './leveling';
import type { DraftTrait } from './draftTrait';
import type { EntitlementSourceKind } from './entityRuntime';

// ── STARTING-EQUIPMENT-1 ─────────────────────────────────────────────────────
// Structured, ruleset-agnostic constraint for "any item matching X" equipment
// choices (e.g. "any Simple Melee Weapon") — reuses the SAME independent-axis
// taxonomy src/content/items/itemBrowse.ts already defines for browsing
// (Category/WeaponClass/WeaponRange/ArmorWeight), never a scripting DSL or a
// combined-concept string like "Martial Melee". Every field is optional and
// AND-combined; an empty object matches every item (rare, but valid for a
// genuinely unconstrained "any item" pick).
export type ItemFilterConstraint = {
  category?:    'weapon' | 'armor' | 'shield' | 'ammunition' | 'tool' | 'focus' | 'gear';
  weaponClass?: 'martial' | 'simple';
  weaponRange?: 'melee' | 'ranged';
  armorWeight?: 'heavy' | 'medium' | 'light';
};

/**
 * A requirement for taking an option, checked by engine/prerequisites.ts (not Warlock-only: any ChoiceOption can carry
 * them, and so can anything else that wants to ask "does this character qualify").
 *   level      the character's level, or `classId`'s level, is at least `min`
 *   has_option the character already holds this pool option (Eldritch Smite needs Pact of the Blade)
 *   has_feature the character has this feature id
 *   cantrip    the character knows a cantrip with these traits (Agonizing Blast: one that deals damage)
 *   spell      the character knows this spell
 *   excludes   mutually exclusive: not allowed while the character holds any of these options
 */
export type Prerequisite =
  | { kind: 'level';       min: number; classId?: string }
  | { kind: 'has_option';  optionId: string; label: string }
  | { kind: 'has_feature'; featureId: string; label: string }
  | { kind: 'cantrip';     traits: ('damage' | 'attack_roll' | 'range_10_plus')[]; label: string }
  | { kind: 'spell';       spellId: string; label: string }
  | { kind: 'excludes';    optionIds: string[]; label: string };

/** When a held option of a `feature_pool` choice may be swapped for another one (Fighting Style on level-up, Hunter's Prey on a rest). */
export type ChoiceReplacePolicy = {
  timing: 'level_up' | 'rest' | 'long_rest';
  /** The rule's own words for the confirm step, e.g. "Whenever you gain a Fighter level". */
  rule: string;
};

export type ChoiceOption = {
  id:    string;
  label: string;
  value: unknown;
  /**
   * STARTING-EQUIPMENT-1: when present, selecting this option ALSO requires
   * picking `quantity` real items matching `constraint` from the shared Item
   * browser (in RequiredEquipmentChoice context — see itemBrowseContext.ts),
   * in addition to (not instead of) any fixed `value` items. This is what
   * lets an ExactOptions/BundleOptions option represent something like
   * "a martial weapon and a shield" (fixed shield + 1 filtered martial
   * weapon) without hardcoding a specific weapon as the option's label —
   * the anti-pattern this whole mechanism replaces (e.g. "two simple
   * weapons (Daggers shown)" baking in one example as if it were the only
   * legal choice).
   */
  itemFilter?: { constraint: ItemFilterConstraint; quantity: number };
  gold?: number;
  /** Requirements for taking this option (level, another option, a cantrip, ...). See Prerequisite. */
  requires?: Prerequisite[];
  /**
   * The option can be taken more than once, each time with its own target (Agonizing Blast on a different cantrip,
   * Lessons of the First Ones with a different Origin feat). A targeted take is selected as `optionId::targetId`; the
   * target is validated by the engine and written on the granted feature (see engine/prerequisites.ts, splitSelection).
   */
  repeatable?: { target: 'cantrip' | 'origin_feat' };
};

/**
 * Narrows (and widens) what a `kind: 'spell'` choice offers, so a feature can let the player pick spells from
 * lists other than their own class's: Bard Magical Secrets (Bard/Cleric/Druid/Wizard), Paladin Blessed Warrior
 * (Cleric cantrips), Pact of the Tome (any list, cantrips plus Ritual spells), Mystic Arcanum (Warlock level 6-9).
 * Absent = the choice's own class list, capped by the character's castable spell level (the original behavior).
 */
export type SpellPickFilter = {
  /** Class ids whose spell lists the spell may come from (a union), or 'any' for every spell. Absent = the character's own class list. */
  lists?: string[] | 'any';
  /** Exact spell levels allowed (0 is a cantrip). Absent = cantrips for a cantrip choice, otherwise level 1 up to the castable level. */
  levels?: number[];
  schools?: string[];
  ritualOnly?: boolean;
  /** A leveled-spell choice that may also take cantrips ("a cantrip or a spell for which you have slots"). */
  includeCantrips?: boolean;
  /** Offer levels above what the character can currently cast (Mystic Arcanum picks level 6-9 spells). */
  ignoreSlotCap?: boolean;
  /** Short label for the picker heading, e.g. "Cleric cantrips". */
  label?: string;
};

export type ChoiceDefinition = {
  id:       string;
  prompt:   string;
  kind:     'skill' | 'spell' | 'language' | 'tool' | 'equipment' | 'feat' | 'asi' | 'custom'
          | 'spellcasting_ability' | 'subclass' | 'infusion' | 'feature_pool' | 'expertise';
  count:    number;
  pool:     ChoiceOption[] | 'all' | FilterExpression;
  grants:   Grant[];
  required: boolean;
  resolved: boolean;
  /**
   * Which class this choice belongs to — set by levelUpClass() when a
   * multiclassed character has more than one pending choice of the same
   * kind (e.g. two subclass choices) so each resolves against the right
   * class. undefined for single-class characters and non-class choices
   * (race/background/feat) — every existing choice literal in src/content
   * stays valid without edits.
   */
  forClassId?: string;
  /** For `kind: 'feature_pool'`: the held options of this choice can be swapped later. See ChoiceReplacePolicy. */
  replace?: ChoiceReplacePolicy;
  /**
   * For a `feature_pool` the homebrew editor wrote: the option drafts the pool was compiled from ({trait: DraftTrait, minLevel}),
   * so the editor can reopen it without rebuilding traits from the compiled features. Ignored by the engine.
   */
  authoredOptions?: { trait: DraftTrait; minLevel: string }[];
  /** For `kind: 'spell'`: where the spells may come from and which levels are offered. See SpellPickFilter. */
  spellFilter?: SpellPickFilter;
  /**
   * Player-facing noun for a `kind: 'subclass'` choice that is not conventionally a subclass
   * (a monthly swapped option). The picker heading, the Features tab button and the
   * creation hub all use it instead of "Subclass". Undefined = "Subclass".
   */
  subclassLabel?: string;
  /**
   * STARTING-EQUIPMENT-1: only meaningful for kind:'equipment'. Undefined
   * (every existing equipment choice literal across src/content) means
   * 'exact_options' — the original, unchanged behavior (a fixed pool of
   * named options, each granting a fixed item list). 'bundle_options' is
   * structurally identical (a whole-pack either/or) — the distinct name
   * exists for UI/semantic clarity (pack contents render expanded) and so
   * a future divergence doesn't need a new discriminant. 'filtered_item'
   * means there is no fixed pool at all — `itemFilter` + `count` alone
   * describe "choose `count` items matching this constraint," and the
   * player picks real items from the shared Item browser.
   */
  equipmentStyle?: 'exact_options' | 'bundle_options' | 'filtered_item';
  /** Only used when equipmentStyle === 'filtered_item'. */
  itemFilter?: ItemFilterConstraint;
  /** Free-text display grouping for the Starting Equipment progress panel
   *  (e.g. "Armor", "Weapons", "Pack") — purely presentational, never used
   *  for legality/matching. Undefined groups under a generic "Equipment"
   *  heading, so no existing choice literal needs to change. */
  equipmentGroup?: string;
};

export type ChoiceState = {
  id:         string;
  definition: ChoiceDefinition;
  grantedAt:  number;
  resolved:   boolean;
  // selections stays plain string[], not branded — a selection's referent
  // (a feat id, spell id, skill name, subclass id, ...) depends on
  // `definition.kind`, so it's polymorphic the same way FeatureSource.refId
  // is. See the Brand<> comment in primitives.ts.
  selections: string[];
  /**
   * Closure pass 2: explicit provenance for this pending/resolved choice —
   * which content source queued it, so resolving it can tag the resulting
   * grant(s) with real, removable source ownership instead of the grant
   * becoming untraceable the moment the choice resolves. Optional/undefined
   * on choices queued before this field existed, or where the queuing call
   * site genuinely has no better source than 'manual' — resolveChoice falls
   * back to sourceKind:'manual' in that case (conservative, matches the
   * migration philosophy: an untraceable grant is treated as permanent
   * rather than guessed at).
   */
  sourceKind?: EntitlementSourceKind;
  sourceId?:   string;
  /**
   * Item-identity closure (pass 3, finding F): for a RESOLVED `kind:
   * 'equipment'` choice, the exact ItemInstance ids it granted into
   * inventory.carried — lets reopenEquipmentChoice (equipmentDisplay.ts)
   * remove precisely what THIS choice added, never the first same-itemId
   * row it happens to find (which, now that duplicate stateful
   * ItemDefinitions are legitimately allowed, could belong to a DIFFERENT
   * choice, Additional Equipment, or another grant entirely). Optional/
   * undefined for a non-equipment choice, an unresolved choice, or one
   * resolved before this field existed — reopenEquipmentChoice falls back
   * to its original itemId-based removal in that case (a documented,
   * least-destructive legacy compromise, not a claim that old data secretly
   * tracked per-instance provenance it never recorded).
   */
  grantedItemInstanceIds?: string[];
  /** Gold this choice added (a starting-equipment package or the gold alternative), taken back out when the choice is reopened. */
  grantedGold?: number;
};

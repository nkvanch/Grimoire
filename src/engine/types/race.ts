import type { RulesetId, ContentOrigin, Ability } from './primitives';
import type { ResourceGrant } from './leveling';
import type { Feature } from './feature';
import type { ChoiceDefinition } from './choices';

// ── 2. Static content schemas ────────────────────────────────────────────────

/**
 * A subrace is a mandatory variant of a race.
 * Dwarves must choose Hill or Mountain; Elves must choose High, Wood, or Drow; etc.
 * Subrace features stack on top of base race features — all are applied.
 */
export type Subrace = {
  id:       string;
  name:     string;
  // Not branded RaceId, despite being unambiguous in meaning — reverted
  // after discovering it has the same volume problem as Race.id itself:
  // every hand-authored subrace literal (~44 in src/content/races/index.ts
  // alone) sets this inline, so branding would force an `as RaceId` cast
  // onto each one for the same "no near-term payoff" reason Race.id etc.
  // are excluded. See the Brand<> comment in primitives.ts.
  parentId: string;    // id of the parent Race
  features: Feature[];
  /**
   * Overrides the parent Race's size for this subrace specifically (e.g. a
   * "Giant" skeleton subrace that's Large while the base Skeleton race is
   * Medium). Mirrors Race.size's own optional shape — undefined means
   * "same size as the parent race." See isLargeCreature() in
   * engine/actionCards.ts for the one mechanical consumer (doubling weapon
   * damage dice for a Large creature, per the DMG house rule).
   */
  size?: Race['size'];
  /**
   * Resource pools this subrace grants (e.g. a limited-use racial ability).
   * Applied the same way class-level resource grants are — via applyGrant
   * with {kind:'resource', value: r} — reusing existing, already-tested
   * engine code rather than inventing new application logic for races.
   */
  resources?: ResourceGrant[];
  /**
   * Choices queued (not auto-resolved) at race-selection time — e.g. Variant
   * Human's "proficiency in one skill of your choice." Queued via
   * leveling.ts's queueChoice at grantedAt=0, alongside subrace feature
   * application in race-detail.tsx's selectRace(), then resolved through
   * whichever creation screen already generically handles that choice kind
   * (skills.tsx for 'skill', etc.) — same pending-choice objects, just
   * queued from race selection instead of leveling up a class.
   */
  pendingChoices?: ChoiceDefinition[];
  /**
   * Subrace-scoped version of Race.flexibleAsi — for a subrace that
   * replaces the base race's flat ASI with a player-directed one (e.g.
   * Variant Human), rather than every subrace of that race needing it (most
   * don't; Dragonborn's ancestryChoice is race-level precisely because it
   * DOES apply to every subrace). Only active once this specific subrace is
   * selected — see race-detail.tsx's `flexAsi` derivation.
   */
  flexibleAsi?: Race['flexibleAsi'];
  ancestryChoice?: Race['ancestryChoice'];
  /**
   * Base race Feature ids this subrace replaces rather than adds to — e.g.
   * Variant Human replaces `human_asi` (its flat all-abilities-+1) with its
   * own `flexibleAsi` choice instead of stacking on top of it. Filtered out
   * of `race.features` before application in race-detail.tsx's
   * selectRace(). Most subraces (Hill Dwarf, High Elf, etc.) leave this
   * unset — they genuinely ADD to the base race per RAW.
   */
  replacesBaseFeatureIds?: string[];
  /** SRD 5.1 legal status — same semantics as Spell.srd. See docs/ROADMAP_1.0.md Phase 1 Step 1.4. */
  srd?:     boolean;
  /** Which ruleset this subrace belongs to. Undefined = available under every ruleset. See the ContentHeader comment in primitives.ts. */
  rulesetId?: RulesetId;
  /**
   * Raw builder state, same purpose as Race.homebrewDraft (see that field's
   * doc comment) — lets app/homebrew/subrace-builder.tsx reload a standalone
   * subrace's exact authoring state on edit. A subrace authored inline while
   * building a brand-new race (race-builder.tsx's SubraceEditor) doesn't need
   * this — that flow's parent Race.homebrewDraft.subraces already carries the
   * full draft. The engine itself never reads this field.
   */
  homebrewDraft?: Record<string, unknown>;
  /** Where this homebrew came from (a book, a creator, a post). Optional; set by the builders and kept with the content. */
  origin?: ContentOrigin;
};

/**
 * Required id prefix for every entry in Race/Subrace.pendingChoices — lets
 * race-detail.tsx's clearRaceFeatures() sweep previously-queued race choices
 * on race change/re-selection without needing to know each race's specific
 * choice ids in advance.
 */
export const RACE_CHOICE_PREFIX = 'race_choice_';

/**
 * One option within a Race.ancestryChoice — e.g. one dragon color for
 * Dragonborn's Draconic Ancestry. `feature` is a complete Feature (may
 * combine passive effects like grant_resistance with an active ability like
 * a breath weapon, same as Rage does) applied via applyGrant when this
 * option is picked, mirroring how a 'feature_pool' ChoiceDefinition option's
 * `value` is a full Feature literal — but resolved immediately alongside
 * subrace selection on the race-detail screen instead of as a deferred
 * pending choice, since (like subrace) it's decided once at race-pick time.
 */
export type AncestryOption = {
  id:      string;
  name:    string;
  blurb:   string;
  /** Applied via applyGrant when this option is chosen. Optional so an
   * option whose only outcome is a queued choice (see `pendingChoice`
   * below) doesn't need a no-op placeholder Feature. */
  feature?: Feature;
  /**
   * Queued (not auto-resolved) when this specific option is chosen — e.g.
   * Half-Elf Versatility's "Skill Versatility" option grants 2 skills of
   * the player's choice, which can't be expressed as a single fixed
   * Feature the way every other Versatility option can. Same RACE_CHOICE_
   * PREFIX/queueChoice mechanism as Race/Subrace.pendingChoices.
   */
  pendingChoice?: ChoiceDefinition;
};

export type Race = {
  id:        string;
  name:      string;
  features:  Feature[];    // base race features — all subraces get these
  subraces?: Subrace[];    // if present, player must pick one before confirming race
  subracesOptional?: boolean;
  /**
   * A same-screen, always-required choice within the race itself (not a
   * subrace) — e.g. Dragonborn's Draconic Ancestry, chosen alongside (and
   * independently of) any subrace. Applied via race-detail.tsx exactly like
   * subrace selection: pick one, its `feature` grants on confirm.
   */
  ancestryChoice?: { prompt: string; options: AncestryOption[] };
  flexibleAsi?: {
    prompt: string;
    mode:
      | { kind: 'two_distinct_plus_one'; exclude?: Ability[] }
      /**
       * restrictTo, added for Background.flexibleAsi (2024 backgrounds
       * restrict the split to 3 background-relevant abilities, e.g.
       * Acolyte's Wisdom/Intelligence/Charisma — unlike Variant Human/
       * Half-Elf's unrestricted any-ability picker). Undefined = any
       * ability, preserving every existing race's unrestricted behavior.
       */
      | { kind: 'two_one_or_three_one'; restrictTo?: Ability[] }
      /** Exactly "one ability +2 and a different ability +1" — no three-way alternative (Ballast). */
      | { kind: 'two_and_one' };
  };
  /** Same as Subrace.pendingChoices — see that field's doc comment. */
  pendingChoices?: ChoiceDefinition[];
  /** Same as Subrace.resources — see that field's doc comment. */
  resources?: ResourceGrant[];
  /**
   * Flavor/reference fields shown on the race detail screen. Official races
   * get this data from a hardcoded lookup table (app/creation/race-
   * detail.tsx's RACE_DETAIL) for historical reasons; homebrew races have
   * no such table to fall into, so these fields let a homebrew race
   * self-describe directly. race-detail.tsx prefers these when present,
   * falling back to RACE_DETAIL for the 9 official races that don't set them.
   */
  age?:         string;
  size?:        'Tiny' | 'Small' | 'Medium' | 'Large';
  languages?:   string[];
  /** Short flavor blurb shown at the top of the race detail screen. */
  description?: string;
  /**
   * Raw builder state (traits, subrace drafts, etc.) preserved alongside the
   * compiled `features`/`subraces` above, so editing an existing homebrew
   * race in the builder can reload the exact authoring state losslessly
   * instead of reverse-engineering it from compiled Effects (which loses
   * information — e.g. a flavor-only trait and a trait whose effect
   * resolved to nothing look identical once compiled). The engine itself
   * never reads this field; only race-builder.tsx does. Opaque/untyped
   * deliberately — this is builder-internal shape, not an engine contract.
   */
  homebrewDraft?: Record<string, unknown>;
  /**
   * SRD 5.1 (CC-BY-4.0) legal status. CONFIRMED via direct verification
   * against the actual SRD 5.1 text (5thsrd.org) on 2026-08-04: individual
   * dedicated pages exist for all 9 standard PHB races. This held up where
   * the equivalent "generous inclusion" assumption did NOT for feats or
   * backgrounds (both turned out to be single "one worked example" pages) —
   * races, like magic items, get a genuinely comprehensive treatment rather
   * than a curated sample. Same semantics as Spell.srd — undefined = not
   * yet audited = unsafe for public builds. See docs/ROADMAP_1.0.md Phase 1
   * Step 1.4 for the full verification writeup.
   */
  srd?:      boolean;
  /** Which ruleset this race belongs to. Undefined = available under every ruleset (every race authored before this field existed, including all official 5e content). See the ContentHeader comment in primitives.ts. */
  rulesetId?: RulesetId;
  /** Where this homebrew came from (a book, a creator, a post). Optional; set by the builders and kept with the content. */
  origin?: ContentOrigin;
};

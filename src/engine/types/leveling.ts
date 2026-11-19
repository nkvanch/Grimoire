import type { Ability, RulesetId, ContentOrigin, SubclassId } from './primitives';
import type { AuditSourceKind } from './audit';
import type { ChoiceDefinition } from './choices';
import type { Effect } from './feature';

// ── 7. Leveling schemas ──────────────────────────────────────────────────────

export type LevelEntry = {
  level:   number;
  grants:  Grant[];
  choices: ChoiceDefinition[];
  hpDie:   4 | 6 | 8 | 10 | 12;
};

export type ClassProgression = {
  // Not branded ClassId, despite being unambiguous in meaning — reverted
  // after discovering the same volume problem as CharClass.id: every
  // hand-authored class/subclass progression literal across
  // src/content/classes/** and src/content/subclasses/** sets this inline
  // (dozens of sites), so branding would force an `as ClassId` cast onto
  // each one. See the Brand<> comment in primitives.ts.
  classId: string;
  entries: LevelEntry[];
  /**
   * Which ability governs HP gain per level. Defaults to 'con' when absent
   * (standard 5e RAW) — see CharClass.hpAbility's doc comment for why this
   * exists. leveling.ts's applyHP/recalculateAllHP read this.
   */
  hpAbility?: Ability;
  /**
   * SRD 5.1 (CC-BY-4.0) legal status. All 12 core PHB classes are SRD-safe
   * (SRD 5.1 includes the full class chassis, not just a stripped subset) —
   * true for all of them. For SUBCLASSES (see SubclassProgression in
   * src/content/subclasses/), the SRD includes exactly ONE subclass per
   * class; all others are non-SRD and must be excluded from public builds.
   * Same semantics as Spell.srd — undefined = not yet audited = unsafe.
   * See docs/ROADMAP_1.0.md Phase 1 Step 1.4.
   */
  srd?: boolean;
  /** Which ruleset this progression (class or subclass) belongs to. Undefined = available under every ruleset. See the ContentHeader comment in primitives.ts. */
  rulesetId?: RulesetId;
  /** Where this homebrew came from (a book, a creator, a post). Optional; set by the builders and kept with the content. */
  origin?: ContentOrigin;
};

/**
 * A homebrew subclass, attachable to ANY class (official or homebrew) via
 * `classId`. Unlike SubclassProgression (src/content/subclasses/), which
 * derives its id by scanning features for a `source.refId` (fine for
 * hand-authored official files), homebrew subclasses need an explicit `id`
 * since src/db/contentCacheRepo.ts keys storage rows off it directly.
 * Selection itself is out of scope (see the subclass_unlock choice in
 * leveling.ts) — this only makes homebrew subclasses author-able and
 * browsable at parity with official ones.
 */
export type HomebrewSubclass = ClassProgression & {
  id:   SubclassId;
  name: string;
};

export type Grant = {
  kind:  'feature' | 'resource' | 'resource_upgrade' | 'spell_slots' | 'proficiency'
       | 'speed' | 'subclass_unlock' | 'init_spellcasting' | 'known_spells'
       | 'starting_item';
  value: unknown;
};

/**
 * 'known_spells' grant value — adds fixed spell/cantrip ids to an already-
 * initialized spellcasting block (must come after 'init_spellcasting' in the
 * same level entry's grants array). Used for classes/races that grant specific
 * known spells rather than a player choice (e.g. innate spellcasting, or a
 * subclass that knows fixed spells at a given level).
 */
export type KnownSpellsGrant = {
  spellIds?:   string[];
  cantripIds?: string[];
};

/**
 * Proficiency grant — used by the class progression `proficiency` grant kind.
 * Each field is an array of string identifiers. Any field may be omitted.
 */
export type ProficiencyGrant = {
  armor?:     string[];
  weapons?:   string[];
  tools?:     string[];
  languages?: string[];
};

export type ResourceGrant = {
  resourceId: string;
  name:       string;
  maximum:    number;
  /** `string` covers a homebrew-authored custom recharge description (see
   * DraftTrait's 'other' recharge option) — displayed as-is by CustomResource,
   * which already allows the same free-text escape hatch. */
  recharge:   'short_rest' | 'long_rest' | 'dawn' | 'never' | string;
  /** When true `maximum` is only the starting value: the pool's maximum tracks the proficiency bonus ("PB uses per Long Rest"). */
  perProficiencyBonus?: boolean;
  /** `maximum` is only the starting value: the maximum tracks this ability's modifier (minimum 1). */
  perAbilityModifier?: Ability;
  /** `maximum` is only the starting value: the maximum tracks character level times this. */
  perLevel?: number;
};

export type ResourceUpgrade = {
  resourceId: string;
  newMaximum: number;
  /** Also changes how the pool recharges (Bardic Inspiration returns on a Short Rest from level 5). */
  recharge?: string;
};

export type SpellSlotRow = {
  level: number;
  slots: [number, number, number, number, number, number, number, number, number];
};

/** An Effect tagged with source metadata for the stacking resolver. */
export type ActiveEffect = {
  effect:     Effect;
  sourceName: string;
  sourceId:   string;
  appliedAt:  number;
  /** Optional — lets audit.ts label a contribution without re-walking
   * entity.features/inventory itself. See AuditSourceKind. */
  sourceKind?: AuditSourceKind;
};

import type { RulesetId, ContentOrigin, Ability } from './primitives';
import type { ResourceGrant } from './leveling';
import type { Feature } from './feature';
import type { Spell } from './spellInventory';
import type { ChoiceDefinition } from './choices';
import type { CharClass } from './charClass';
import type { Race } from './race';

export type Background = {
  id: string;
  name: string;
  features: Feature[];
  /** Same rationale as Race.homebrewDraft — lossless edit-mode round-tripping. */
  homebrewDraft?: Record<string, unknown>;
  /**
   * SRD 5.1 legal status. CONFIRMED via direct verification against the
   * actual SRD 5.1 text (5thsrd.org) on 2026-08-04: the Backgrounds section
   * contains ONLY Acolyte, explicitly framed as "the sample background" —
   * WotC's own site notes state "far, far more options available" outside
   * the SRD. This CORRECTS a prior optimistic tagging of all 13 standard
   * PHB backgrounds, based on a "generous inclusion" pattern that turned
   * out not to apply here (same lesson learned for feats — see Feat.srd).
   * See docs/ROADMAP_1.0.md Phase 1 Step 1.4 for the full verification.
   */
  srd?: boolean;
  /** Which ruleset this background belongs to. Undefined = available under every ruleset. See the ContentHeader comment in primitives.ts. */
  rulesetId?: RulesetId;
  /**
   * A player-directed ability score bonus, same shape as Race.flexibleAsi —
   * the 2024 background-grants-ASI mechanic (species lost their flat ASI in
   * that revision). Resolved the same way race-detail.tsx resolves
   * Race.flexibleAsi: on the background-selection screen, compiled into one
   * generated Feature's stat_modifier effects on confirm. See
   * app/creation/background.tsx's flexAsi state and applyGrant call.
   */
  flexibleAsi?: Race['flexibleAsi'];
  /**
   * The Origin feat this background grants (2024: every background names one). Applied for real when the
   * background is selected, by engine/originFeat.ts: the feat's feature, its limited-use pools and any
   * picks it asks for (skills, spells) are granted with this background as their source, so changing the
   * background takes them all back out.
   */
  originFeat?: string;
  /**
   * FILTER-METADATA-2: free-text tool/vehicle proficiency names (e.g.
   * "Thieves' tools", "Vehicles (land)"), sourced from the same PHB text
   * app/creation/background.tsx's BG_DETAIL table already displays.
   * Deliberately NOT mechanically enforced — no grant_proficiency 'tool:'
   * effect exists for any official background (confirmed: this engine
   * currently grants zero tool proficiencies from background selection at
   * all, a real, separate, pre-existing gap, same shape as CharClass's
   * armor/weapon-proficiency gap — not fixed here). Skill proficiencies
   * deliberately have NO equivalent field here: they're already real,
   * structured data via each background's own grant_proficiency 'skill:'
   * Feature effects — see backgroundSkillGrants() in
   * src/content/backgrounds/backgroundBrowse.ts, which derives them
   * without duplicating the same fact in a second field.
   */
  toolProficiencies?: string[];
  /**
   * CHOICE-AUTHORING-1: choices queued (not auto-resolved) at background-
   * selection time — e.g. "choose one artisan's tool" or "learn two
   * languages of your choice." Same mechanism as Race.pendingChoices (see
   * that field's doc comment and BACKGROUND_CHOICE_PREFIX below): queued
   * via leveling.ts's queueChoice at grantedAt=0 from both
   * app/creation/background.tsx's selectBackground() and leveling.ts's
   * swapBackground(), and swept on background change the same way
   * Race.pendingChoices is swept on race change.
   */
  pendingChoices?: ChoiceDefinition[];
  /** Where this homebrew came from (a book, a creator, a post). Optional; set by the builders and kept with the content. */
  origin?: ContentOrigin;
};

/**
 * Required id prefix for every entry in Background.pendingChoices — lets
 * swapBackground()/selectBackground() sweep previously-queued background
 * choices on background change without needing to know each background's
 * specific choice ids in advance. Mirrors RACE_CHOICE_PREFIX exactly.
 */
export const BACKGROUND_CHOICE_PREFIX = 'background_choice_';

/** rulesetId undefined = available under every ruleset. See the ContentHeader comment in primitives.ts. */
export type Condition  = { id: string; name: string; description: string; features: Feature[]; rulesetId?: RulesetId; origin?: ContentOrigin };

export type Item = {
  id:         string;
  name:       string;
  weight:     number;
  cost:       string;
  properties: string[];
  features:   Feature[];
  /** Same rationale as Race.homebrewDraft — lossless edit-mode round-tripping. */
  homebrewDraft?: Record<string, unknown>;
  /**
   * SRD 5.1 legal status. Standard PHB weapons/armor/gear (Dagger, Chain
   * Mail, Explorer's Pack, etc.) carry no Product Identity naming risk at
   * all — confidently true. Named magic items need individual review
   * (Product Identity concerns apply the same way as spells). Same
   * semantics as Spell.srd. See docs/ROADMAP_1.0.md Phase 1 Step 1.4.
   */
  srd?:       boolean;
  imageUri?:  string;
  /** Which ruleset this item belongs to. Undefined = available under every ruleset. See the ContentHeader comment in primitives.ts. */
  rulesetId?: RulesetId;
  /**
   * Limited-use pools this item carries (a wand's charges, a standard's "3 charges, regains 1d3
   * at dawn"). Granted by inventory.ts's equipItem the first time the item is equipped, with
   * recharge 'dawn:<dice>' supported for a partial dawn refill (see rest.ts's parseDawnRecharge).
   * An activation on the item's feature spends the pool through its `resourceCost.resourceId`.
   * The pool stays with the character when the item is unequipped (charges are not lost by
   * putting the item away) and is dropped by removeFeature-style provenance cleanup only if the
   * source is revoked.
   */
  resources?: ResourceGrant[];
  /** Where this homebrew came from (a book, a creator, a post). Optional; set by the builders and kept with the content. */
  origin?: ContentOrigin;
};

/**
 * A feat. Selected in place of an Ability Score Increase.
 * `feature` is the Feature applied when the feat is taken; it carries any
 * automated Effects (e.g. a fixed +1 to an ability, +5 initiative). Feats whose
 * benefits can't be fully automated yet still apply as a named, described Feature
 * the player tracks manually.
 */
/** The four feat categories of the 2024 rules (the SRD lists them as Origin, General, Fighting Style and Epic Boon). */
export type FeatCategory = 'origin' | 'general' | 'fighting_style' | 'epic_boon';

export type Feat = {
  id:           string;
  name:         string;
  /** Which category a 2024 feat is in. Absent for older feats (everything in the 5e catalog). */
  category?:    FeatCategory;
  prerequisite: string | null;
  description:  string;
  source:       string;
  feature:      Feature;
  /**
   * Some feats grant "+N to one of these abilities (your choice)". When present,
   * the feat picker collects the player's choice and injects the matching
   * stat_modifier effect into the feature before it's applied, so the bonus
   * actually lands on the sheet. Omitted for feats with a fixed or no ability bonus.
   *
   * `grantsSaveProficiency` (Resilient): the chosen ability also confers
   * proficiency in that ability's saving throws. The picker adds it to
   * entity.proficiencies.savingThrows on commit.
   */
  abilityChoice?: { options: Ability[]; amount: number; grantsSaveProficiency?: boolean };
  /**
   * Limited-use resource pools this feat grants (e.g. a once-per-long-rest resource). Applied by leveling.ts's applyFeatToEntity via the same `resource` grant races
   * and classes use, tagged with sourceKind 'feature' + this feat's feature id so removeFeature's
   * existing revokeResourceSource cleanup covers it with no extra wiring. A feature's activation
   * references the pool by `resourceId`.
   */
  resources?: ResourceGrant[];
  skillChoice?: {
    picks: { id: string; label: string; mode: 'proficiency' | 'expertise'; from: 'any' | 'proficient' }[];
  };
  pendingChoices?: ChoiceDefinition[];
  /**
   * SRD 5.1 legal status. CONFIRMED via direct verification against the
   * actual SRD 5.1 text (5thsrd.org) on 2026-08-04: the Feats section
   * contains ONLY Grappler. This resolved a prior optimistic guess (all 42
   * PHB feats, based on a "generous inclusion" pattern seen in other
   * content types) that turned out NOT to apply to feats — the same
   * verification pass found the identical narrow-inclusion pattern for
   * backgrounds (only Acolyte). Computed in src/content/feats/index.ts as
   * `id === 'grappler'`. See docs/ROADMAP_1.0.md Phase 1 Step 1.4 for the
   * full verification writeup.
   */
  srd?: boolean;
  /** Which ruleset this feat belongs to. Undefined = available under every ruleset. See the ContentHeader comment in primitives.ts. */
  rulesetId?: RulesetId;
  /** Where this homebrew came from (a book, a creator, a post). Optional; set by the builders and kept with the content. */
  origin?: ContentOrigin;
};

/** Namespacing convention for Feat.pendingChoices ids — see that field's doc
 * comment. Unlike RACE_CHOICE_PREFIX/BACKGROUND_CHOICE_PREFIX, sweeping on
 * removal doesn't scan for this prefix directly; removeFeature() instead
 * namespaces by the compiled feature's own id via queueChoice's originId
 * param, since a feat (unlike a race/background) is removed individually
 * while others may remain. This prefix exists purely to avoid id collisions
 * with other choice sources when a feat is authored. */
export const FEAT_CHOICE_PREFIX = 'feat_choice_';

export type ContentDB = {
  races:       Race[];
  classes:     CharClass[];
  backgrounds: Background[];
  spells:      Spell[];
  items:       Item[];
  conditions:  Condition[];
  features:    Feature[];
  feats?:      Feat[];   // optional so existing ContentDB literals remain valid
};

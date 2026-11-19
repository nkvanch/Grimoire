// ── 1. Primitive aliases & shared enums ─────────────────────────────────────

/**
 * Compile-time-only nominal typing for content ids — `Brand<string,'X'>` is
 * still a plain string at runtime (JSON/SQLite round-trips need no changes),
 * it just stops TypeScript from accepting a SpellId where a RaceId is
 * expected. Deliberately applied only at a few verified-unambiguous sites
 * (see the branded types below) — most content ids stay plain `string`
 * because they're either polymorphic (e.g. FeatureSource.refId holds a
 * different content type's id depending on `kind`) or hand-authored as
 * string literals across src/content/** in volumes that would make a full
 * branding rollout a large mechanical change for no near-term payoff. See
 * docs/NEW architecture/ (or the fundamental-changes migration plan) for
 * the full reasoning.
 */
type Brand<K, T extends string> = K & { readonly __brand: T };

export type RaceId       = Brand<string, 'RaceId'>;
export type SubraceId    = Brand<string, 'SubraceId'>;
export type ClassId      = Brand<string, 'ClassId'>;
export type SubclassId   = Brand<string, 'SubclassId'>;
export type BackgroundId = Brand<string, 'BackgroundId'>;
export type FeatId       = Brand<string, 'FeatId'>;
export type SpellId      = Brand<string, 'SpellId'>;
export type ItemId       = Brand<string, 'ItemId'>;
export type ConditionId  = Brand<string, 'ConditionId'>;
export type MonsterId    = Brand<string, 'MonsterId'>;
/** Not yet used — added now so the Phase 4 ContentHeader/rulesetId work doesn't need to reintroduce the Brand<> pattern. */
export type RulesetId    = Brand<string, 'RulesetId'>;
/**
 * Identifies a GAME SYSTEM (D&D, Pathfinder, Old-School Essentials, …) — one
 * level above RulesetId (a specific edition/printing WITHIN a game, e.g.
 * 'dnd5e-2014' vs 'dnd5e-2024'). Content is never tagged with a GameId
 * directly — only with a RulesetId — a content item's game is always
 * DERIVED via `gameIdForRuleset()` (src/content/rulesets.ts), which looks
 * the ruleset up in the static RULESETS registry and returns its `gameId`.
 * This is deliberate: duplicating the same Game value onto every content
 * definition alongside its RulesetId would be redundant, derivable data —
 * exactly the kind of duplicated-truth the ruleset/source/pack metadata
 * work (see ContentProvenance below) is designed to avoid.
 */
export type GameId       = Brand<string, 'GameId'>;

export const asRaceId       = (id: string): RaceId       => id as RaceId;
export const asSubraceId    = (id: string): SubraceId    => id as SubraceId;
export const asClassId      = (id: string): ClassId      => id as ClassId;
export const asSubclassId   = (id: string): SubclassId   => id as SubclassId;
export const asBackgroundId = (id: string): BackgroundId => id as BackgroundId;
export const asFeatId       = (id: string): FeatId       => id as FeatId;
export const asSpellId      = (id: string): SpellId      => id as SpellId;
export const asItemId       = (id: string): ItemId       => id as ItemId;
export const asConditionId  = (id: string): ConditionId  => id as ConditionId;
export const asMonsterId    = (id: string): MonsterId    => id as MonsterId;
export const asRulesetId    = (id: string): RulesetId    => id as RulesetId;
export const asGameId       = (id: string): GameId       => id as GameId;

/** Where a piece of homebrew came from, for content that was not made in Grimoire: a name (book, creator, post) and an optional link. */
export type ContentOrigin = { name: string; link?: string };

/**
 * Documented reference shape, NOT a structural base type — no content type
 * `extends`/intersects this. Every content type (Race, CharClass, Spell,
 * Item, Feat, Background, ClassProgression, MonsterTemplate) informally
 * carries an `id`/`name`/`rulesetId?`/`srd?` shape close to this one, but
 * `Condition` doesn't carry `srd`, and nothing in the app today needs to
 * treat "any content type" polymorphically — restructuring every type to
 * literally extend a shared base would touch every content file for no
 * current consumer, the same mistake Phase 3 avoided for full id branding.
 * Exists here purely so the intended common shape has one documented name.
 */
export type ContentHeader = {
  id:         string;
  name:       string;
  /** Undefined = available under every ruleset (every piece of content authored before 5.5e, i.e. everything today). */
  rulesetId?: RulesetId;
  srd?:       boolean;
};

/**
 * True if a piece of content (via its own optional `rulesetId`) should be
 * visible under `activeRuleset`. Untagged content (`contentRulesetId`
 * undefined) is shared across every ruleset — most content stays untagged
 * indefinitely (5.5e reuses most 5e content unchanged, so only the pieces
 * 5.5e actually revises need to be tagged). An untagged `activeRuleset`
 * means no filter is active (matches everything) — the state of every
 * character/screen until Phase 6 ships an actual ruleset picker.
 */
export function matchesRuleset(
  contentRulesetId: RulesetId | undefined,
  activeRuleset:    RulesetId | undefined,
): boolean {
  return contentRulesetId === undefined || activeRuleset === undefined || contentRulesetId === activeRuleset;
}

/**
 * Same "untagged = shared/matches everything" compatibility policy as
 * matchesRuleset, one level up: a content item's Game is never stored
 * directly (see GameId's doc comment) — it's derived by resolving
 * `contentRulesetId` through the RULESETS registry (src/content/rulesets.ts,
 * which calls this indirectly via matchesGame there — kept here only as
 * the boolean-semantics primitive both matchesRuleset and matchesGame
 * share, so the "undefined means universal" rule is defined exactly once).
 */
export function matchesOptionalTag<T>(contentTag: T | undefined, activeTag: T | undefined): boolean {
  return contentTag === undefined || activeTag === undefined || contentTag === activeTag;
}

export type Ability = 'str' | 'dex' | 'con' | 'int' | 'wis' | 'cha';

export type SkillName =
  | 'athletics' | 'acrobatics' | 'sleight_of_hand' | 'stealth'
  | 'arcana' | 'history' | 'investigation' | 'nature' | 'religion'
  | 'animal_handling' | 'insight' | 'medicine' | 'perception' | 'survival'
  | 'deception' | 'intimidation' | 'performance' | 'persuasion';

export type AdvantageState   = 'straight' | 'advantage' | 'disadvantage';

/** What an ability substitution applies to: attack and damage rolls with weapons, ability checks (skills included), saving throws. */
export type AbilityUseKind = 'weapon_attacks' | 'ability_checks' | 'saving_throws';
export type ResistanceState  = 'none' | 'resistance' | 'immunity' | 'vulnerability';
export type StrategyKind     = 'stat_modifier' | 'named_bonus' | 'advantage_track' | 'temp_hp' | 'base_ac_formula';

export interface AttackBonus {
  /** Historically the equipped item's `itemId` (definition id) for a weapon
   *  attack, or a synthetic id ('unarmed_strike') otherwise — kept exactly
   *  as-is for every existing consumer. When TWO equipped instances share
   *  an `itemId`, computeWeaponAttackBonuses (pipeline.ts) still produces
   *  one AttackBonus per instance (never deduplicated), but `id` alone can
   *  no longer tell them apart — see `instanceId` below, the item-identity
   *  closure's fix for that. */
  id:          string;
  /** Item-identity closure: the equipped ItemInstance's own `id` (owned-
   *  copy identity), when the instance has one — undefined for a synthetic
   *  entry (Unarmed Strike) or a still-unmigrated instance. Lets a caller
   *  that HAS a specific ItemInstance in hand (e.g. actionCards.ts's
   *  equipped-item loop) find the EXACT matching AttackBonus instead of
   *  `.find(a => a.id === itemId)`'s old first-match-only behavior, which
   *  silently returned the same entry for every instance sharing itemId. */
  instanceId?: string;
  name:        string;
  bonus:       number;
  type:        'melee' | 'ranged' | 'spell' | string;
  ability:     'str' | 'dex';
  damageBonus: number;
  damageDice:  string;
  damageType:  string;
  /** Great Weapon Fighting on a melee weapon held in two hands: reroll a 1 or 2 once (2014) or count it as a 3 (2024). */
  damageDieRule?: DamageDieRule;
  /** A light melee weapon while another is worn: the damage bonus of its off-hand (bonus action) attack, which adds no positive
   *  ability modifier unless the character has Two-Weapon Fighting. Absent when there is no off-hand attack. */
  offHandDamageBonus?: number;
}

export type DamageDieRule = 'reroll_1_2' | 'min_3';

export type FilterExpression = Record<string, unknown>;

export type Action = {
  id:          string;
  name:        string;
  description: string;
};

export type GrantResult = {
  type:     string;
  targetId: string;
  value:    unknown;
};

export type AbilityGenerationMode = 'standard' | 'pointbuy' | 'manual' | 'roll';
export type PointBuyConfig = { budget:number; minimum:number; maximum:number; costs:Record<number,number> };

/** Alternatives, any one of which is enough; each lists abilities that all need at least their minimum (13 when absent). The desktop's shape. */
export type MulticlassPrerequisites = { ability: Ability; minimum?: number }[][];

export type CampaignRules = {
  maxAbilityScore: number | null;
  maxLevel:        number | null;
  useXP:           boolean;
  hpMode:          'fixed' | 'rolled' | 'max';
  allowMulticlass: boolean;
  /** Whether a new class needs the abilities its multiclass requirement names (engine/multiclassPrerequisites.ts). On unless false. */
  multiclassPrerequisites?: boolean;
  customRules:     Record<string, unknown>;
  abilityGenerationMode?: AbilityGenerationMode;
  pointBuy?: PointBuyConfig;
};

/** Named, persisted overrides for rule values the current engine already understands. */
export type CustomRuleProfile = {
  id: string;
  name: string;
  gameId: GameId;
  baseRulesetId: RulesetId;
  rules: Partial<CampaignRules> & { customRules?: Record<string, unknown> };
  source: { kind: 'local' | 'imported' | 'preset'; label?: string };
  createdAt: number;
  updatedAt: number;
};

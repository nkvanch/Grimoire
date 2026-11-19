// ============================================================================
// FILE: src/engine/defaults.ts
// The default campaign rules and the empty entity every character and monster starts from. Pure data, so the
// engine does not reach into the store for them (contract ARCH-003); src/store/characterStore.ts re-exports both.
// ============================================================================
import { Entity, CampaignRules, SkillName, SkillEntry, AbilityScores, RulesetId } from './types';

// ── Default campaign rules ────────────────────────────────────────────────────

export const DEFAULT_RULES: CampaignRules = {
  maxAbilityScore: 20,
  maxLevel:        20,
  useXP:           false,
  hpMode:          'fixed',
  allowMulticlass: false,
  customRules:     {},
  abilityGenerationMode: 'standard',
};

// ── Default skill block ───────────────────────────────────────────────────────

const ALL_SKILLS: { name: SkillName; ability: 'str' | 'dex' | 'con' | 'int' | 'wis' | 'cha' }[] = [
  { name: 'athletics',        ability: 'str' },
  { name: 'acrobatics',       ability: 'dex' },
  { name: 'sleight_of_hand',  ability: 'dex' },
  { name: 'stealth',          ability: 'dex' },
  { name: 'arcana',           ability: 'int' },
  { name: 'history',          ability: 'int' },
  { name: 'investigation',    ability: 'int' },
  { name: 'nature',           ability: 'int' },
  { name: 'religion',         ability: 'int' },
  { name: 'animal_handling',  ability: 'wis' },
  { name: 'insight',          ability: 'wis' },
  { name: 'medicine',         ability: 'wis' },
  { name: 'perception',       ability: 'wis' },
  { name: 'survival',         ability: 'wis' },
  { name: 'deception',        ability: 'cha' },
  { name: 'intimidation',     ability: 'cha' },
  { name: 'performance',      ability: 'cha' },
  { name: 'persuasion',       ability: 'cha' },
];

function makeDefaultSkills(): Record<SkillName, SkillEntry> {
  const skills = {} as Record<SkillName, SkillEntry>;
  for (const s of ALL_SKILLS) {
    skills[s.name] = { ability: s.ability, trained: false, expertise: false, bonus: null };
  }
  return skills;
}

// ── Empty entity factory ──────────────────────────────────────────────────────

/** Returns a fully-typed empty entity ready to receive leveling and creation steps. */
export function makeEmptyEntity(id: string, kind: Entity['kind'] = 'character'): Entity {
  const defaultStats: AbilityScores = { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 };

  const defaultDerived = {
    proficiencyBonus:  2,
    ac:                10,
    initiative:        0,
    speed:             30,
    passivePerception:    10,
    passiveInvestigation: 10,
    passiveInsight:       10,
    senses:            [],
    movement:          {},
    savingThrows:      { str: 0, dex: 0, con: 0, int: 0, wis: 0, cha: 0 },
    attackBonuses:     [],
    advantageStates:   [],
    spellSaveDC:       null,
    spellAttackBonus:  null,
    kiSaveDC:          null,
    abilityBasedDC:    { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    attackActionAttacks: 1,
  };

  return {
    id,
    kind,
    identity: {
      name:         '',
      level:        0,
      raceId:       '',
      subRaceId:    null,
      classId:      '',
      subclassId:   null,
      backgroundId: '',
      alignment:    null,
      xp:           0,
    },
    stats:   defaultStats,
    derived: defaultDerived,
    skills:  { skills: makeDefaultSkills() },
    proficiencies: {
      armor:        [],
      weapons:      [],
      tools:        [],
      languages:    [],
      savingThrows: [],
    },
    resources: {
      hp:      { current: 0, maximum: 0, temp: 0 },
      hitDice: { die: 8, total: 0, remaining: 0 },
      speed:   30,
      ac:      0,
      custom:  [],
      deathSaves: { successes: 0, failures: 0, stable: false },
    },
    spellcasting: null,
    inventory: {
      equipped: [],
      carried:  [],
      currency: { pp: 0, gp: 0, ep: 0, sp: 0, cp: 0 },
    },
    conditions:       [],
    conditionMonitor: { active: [], exhaustion: 0, flags: {} },
    features:         [],
    choices:          [],
    characterOverrides: [],
    dmOverrides:      [],
    wildShapeState:   null,
    notes:            '',
  };
}

/** The ruleset of a character saved before characters had one (the app was 2014-only then); the engine already reads a missing
 *  ruleset as 2014 (ruleset/dnd5ePinning.ts). */
export const LEGACY_RULESET_ID = 'dnd5e-2014' as RulesetId;

/**
 * A character with its ruleset set: one with none gets the 2014 rules. Without it, content looked up for the character covered every
 * edition (found 2026-11-17: the sample character's condition picker listed each condition twice, the 2014 and the 2024 record).
 */
export function withDefaultRuleset(entity: Entity): Entity {
  return entity.rulesetId ? entity : { ...entity, rulesetId: LEGACY_RULESET_ID };
}

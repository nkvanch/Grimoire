// Homebrew authoring for the native-parity fixtures: draft traits, feats, spells and items, and what the app compiles them to.
// The executors are the app's own code (content/traitCompiler.ts, content/homebrewCompile.ts, engine/homebrewValidator.ts).
import type { DraftTrait, Feature } from '../types';
import { newDraftTrait, buildTraitFeature } from '../../content/traitCompiler';
import {
  compileFeatFields, compileSpellFields, compileItemFields, compileClassFields, compileSubclassFields,
  compileRaceFields, compileBackgroundFields, compileConditionFields,
  type ConditionDraft, type FeatDraft, type SpellDraft, type ItemDraft, type ClassDraft, type SubclassDraft, type RaceDraft, type BackgroundDraft,
} from '../../content/homebrewCompile';
import { validateFeat, validateSpell, validateItem, validateClass, validateSubclass, validateRace } from '../homebrewValidator';
import { buildProgressionFromClass, getProgressionForClass } from '../../content/classes/progressions';
import { simulate } from '../simulate';
import { applyGrant } from '../levelingGrants';
import { applyCondition } from '../conditions';
import {
  draftChoiceToDefinition, definitionToDraftChoice, validateDraftChoice, type DraftChoice, type AuthorableChoiceKind,
} from '../../content/choiceDefinitionCompiler';
import {
  featurePoolDraftToDefinition, definitionToFeaturePoolDraft, validateFeaturePoolDraft, newFeaturePoolDraft,
  type FeaturePoolDraft, type FeaturePoolOwner,
} from '../../content/featurePoolChoice';
import { ALL_TOOLS, TOOL_CATEGORY_ORDER } from '../../content/tools';
import { ALL_LANGUAGES, LANGUAGE_CATEGORY_ORDER, SELECTABLE_LANGUAGE_CATEGORIES } from '../../content/languages';
import { ALL_SKILL_OPTIONS } from '../../content/skills';
import { createCharacter } from '../../content/provider/createCharacter';
import { DEFAULT_RULES, makeEmptyEntity } from '../defaults';
import type { Providers, LevelStep, LevelRulesArg } from './parityLevelScenarios';
import type { CharClass, Entity } from '../types';

type Over = Partial<DraftTrait>;
let seq = 0;
/** A draft trait with a fixed local id, so a regenerated fixture differs only when behaviour does. */
export function trait(name: string, over: Over = {}): DraftTrait {
  seq += 1;
  return { ...newDraftTrait(name), localId: `t_${seq}`, ...over };
}

export type TraitOpts = { idPrefix: string; sourceKind: 'race' | 'class' | 'subclass' | 'feat' | 'item' | 'background'; sourceRefId: string; level: number | null };
export type TraitCase = { name: string; traits: DraftTrait[]; opts: TraitOpts };

const feat: TraitOpts = { idPrefix: 'hb_feat', sourceKind: 'feat', sourceRefId: 'hb_feat', level: null };
const cls: TraitOpts = { idPrefix: 'hb_class_l3', sourceKind: 'class', sourceRefId: 'hb_class', level: 3 };

export function buildTraitCases(): TraitCase[] {
  seq = 0;
  const out: TraitCase[] = [];
  const one = (name: string, t: DraftTrait, opts: TraitOpts = feat) => out.push({ name, traits: [t], opts });

  one('flavor', trait('Steady Gait', { description: 'You walk steadily.' }));
  one('flavor-no-description', trait('Quiet'));
  one('ability-score', trait('Strong', { effectKind: 'ability_score', abilityTarget: 'str', abilityAmount: '2' }));
  one('ability-score-zero', trait('Nothing', { effectKind: 'ability_score', abilityTarget: 'dex', abilityAmount: '0' }));
  one('unarmored-defense', trait('Bare Skin', { effectKind: 'unarmored_defense', unarmoredBase: '10', unarmoredAbilities: ['dex', 'wis'] }));
  one('unarmored-defense-capped', trait('Capped', { effectKind: 'unarmored_defense', unarmoredBase: '12', unarmoredAbilities: ['dex', 'con'], unarmoredCaps: { dex: '2' } }));
  one('unarmored-defense-empty', trait('No Abilities', { effectKind: 'unarmored_defense', unarmoredAbilities: [] }));
  one('ac-bonus', trait('Tough Hide', { effectKind: 'ac_bonus', acBonusAmount: '1' }));
  one('ac-bonus-zero', trait('No AC', { effectKind: 'ac_bonus', acBonusAmount: '0' }));
  one('skill', trait('Scholar', { effectKind: 'skill_proficiency', skillTarget: 'arcana' }));
  one('skill-expertise', trait('Master Scholar', { effectKind: 'skill_proficiency', skillTarget: 'history', skillExpertise: true }));
  one('tool', trait('Tinker', { effectKind: 'tool_proficiency', toolName: "Smith's Tools" }));
  one('tool-empty', trait('No Tool', { effectKind: 'tool_proficiency', toolName: '  ' }));
  one('advantage', trait('Fey Ward', { effectKind: 'advantage_disadvantage', advDirection: 'advantage', advTarget: 'saving throws against being charmed' }));
  one('disadvantage', trait('Light Sensitivity', { effectKind: 'advantage_disadvantage', advDirection: 'disadvantage', advTarget: 'attack rolls in sunlight' }));
  one('sense', trait('Dark Eyes', { effectKind: 'sense', senseType: 'darkvision', senseRange: '60' }));
  one('sense-zero', trait('No Sense', { effectKind: 'sense', senseRange: '0' }));
  one('movement', trait('Wings', { effectKind: 'movement', moveType: 'fly', moveRange: '30' }));
  one('movement-condition', trait('Sure Footed', { effectKind: 'movement_condition', moveCondTargets: ['grappled', 'restrained'], moveCondFlavor: 'Difficult terrain still slows you' }));
  one('movement-condition-flavor-period', trait('Sure Footed 2', { effectKind: 'movement_condition', description: 'Nothing holds you.', moveCondTargets: ['stunned'], moveCondFlavor: 'Except walls' }));
  one('resistance', trait('Fire Blood', { effectKind: 'damage_resistance', damageType: 'Fire' }));
  one('immunity', trait('Poison Proof', { effectKind: 'damage_immunity', damageType: 'poison' }));
  one('vulnerability', trait('Brittle', { effectKind: 'damage_vulnerability', damageType: 'thunder' }));
  one('resistance-empty', trait('No Type', { effectKind: 'damage_resistance', damageType: ' ' }));

  for (const [target, op, amount] of [
    ['speed', 'add', '10'], ['speed', 'set', '40'], ['speed', 'scale', '1.5'], ['initiative', 'add', '5'], ['initiative', 'scale', '2'],
    ['extra_attack', 'add', '1'], ['spell_save_dc', 'add', '1'], ['spell_attack_bonus', 'add', '2'], ['passive_perception', 'add', '5'],
    ['passive_investigation', 'add', '5'], ['passive_insight', 'add', '5'],
  ] as const) {
    one(`stat-${target}-${op}`, trait('Stat', { effectKind: 'stat_bonus', statTarget: target, statOperation: op, statAmount: amount }));
  }
  one('stat-saves-all', trait('Saves', { effectKind: 'stat_bonus', statTarget: 'saving_throw', statSaveAbility: 'all', statOperation: 'add', statAmount: '1' }));
  one('stat-saves-one', trait('Wis Save', { effectKind: 'stat_bonus', statTarget: 'saving_throw', statSaveAbility: 'wis', statOperation: 'add', statAmount: '2' }));
  one('stat-meaningless-scale', trait('Times One', { effectKind: 'stat_bonus', statTarget: 'speed', statOperation: 'scale', statAmount: '1' }));
  one('stat-set-zero', trait('Rooted', { effectKind: 'stat_bonus', statTarget: 'speed', statOperation: 'set', statAmount: '0' }));
  one('stat-bad-op-for-target', trait('Bad Op', { effectKind: 'stat_bonus', statTarget: 'extra_attack', statOperation: 'set', statAmount: '1' }));
  one('gear-armor', trait('Armor Training', { effectKind: 'gear_proficiency', gearKind: 'armor', gearName: 'Heavy' }));
  one('gear-weapon', trait('Weapon Training', { effectKind: 'gear_proficiency', gearKind: 'weapon', gearName: 'Martial Weapons' }));
  one('gear-empty', trait('No Gear', { effectKind: 'gear_proficiency', gearName: ' ' }));
  one('condition-immunity', trait('Iron Mind', { effectKind: 'condition_immunity', conditionImmunityTarget: 'Charmed' }));

  one('spell-grant-cantrip', trait('Gift', { effectKind: 'spell_grant', spellGrantCantripId: 'firebolt', spellGrantAbility: 'cha' }));
  one('spell-grant-pool-and-slot', trait('Gifts', {
    effectKind: 'spell_grant', spellGrantCantripId: 'light', spellGrantAbility: 'int',
    spellGrants: [
      { localId: 'g1', spellId: 'shield', spellName: 'Shield', actionType: 'reaction', unlockLevel: '3', mode: 'resource', recharge: 'long_rest', rechargeOther: '', uses: '2', minSlotLevel: '1' },
      { localId: 'g2', spellId: 'fireball', spellName: 'Fireball', actionType: 'action', unlockLevel: '5', mode: 'slot', recharge: 'long_rest', rechargeOther: '', uses: '1', minSlotLevel: '4' },
      { localId: 'g3', spellId: 'misty_step', spellName: '', actionType: 'bonus_action', unlockLevel: 'x', mode: 'resource', recharge: 'other', rechargeOther: 'Dawn', uses: '0', minSlotLevel: '1' },
      { localId: 'g4', spellId: '', spellName: 'Empty', actionType: 'action', unlockLevel: '1', mode: 'slot', recharge: 'long_rest', rechargeOther: '', uses: '1', minSlotLevel: '1' },
    ],
  }));

  one('resource-ability', trait('Second Wind', { effectKind: 'resource_ability', actionType: 'bonus_action', recharge: 'short_rest', uses: '1', healDice: '1d10' }));
  one('resource-ability-other-action', trait('Odd Move', { effectKind: 'resource_ability', actionType: 'other', actionTypeOther: 'When you rest', recharge: 'other', rechargeOther: 'a full moon', uses: '3', healDice: '' }));
  one('resource-ability-save', trait('Burst', { effectKind: 'resource_ability', actionType: 'action', recharge: 'long_rest', uses: '2', healDice: '', saveEnabled: true, saveAbility: 'con', saveDcMode: 'ability', saveDcAbility: 'cha' }));
  one('resource-ability-save-spell', trait('Hex Bolt', { effectKind: 'resource_ability', actionType: 'action', recharge: 'dawn', uses: '1', healDice: '', saveEnabled: true, saveAbility: 'wis', saveDcMode: 'spell' }));
  one('resource-ability-save-fixed', trait('Trap', { effectKind: 'resource_ability', actionType: 'reaction', recharge: 'monthly', uses: '1', healDice: '', saveEnabled: true, saveAbility: 'dex', saveDcMode: 'fixed', saveDcFixed: '15' }));
  one('resource-ability-scaled-proficiency', trait('Surge', { effectKind: 'resource_ability', uses: '2', usesScaling: 'proficiency', healDice: '' }));
  one('resource-ability-scaled-ability', trait('Surge 2', { effectKind: 'resource_ability', uses: '1', usesScaling: 'ability', usesScalingAbility: 'cha', healDice: '' }));
  one('resource-ability-scaled-level', trait('Surge 3', { effectKind: 'resource_ability', uses: '1', usesScaling: 'level', usesPerLevel: '2', healDice: '' }));
  one('resource-ability-spends-existing', trait('Ki Strike', { effectKind: 'resource_ability', spendsResourceId: 'ki', spendsQuantity: '2', healDice: '' }));

  one('limited-use-on-resistance', trait('Warding', { effectKind: 'damage_resistance', damageType: 'cold', limitedUse: true, actionType: 'reaction', recharge: 'short_rest', uses: '3' }));
  one('limited-use-flavor', trait('Opportunist', { limitedUse: true, actionType: 'reaction', recharge: 'long_rest', uses: '1' }));
  one('limited-use-save-scaled', trait('Roar', { limitedUse: true, actionType: 'action', recharge: 'long_rest', uses: '1', usesScaling: 'proficiency', saveEnabled: true, saveAbility: 'wis', saveDcMode: 'ability', saveDcAbility: 'str' }));
  one('at-will', trait('Cunning Action', { atWill: true, actionType: 'bonus_action' }));
  one('spends-existing-on-flavor', trait('Spend Rage', { spendsResourceId: 'rage', actionType: 'bonus_action' }));
  one('limited-use-other-action', trait('Free Use', { limitedUse: true, actionType: 'other', actionTypeOther: 'on your turn', recharge: 'dawn', uses: '2' }));

  // advanced fields
  one('adv-riders', trait('Brand', {
    limitedUse: true, actionType: 'bonus_action', recharge: 'short_rest', uses: '2',
    riders: [
      { name: 'Searing Smite', on: 'hit', dice: '2d6', damageType: 'Fire', note: 'ignites the target', limit: 'once_per_turn', requires: 'a weapon attack', clears: '', usesPool: true },
      { name: ' ', on: 'hit', dice: '1d4', damageType: '', note: '', limit: 'unlimited', requires: '', clears: '', usesPool: false },
      { name: 'Mark', on: 'hit', dice: '', damageType: '', note: 'marked', limit: 'once_per_turn', requires: '', clears: 'a short rest', usesPool: false },
    ] as never,
  }));
  one('adv-suspend', trait('Raging Flame', { effectKind: 'damage_resistance', damageType: 'fire', suspendDamageType: 'Cold', suspendUntil: 'end_of_this_turn' }));
  one('adv-suspend-default', trait('Raging Flame 2', { effectKind: 'damage_resistance', damageType: 'fire', suspendDamageType: 'cold' }));
  one('adv-also-costs', trait('Lunge', { atWill: true, actionType: 'action', alsoCosts: 'bonus_action' }));
  one('adv-temp-hp', trait('Bolster', { limitedUse: true, recharge: 'short_rest', uses: '1', tempHpDice: 'PBd6' }));
  one('adv-heal-from-damage', trait('Mend', { atWill: true, healFromDamageFraction: '0.5', healFromDamageTurnsBack: '2' }));
  one('adv-track', trait('Quarry', { atWill: true, trackEffectName: 'Quarry', trackRecords: true, trackUntil: 'end_of_next_turn', trackRecordUntil: 'end_of_this_turn' }));
  one('adv-grant-speed', trait('Lift Off', { limitedUse: true, recharge: 'long_rest', uses: '1', grantSpeedType: 'fly', grantSpeedAmount: '60', grantSpeedUnit: 'minutes', grantSpeedFor: '10' }));
  one('adv-outcome-regain', trait('Riposte', { limitedUse: true, recharge: 'short_rest', uses: '2', tempHpDice: '1d4', outcomeOn: 'hit', outcomeRegain: '1' }));
  one('adv-aura-ac', trait('Guardian Aura', { auraEnabled: true, auraLabel: 'Guard', auraRange: '10 feet', auraAffects: 'allies_and_self', auraStat: 'ac', auraAmount: '1' }));
  one('adv-aura-saves-cha', trait('Aura of Protection', { auraEnabled: true, auraRange: '10 feet', auraAffects: 'allies', auraStat: 'saves', auraAmount: '0', auraAddAbility: 'cha' }));
  one('adv-aura-resistance', trait('Warding Aura', { auraEnabled: true, auraStat: 'resistance', auraResistType: 'Necrotic', auraAmount: '' }));
  one('adv-derived-rules', trait('Odd Body', { armorDexCap: true, critImmune: true, critRange: '19', infusionBonus: '2', appliesInBeastForm: true, effectKind: 'ac_bonus', acBonusAmount: '1' }));
  one('adv-ability-substitute', trait('Force of Will', { substituteFrom: 'str', substituteTo: 'cha', substituteFor: ['attack', 'damage'] as never }));
  one('adv-crit-range-out-of-bounds', trait('Edge', { critRange: '20' }));
  one('adv-resource-upgrade', trait('More Dice', { raiseResourceId: 'superiority_dice', raiseResourceTo: '5' }), cls);
  one('class-level-feature', trait('Sneak Attack', { effectKind: 'resource_ability', uses: '1', healDice: '' }), cls);

  // several traits built together: ids that would collide, a pool another trait spends from
  out.push({
    name: 'multi-same-name', opts: cls,
    traits: [trait('Resilience', { effectKind: 'damage_resistance', damageType: 'fire' }), trait('Resilience', { effectKind: 'damage_resistance', damageType: 'cold' }), trait('Resilience')],
  });
  const pool = trait('Fury Pool', { effectKind: 'resource_ability', uses: '3', healDice: '' });
  out.push({
    name: 'multi-local-resource', opts: cls,
    traits: [
      pool,
      trait('Fury Strike', { spendsResourceId: `local:${pool.localId}`, spendsQuantity: '2', actionType: 'action' }),
      trait('Fury Growth', { raiseResourceId: `local:${pool.localId}`, raiseResourceTo: '4' }),
    ],
  });
  return out;
}

/** The compile of every trait of a case, with one shared id set and one shared pool map, as the class and race builders do. */
export function runTraitCase(c: TraitCase) {
  const usedIds = new Set<string>();
  const localResources = new Map<string, string>();
  return c.traits.map(t => {
    const built = buildTraitFeature(t, { ...c.opts, usedIds, localResources });
    return {
      feature: built.feature,
      resource: built.resource,
      extraFeatures: built.extraFeatures ?? null,
      extraResources: built.extraResources ?? null,
      resourceUpgrades: built.resourceUpgrades ?? null,
    };
  });
}

// ── feats, spells, items ─────────────────────────────────────────────────────────────────────────────────────────────────

export type FeatCase = { name: string; id: string; draft: FeatDraft };
export type SpellCase = { name: string; id: string; draft: SpellDraft };
export type ItemCase = { name: string; id: string; draft: ItemDraft };

export function buildFeatCases(): FeatCase[] {
  const base = (over: Partial<FeatDraft> = {}): FeatDraft => ({
    name: 'Stout Heart', prerequisite: '', source: 'Homebrew', sourceLink: '', description: 'You are hard to rattle.',
    trait: trait('Effect', { effectKind: 'stat_bonus', statTarget: 'initiative', statOperation: 'add', statAmount: '2' }),
    abilityChoice: null, skillPicks: [], ...over,
  });
  return [
    { name: 'plain', id: 'stout_heart', draft: base() },
    { name: 'with-source-and-link', id: 'stout_heart_2', draft: base({ source: 'The Grey Book', sourceLink: ' https://example.test/grey ', prerequisite: ' Strength 13 ' }) },
    { name: 'link-only', id: 'stout_heart_3', draft: base({ sourceLink: 'https://example.test/only' }) },
    { name: 'ability-choice', id: 'iron_will', draft: base({ name: 'Iron Will', abilityChoice: { options: ['wis', 'cha'], amount: '1', grantsSaveProficiency: true } }) },
    { name: 'ability-choice-bad-amount', id: 'iron_will_2', draft: base({ name: 'Iron Will 2', abilityChoice: { options: ['wis'], amount: 'x', grantsSaveProficiency: false } }) },
    { name: 'ability-choice-no-options', id: 'iron_will_3', draft: base({ name: 'Iron Will 3', abilityChoice: { options: [], amount: '1', grantsSaveProficiency: false } }) },
    { name: 'skill-picks', id: 'skilled_hand', draft: base({ name: 'Skilled Hand', skillPicks: [
      { id: 'pick_1', label: 'Choose a skill', mode: 'proficiency', from: 'any' },
      { id: 'pick_2', label: 'Expert in one', mode: 'expertise', from: 'proficient' },
    ] }) },
    { name: 'resource-feature', id: 'second_chance', draft: base({ name: 'Second Chance', trait: trait('Effect', { effectKind: 'resource_ability', uses: '1', recharge: 'long_rest', healDice: '' }) }) },
    { name: 'empty-name', id: 'nameless', draft: base({ name: '  ', description: '' }) },
    { name: 'ruleset', id: 'new_style', draft: base({ name: 'New Style', rulesetId: 'dnd5e-2024' as never }) },
    { name: 'with-choices', id: 'scholars_gift', draft: base({ name: 'Scholars Gift', pendingChoices: [
      { localId: 'p1', kind: 'expertise', count: '1', prompt: '', poolMode: 'all', categories: [], restrictedIds: [] },
      { localId: 'p2', kind: 'language', count: '2', prompt: 'Two tongues.', poolMode: 'category', categories: ['common'], restrictedIds: [] },
    ] }) },
  ];
}

export function buildSpellCases(): SpellCase[] {
  const base = (over: Partial<SpellDraft> = {}): SpellDraft => ({
    name: 'Ember Lance', level: 1, school: 'Evocation', castingTime: '1 action', range: '60 feet', components: ['V', 'S'], duration: 'Instantaneous',
    description: 'A lance of embers deals 2d6 fire damage.', upcast: '', tiers: [], ritual: false, concentration: false, spellTypes: [], ...over,
  });
  return [
    { name: 'plain', id: 'ember_lance', draft: base() },
    { name: 'concentration-ritual', id: 'quiet_vigil', draft: base({ name: 'Quiet Vigil', level: 2, school: 'Divination', ritual: true, concentration: true, duration: '1 hour', upcast: ' Targets one more creature per level. ', spellTypes: ['Utility', 'Buff'] }) },
    { name: 'cantrip-tiers', id: 'spark', draft: base({ name: 'Spark', level: 0, description: 'Deals 1d8 lightning damage.', tiers: [
      { level: '5', dice: '2d8', count: '' }, { level: '11', dice: '3D8', count: '' }, { level: '17', dice: '4d8', count: '2' }, { level: '25', dice: '9d9', count: '' },
      { level: '5', dice: '2d8+1', count: '' }, { level: '9', dice: '', count: '3' }, { level: '3', dice: 'nope', count: '' },
    ] }) },
    { name: 'tiers-ignored-above-cantrip', id: 'not_a_cantrip', draft: base({ name: 'Not A Cantrip', level: 3, tiers: [{ level: '5', dice: '2d8', count: '' }] }) },
    { name: 'level-ten-warning', id: 'world_ender', draft: base({ name: 'World Ender', level: 10 }) },
    { name: 'material', id: 'bell_ring', draft: base({ name: 'Bell Ring', components: ['V', 'S', 'M'], origin: { name: ' A Zine ', link: 'https://example.test/zine' } }) },
    { name: 'missing-fields', id: 'blank', draft: base({ name: '', school: ' ', castingTime: '', range: '', duration: '', description: '' }) },
    { name: 'ruleset', id: 'ember_lance_24', draft: base({ rulesetId: 'dnd5e-2024' as never }) },
  ];
}

export function buildItemCases(): ItemCase[] {
  const flavor = () => trait('Effect');
  const base = (over: Partial<ItemDraft> = {}): ItemDraft => ({
    name: 'Ashen Blade', cost: '', weight: '', description: 'Pale as old ash.', category: 'weapon', rarity: null, armorCategory: 'light armor',
    weaponProps: [], extraProps: '', weaponClass: null, weaponRangeSel: null, weaponDamage: [{ dice: '1d8', damageType: 'slashing' }],
    acValue: '', acAddsDex: false, trait: flavor(), ...over,
  });
  return [
    { name: 'weapon', id: 'hb_ashen_blade', draft: base({ weaponProps: ['finesse', 'light'], weaponClass: 'martial', weaponRangeSel: 'melee', cost: '25 gp', weight: '3' }) },
    { name: 'weapon-two-damage-types', id: 'hb_vampire_blade', draft: base({ name: 'Vampire Blade', rarity: 'rare', weaponDamage: [{ dice: '1d8', damageType: 'slashing' }, { dice: ' 1d6 ', damageType: 'necrotic' }, { dice: '', damageType: 'fire' }], extraProps: ' Sentient , Bound ,' }) },
    { name: 'weapon-with-trait', id: 'hb_glow_blade', draft: base({ name: 'Glow Blade', trait: trait('Effect', { effectKind: 'sense', senseType: 'darkvision', senseRange: '30' }) }) },
    { name: 'armor-light', id: 'hb_silk_coat', draft: base({ name: 'Silk Coat', category: 'armor', armorCategory: 'light armor', acValue: '11', acAddsDex: true, weight: '8' }) },
    { name: 'armor-medium', id: 'hb_scale_coat', draft: base({ name: 'Scale Coat', category: 'armor', armorCategory: 'medium armor', acValue: '14', acAddsDex: true }) },
    { name: 'armor-heavy', id: 'hb_plate_coat', draft: base({ name: 'Plate Coat', category: 'armor', armorCategory: 'heavy armor', acValue: '18', acAddsDex: false }) },
    { name: 'armor-bad-ac', id: 'hb_odd_coat', draft: base({ name: 'Odd Coat', category: 'armor', acValue: 'high' }) },
    { name: 'shield', id: 'hb_tower', draft: base({ name: 'Tower', category: 'armor', armorCategory: 'shield', acValue: '2' }) },
    { name: 'potion', id: 'hb_draught', draft: base({ name: 'Draught', category: 'potion', rarity: 'uncommon', cost: '50 gp' }) },
    { name: 'ring-with-resistance', id: 'hb_ember_ring', draft: base({ name: 'Ember Ring', category: 'ring', rarity: 'rare', trait: trait('Effect', { effectKind: 'damage_resistance', damageType: 'fire' }) }) },
    { name: 'wondrous-with-limited-use', id: 'hb_lantern', draft: base({ name: 'Lantern', category: 'wondrous', rarity: 'uncommon', trait: trait('Effect', { effectKind: 'resource_ability', uses: '3', recharge: 'dawn', healDice: '' }) }) },
    { name: 'gear-image-ruleset', id: 'hb_rope', draft: base({ name: 'Rope', category: 'gear', weight: '10', cost: '1 gp', imageUri: 'data:image/png;base64,AAAA', rulesetId: 'dnd5e-2014' as never, origin: { name: '', link: 'https://example.test/rope' } }) },
    { name: 'empty-name', id: 'hb_blank', draft: base({ name: ' ', description: '' }) },
  ];
}

export function runFeatCase(c: FeatCase) {
  const fields = compileFeatFields(c.draft, c.id);
  return { fields, validation: validateFeat(fields) };
}
export function runSpellCase(c: SpellCase) {
  const fields = compileSpellFields(c.draft, c.id);
  return { fields, validation: validateSpell(fields) };
}
export function runItemCase(c: ItemCase) {
  const fields = compileItemFields(c.draft, c.id);
  return { fields, validation: validateItem(fields) };
}

export type { Feature };

// ── classes and subclasses ───────────────────────────────────────────────────────────────────────────────────────────────

export type ClassCase = { name: string; id: string; draft: ClassDraft };
export type SubclassCase = { name: string; id: string; hitDie: 4 | 6 | 8 | 10 | 12; draft: SubclassDraft };

const lf = (level: number, name: string, over: Over = {}): DraftTrait & { level: number } => ({ ...trait(name, over), level });

export function buildClassCases(): ClassCase[] {
  const base = (over: Partial<ClassDraft> = {}): ClassDraft => ({
    name: 'Runesmith', hitDie: 8, hpAbility: 'con', description: '', savingThrows: [], armorProfs: [], weaponProfs: [], toolProfs: [],
    startingEquipment: [], equipmentNotes: '', isCaster: false, spellAbilities: ['int'], spellStyle: 'full', spellPrepPolicy: 'known',
    spellStartLevel: '1', spellSource: 'own', levelFeatures: [], asiLevels: [4, 8, 12, 16, 19], ...over,
  });
  const pool = lf(1, 'Rune Pool', { effectKind: 'resource_ability', uses: '3', healDice: '' });
  return [
    { name: 'minimal', id: 'plain_class', draft: base({ name: 'Plain Class' }) },
    { name: 'martial', id: 'runesmith', draft: base({
      hitDie: 10, savingThrows: ['str', 'con'], armorProfs: ['light', 'medium', 'heavy', 'shield'], weaponProfs: ['simple', 'martial'],
      multiclassArmor: ['light', 'shield'], multiclassWeapons: ['martial'], multiclassTools: ["Smith's Tools"],
      description: 'Works metal and meaning.', startingEquipment: ['dagger', 'backpack'], toolProfs: ["Smith's Tools"], equipmentNotes: 'A leather apron.',
      levelFeatures: [
        lf(1, 'Rally', { effectKind: 'resource_ability', uses: '1', recharge: 'short_rest', healDice: '1d10', actionType: 'bonus_action' }),
        lf(2, 'Hardy', { effectKind: 'ac_bonus', acBonusAmount: '1' }),
        lf(5, 'Extra Strike', { effectKind: 'stat_bonus', statTarget: 'extra_attack', statOperation: 'add', statAmount: '1' }),
        lf(9, 'Unyielding', { limitedUse: true, actionType: 'reaction', recharge: 'long_rest', uses: '1' }),
        lf(9, 'Unyielding', { effectKind: 'damage_resistance', damageType: 'force' }),
      ],
    }) },
    { name: 'full-caster-spellbook', id: 'glyphwright', draft: base({
      name: 'Glyphwright', hitDie: 6, savingThrows: ['int', 'wis'], isCaster: true, spellAbilities: ['int'], spellStyle: 'full',
      spellPrepPolicy: 'spellbook_prepared', levelFeatures: [lf(3, 'Glyph Lore', { effectKind: 'spell_grant', spellGrantCantripId: 'light', spellGrantAbility: 'int' })],
    }) },
    { name: 'half-caster-late', id: 'wardkeeper', draft: base({
      name: 'Wardkeeper', hitDie: 10, hpAbility: 'cha', isCaster: true, spellAbilities: ['wis'], spellStyle: 'half',
      spellPrepPolicy: 'full_list_prepared', spellStartLevel: '2', spellSource: 'class:cleric',
    }) },
    { name: 'pact-caster', id: 'oathbound', draft: base({ name: 'Oathbound', isCaster: true, spellAbilities: ['cha'], spellStyle: 'pact', spellSource: 'list:my_list' }) },
    { name: 'choose-casting-ability', id: 'wanderer', draft: base({ name: 'Wanderer', isCaster: true, spellAbilities: ['int', 'wis'], spellStyle: 'half', spellStartLevel: '3' }) },
    { name: 'custom-asi-levels', id: 'sparse', draft: base({ name: 'Sparse', asiLevels: [3, 6, 9], origin: { name: ' A Zine ', link: 'https://example.test/z' }, rulesetId: 'dnd5e-2024' as never }) },
    { name: 'pools-spend-and-raise', id: 'fury_class', draft: base({
      name: 'Fury Class',
      levelFeatures: [
        pool,
        lf(1, 'Fury Strike', { spendsResourceId: `local:${pool.localId}`, spendsQuantity: '2', actionType: 'action' }),
        lf(5, 'Deeper Pool', { raiseResourceId: `local:${pool.localId}`, raiseResourceTo: '5' }),
        lf(7, 'Fury Strike', { atWill: true, actionType: 'bonus_action' }),
      ],
    }) },
    { name: 'bad-hit-die', id: 'bad_die', draft: base({ name: 'Bad Die', hitDie: 7 as never }) },
    { name: 'with-level-choices', id: 'scout_class', draft: base({ name: 'Scout Class', levelChoices: [
      { localId: 'x1', level: 3, kind: 'expertise', count: '2', prompt: '', poolMode: 'all', categories: [], restrictedIds: [] },
      { localId: 'x2', level: 3, kind: 'tool', count: '1', prompt: '', poolMode: 'category', categories: ['artisan'], restrictedIds: [] },
      { localId: 'x3', level: 10, kind: 'expertise', count: '2', prompt: 'Sharpen two skills.', poolMode: 'all', categories: [], restrictedIds: [] },
    ] as never }) },
  ];
}

export function runClassCase(c: ClassCase) {
  const fields = { ...compileClassFields(c.draft, c.id), features: [] as unknown[] };
  const asClass = fields as unknown as CharClass;
  return { fields, validation: validateClass(fields), progression: buildProgressionFromClass(asClass) };
}

export function buildSubclassCases(): SubclassCase[] {
  const base = (over: Partial<SubclassDraft> = {}): SubclassDraft => ({ name: 'Order of Embers', classId: 'fighter', levelFeatures: [], ...over });
  const pool = lf(3, 'Ember Pool', { effectKind: 'resource_ability', uses: '2', healDice: '' });
  return [
    { name: 'empty', id: 'empty_order', hitDie: 10, draft: base({ name: 'Empty Order' }) },
    { name: 'features', id: 'order_of_embers', hitDie: 10, draft: base({
      origin: { name: 'The Grey Book', link: '' },
      levelFeatures: [
        lf(3, 'Kindle', { effectKind: 'damage_resistance', damageType: 'fire' }),
        lf(3, 'Kindle', { effectKind: 'ac_bonus', acBonusAmount: '1' }),
        lf(7, 'Smolder', { effectKind: 'sense', senseType: 'darkvision', senseRange: '60' }),
        lf(15, 'Pyre', { effectKind: 'spell_grant', spellGrantCantripId: 'firebolt', spellGrantAbility: 'cha',
          spellGrants: [{ localId: 'g', spellId: 'burning_hands', spellName: 'Burning Hands', actionType: 'action', unlockLevel: '15', mode: 'resource', recharge: 'long_rest', rechargeOther: '', uses: '1', minSlotLevel: '1' }] as never }),
      ],
    }) },
    { name: 'pools', id: 'order_of_wells', hitDie: 8, draft: base({
      name: 'Order of Wells', classId: 'cleric', rulesetId: 'dnd5e-2014' as never,
      levelFeatures: [pool, lf(6, 'Spend', { spendsResourceId: `local:${pool.localId}` }), lf(10, 'Deepen', { raiseResourceId: `local:${pool.localId}`, raiseResourceTo: '4' })],
    }) },
    { name: 'missing-class', id: 'orphan', hitDie: 8, draft: base({ name: 'Orphan', classId: '' }) },
  ];
}

export function runSubclassCase(c: SubclassCase) {
  const fields = compileSubclassFields(c.draft, c.id, c.hitDie);
  return { fields, validation: validateSubclass(fields) };
}

// A class the person made, added to characters the app's creation path built, then levelled.
export type HomebrewLevelCase = {
  name: string; entity: Entity; rules: LevelRulesArg; steps: LevelStep[];
  homebrew: { classes: CharClass[] };
};

export function buildHomebrewLevelCases(providers: Providers): HomebrewLevelCase[] {
  const out: HomebrewLevelCase[] = [];
  const classes = new Map<string, CharClass>();
  for (const c of buildClassCases()) {
    classes.set(c.id, { ...compileClassFields(c.draft, c.id), features: [] });
  }
  const p = providers.p2014;
  const build = (classId: string, level: number) => createCharacter(p, {
    id: `c-${classId}-${level}`, name: `Test ${classId}`, classId, raceId: p.races()[0].id, backgroundId: p.backgrounds()[0].id,
    stats: { str: 15, dex: 14, con: 14, int: 12, wis: 13, cha: 8 }, level,
  }, DEFAULT_RULES);
  const fixed: LevelRulesArg = { hpMode: 'fixed', customRules: {} };
  const add = (name: string, entity: Entity, ids: string[], steps: LevelStep[]) =>
    out.push({ name, entity, rules: fixed, steps, homebrew: { classes: ids.map(id => classes.get(id)!) } });
  const times = (classId: string, n: number): LevelStep[] => Array.from({ length: n }, () => ({ classId }));

  add('hbclass-martial-multiclass', build('fighter', 2), ['runesmith'], [...times('runesmith', 10), { classId: 'fighter' }]);
  add('hbclass-full-caster-with-wizard', build('wizard', 3), ['glyphwright'], [...times('glyphwright', 6), { classId: 'wizard' }]);
  add('hbclass-half-caster-late-start', build('cleric', 4), ['wardkeeper'], times('wardkeeper', 9));
  add('hbclass-pact-with-warlock', build('warlock', 3), ['oathbound'], [...times('oathbound', 5), { classId: 'warlock' }]);
  add('hbclass-choose-casting-ability', build('rogue', 2), ['wanderer'], times('wanderer', 6));
  add('hbclass-custom-asi', build('fighter', 1), ['sparse'], times('sparse', 10));
  add('hbclass-pools', build('barbarian', 2), ['fury_class'], times('fury_class', 8));
  add('hbclass-two-homebrew', build('monk', 1), ['runesmith', 'oathbound'], [...times('runesmith', 3), ...times('oathbound', 3), { classId: 'runesmith' }]);
  return out;
}

// ── races and backgrounds ────────────────────────────────────────────────────────────────────────────────────────────────

export type RaceCase = { name: string; id: string; draft: RaceDraft };
export type BackgroundCase = { name: string; id: string; draft: BackgroundDraft };

export function buildRaceCases(): RaceCase[] {
  const none = { str: '', dex: '', con: '', int: '', wis: '', cha: '' };
  const base = (over: Partial<RaceDraft> = {}): RaceDraft => ({
    name: 'Pandafolk', age: '', size: 'Medium', speed: '30', languages: 'Common', description: '', abiBonuses: { ...none },
    senses: [], movement: {}, traits: [], subraces: [], ...over,
  });
  return [
    { name: 'minimal', id: 'plain_folk', draft: base({ name: 'Plain Folk', languages: '' }) },
    { name: 'full', id: 'pandafolk', draft: base({
      age: ' Up to 100 years ', size: 'Small', speed: '35', languages: 'Common, Elvish ,, ', description: 'Bamboo-loving wanderers.',
      origin: { name: 'The Grey Book', link: 'https://example.test/panda' },
      abiBonuses: { ...none, str: '2', con: '1', wis: '0', cha: 'x' },
      senses: [{ type: 'darkvision', range: 60 }, { type: 'tremorsense', range: 10, note: 'in water' }],
      movement: { fly: 30, swim: 20, burrow: 0 },
      traits: [
        trait('Keen Mind', { effectKind: 'skill_proficiency', skillTarget: 'arcana' }),
        trait('Fey Ward', { effectKind: 'advantage_disadvantage', advDirection: 'advantage', advTarget: 'saves against being charmed' }),
        trait('Deep Breath', { effectKind: 'resource_ability', uses: '2', recharge: 'long_rest', healDice: '' }),
        trait('Fey Ward', { effectKind: 'damage_resistance', damageType: 'psychic' }),
        trait('Gifts', { effectKind: 'spell_grant', spellGrantCantripId: 'light', spellGrantAbility: 'cha',
          spellGrants: [{ localId: 'g', spellId: 'shield', spellName: 'Shield', actionType: 'reaction', unlockLevel: '3', mode: 'resource', recharge: 'long_rest', rechargeOther: '', uses: '1', minSlotLevel: '1' }] as never }),
      ],
      subraces: [
        { localId: 'sr_1', name: 'Fire Pandafolk', abiBonuses: { ...none, cha: '1' }, traits: [
          trait('Ember Blood', { effectKind: 'damage_resistance', damageType: 'fire' }),
          trait('Ember Blood', { effectKind: 'sense', senseType: 'darkvision', senseRange: '30' }),
          trait('Spark', { limitedUse: true, recharge: 'short_rest', uses: '1', actionType: 'bonus_action' }),
        ] },
        { localId: 'sr_2', name: 'Water Pandafolk', abiBonuses: { ...none }, traits: [] },
      ],
      rulesetId: 'dnd5e-2024' as never,
    }) },
    { name: 'speed-collision', id: 'quick_folk', draft: base({ name: 'Quick Folk', speed: '40', traits: [trait('Speed', { effectKind: 'stat_bonus', statTarget: 'speed', statOperation: 'add', statAmount: '5' })] }) },
    { name: 'large-and-slow', id: 'ogre_kin', draft: base({ name: 'Ogre Kin', size: 'Large', speed: '25' }) },
    { name: 'with-choices', id: 'wanderfolk', draft: base({ name: 'Wanderfolk', pendingChoices: [
      { localId: 'p1', kind: 'tool', count: '1', prompt: '', poolMode: 'category', categories: ['musical_instrument'], restrictedIds: [] },
      { localId: 'p2', kind: 'language', count: '1', prompt: '', poolMode: 'all', categories: [], restrictedIds: [] },
    ] }) },
  ];
}

export function runRaceCase(c: RaceCase) {
  const fields = compileRaceFields(c.draft, c.id);
  return { fields, validation: validateRace(fields) };
}

export function buildBackgroundCases(): BackgroundCase[] {
  const base = (over: Partial<BackgroundDraft> = {}): BackgroundDraft => ({
    name: 'Lamplighter', skills: [], toolProfs: [], languages: '', equipmentNote: '', features: [], ...over,
  });
  return [
    { name: 'minimal', id: 'lamplighter', draft: base() },
    { name: 'full', id: 'cartographer', draft: base({
      name: 'Cartographer', skills: ['arcana', 'history'], toolProfs: ["Cartographer's Tools", 'Navigator\'s Tools'],
      languages: ' two of your choice ', equipmentNote: ' A map case. ', origin: { name: '', link: 'https://example.test/bg' },
      features: [
        { localId: 'f1', name: 'Well Travelled', description: ' You know every road. ' },
        { localId: 'f2', name: 'Well Travelled', description: '' },
        { localId: 'f3', name: "Surveyor's Eye", description: 'You read land like a page.' },
      ],
      rulesetId: 'dnd5e-2014' as never,
    }) },
    { name: 'one-skill', id: 'hermit', draft: base({ name: 'Hermit', skills: ['medicine'] }) },
    { name: 'with-choices', id: 'guild_clerk', draft: base({ name: 'Guild Clerk', pendingChoices: [
      { localId: 'p1', kind: 'tool', count: '1', prompt: '', poolMode: 'restricted', categories: [], restrictedIds: ['calligraphers_supplies', 'forgery_kit'] },
    ] }) },
  ];
}

// ── conditions ──────────────────────────────────────────────────────────────────────────────────────────────────────────

export type ConditionCase = { name: string; id: string; draft: ConditionDraft };

export function buildConditionCases(): ConditionCase[] {
  seq = 0;
  const base = (over: Partial<ConditionDraft> = {}): ConditionDraft => ({ name: 'Ashen Lung', description: ' Soot fills the air you breathe. ', traits: [], ...over });
  return [
    { name: 'minimal', id: 'ashen_lung', draft: base() },
    { name: 'one-trait', id: 'brittle_bones', draft: base({
      name: 'Brittle Bones', traits: [trait('Brittle', { effectKind: 'damage_vulnerability', damageType: 'bludgeoning' })],
    }) },
    { name: 'several-traits', id: 'frostbound', draft: base({
      name: 'Frostbound', description: 'The cold has you.', origin: { name: 'Winter Court', link: 'https://example.test/frost' },
      traits: [
        trait('Numb', { effectKind: 'ac_bonus', acBonusAmount: '-1' }),
        trait('Slowed', { effectKind: 'advantage_disadvantage', advDirection: 'disadvantage', advTarget: 'dexterity saving throws' }),
        trait('Cold Blooded', { effectKind: 'damage_resistance', damageType: 'cold' }),
      ],
      rulesetId: 'dnd5e-2014' as never,
    }) },
    { name: 'same-trait-name-twice', id: 'twin_marks', draft: base({
      name: 'Twin Marks', traits: [trait('Mark', { description: 'The first.' }), trait('Mark', { description: 'The second.' })],
    }) },
    { name: 'sense-and-movement', id: 'moonlit', draft: base({
      name: 'Moonlit', traits: [
        trait('Night Eyes', { effectKind: 'sense', senseType: 'darkvision', senseRange: '30' }),
        trait('Drift', { effectKind: 'movement', moveType: 'fly', moveRange: '10' }),
      ],
    }) },
    { name: 'no-name', id: 'nameless', draft: base({ name: ' ', description: '' }) },
  ];
}

export function runConditionCase(c: ConditionCase) {
  const fields = compileConditionFields(c.draft, c.id);
  return { fields, validation: validateRace(fields) };
}

export function runBackgroundCase(c: BackgroundCase) {
  const fields = compileBackgroundFields(c.draft, c.id);
  return { fields, validation: validateRace(fields) };
}

// ── choices a thing asks of the player ──────────────────────────────────────────────────────────────────────────────────

const dc = (localId: string, kind: AuthorableChoiceKind, over: Partial<DraftChoice> = {}): DraftChoice => ({
  localId, kind, count: '1', prompt: '', poolMode: 'all', categories: [], restrictedIds: [], ...over,
});
export const choiceDraftsForCases = {
  expertise: dc('c_exp', 'expertise', { count: '2' }),
  tool: dc('c_tool', 'tool', { poolMode: 'category', categories: ['artisan'] }),
  language: dc('c_lang', 'language', { count: '2', prompt: 'Pick two tongues.' }),
};

export type ChoiceDraftCase = { name: string; prefix: string; draft: DraftChoice };

export function buildChoiceDraftCases(): ChoiceDraftCase[] {
  return [
    { name: 'expertise-all', prefix: '', draft: dc('e1', 'expertise', { count: '2' }) },
    { name: 'expertise-one', prefix: 'race_choice_', draft: dc('e2', 'expertise') },
    { name: 'expertise-restricted', prefix: '', draft: dc('e3', 'expertise', { poolMode: 'restricted', restrictedIds: ['stealth', 'perception', 'insight'], count: '2' }) },
    { name: 'tool-all', prefix: '', draft: dc('t1', 'tool', { count: '3' }) },
    { name: 'tool-artisan', prefix: 'background_choice_', draft: dc('t2', 'tool', { poolMode: 'category', categories: ['artisan'] }) },
    { name: 'tool-two-categories', prefix: '', draft: dc('t3', 'tool', { poolMode: 'category', categories: ['gaming_set', 'musical_instrument'] }) },
    { name: 'tool-restricted', prefix: '', draft: dc('t4', 'tool', { poolMode: 'restricted', restrictedIds: ['smiths_tools', 'brewers_supplies', 'masons_tools'], prompt: ' Choose a trade. ' }) },
    { name: 'language-all', prefix: '', draft: dc('l1', 'language', { count: '2' }) },
    { name: 'language-common-exotic', prefix: 'feat_choice_', draft: dc('l2', 'language', { poolMode: 'category', categories: ['common', 'exotic'] }) },
    { name: 'language-secret-restricted', prefix: '', draft: dc('l3', 'language', { poolMode: 'restricted', restrictedIds: ['thieves_cant', 'druidic'] }) },
    { name: 'count-blank', prefix: '', draft: dc('b1', 'tool', { count: '' }) },
    { name: 'count-too-big-restricted', prefix: '', draft: dc('b2', 'language', { poolMode: 'restricted', restrictedIds: ['elvish'], count: '3' }) },
    { name: 'restricted-empty', prefix: '', draft: dc('b3', 'tool', { poolMode: 'restricted' }) },
    { name: 'restricted-unknown-and-duplicate', prefix: '', draft: dc('b4', 'tool', { poolMode: 'restricted', restrictedIds: ['nope', 'nope', 'lute'] }) },
    { name: 'category-none', prefix: '', draft: dc('b5', 'language', { poolMode: 'category' }) },
    { name: 'category-too-small', prefix: '', draft: dc('b6', 'tool', { poolMode: 'category', categories: ['gaming_set'], count: '9' }) },
  ];
}

export function runChoiceDraftCase(c: ChoiceDraftCase) {
  const definition = draftChoiceToDefinition(c.draft, c.prefix);
  return { definition, errors: validateDraftChoice(c.draft), back: definitionToDraftChoice(definition, c.prefix) };
}

// ── feature pools: "pick N options, each granting a different feature" ─────────────────────────────────────────────────

export type FeaturePoolCase = { name: string; prefix: string; owner: FeaturePoolOwner; draft: FeaturePoolDraft };

const fp = (localId: string, over: Partial<FeaturePoolDraft> = {}): FeaturePoolDraft => ({
  ...newFeaturePoolDraft(), localId, ...over,
});
const opt = (name: string, over: Over = {}, minLevel = '') => ({ trait: trait(name, over), minLevel });

const wizardOwner: FeaturePoolOwner = { sourceKind: 'class', sourceRefId: 'wizard', classId: 'wizard' };

/** The pool the resolve cases queue on a character; built once so its option ids are the same in every case. */
export function featurePoolStyles(): FeaturePoolDraft {
  return fp('pool_styles', {
    count: '2', prompt: 'Pick two combat styles.', replaceTiming: 'level_up', replaceRule: 'Whenever you gain a level, you may swap one.',
    options: [
      opt('Iron Skin', { effectKind: 'ac_bonus', acBonusAmount: '1', description: 'Your skin hardens.' }),
      opt('Quick Feet', { effectKind: 'stat_bonus', statTarget: 'speed', statOperation: 'add', statAmount: '10' }),
      opt('Keen Eyes', { effectKind: 'sense', senseType: 'darkvision', senseRange: '60' }, '9'),
      opt('Veteran', { effectKind: 'skill_proficiency', skillTarget: 'athletics', skillExpertise: true }, '3'),
    ],
  });
}
export const FEATURE_POOL_STYLES_PREFIX = 'wizard_l3_';
export const FEATURE_POOL_STYLES_OWNER = wizardOwner;

export function buildFeaturePoolCases(): FeaturePoolCase[] {
  seq = 0;
  const mk = (name: string, prefix: string, owner: FeaturePoolOwner, draft: FeaturePoolDraft): FeaturePoolCase => ({ name, prefix, owner, draft });
  return [
    mk('class-styles', FEATURE_POOL_STYLES_PREFIX, wizardOwner, featurePoolStyles()),
    mk('feat-one', 'feat_choice_', { sourceKind: 'feat', sourceRefId: 'hb_feat' }, fp('pool_one', {
      options: [
        opt('Calm Mind', { effectKind: 'advantage_disadvantage', advDirection: 'advantage', advTarget: 'saves against fear' }),
        opt('Hard Knocks', { effectKind: 'damage_resistance', damageType: 'bludgeoning' }),
      ],
    })),
    mk('race-rest-swap', 'race_choice_', { sourceKind: 'race', sourceRefId: 'hb_race' }, fp('pool_rest', {
      count: '1', replaceTiming: 'rest',
      options: [opt('Totem Bear', { effectKind: 'damage_resistance', damageType: 'cold' }), opt('Totem Wolf', { effectKind: 'ability_score', abilityTarget: 'wis', abilityAmount: '1' })],
    })),
    mk('long-rest-default-rule', 'background_choice_', { sourceKind: 'background', sourceRefId: 'hb_bg' }, fp('pool_long', {
      replaceTiming: 'long_rest',
      options: [opt('Folk Tale', { description: 'You know a tale for every road.' }), opt('Folk Song')],
    })),
    mk('active-spends-pool', 'wizard_l5_', wizardOwner, fp('pool_active', {
      options: [
        opt('Shadow Step', { atWill: true, actionType: 'bonus_action', description: 'Step through shadow.' }),
        opt('Ki Burst', { spendsResourceId: 'ki_points', spendsQuantity: '2', actionType: 'action', description: 'Burst of ki.' }),
      ],
    })),
    mk('same-name-twice', '', wizardOwner, fp('pool_same', { options: [opt('Echo'), opt('Echo')] })),
    mk('count-three-of-four', 'wizard_l9_', wizardOwner, fp('pool_three', {
      count: '3',
      options: [
        opt('One', { effectKind: 'ac_bonus', acBonusAmount: '1' }), opt('Two', { effectKind: 'ac_bonus', acBonusAmount: '2' }),
        opt('Three', { effectKind: 'sense', senseRange: '30' }), opt('Four'),
      ],
    })),
    mk('error-no-options', '', wizardOwner, fp('pool_empty')),
    mk('error-count-exceeds', '', wizardOwner, fp('pool_big', { count: '4', options: [opt('Only One')] })),
    mk('error-blank-name', '', wizardOwner, fp('pool_blank', { options: [opt('  '), opt('Fine')] })),
    mk('error-own-counter', '', wizardOwner, fp('pool_counter', {
      options: [opt('Limited', { limitedUse: true, uses: '2' }), opt('Resource', { effectKind: 'resource_ability', uses: '1' }), opt('Spells', { effectKind: 'spell_grant' })],
    })),
    mk('error-min-level', '', wizardOwner, fp('pool_level', { count: 'x', options: [opt('Late', {}, '25'), opt('Odd', {}, 'soon'), opt('Ok', {}, '2')] })),
  ];
}

export function runFeaturePoolCase(c: FeaturePoolCase) {
  const errors = validateFeaturePoolDraft(c.draft);
  const definition = featurePoolDraftToDefinition(c.draft, c.prefix, c.owner);
  return { definition, errors, back: definitionToFeaturePoolDraft(definition, c.prefix) };
}

export function registriesForFixtures() {
  return {
    tools: ALL_TOOLS, toolCategories: TOOL_CATEGORY_ORDER,
    languages: ALL_LANGUAGES.map(l => ({ id: l.id, name: l.name, category: l.category })),
    languageCategories: LANGUAGE_CATEGORY_ORDER, selectableLanguageCategories: SELECTABLE_LANGUAGE_CATEGORIES,
    skills: ALL_SKILL_OPTIONS.map(o => ({ id: o.id, label: o.label })),
  };
}

// ── the builders' Test: a record applied to a throwaway level 1 character ────────────────────────────────────────────────

export type TestKind = 'feat' | 'class' | 'subclass' | 'race' | 'background' | 'condition' | 'subrace';

/**
 * The apply step of each builder's runTest (app/homebrew/*-builder.tsx), on the record the builder would save: the entity
 * after, which the desktop app's Test must reproduce. Rows are built from before/after by the apps' own row builders.
 */
export function testAfterEntity(kind: TestKind, fields: Record<string, unknown>): Entity {
  const empty = makeEmptyEntity('homebrew-test');
  const scratch: Entity = { ...empty, identity: { ...empty.identity, level: 1 } };
  const { after } = simulate(scratch, e => {
    let updated = e;
    if (kind === 'feat') {
      return applyGrant(updated, { kind: 'feature', value: fields.feature }, 0);
    }
    if (kind === 'class') {
      const progression = getProgressionForClass({ ...fields, features: [] } as unknown as CharClass);
      for (const entry of progression.entries) {
        for (const grant of entry.grants) updated = applyGrant(updated, grant, entry.level, fields.id as string);
      }
      return updated;
    }
    if (kind === 'subclass') {
      for (const entry of fields.entries as { level: number; grants: never[] }[]) {
        for (const grant of entry.grants) updated = applyGrant(updated, grant, entry.level, fields.classId as string);
      }
      return updated;
    }
    if (kind === 'race') {
      for (const feature of (fields.features ?? []) as Feature[]) {
        updated = applyGrant(updated, { kind: 'feature', value: { ...feature, isActive: true } }, feature.level ?? 0);
      }
      for (const resource of (fields.resources ?? []) as never[]) {
        updated = applyGrant(updated, { kind: 'resource', value: resource }, 0, undefined, { kind: 'race', id: fields.id as string });
      }
      return updated;
    }
    if (kind === 'subrace') {
      for (const feature of (fields.features ?? []) as Feature[]) {
        updated = applyGrant(updated, { kind: 'feature', value: { ...feature, isActive: true } }, feature.level ?? 0);
      }
      for (const resource of (fields.resources ?? []) as never[]) {
        updated = applyGrant(updated, { kind: 'resource', value: resource }, 0, undefined, { kind: 'subrace', id: fields.id as string });
      }
      return updated;
    }
    if (kind === 'condition') {
      return applyCondition(updated, fields.id as string, 'test', DEFAULT_RULES, (fields.features ?? []) as Feature[], null);
    }
    for (const feature of (fields.features ?? []) as Feature[]) {
      updated = applyGrant(updated, { kind: 'feature', value: { ...feature, isActive: true } }, 0);
    }
    return updated;
  }, DEFAULT_RULES);
  return after;
}

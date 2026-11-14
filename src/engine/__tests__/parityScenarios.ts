// Synthetic characters for the native-parity fixtures: a real exported character with features added that exercise the effect
// pipeline one rule at a time (stacking, scaling, formulas, gates, senses, substitutions, ...). The TypeScript engine's answer for
// each is the oracle the native app is held to. Pure data: no engine imports, so this file cannot influence the result.
import type { Entity } from '../types';

type Json = Record<string, unknown>;

const feature = (id: string, effects: Json[], extra: Json = {}, kind = 'feat', level = 1): Json => ({
  id, name: id, description: '', source: { kind, refId: id }, level, actions: [], choices: [], passive: true, effects, isActive: true, ...extra,
});
const fx = (target: string, operation: string, value: unknown, extra: Json = {}, type = 'stat_modifier'): Json =>
  ({ type, target, operation, value, condition: null, ...extra });

export type Scenario = { name: string; entity: Entity };

export function buildScenarios(base: Entity): Scenario[] {
  const clone = (): Entity => JSON.parse(JSON.stringify(base)) as Entity;
  const withFeatures = (name: string, features: Json[], tweak?: (e: Entity & Json) => void): Scenario => {
    const e = clone() as Entity & Json;
    e.features = [...e.features, ...(features as never[])];
    tweak?.(e);
    return { name, entity: e };
  };
  const out: Scenario[] = [];

  out.push(withFeatures('ability-add-and-set', [
    feature('f_str', [fx('str', 'add', 4)]),
    feature('f_dex_low', [fx('dex', 'set', 16)]),
    feature('f_dex_high', [fx('dex', 'set', 18)]),
    feature('f_dex_add', [fx('dex', 'add', 1)]),
  ]));
  out.push(withFeatures('ability-multiply-and-scale', [
    feature('f_con_mult', [fx('con', 'multiply', 2)]),
    feature('f_int_scale', [fx('int', 'scale', 1.5)]),
  ]));
  out.push(withFeatures('ability-floor', [
    feature('f_int_floor', [fx('int', 'set', 19, { atLeast: true })]),
    feature('f_wis_floor_noop', [fx('wis', 'set', 3, { atLeast: true })]),
  ]));
  out.push(withFeatures('ac-formulas-unarmored-defense', [
    feature('f_ud', [fx('base_ac_formula', 'set', 10, { formulaAbilities: ['dex', 'con'] }, 'base_ac_formula')]),
    feature('f_mage_armor', [fx('base_ac_formula', 'set', 13, { formulaAbilities: ['dex'] }, 'base_ac_formula')]),
  ]));
  out.push(withFeatures('ac-medium-armor-cap-and-raise', [
    feature('f_medium', [fx('base_ac_formula', 'set', 14, { formulaAbilities: ['dex'], formulaAbilityCap: { dex: 2 } }, 'base_ac_formula')]),
    feature('f_dex_cap', [fx('armor_dex_cap', 'set', 3)]),
    feature('f_dex_stat', [fx('dex', 'add', 4)]),
  ]));
  out.push(withFeatures('ac-bonus-and-scale', [
    feature('f_shield', [fx('ac', 'add', 2)]),
    feature('f_ring', [fx('ac', 'add', 1)]),
    feature('f_ac_scale', [fx('ac', 'scale', 2)]),
  ]));
  out.push(withFeatures('initiative-folds', [
    feature('f_alert', [fx('initiative', 'add', 0, { addProficiencyBonus: true })]),
    feature('f_cha_init', [fx('initiative', 'add', 0, { addAbilityModifier: 'cha' })]),
    feature('f_per_level', [fx('initiative', 'add', 0, { addPerLevel: 1 })]),
    feature('f_cha_up', [fx('cha', 'add', 6)]),
  ]));
  out.push(withFeatures('speed-set-add-scale', [
    feature('f_set', [fx('speed', 'set', 25)]),
    feature('f_set_higher', [fx('speed', 'set', 35)]),
    feature('f_add', [fx('speed', 'add', 10)]),
    feature('f_scale', [fx('speed', 'scale', 0.5)]),
  ]));
  out.push(withFeatures('speed-zero-restriction', [
    feature('f_fast', [fx('speed', 'add', 20)]),
    feature('f_grappled', [fx('speed', 'set', 0)], {}, 'condition'),
    feature('f_fly', [fx('movement', 'add', 0, { movementType: 'fly', movementEqualsSpeed: true }, 'grant_movement')]),
  ]));
  out.push(withFeatures('speed-exhaustion-2024', [], e => {
    (e as Json).rulesetId = 'dnd5e-2024';
    (e.conditionMonitor as Json).exhaustion = 3;
  }));
  out.push(withFeatures('condition-gates', [
    feature('f_flag_on', [fx('ac', 'add', 3, { condition: 'rage_active' })]),
    feature('f_flag_off', [fx('ac', 'add', 50, { condition: 'not_active_flag' })]),
    feature('f_cond_id', [fx('speed', 'add', -10, { condition: 'slowed' })]),
    feature('f_res_ge', [fx('initiative', 'add', 4, { condition: 'resource:gate_pool>=2' })]),
    feature('f_res_lt', [fx('initiative', 'add', 100, { condition: 'resource:gate_pool<2' })]),
    feature('f_res_missing', [fx('initiative', 'add', 100, { condition: 'resource:no_such_pool>=0' })]),
    feature('f_worn', [fx('ac', 'add', 1, { condition: 'worn:no_armor' })]),
  ], e => {
    (e.conditionMonitor as Json).flags = { rage_active: true };
    (e as Json).conditions = [{ id: 'slowed', name: 'Slowed', suppressedBy: [], sourceId: 'x' }];
    (e.resources as Json).custom = [...((e.resources as Json).custom as unknown[]), { id: 'gate_pool', name: 'Gate', current: 3, maximum: 3, recharge: 'long_rest' }];
  }));
  out.push(withFeatures('suspended-and-level-gated', [
    feature('f_suspended', [fx('ac', 'add', 10)]),
    feature('f_live', [fx('ac', 'add', 1)]),
    feature('f_race_late', [fx('speed', 'add', 10)], {}, 'race', 9),
    feature('f_race_ok', [fx('speed', 'add', 5)], {}, 'race', 1),
    feature('f_min_level', [{ ...fx('ac', 'add', 7), minLevel: 11 }]),
    feature('f_inactive', [fx('ac', 'add', 9)], { isActive: false }),
  ], e => {
    (e as Json).turnCounter = 2;
    (e as Json).suspensions = [{ featureId: 'f_suspended', until: 5 }];
  }));
  out.push(withFeatures('situational-answers', [
    feature('f_sit_yes', [fx('ac', 'add', 2, { situational: { id: 'ally_near', label: 'Ally nearby' } })]),
    feature('f_sit_no', [fx('ac', 'add', 20, { situational: { id: 'raining', label: 'Raining' } })]),
  ], e => { (e as Json).situationalAnswers = { ally_near: true, raining: false }; }));
  out.push(withFeatures('advantage-tracks', [
    feature('f_adv1', [fx('adv.attack_rolls', 'advantage', null)]),
    feature('f_adv2', [fx('adv.str_checks', 'advantage', null)]),
    feature('f_dis2', [fx('adv.str_checks', 'disadvantage', null)]),
    feature('f_dis3', [fx('adv.dex_saves', 'disadvantage', null)]),
  ]));
  out.push(withFeatures('senses-and-movement', [
    feature('f_dv60', [fx('sense', 'add', 0, { senseType: 'darkvision', senseRange: 60 }, 'grant_sense')]),
    feature('f_dv120', [fx('sense', 'add', 0, { senseType: 'darkvision', senseRange: 120, senseNote: 'devil sight' }, 'grant_sense')]),
    feature('f_blind', [fx('sense', 'add', 0, { senseType: 'blindsight', senseRange: 10 }, 'grant_sense')]),
    feature('f_climb', [fx('movement', 'add', 0, { movementType: 'climb', movementRange: 20 }, 'grant_movement')]),
    feature('f_climb_eq', [fx('movement', 'add', 0, { movementType: 'climb', movementEqualsSpeed: true, movementRange: 5 }, 'grant_movement')]),
    feature('f_swim_zero', [fx('movement', 'add', 0, { movementType: 'swim', movementRange: 0 }, 'grant_movement')]),
  ]));
  out.push(withFeatures('crits-and-extra-attack', [
    feature('f_crit19', [fx('crit_range', 'set', 19)]),
    feature('f_crit18', [fx('crit_range', 'set', 18)]),
    feature('f_crit_immune', [fx('critical_hits_against', 'immunity', null)]),
    feature('f_ea1', [fx('extra_attack', 'set', 1)]),
    feature('f_ea2', [fx('extra_attack', 'set', 3)]),
  ]));
  out.push(withFeatures('ability-substitution', [
    feature('f_sub_checks', [{ type: 'ability_substitute', target: 'x', operation: 'add', value: null, condition: null, substituteFrom: 'wis', substituteTo: 'int', substituteFor: ['ability_checks'] }]),
    feature('f_sub_saves', [{ type: 'ability_substitute', target: 'x', operation: 'add', value: null, condition: null, substituteFrom: 'str', substituteTo: 'int', substituteFor: ['saving_throws', 'weapon_attacks'] }]),
  ]));
  out.push(withFeatures('skills-and-passives', [
    feature('f_perc_bonus', [fx('skill.perception', 'add', 3)]),
    feature('f_perc_passive', [fx('passivePerception', 'add', 5)]),
    feature('f_inv_passive', [fx('passiveInvestigation', 'add', 2)]),
    feature('f_ins_prof', [fx('skill:insight', 'add', null, {}, 'grant_proficiency')]),
    feature('f_ins_expert', [fx('skill:insight', 'add', 'expertise_if_proficient', {}, 'grant_proficiency')]),
    feature('f_arc_expert', [fx('skill:arcana', 'multiply', 2, {}, 'grant_proficiency')]),
  ]));
  out.push(withFeatures('spell-and-save-numbers', [
    feature('f_dc', [fx('spell_save_dc', 'add', 1), fx('spellSaveDC', 'add', 1)]),
    feature('f_atk', [fx('spell_attack_bonus', 'add', 2), fx('spellAttackBonus', 'add', 1)]),
    feature('f_dex_save', [fx('savingThrows.dex', 'add', 2)]),
    feature('f_all_wis_save', [fx('savingThrows.wis', 'add', 1)]),
    feature('f_int_up', [fx('int', 'add', 2)]),
  ]));
  out.push(withFeatures('martial-arts-monk', [
    feature('martial_arts', [fx('ki_save_dc', 'add', 1)], {}, 'class'),
    feature('f_dex_up', [fx('dex', 'add', 4)]),
  ], e => {
    const identity = e.identity as Json;
    identity.classes = [{ classId: 'monk', subclassId: null, level: 11 }];
  }));
  out.push(withFeatures('ability-overrides', [], e => {
    (e as Json).characterOverrides = [{ id: 'o1', stat: 'str', operation: 'set', value: 20, active: true, appliedAt: 1, reason: 't' }];
    (e as Json).dmOverrides = [{ id: 'o2', stat: 'dex', operation: 'add', value: 3, active: true, appliedAt: 2, reason: 't' }, { id: 'o3', stat: 'con', operation: 'set', value: 1, active: false, appliedAt: 3, reason: 't' }];
  }));
  out.push(withFeatures('condition-suppression', [
    feature('f_blinded', [fx('ac', 'add', -2), fx('speed', 'add', -5)], {}, 'condition'),
    feature('f_blindsight', [{ type: 'suppress_condition_effects', target: 'x', operation: 'add', value: ['ac'], condition: null }]),
  ], e => {
    (e as Json).conditions = [{ id: 'f_blinded', name: 'Blinded', suppressedBy: ['f_blindsight'], sourceId: 'x' }];
    const blinded = (e.features as unknown as Json[]).find(f => f.id === 'f_blinded')!;
    (blinded.source as Json).refId = 'f_blinded';
  }));
  out.push(withFeatures('received-aura', [], e => {
    (e as Json).receivedAuras = [{ label: 'Aura of Protection', sourceName: 'Paladin', sourceEntityId: 'other', featureId: 'aura', effects: [fx('savingThrows.str', 'add', 3), fx('ac', 'add', 1, { condition: 'rage_active' })] }];
  }));
  return out;
}

// ── hit point operations ────────────────────────────────────────────────────────────────────────────────────────────────

export type HpCase = { name: string; entity: Entity; op: { name: 'applyDamage' | 'applyHealing' | 'applyTempHP'; args: { amount: number; damageType?: string } } };

export function buildHpCases(base: Entity): HpCase[] {
  const out: HpCase[] = [];
  const make = (
    name: string,
    op: HpCase['op'],
    setup: { current?: number; temp?: number; deathSaves?: Json; features?: Json[]; turnCounter?: number } = {},
  ) => {
    const e = JSON.parse(JSON.stringify(base)) as Entity & Json;
    const hp = (e.resources as Json).hp as Json;
    if (setup.current !== undefined) hp.current = setup.current;
    if (setup.temp !== undefined) hp.temp = setup.temp;
    if (setup.deathSaves) (e.resources as Json).deathSaves = setup.deathSaves;
    if (setup.features) e.features = [...e.features, ...(setup.features as never[])];
    if (setup.turnCounter !== undefined) (e as Json).turnCounter = setup.turnCounter;
    out.push({ name, entity: e, op });
  };
  const dmg = (amount: number, damageType?: string): HpCase['op'] => ({ name: 'applyDamage', args: { amount, ...(damageType ? { damageType } : {}) } });
  const res = (type: string, operation: string): Json => feature(`r_${type}_${operation}`, [{ type: 'grant_resistance', target: type, operation, value: null, condition: null }]);

  make('hp-damage-plain', dmg(7), { current: 30 });
  make('hp-damage-more-than-hp', dmg(100), { current: 30 });
  make('hp-damage-temp-absorbs-all', dmg(3), { current: 30, temp: 5 });
  make('hp-damage-temp-partly', dmg(9), { current: 30, temp: 5 });
  make('hp-damage-resistance', dmg(9, 'fire'), { current: 30, features: [res('fire', 'resistance')] });
  make('hp-damage-resistance-wrong-type', dmg(9, 'cold'), { current: 30, features: [res('fire', 'resistance')] });
  make('hp-damage-immunity', dmg(9, 'fire'), { current: 30, temp: 2, features: [res('fire', 'immunity')] });
  make('hp-damage-vulnerability', dmg(9, 'fire'), { current: 30, features: [res('fire', 'vulnerability')] });
  make('hp-damage-resist-and-vuln', dmg(9, 'fire'), { current: 30, features: [res('fire', 'resistance'), res('fire', 'vulnerability')] });
  make('hp-damage-flat-reduction', dmg(10, 'slashing'), { current: 30, features: [feature('shell', [fx('damage_reduction:slashing', 'add', 3)])] });
  make('hp-damage-flat-reduction-floor', dmg(2, 'slashing'), { current: 30, features: [feature('shell', [fx('damage_reduction:slashing', 'add', 3)])] });
  make('hp-damage-resist-then-flat', dmg(9, 'slashing'), { current: 30, features: [res('slashing', 'resistance'), feature('shell', [fx('damage_reduction:slashing', 'add', 3)])] });
  make('hp-drop-to-zero', dmg(20), { current: 5, deathSaves: { successes: 2, failures: 2, stable: true } });
  make('hp-at-zero-failure', dmg(4), { current: 0, deathSaves: { successes: 1, failures: 1, stable: false } });
  make('hp-at-zero-third-failure', dmg(4), { current: 0, deathSaves: { successes: 0, failures: 3, stable: false } });
  make('hp-at-zero-temp-absorbs', dmg(4), { current: 0, temp: 6, deathSaves: { successes: 1, failures: 1, stable: false } });
  make('hp-at-zero-stable-hit', dmg(4), { current: 0, deathSaves: { successes: 3, failures: 0, stable: true } });
  make('hp-damage-log-grows', dmg(4, 'fire'), { current: 30, turnCounter: 3 });
  make('hp-suspend-on-damage', dmg(4, 'fire'), { current: 30, turnCounter: 2, features: [feature('chill_ward', [fx('ac', 'add', 2)], { suspendOn: { damageType: 'fire', until: 'end_of_next_turn' } })] });
  make('hp-suspend-other-type', dmg(4, 'cold'), { current: 30, features: [feature('chill_ward', [fx('ac', 'add', 2)], { suspendOn: { damageType: 'fire', until: 'end_of_this_turn' } })] });
  make('hp-heal-plain', { name: 'applyHealing', args: { amount: 6 } }, { current: 20 });
  make('hp-heal-cap', { name: 'applyHealing', args: { amount: 10 } }, { current: 40 });
  make('hp-heal-from-zero', { name: 'applyHealing', args: { amount: 6 } }, { current: 0, deathSaves: { successes: 1, failures: 2, stable: false } });
  make('hp-heal-zero-amount', { name: 'applyHealing', args: { amount: 0 } }, { current: 10 });
  make('hp-temp-higher', { name: 'applyTempHP', args: { amount: 8 } }, { current: 30, temp: 3 });
  make('hp-temp-lower', { name: 'applyTempHP', args: { amount: 2 } }, { current: 30, temp: 5 });
  make('hp-temp-equal', { name: 'applyTempHP', args: { amount: 5 } }, { current: 30, temp: 5 });
  return out;
}

// ── equipment ──────────────────────────────────────────────────────────────────────────────────────────────────────────

const inst = (itemId: string, extra: Json = {}): Json => ({ id: `item:${itemId}`, itemId, quantity: 1, attuned: false, features: [], ...extra });

export function buildEquipmentScenarios(base: Entity): Scenario[] {
  const out: Scenario[] = [];
  const make = (name: string, equipped: Json[], tweak?: (e: Entity & Json) => void, features: Json[] = []) => {
    const e = JSON.parse(JSON.stringify(base)) as Entity & Json;
    (e.inventory as Json).equipped = equipped;
    e.features = [...e.features, ...(features as never[])];
    tweak?.(e);
    out.push({ name, entity: e });
  };
  const ringFeature = (id: string, effects: Json[]): Json => feature(id, effects, {}, 'item');

  make('equip-chain-mail', [inst('chain_mail')]);
  make('equip-chain-mail-and-shield', [inst('chain_mail'), inst('shield')]);
  make('equip-studded-leather', [inst('studded_leather')]);
  make('equip-breastplate-dex-cap-raise', [inst('breastplate')], e => { e.stats = { ...e.stats, dex: 18 }; }, [feature('medium_master', [fx('armor_dex_cap', 'set', 3)])]);
  make('equip-longsword-not-proficient', [inst('longsword')]);
  make('equip-weapons-proficiency-and-finesse', [inst('dagger'), inst('quarterstaff'), inst('longsword'), inst('shortbow'), inst('greatsword')], e => {
    e.stats = { ...e.stats, str: 10, dex: 16 };
    const ent = (key: string): Json => ({ kind: 'weapon_proficiency', key, sourceKind: 'class', sourceId: 'x' });
    (e as Json).entitlements = [...((e as Json).entitlements as unknown[]), ent('simple'), ent('Longsword')];
  }, [feature('weapon_grant', [fx('weapon:greatsword', 'add', null, {}, 'grant_proficiency')])]);
  make('equip-weapon-strength-vs-dex', [inst('rapier'), inst('warhammer')], e => {
    e.stats = { ...e.stats, str: 18, dex: 8 };
    (e as Json).entitlements = [...((e as Json).entitlements as unknown[]), { kind: 'weapon_proficiency', key: 'martial', sourceKind: 'class', sourceId: 'x' }];
  });
  make('equip-unknown-attuned-and-not', [
    inst('zz_ring_a', { requiresAttunement: true, attuned: false, features: [ringFeature('zz_a', [fx('ac', 'add', 2)])] }),
    inst('zz_ring_b', { requiresAttunement: true, attuned: true, features: [ringFeature('zz_b', [fx('ac', 'add', 1), fx('initiative', 'add', 2)])] }),
    inst('zz_ring_c', { features: [ringFeature('zz_c', [fx('speed', 'add', 5)])] }),
  ]);
  make('equip-requires-no-armor-or-shield', [
    inst('zz_bracers', { features: [ringFeature('zz_bracers_f', [fx('ac', 'add', 2, { requiresNoArmorOrShield: true })])] }),
  ]);
  make('equip-requires-no-armor-blocked', [
    inst('zz_bracers', { features: [ringFeature('zz_bracers_f', [fx('ac', 'add', 2, { requiresNoArmorOrShield: true })])] }),
    inst('shield'),
  ]);
  const gates = [
    feature('g_not_heavy', [fx('ac', 'add', 3, { condition: 'worn:not_heavy' })]),
    feature('g_no_armor', [fx('ac', 'add', 1, { condition: 'worn:no_armor' })]),
    feature('g_no_armor_or_shield', [fx('speed', 'add', 5, { condition: 'worn:no_armor_or_shield' })]),
    feature('g_light_or_none', [fx('initiative', 'add', 2, { condition: 'worn:no_medium_or_heavy' })]),
  ];
  make('worn-gates-none', [], undefined, gates);
  make('worn-gates-heavy', [inst('chain_mail')], undefined, gates);
  make('worn-gates-medium-and-shield', [inst('breastplate'), inst('shield')], undefined, gates);
  make('worn-gates-light', [inst('studded_leather')], undefined, gates);
  make('worn-gates-shield-only', [inst('shield')], undefined, gates);
  make('worn-gates-hydrated-facts', [inst('zz_plate', { armorWeight: 'heavy', isShield: true, wearsArmorOrShield: true })], undefined, gates);
  make('equip-infusion-feature', [
    inst('shield', { infusedWith: 'enhanced_defense', features: [ringFeature('infusion_enhanced_defense', [fx('ac', 'add', 1)]), ringFeature('stale_copy', [fx('ac', 'add', 50)])] }),
  ]);
  return out;
}

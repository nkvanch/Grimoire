// Rests, hit dice, dawn and the end-of-change recompute: prepared characters for the native-parity fixtures. Pure data.
import type { Entity } from '../types';

type Json = Record<string, unknown>;

const feature = (id: string, effects: Json[], extra: Json = {}, kind = 'feat', level = 1): Json => ({
  id, name: id, description: '', source: { kind, refId: id }, level, actions: [], choices: [], passive: true, effects, isActive: true, ...extra,
});
const fx = (target: string, operation: string, value: unknown, extra: Json = {}, type = 'stat_modifier'): Json =>
  ({ type, target, operation, value, condition: null, ...extra });

export type RestCase = {
  name: string;
  entity: Entity;
  op:
    | { name: 'takeRest'; args: { kind: 'short' | 'long'; allocation?: { dieSize: number; recover: number }[] } }
    | { name: 'spendHitDieManual'; args: { roll: number; dieSize?: number } }
    | { name: 'discardHitDie'; args: { dieSize?: number } }
    | { name: 'takeDawn'; args: Record<string, never> }
    | { name: 'recompute'; args: Record<string, never> };
};

export function buildRestCases(base: Entity): RestCase[] {
  const out: RestCase[] = [];
  const pool = (id: string, recharge: string, current: number, maximum: number, extra: Json = {}): Json =>
    ({ id, name: id, current, maximum, recharge, sourceKind: 'class', sourceId: 'wizard', ...extra });
  const make = (name: string, op: RestCase['op'], tweak: (e: Entity & Json) => void = () => undefined) => {
    const e = JSON.parse(JSON.stringify(base)) as Entity & Json;
    tweak(e);
    out.push({ name, entity: e, op });
  };
  const res = (e: Entity & Json): Json => e.resources;
  const hp = (e: Entity & Json): Json => res(e).hp as Json;
  const sc = (e: Entity & Json): Json => e.spellcasting as unknown as Json;
  const addFeature = (e: Entity & Json, f: Json) => { e.features = [...e.features, f as never]; };
  const usedSlots = (e: Entity & Json) => {
    const slots = sc(e).slots as Record<string, { total: number; used: number }>;
    for (const t of ['1', '2', '3']) slots[t].used = Math.min(slots[t].total, 2);
  };
  const spent = (e: Entity & Json) => {
    hp(e).current = 9;
    hp(e).temp = 4;
    res(e).deathSaves = { successes: 1, failures: 2, stable: false };
    (res(e).hitDice as Json).remaining = 1;
    res(e).custom = [
      pool('p_short', 'short_rest', 0, 3), pool('p_long', 'long_rest', 1, 4), pool('p_never', 'never', 0, 2),
      pool('p_dawn', 'dawn', 0, 2), pool('p_text', 'per encounter', 0, 1),
    ];
    usedSlots(e);
  };

  make('rest-short', { name: 'takeRest', args: { kind: 'short' } }, spent);
  make('rest-short-pact-pool', { name: 'takeRest', args: { kind: 'short' } }, e => {
    spent(e);
    (e.identity as unknown as Json).classes = [{ classId: 'warlock', subclassId: null, level: 5 }];
    sc(e).pactSlots = { '1': { total: 0, used: 0 }, '2': { total: 2, used: 2 }, '3': { total: 0, used: 0 } };
  });
  make('rest-short-pact-legacy-slots', { name: 'takeRest', args: { kind: 'short' } }, e => {
    spent(e);
    (e.identity as unknown as Json).classes = [{ classId: 'warlock', subclassId: null, level: 5 }];
  });
  make('rest-long', { name: 'takeRest', args: { kind: 'long' } }, e => {
    spent(e);
    (e as Json).damageLog = [{ turn: 1, amount: 5 }];
    (e as Json).turnCounter = 4;
    (e as Json).pendingOutcomes = [{ id: 'x' }];
    (e.conditionMonitor as unknown as Json).exhaustion = 2;
  });
  make('rest-long-concentration-and-conditions', { name: 'takeRest', args: { kind: 'long' } }, e => {
    spent(e);
    sc(e).concentrating = 'bless';
    sc(e).concentratingDuration = { rounds: 10 };
    (e.conditionMonitor as unknown as Json).flags = { concentrating: true, rage_active: true };
    const bless = feature('bless_effect', [fx('attack_rolls', 'add', 1)], {}, 'spell');
    (bless.source as Json).refId = 'bless';
    const cond = feature('cond_feat', [fx('speed', 'add', -10)], {}, 'condition');
    (cond.source as Json).refId = 'frightened';
    addFeature(e, bless);
    addFeature(e, cond);
    (e as Json).conditions = [
      { id: 'frightened', name: 'Frightened', suppressedBy: [], sourceId: 'x' },
      { id: 'prone', name: 'Prone', suppressedBy: [], sourceId: 'y' },
    ];
    (e.conditionMonitor as unknown as Json).active = [
      { id: 'frightened', duration: { unit: 'until_rest' } },
      { id: 'prone', duration: { unit: 'rounds', amount: 3 } },
    ];
    (e.conditionMonitor as unknown as Json).exhaustion = 1;
  });
  make('rest-long-heroic-inspiration', { name: 'takeRest', args: { kind: 'long' } }, e => {
    addFeature(e, feature('resourceful', [fx('heroic_inspiration_on_long_rest', 'set', 1)], {}, 'race'));
  });
  const twoPools = (e: Entity & Json) => {
    (e.identity as unknown as Json).level = 7;
    (e.identity as unknown as Json).classes = [{ classId: 'wizard', subclassId: null, level: 3 }, { classId: 'fighter', subclassId: null, level: 4 }];
    res(e).hitDice = { die: 6, total: 7, remaining: 0, pools: [{ die: 6, total: 3, remaining: 0 }, { die: 10, total: 4, remaining: 0 }] };
  };
  make('rest-long-needs-choice-refused', { name: 'takeRest', args: { kind: 'long' } }, twoPools);
  make('rest-long-choice-valid', { name: 'takeRest', args: { kind: 'long', allocation: [{ dieSize: 10, recover: 3 }] } }, twoPools);
  make('rest-long-choice-split', { name: 'takeRest', args: { kind: 'long', allocation: [{ dieSize: 6, recover: 1 }, { dieSize: 10, recover: 2 }] } }, twoPools);
  make('rest-long-choice-too-many', { name: 'takeRest', args: { kind: 'long', allocation: [{ dieSize: 10, recover: 4 }] } }, twoPools);
  make('rest-long-choice-unknown-die', { name: 'takeRest', args: { kind: 'long', allocation: [{ dieSize: 8, recover: 1 }] } }, twoPools);
  make('rest-long-choice-duplicate', { name: 'takeRest', args: { kind: 'long', allocation: [{ dieSize: 10, recover: 1 }, { dieSize: 10, recover: 1 }] } }, twoPools);
  make('rest-long-pools-budget-covers', { name: 'takeRest', args: { kind: 'long' } }, e => {
    twoPools(e);
    res(e).hitDice = { die: 6, total: 7, remaining: 5, pools: [{ die: 6, total: 3, remaining: 3 }, { die: 10, total: 4, remaining: 2 }] };
  });
  make('rest-long-single-pool-partial', { name: 'takeRest', args: { kind: 'long' } }, e => {
    (e.identity as unknown as Json).level = 9;
    (res(e).hitDice as Json).total = 9;
    (res(e).hitDice as Json).remaining = 2;
  });

  make('hitdie-spend', { name: 'spendHitDieManual', args: { roll: 4 } }, e => { hp(e).current = 10; (res(e).hitDice as Json).remaining = 3; });
  make('hitdie-spend-cap', { name: 'spendHitDieManual', args: { roll: 6 } }, e => { hp(e).current = 40; });
  make('hitdie-spend-none-left', { name: 'spendHitDieManual', args: { roll: 6 } }, e => { hp(e).current = 10; (res(e).hitDice as Json).remaining = 0; });
  make('hitdie-spend-con-effect', { name: 'spendHitDieManual', args: { roll: 3 } }, e => {
    hp(e).current = 5;
    addFeature(e, feature('belt', [fx('con', 'set', 20)]));
  });
  const spendPools = (e: Entity & Json) => {
    twoPools(e);
    hp(e).current = 10;
    res(e).hitDice = { die: 6, total: 7, remaining: 5, pools: [{ die: 6, total: 3, remaining: 2 }, { die: 10, total: 4, remaining: 3 }] };
  };
  make('hitdie-spend-two-pools-needs-size', { name: 'spendHitDieManual', args: { roll: 5 } }, spendPools);
  make('hitdie-spend-two-pools-named', { name: 'spendHitDieManual', args: { roll: 5, dieSize: 10 } }, spendPools);
  make('hitdie-spend-pool-exhausted-size', { name: 'spendHitDieManual', args: { roll: 5, dieSize: 6 } }, e => {
    twoPools(e);
    hp(e).current = 10;
    res(e).hitDice = { die: 6, total: 7, remaining: 3, pools: [{ die: 6, total: 3, remaining: 0 }, { die: 10, total: 4, remaining: 3 }] };
  });
  make('hitdie-discard', { name: 'discardHitDie', args: {} }, e => { hp(e).current = 10; });
  make('hitdie-discard-named-pool', { name: 'discardHitDie', args: { dieSize: 6 } }, spendPools);

  make('dawn-plain', { name: 'takeDawn', args: {} }, e => {
    res(e).custom = [pool('d1', 'dawn', 0, 3), pool('d2', 'dawn', 3, 3), pool('l1', 'long_rest', 0, 2)];
  });
  make('dawn-nothing-to-do', { name: 'takeDawn', args: {} }, e => { res(e).custom = [pool('l1', 'long_rest', 0, 2)]; });

  make('recompute-max-hp-bonus', { name: 'recompute', args: {} }, e => {
    hp(e).current = 30;
    addFeature(e, feature('tough', [fx('max_hp', 'add', 10)]));
  });
  make('recompute-max-hp-bonus-removed', { name: 'recompute', args: {} }, e => {
    hp(e).maximum = 52;
    hp(e).current = 50;
    hp(e).bonusApplied = 10;
  });
  make('recompute-max-hp-bonus-lowered', { name: 'recompute', args: {} }, e => {
    hp(e).maximum = 52;
    hp(e).current = 50;
    hp(e).bonusApplied = 10;
    addFeature(e, feature('tough', [fx('max_hp', 'add', 4)]));
  });
  make('recompute-hit-die-tier', { name: 'recompute', args: {} }, e => {
    addFeature(e, feature('dense', [fx('hit_die_tier', 'add', 1)]));
  });
  make('recompute-resource-upgrades', { name: 'recompute', args: {} }, e => {
    res(e).custom = [pool('dice', 'short_rest', 2, 4, { baseMaximum: 4 }), pool('plain', 'long_rest', 1, 3)];
    (e as Json).entitlements = [
      ...((e as Json).entitlements as unknown[]),
      { kind: 'resource_upgrade', key: 'dice', amount: 2, sourceKind: 'class', sourceId: 'x' },
      { kind: 'resource_upgrade', key: 'gone', amount: 5, sourceKind: 'class', sourceId: 'x' },
    ];
  });
  make('recompute-formula-resources', { name: 'recompute', args: {} }, e => {
    e.stats = { ...e.stats, int: 20 };
    res(e).custom = [
      pool('per_prof', 'long_rest', 1, 2, { perProficiencyBonus: true }),
      pool('per_int', 'long_rest', 1, 3, { perAbilityModifier: 'int' }),
      pool('per_level', 'long_rest', 5, 5, { perLevel: 2 }),
    ];
  });
  make('recompute-proficiency-lists', { name: 'recompute', args: {} }, e => {
    (e.proficiencies as unknown as Json).weapons = ['Stale Weapon'];
    (e.proficiencies as unknown as Json).tools = ['Stale Tool'];
    addFeature(e, feature('grants', [
      fx('tool:thieves_tools', 'add', null, {}, 'grant_proficiency'),
      fx('weapon:hand_crossbow', 'add', null, {}, 'grant_proficiency'),
      fx('armor:light', 'add', null, {}, 'grant_proficiency'),
      fx('skill:stealth', 'add', null, {}, 'grant_proficiency'),
    ]));
  });
  return out;
}

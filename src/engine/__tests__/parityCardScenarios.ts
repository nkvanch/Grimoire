// Prepared characters and card uses for the native-parity fixtures: casting, concentration, rituals, resources, outcomes, action
// economy, attack sequences, incapacitation. Pure data (no engine imports).
import type { Entity } from '../types';

type Json = Record<string, unknown>;

export type CardUseArgs = {
  featureId: string;
  sourceId?: string;
  optionId?: string;
  payment?: { kind: 'normal' | 'pact'; tier: string };
  contextKey?: string;
  bypassPrep?: boolean;
  bypassIncap?: boolean;
  ritual?: boolean;
  sequenceId?: string;
};
export type CardScenario = { name: string; entity: Entity; uses: CardUseArgs[] };

const feature = (id: string, extra: Json = {}, kind = 'feat', level = 1): Json => ({
  id, name: id, description: `${id} description`, source: { kind, refId: id }, level, actions: [], choices: [], passive: false, effects: [],
  isActive: true, ...extra,
});
const activation = (actionType: string, cost: Json | null, extra: Json = {}): Json =>
  ({ actionType, resourceCost: cost, range: 'self', target: 'self', requiresSave: null, ...extra });
const pool = (id: string, current: number, maximum: number, recharge = 'long_rest'): Json =>
  ({ id, name: id, current, maximum, recharge, sourceKind: 'class', sourceId: 'x' });
const spellAccess = (key: string, sourceKind = 'class', sourceId = 'wizard', extra: Json = {}): Json => ({ kind: 'spell_access', key, sourceKind, sourceId, ...extra });
const cantripAccess = (key: string, sourceKind = 'class', sourceId = 'wizard'): Json => ({ kind: 'cantrip_access', key, sourceKind, sourceId });

export function buildCardScenarios(base: Entity): CardScenario[] {
  const out: CardScenario[] = [];
  const make = (name: string, tweak: (e: Entity & Json) => void, uses: CardUseArgs[]) => {
    const e = JSON.parse(JSON.stringify(base)) as Entity & Json;
    tweak(e);
    out.push({ name, entity: e, uses });
  };
  const sc = (e: Entity & Json): Json => e.spellcasting as unknown as Json;
  const res = (e: Entity & Json): Json => e.resources;
  const identity = (e: Entity & Json): Json => e.identity;
  const addEntitlements = (e: Entity & Json, ...list: Json[]) => { (e as Json).entitlements = [...((e as Json).entitlements as unknown[]), ...list]; };
  const addFeature = (e: Entity & Json, f: Json) => { e.features = [...e.features, f as never]; };
  const turn = (e: Entity & Json, used: Json = {}) => { (e as Json).turnState = { actionUsed: false, bonusActionUsed: false, reactionUsed: false, ...used }; };

  const spells = (e: Entity & Json) => {
    addEntitlements(e, spellAccess('magic_missile'), spellAccess('shield'), spellAccess('burning_hands'), spellAccess('detect_magic'),
      spellAccess('bless'), spellAccess('haste'), spellAccess('healing_word'));
    sc(e).prepared = ['magic_missile', 'shield', 'bless', 'haste', 'healing_word'];
  };

  make('cards-spells-basic', spells, [
    { featureId: 'magic_missile' },
    { featureId: 'magic_missile', payment: { kind: 'normal', tier: '1' } },
    { featureId: 'magic_missile', payment: { kind: 'normal', tier: '3' } },
    { featureId: 'magic_missile', payment: { kind: 'normal', tier: '4' } },
    { featureId: 'firebolt' },
    { featureId: 'burning_hands', payment: { kind: 'normal', tier: '1' } },
    { featureId: 'burning_hands', payment: { kind: 'normal', tier: '1' }, bypassPrep: true },
  ]);
  make('cards-spells-single-slot', e => {
    spells(e);
    const slots = sc(e).slots as Record<string, { total: number; used: number }>;
    slots['1'] = { total: 1, used: 0 }; slots['2'] = { total: 0, used: 0 }; slots['3'] = { total: 0, used: 0 };
  }, [{ featureId: 'magic_missile' }, { featureId: 'shield' }]);
  make('cards-spells-no-slots', e => {
    spells(e);
    const slots = sc(e).slots as Record<string, { total: number; used: number }>;
    for (const t of ['1', '2', '3']) slots[t].used = slots[t].total;
  }, [{ featureId: 'magic_missile', payment: { kind: 'normal', tier: '1' } }, { featureId: 'firebolt' }]);
  make('cards-pact-and-normal', e => {
    spells(e);
    sc(e).pactSlots = { '2': { total: 2, used: 0 } };
  }, [
    { featureId: 'magic_missile', payment: { kind: 'pact', tier: '2' } },
    { featureId: 'magic_missile', payment: { kind: 'normal', tier: '2' } },
    { featureId: 'magic_missile' },
  ]);
  make('cards-concentration', e => {
    spells(e);
    addFeature(e, { ...feature('bless_buff', { passive: true, effects: [] }, 'spell'), source: { kind: 'spell', refId: 'bless' } });
    sc(e).concentrating = 'bless';
    sc(e).concentratingDuration = { unit: 'rounds', remaining: 5 };
    ((e.conditionMonitor as unknown) as Json).flags = { concentrating: true };
  }, [
    { featureId: 'haste', payment: { kind: 'normal', tier: '3' } },
    { featureId: 'bless', payment: { kind: 'normal', tier: '2' } },
    { featureId: 'magic_missile', payment: { kind: 'normal', tier: '1' } },
  ]);
  make('cards-ritual', e => {
    spells(e);
    sc(e).prepared = ['magic_missile'];
  }, [
    { featureId: 'detect_magic', ritual: true },
    { featureId: 'detect_magic', payment: { kind: 'normal', tier: '1' } },
    { featureId: 'detect_magic', payment: { kind: 'normal', tier: '1' }, bypassPrep: true },
    { featureId: 'magic_missile', ritual: true },
  ]);
  make('cards-action-economy', e => { spells(e); turn(e); }, [
    { featureId: 'magic_missile', payment: { kind: 'normal', tier: '1' } },
    { featureId: 'healing_word', payment: { kind: 'normal', tier: '1' } },
    { featureId: 'shield', payment: { kind: 'normal', tier: '1' } },
    { featureId: 'firebolt' },
  ]);
  make('cards-action-economy-spent', e => { spells(e); turn(e, { actionUsed: true, bonusActionUsed: true, reactionUsed: false }); }, [
    { featureId: 'magic_missile', payment: { kind: 'normal', tier: '1' } },
    { featureId: 'healing_word', payment: { kind: 'normal', tier: '1' } },
    { featureId: 'shield', payment: { kind: 'normal', tier: '1' } },
    { featureId: 'detect_magic', ritual: true },
  ]);

  make('cards-features-resources', e => {
    res(e).custom = [pool('wind', 1, 1), pool('rage_pool', 2, 3), pool('dice', 0, 4), pool('charges', 3, 5)];
    turn(e);
    addFeature(e, feature('second_wind', {
      activation: activation('bonus_action', { resourceId: 'wind', quantity: 1 }), abilityEffects: [{ type: 'heal', dice: '1d10' }],
    }, 'class'));
    addFeature(e, feature('rage', {
      activation: activation('bonus_action', { resourceId: 'rage_pool', quantity: 1 }), abilityEffects: [{ type: 'set_flag', flag: 'rage_active', value: true }],
    }, 'class'));
    addFeature(e, feature('refill', {
      activation: activation('free', { resourceId: 'charges', quantity: 1 }),
      abilityEffects: [{ type: 'restore_resource', resourceId: 'dice', amount: 'full' }, { type: 'restore_resource', resourceId: 'charges', amount: 2 }],
    }, 'class'));
    addFeature(e, feature('strike_with_outcome', {
      activation: activation('action', { resourceId: 'rage_pool', quantity: 1 }, { target: 'single' }),
      outcomes: { hit: { effects: [{ type: 'restore_resource', resourceId: 'dice', amount: 1 }] }, miss: { effects: [] } },
    }, 'class'));
    addFeature(e, feature('choose_cost', {
      activation: activation('action', null, { options: [
        { id: 'big', label: 'Big', resourceCost: { resourceId: 'charges', quantity: 3 } },
        { id: 'small', label: 'Small', resourceCost: { resourceId: 'charges', quantity: 1 } },
      ] }),
    }, 'class'));
    addFeature(e, feature('both_slots', { activation: activation('action', null, { alsoCosts: 'bonus_action' }) }, 'class'));
    addFeature(e, feature('apply_self_condition', {
      activation: activation('action', null), abilityEffects: [{ type: 'apply_condition', conditionId: 'frightened' }],
    }, 'class'));
    addFeature(e, feature('apply_target_condition', {
      activation: activation('action', null, { target: 'single' }), abilityEffects: [{ type: 'apply_condition', conditionId: 'frightened' }],
    }, 'class'));
    addFeature(e, feature('tracks', { activation: activation('action', null), abilityEffects: [{ type: 'track_effect', name: 'x', until: 'end_of_turn' }] }, 'class'));
  }, [
    { featureId: 'second_wind' }, { featureId: 'rage' }, { featureId: 'refill' }, { featureId: 'strike_with_outcome' },
    { featureId: 'choose_cost' }, { featureId: 'choose_cost', optionId: 'small' }, { featureId: 'choose_cost', optionId: 'big' },
    { featureId: 'both_slots' }, { featureId: 'apply_self_condition' }, { featureId: 'apply_target_condition' }, { featureId: 'tracks' },
  ]);
  make('cards-features-exhausted', e => {
    res(e).custom = [pool('wind', 0, 1)];
    turn(e, { bonusActionUsed: true });
    addFeature(e, feature('second_wind', { activation: activation('bonus_action', { resourceId: 'wind', quantity: 1 }) }, 'class'));
    addFeature(e, feature('needs_missing', { activation: activation('free', { resourceId: 'nope', quantity: 1 }) }, 'class'));
    addFeature(e, feature('plain_action', { activation: activation('action', null) }, 'class'));
    addFeature(e, feature('passive_thing', { passive: true, activation: activation('passive', null) }, 'class'));
  }, [{ featureId: 'second_wind' }, { featureId: 'needs_missing' }, { featureId: 'plain_action' }]);
  make('cards-heal-from-damage-taken-and-conditions', e => {
    (e as Json).turnCounter = 4;
    (e as Json).damageLog = [{ turn: 4, amount: 10 }, { turn: 3, amount: 6 }, { turn: 1, amount: 50 }];
    res(e).hp = { ...(res(e).hp as Json), current: 20 };
    (e as Json).conditions = [{ id: 'prone', name: 'Prone', suppressedBy: [], sourceId: 'x' }];
    ((e.conditionMonitor as unknown) as Json).active = [{ id: 'prone', duration: { unit: 'rounds', amount: 3 } }];
    addFeature(e, feature('reform', {
      activation: activation('reaction', null), abilityEffects: [{ type: 'heal_from_damage_taken', turnsBack: 1, fraction: 0.5 }],
    }, 'class'));
    addFeature(e, feature('stand_up', {
      activation: activation('free', null), abilityEffects: [{ type: 'remove_condition', conditionId: 'prone' }],
    }, 'class'));
  }, [{ featureId: 'reform' }, { featureId: 'stand_up' }]);
  make('cards-incapacitated', e => {
    res(e).hp = { ...(res(e).hp as Json), current: 0 };
    res(e).deathSaves = { successes: 1, failures: 1, stable: false };
    spells(e);
    addFeature(e, feature('some_action', { activation: activation('action', null) }, 'class'));
  }, [
    { featureId: 'some_action' }, { featureId: 'some_action', bypassIncap: true },
    { featureId: 'magic_missile', payment: { kind: 'normal', tier: '1' } },
    { featureId: 'magic_missile', payment: { kind: 'normal', tier: '1' }, bypassIncap: true },
    { featureId: 'unarmed_strike' },
  ]);
  make('cards-dead', e => {
    res(e).hp = { ...(res(e).hp as Json), current: 0 };
    res(e).deathSaves = { successes: 0, failures: 3, stable: false };
    addFeature(e, feature('some_action', { activation: activation('action', null) }, 'class'));
  }, [{ featureId: 'some_action', bypassIncap: true }]);
  make('cards-suspended-feature', e => {
    (e as Json).turnCounter = 2;
    (e as Json).suspensions = [{ featureId: 'quiet', until: 5 }];
    addFeature(e, feature('quiet', { activation: activation('action', null) }, 'class'));
  }, [{ featureId: 'quiet' }]);

  const withExtraAttack = (e: Entity & Json) => {
    addFeature(e, { ...feature('extra_attack', { passive: true }, 'class'), effects: [{ type: 'stat_modifier', target: 'extra_attack', operation: 'set', value: 1, condition: null }] });
    turn(e);
  };
  make('cards-attack-sequence-lead', withExtraAttack, [
    { featureId: 'unarmed_strike', sequenceId: 'seq1' },
    { featureId: 'some_spell_like', sequenceId: 'seq1' },
  ]);
  make('cards-attack-sequence-chained', e => {
    withExtraAttack(e);
    turn(e, { actionUsed: true });
    (e as Json).attackSequence = { sequenceId: 'seq1', actorId: (e as Json).id, maxAttacks: 2, usedAttacks: 1 };
  }, [{ featureId: 'unarmed_strike', sequenceId: 'seq1' }, { featureId: 'unarmed_strike', sequenceId: 'other' }, { featureId: 'unarmed_strike' }]);
  make('cards-attack-sequence-exhausted', e => {
    withExtraAttack(e);
    turn(e, { actionUsed: true });
    (e as Json).attackSequence = { sequenceId: 'seq1', actorId: (e as Json).id, maxAttacks: 2, usedAttacks: 2 };
  }, [{ featureId: 'unarmed_strike', sequenceId: 'seq1' }]);

  const inst = (itemId: string, extra: Json = {}): Json => ({ id: `item:${itemId}`, itemId, quantity: 1, attuned: false, features: [], ...extra });
  make('cards-items', e => {
    turn(e);
    (e.inventory as unknown as Json).equipped = [
      inst('longsword'), inst('shield'),
      inst('zz_wand', {
        features: [feature('zz_wand_zap', {
          activation: activation('action', { resourceId: 'charges', quantity: 1 }, { target: 'single' }), abilityEffects: [{ type: 'set_flag', flag: 'zapped', value: true }],
        }, 'item')],
      }),
      inst('zz_ring', { requiresAttunement: true, attuned: false, features: [feature('zz_ring_pulse', { activation: activation('action', null) }, 'item')] }),
    ];
    res(e).custom = [pool('charges', 2, 3)];
  }, [
    { featureId: 'longsword_attack', sourceId: 'item:longsword' },
    { featureId: 'zz_wand_zap', sourceId: 'item:zz_wand' },
    { featureId: 'zz_ring_pulse', sourceId: 'item:zz_ring' },
  ]);

  make('cards-casting-contexts-multiclass', e => {
    identity(e).level = 5;
    identity(e).classes = [{ classId: 'wizard', subclassId: null, level: 3 }, { classId: 'sorcerer', subclassId: null, level: 2 }];
    addEntitlements(e,
      spellAccess('fireball'), spellAccess('fireball', 'class', 'sorcerer'),
      spellAccess('magic_missile', 'class', 'sorcerer'),
      spellAccess('shield', 'manual', undefined, { ambiguousClassIds: ['wizard', 'sorcerer'] }),
      spellAccess('sleep', 'race', 'elf'),
      cantripAccess('light', 'class', 'sorcerer'));
    sc(e).prepared = [];
    const slots = sc(e).slots as Record<string, { total: number; used: number }>;
    slots['3'] = { total: 2, used: 0 };
  }, [
    { featureId: 'fireball', payment: { kind: 'normal', tier: '3' } },
    { featureId: 'fireball', payment: { kind: 'normal', tier: '3' }, contextKey: 'class:wizard:wizard:spell_access:' },
    { featureId: 'fireball', payment: { kind: 'normal', tier: '3' }, contextKey: 'class:sorcerer:sorcerer:spell_access:' },
    { featureId: 'magic_missile', payment: { kind: 'normal', tier: '1' } },
    { featureId: 'shield', payment: { kind: 'normal', tier: '1' } },
    { featureId: 'sleep', payment: { kind: 'normal', tier: '1' } },
    { featureId: 'light' },
  ]);
  make('cards-granted-spell-feature', e => {
    addFeature(e, {
      ...feature('racial_magic', { passive: true }, 'race', 1),
      effects: [{ type: 'grant_spell', target: 'spells', operation: 'add', value: null, condition: null, cantripIds: ['light'], spellIds: ['mage_armor'], spellcastingAbility: 'cha' }],
    });
    addEntitlements(e, cantripAccess('light', 'race', 'x'), spellAccess('mage_armor', 'race', 'x'));
  }, [{ featureId: 'light' }, { featureId: 'mage_armor', payment: { kind: 'normal', tier: '1' } }]);
  return out;
}

// The 2014 Druid's Wild Shape card: the picker, using it, and the beast's own attacks while transformed.
export function buildWildShapeCardScenarios(druid: Entity): CardScenario[] {
  const out: CardScenario[] = [];
  const make = (name: string, tweak: (e: Entity & Json) => void, uses: CardUseArgs[]) => {
    const e = JSON.parse(JSON.stringify(druid)) as Entity & Json;
    tweak(e);
    out.push({ name, entity: e, uses });
  };
  const pool = (e: Entity & Json, id: string, current: number) => {
    const list = (e.resources as unknown as Json).custom as Json[];
    const p = list.find(r => r.id === id);
    if (p) p.current = current;
  };
  make('cards-wild-shape-picker', () => undefined, [
    { featureId: 'wild_shape', optionId: 'form:wolf' },
    { featureId: 'wild_shape', optionId: 'form:crocodile' },
  ]);
  make('cards-wild-shape-spent', e => pool(e, 'wild_shape', 0), [{ featureId: 'wild_shape', optionId: 'form:wolf' }]);
  make('cards-wild-shape-active', e => {
    (e as Json).wildShapeState = { active: true, formId: 'wolf', beastHp: 11, beastHpMax: 11, expiresAt: { unit: 'hours', remaining: 2 } };
  }, [{ featureId: 'wild_shape', optionId: 'form:ape' }, { featureId: 'wild_shape_attack_wolf_0' }]);
  return out;
}

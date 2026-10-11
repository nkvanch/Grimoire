// What the trait editor can now author: an unlimited card (Cunning Action), spending a resource that already exists (Ki, another
// feature's pool), a pool that follows proficiency / an ability / level, and raising a pool at a later level (Martial Surge dice).
import { newDraftTrait, buildTraitFeature } from '../traitCompiler';
import type { BuildTraitOpts } from '../traitCompiler';
import { getProgressionForClass } from '../classes/progressions';
import { classResourceChoices, localPoolChoices, poolChoicesBefore } from '../classes/knownResources';
import { applyGrant } from '../../engine/leveling';
import { makeEmptyEntity } from '../../store/characterStore';
import type { CharClass, DraftTrait, Grant } from '../../engine/types';

const opts = (over: Partial<BuildTraitOpts> = {}): BuildTraitOpts => ({ idPrefix: 'sc_l3', sourceKind: 'subclass', sourceRefId: 'sc', level: 3, ...over });
const trait = (name: string, patch: Partial<DraftTrait> = {}): DraftTrait => ({ ...newDraftTrait(name), ...patch });

describe('an unlimited card (at will)', () => {
  it('is a non-passive card with no cost and no pool of its own', () => {
    const built = buildTraitFeature(trait('Cunning Action', { atWill: true, actionType: 'bonus_action', description: 'Dash, Disengage or Hide.' }), opts());
    expect(built.feature.passive).toBe(false);
    expect(built.feature.activation).toMatchObject({ actionType: 'bonus_action', resourceCost: null });
    expect(built.resource).toBeNull();
  });

  it('does nothing extra when the toggle is off', () => {
    const built = buildTraitFeature(trait('Steady Gait', { actionType: 'bonus_action' }), opts());
    expect(built.feature.activation).toBeUndefined();
  });

  it('keeps a saving throw on the card', () => {
    const built = buildTraitFeature(trait('Shout', { atWill: true, actionType: 'action', saveEnabled: true, saveAbility: 'con', saveDcMode: 'fixed', saveDcFixed: '14' }), opts());
    expect(built.feature.activation?.requiresSave).toEqual({ ability: 'con', dc: 14 });
  });
});

describe('spending a resource that already exists', () => {
  it('costs that resource and creates no pool', () => {
    const built = buildTraitFeature(trait('Flurry Echo', { spendsResourceId: 'ki_points', spendsQuantity: '2', actionType: 'bonus_action' }), opts());
    expect(built.feature.activation?.resourceCost).toEqual({ resourceId: 'ki_points', quantity: 2 });
    expect(built.resource).toBeNull();
  });

  it('works for a resource_ability trait too, and ignores its own uses', () => {
    const built = buildTraitFeature(trait('Wild Burst', { effectKind: 'resource_ability', spendsResourceId: 'wild_shape_pool', uses: '3' }), opts());
    expect(built.resource).toBeNull();
    expect(built.feature.activation?.resourceCost).toEqual({ resourceId: 'wild_shape_pool', quantity: 1 });
  });

  it('spends from a pool another feature in the same build created', () => {
    const local = new Map<string, string>();
    const dice = trait('Martial Surge', { limitedUse: true, uses: '4', recharge: 'short_rest', actionType: 'other' });
    const first = buildTraitFeature(dice, opts({ localResources: local }));
    const spender = trait('Riposte', { spendsResourceId: `local:${dice.localId}`, actionType: 'reaction' });
    const second = buildTraitFeature(spender, opts({ idPrefix: 'sc_l7', level: 7, localResources: local }));
    expect(first.resource?.maximum).toBe(4);
    expect(second.feature.activation?.resourceCost).toEqual({ resourceId: first.resource!.resourceId, quantity: 1 });
    expect(second.resource).toBeNull();
  });

  it('a reference to a pool that was never built leaves the card without a cost instead of inventing one', () => {
    const built = buildTraitFeature(trait('Orphan', { spendsResourceId: 'local:nope', limitedUse: false, atWill: true }), opts({ localResources: new Map() }));
    expect(built.feature.activation?.resourceCost).toBeNull();
  });
});

describe('a pool that follows the character', () => {
  const pool = (patch: Partial<DraftTrait>) =>
    buildTraitFeature(trait('Surge', { effectKind: 'resource_ability', uses: '2', ...patch }), opts()).resource!;
  it('follows the proficiency bonus', () => expect(pool({ usesScaling: 'proficiency' })).toMatchObject({ maximum: 2, perProficiencyBonus: true }));
  it('follows an ability modifier', () => expect(pool({ usesScaling: 'ability', usesScalingAbility: 'wis' })).toMatchObject({ perAbilityModifier: 'wis' }));
  it('follows level times a number', () => expect(pool({ usesScaling: 'level', usesPerLevel: '3' })).toMatchObject({ perLevel: 3 }));
  it('is fixed by default', () => {
    const r = pool({});
    expect(r.perProficiencyBonus).toBeUndefined(); expect(r.perAbilityModifier).toBeUndefined(); expect(r.perLevel).toBeUndefined();
  });
  it('applies to a limited-use pool on a non-resource trait as well', () => {
    const r = buildTraitFeature(trait('Aura Surge', { limitedUse: true, uses: '1', usesScaling: 'proficiency' }), opts()).resource!;
    expect(r.perProficiencyBonus).toBe(true);
  });
});

describe('raising a resource at a later level (Martial Surge dice 4, 5 at 7th, 6 at 15th)', () => {
  const dice = { ...trait('Martial Surge', { limitedUse: true, uses: '4', recharge: 'short_rest', actionType: 'other' }), level: 3 };
  const improved = { ...trait('Improved Martial Surge', { raiseResourceId: `local:${dice.localId}`, raiseResourceTo: '5' }), level: 7 };
  const relentless = { ...trait('Relentless', { raiseResourceId: `local:${dice.localId}`, raiseResourceTo: '6' }), level: 15 };
  const cls: CharClass = {
    id: 'hb_warrior', name: 'Warrior', hitDie: 10, features: [],
    levelFeatures: [dice, improved, relentless].map(f => ({ ...f, effectKind: f.effectKind ?? 'none' })),
  } as unknown as CharClass;

  const grantsAt = (level: number): Grant[] => getProgressionForClass(cls).entries.find(e => e.level === level)?.grants ?? [];
  const poolId = () => (grantsAt(3).find(g => g.kind === 'resource')!.value as { resourceId: string }).resourceId;

  it('compiles the later feature into a resource_upgrade grant for the pool built earlier', () => {
    const up = grantsAt(7).find(g => g.kind === 'resource_upgrade');
    expect(up?.value).toEqual({ resourceId: poolId(), newMaximum: 5 });
    expect(grantsAt(15).find(g => g.kind === 'resource_upgrade')?.value).toEqual({ resourceId: poolId(), newMaximum: 6 });
  });

  it('on a character: 4 dice, then 5, then 6, with spent dice staying spent', () => {
    let e = makeEmptyEntity('w1');
    for (const g of grantsAt(3)) e = applyGrant(e, g, 3, 'hb_warrior');
    const get = () => e.resources.custom.find(r => r.id === poolId())!;
    expect(get()).toMatchObject({ maximum: 4, current: 4 });
    e = { ...e, resources: { ...e.resources, custom: e.resources.custom.map(r => r.id === poolId() ? { ...r, current: 1 } : r) } };
    for (const g of grantsAt(7)) e = applyGrant(e, g, 7, 'hb_warrior');
    expect(get()).toMatchObject({ maximum: 5, current: 2 });
    for (const g of grantsAt(15)) e = applyGrant(e, g, 15, 'hb_warrior');
    expect(get()).toMatchObject({ maximum: 6, current: 3 });
  });

  it('an upgrade of a pool that does not exist is dropped, not invented', () => {
    const built = buildTraitFeature(trait('Dangling', { raiseResourceId: 'local:missing', raiseResourceTo: '3' }), opts({ localResources: new Map() }));
    expect(built.resourceUpgrades).toBeUndefined();
  });

  it('an upgrade of a class resource by id needs no local pool', () => {
    const built = buildTraitFeature(trait('More Rage', { raiseResourceId: 'rage_pool', raiseResourceTo: '7' }), opts());
    expect(built.resourceUpgrades).toEqual([{ resourceId: 'rage_pool', newMaximum: 7 }]);
  });
});

describe('the picker lists', () => {
  it('only pools built before the open feature', () => {
    const a = { ...trait('A Pool', { limitedUse: true }), level: 3 };
    const b = { ...trait('B Pool', { effectKind: 'resource_ability' }), level: 7 };
    const flavor = { ...trait('Flavor'), level: 3 };
    const choices = poolChoicesBefore([a, b, flavor], { localId: flavor.localId, level: 5 });
    expect(choices.map(c => c.id)).toEqual([`local:${a.localId}`]);
    expect(poolChoicesBefore([a, b], null)).toEqual([]);
  });

  it('never offers a trait that itself spends from something else', () => {
    const spender = trait('Spender', { limitedUse: true, spendsResourceId: 'ki_points' });
    expect(localPoolChoices([spender])).toEqual([]);
  });

  it('lists the pools an official class grants', () => {
    const { ALL_CHAR_CLASSES } = require('../classes') as typeof import('../classes');
    const barbarian = ALL_CHAR_CLASSES.find(c => c.id === 'barbarian')!;
    expect(classResourceChoices(barbarian).map(c => c.id)).toContain('rage_pool');
    expect(classResourceChoices(null)).toEqual([]);
  });
});

describe('on a character sheet', () => {
  const { generateAllActionCards } = require('../../engine/actionCards') as typeof import('../../engine/actionCards');
  const { applyActionCardUse } = require('../../engine/actionUse') as typeof import('../../engine/actionUse');
  const { DEFAULT_RULES } = require('../../store/characterStore') as typeof import('../../store/characterStore');

  function sheet() {
    const atWill = buildTraitFeature(trait('Cunning Action', { atWill: true, actionType: 'bonus_action' }), opts({ idPrefix: 'a', sourceKind: 'manual', sourceRefId: 'a', level: null })).feature;
    const spender = buildTraitFeature(trait('Flurry Echo', { spendsResourceId: 'ki_points', spendsQuantity: '2', actionType: 'bonus_action' }), opts({ idPrefix: 'b', sourceKind: 'manual', sourceRefId: 'b', level: null })).feature;
    const e = makeEmptyEntity('p');
    return { atWill, spender, entity: { ...e, features: [{ ...atWill, isActive: true }, { ...spender, isActive: true }] as never,
      resources: { ...e.resources, custom: [{ id: 'ki_points', name: 'Ki', current: 3, maximum: 3, recharge: 'short_rest' }] } } };
  }

  it('shows a card for each, and using the spender spends ki while the at-will card spends nothing', () => {
    const { atWill, spender, entity } = sheet();
    const cards = generateAllActionCards(entity, DEFAULT_RULES);
    const willCard = cards.find(c => c.featureId === atWill.id);
    const spendCard = cards.find(c => c.featureId === spender.id);
    expect(willCard).toBeTruthy();
    expect(spendCard).toBeTruthy();
    expect(willCard!.resourceCost).toBeNull();
    expect(spendCard!.resourceCost).toEqual({ resourceId: 'ki_points', quantity: 2 });

    const afterWill = applyActionCardUse(entity, willCard!, DEFAULT_RULES, undefined, undefined, true);
    expect(afterWill.resources.custom.find(r => r.id === 'ki_points')!.current).toBe(3);
    const afterSpend = applyActionCardUse(entity, spendCard!, DEFAULT_RULES, undefined, undefined, true);
    expect(afterSpend.resources.custom.find(r => r.id === 'ki_points')!.current).toBe(1);
  });
});

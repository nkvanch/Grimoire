// grant_speed: an ability that gives a movement speed for a while now does (the creator audit's grant_speed finding).
import { makeEmptyEntity, DEFAULT_RULES } from '../../store/characterStore';
import { recomputeDerived } from '../pipeline';
import { generateActionCard } from '../actionCards';
import { applyActionCardUse } from '../actionUse';
import { startTurn, playerEndTurn } from '../combat';
import { takeRest } from '../rest';
import { removeCondition } from '../conditions';
import type { Entity, Feature, AbilityEffect } from '../types';

const wings = (effect: AbilityEffect): Feature => ({
  id: 'wings', name: 'Wings', description: 'x', source: { kind: 'manual', refId: 'wings' }, level: null,
  effects: [], actions: [], choices: [], passive: false,
  activation: { actionType: 'bonus_action', target: 'self', range: 'Self', requiresSave: null, resourceCost: null },
  abilityEffects: [effect],
});
const character = (f: Feature): Entity => {
  const base = makeEmptyEntity('speed');
  return recomputeDerived({ ...base, identity: { ...base.identity, level: 5 }, features: [{ ...f, isActive: false }] }, DEFAULT_RULES);
};
const use = (e: Entity) => applyActionCardUse(e, generateActionCard(e.features[0], e)!, DEFAULT_RULES);

describe('grant_speed', () => {
  it('a fly speed is on the sheet after use', () => {
    const e = use(startTurn(character(wings({ type: 'grant_speed', speedType: 'fly', amount: 40, duration: { unit: 'rounds', remaining: 10 } })), DEFAULT_RULES));
    expect(e.derived.movement.fly).toBe(40);
  });
  it('a rounds duration ends with the End Turn that runs it out', () => {
    let e = use(startTurn(character(wings({ type: 'grant_speed', speedType: 'fly', amount: 40, duration: { unit: 'rounds', remaining: 2 } })), DEFAULT_RULES));
    expect(e.derived.movement.fly).toBe(40);
    e = playerEndTurn(e, DEFAULT_RULES);
    expect(e.derived.movement.fly).toBe(40);
    e = playerEndTurn(e, DEFAULT_RULES);
    expect(e.derived.movement.fly).toBeUndefined();
  });
  it('an until_rest duration ends at a long rest', () => {
    const e = use(startTurn(character(wings({ type: 'grant_speed', speedType: 'swim', amount: 30, duration: { unit: 'until_rest', remaining: 1 } })), DEFAULT_RULES));
    expect(e.derived.movement.swim).toBe(30);
    expect(takeRest(e, 'long', DEFAULT_RULES).derived.movement.swim).toBeUndefined();
  });
  it('a minutes duration stays until the player removes it', () => {
    const e = use(startTurn(character(wings({ type: 'grant_speed', speedType: 'climb', amount: 20, duration: { unit: 'minutes', remaining: 10 } })), DEFAULT_RULES));
    expect(e.derived.movement.climb).toBe(20);
    expect(e.conditionMonitor.active.map(c => c.id)).toEqual(['Climb speed 20 ft']);
    expect(removeCondition(e, 'Climb speed 20 ft', DEFAULT_RULES).derived.movement.climb).toBeUndefined();
  });
  it('a walk speed adds to the walking speed', () => {
    const before = startTurn(character(wings({ type: 'grant_speed', speedType: 'walk', amount: 10, duration: { unit: 'rounds', remaining: 1 } })), DEFAULT_RULES);
    expect(use(before).derived.speed).toBe(before.derived.speed + 10);
  });
  it('using it twice does not stack', () => {
    const f = wings({ type: 'grant_speed', speedType: 'fly', amount: 40, duration: { unit: 'rounds', remaining: 10 } });
    const once = use(startTurn(character(f), DEFAULT_RULES));
    expect(once.conditionMonitor.active).toHaveLength(1);
    expect(once.features.filter(x => x.source.kind === 'condition')).toHaveLength(1);
  });
});

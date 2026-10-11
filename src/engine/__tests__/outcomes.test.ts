// Outcome effects wait for the table to confirm what happened (the creator audit's hit-contingent refund finding).
import { makeEmptyEntity, DEFAULT_RULES } from '../../store/characterStore';
import { recomputeDerived } from '../pipeline';
import { generateActionCard } from '../actionCards';
import { applyActionCardUse } from '../actionUse';
import { outcomeOffersForCard, confirmOutcome, dismissOutcomes } from '../outcomes';
import { takeRest } from '../rest';
import type { Entity, Feature } from '../types';

const strike: Feature = {
  id: 'strike', name: 'Challenging Strike', description: 'x', source: { kind: 'manual', refId: 'strike' }, level: null,
  effects: [], actions: [], choices: [], passive: false,
  activation: { actionType: 'action', target: 'single', range: '5 feet', requiresSave: null, resourceCost: { resourceId: 'strike_pool', quantity: 1 } },
  outcomes: { hit: { effects: [{ type: 'restore_resource', resourceId: 'strike_pool', amount: 1 }] } },
};
const make = (): Entity => {
  const base = makeEmptyEntity('o');
  return recomputeDerived({
    ...base, identity: { ...base.identity, level: 5 },
    resources: { ...base.resources, custom: [{ id: 'strike_pool', name: 'Strike', current: 1, maximum: 1, recharge: 'short_rest' }] },
    features: [{ ...strike, isActive: false }],
  }, DEFAULT_RULES);
};
const pool = (e: Entity) => e.resources.custom[0].current;
const used = (e: Entity) => applyActionCardUse(e, generateActionCard(e.features[0], e)!, DEFAULT_RULES);

describe('outcome confirmation', () => {
  it('using the card applies nothing and offers the outcome', () => {
    const e = used(make());
    expect(pool(e)).toBe(0);
    const offers = outcomeOffersForCard(e, generateActionCard(e.features[0], e)!);
    expect(offers).toHaveLength(1);
    expect(offers[0]).toMatchObject({ key: 'hit', effects: 'Regain 1 strike pool' });
  });
  it('confirming the hit runs its effects once', () => {
    const e = confirmOutcome(used(make()), 'strike', 'hit', DEFAULT_RULES);
    expect(pool(e)).toBe(1);
    expect(e.pendingOutcomes).toEqual([]);
  });
  it('confirming again changes nothing (idempotent)', () => {
    const once = confirmOutcome(used(make()), 'strike', 'hit', DEFAULT_RULES);
    const twice = confirmOutcome(once, 'strike', 'hit', DEFAULT_RULES);
    expect(twice).toBe(once);
    expect(pool(twice)).toBe(1);
  });
  it('cannot be confirmed without a use, so it is never a free refund', () => {
    const e = make();
    expect(confirmOutcome(e, 'strike', 'hit', DEFAULT_RULES)).toBe(e);
  });
  it('dismissing settles the use with no effect', () => {
    const e = dismissOutcomes(used(make()), 'strike');
    expect(pool(e)).toBe(0);
    expect(confirmOutcome(e, 'strike', 'hit', DEFAULT_RULES)).toBe(e);
  });
  it('a rest clears what is still waiting', () => {
    const e = takeRest(used(make()), 'short', DEFAULT_RULES);
    expect(e.pendingOutcomes ?? []).toEqual([]);
  });
  it('a feature with no outcome effects records nothing', () => {
    const plain = { ...strike, id: 'plain', outcomes: undefined, activation: { ...strike.activation!, resourceCost: null } } as Feature;
    const base = make();
    const e = recomputeDerived({ ...base, features: [{ ...plain, isActive: false }] }, DEFAULT_RULES);
    expect(used(e).pendingOutcomes ?? []).toEqual([]);
  });
});

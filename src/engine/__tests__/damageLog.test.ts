// The damage log: what landed, stamped with the creature's own turn counter, and "damage taken since your last turn".
import { makeEmptyEntity, DEFAULT_RULES } from '../../store/characterStore';
import { recomputeDerived } from '../pipeline';
import { applyDamage, startTurn, applyWildShapeDamage } from '../combat';
import { damageTakenSince, logDamage } from '../damageLog';
import { takeRest } from '../rest';
import type { Entity } from '../types';

const base = (): Entity => {
  const e = makeEmptyEntity('t');
  return recomputeDerived({ ...e, resources: { ...e.resources, hp: { ...e.resources.hp, current: 40, maximum: 40, temp: 0 } } }, DEFAULT_RULES);
};

describe('damage log', () => {
  it('records the damage that landed, after resistance', () => {
    let e = base();
    e = applyDamage(e, 10, DEFAULT_RULES);
    expect(damageTakenSince(e, 0)).toBe(10);
    expect(e.damageLog).toEqual([{ turn: 0, amount: 10 }]);
  });
  it('records damage that temporary HP absorbed', () => {
    let e = base();
    e = { ...e, resources: { ...e.resources, hp: { ...e.resources.hp, temp: 6 } } };
    e = applyDamage(e, 10, DEFAULT_RULES);
    expect(damageTakenSince(e, 0)).toBe(10);
    expect(e.resources.hp.current).toBe(36);
  });
  it('records the type and what immunity prevents does not count', () => {
    const e = applyDamage(base(), 8, DEFAULT_RULES, 'fire');
    expect(e.damageLog![0]).toMatchObject({ amount: 8, type: 'fire' });
    expect(damageTakenSince(e, 0, 'cold')).toBe(0);
  });
  it('"since the start of your previous turn" is this turn and the one before', () => {
    let e = base();
    e = applyDamage(e, 5, DEFAULT_RULES);        // turn 0
    e = startTurn(e);                            // turn 1
    e = applyDamage(e, 7, DEFAULT_RULES);
    e = startTurn(e);                            // turn 2
    e = applyDamage(e, 3, DEFAULT_RULES);
    expect(e.turnCounter).toBe(2);
    expect(damageTakenSince(e, 0)).toBe(3);      // this turn only
    expect(damageTakenSince(e, 1)).toBe(10);     // this turn and the previous one
    expect(damageTakenSince(e, 2)).toBe(15);
  });
  it('is bounded', () => {
    let e = base();
    for (let i = 0; i < 100; i++) e = logDamage(e, 1);
    expect(e.damageLog!.length).toBeLessThanOrEqual(40);
  });
  it('a long rest clears it and the counter', () => {
    let e = applyDamage(startTurn(base()), 12, DEFAULT_RULES);
    e = takeRest(e, 'long', DEFAULT_RULES);
    expect(e.damageLog).toBeUndefined();
    expect(e.turnCounter).toBeUndefined();
  });
  it('Wild Shape: damage the form took is logged once, and the overflow that reverts it is logged once', () => {
    let e = base();
    e = { ...e, wildShapeState: { active: true, formId: 'wolf', beastHp: 5, beastHpMax: 11, expiresAt: { unit: 'hours', remaining: 1 } as never } } as Entity;
    const out = applyWildShapeDamage(e, 9, DEFAULT_RULES);
    expect(damageTakenSince(out, 0)).toBe(9);
  });
});

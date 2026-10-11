// Features that switch off for a time: by taking damage of a type, and ending on the turn counter.
import { makeEmptyEntity, DEFAULT_RULES } from '../../store/characterStore';
import { recomputeDerived } from '../pipeline';
import { applyDamage, startTurn } from '../combat';
import { suspendFeature, resumeFeature, isFeatureSuspended } from '../suspension';
import type { Entity, Feature } from '../types';

const bark: Feature & { isActive: boolean } = {
  id: 'bark', name: 'Bark', description: '', source: { kind: 'class', refId: 'x' }, level: null, actions: [], choices: [], passive: true, isActive: true,
  effects: [{ type: 'stat_modifier', target: 'ac', operation: 'add', value: 2, condition: null }],
  suspendOn: { damageType: 'fire', until: 'end_of_next_turn' },
} as never;
const base = (): Entity => {
  const e = makeEmptyEntity('t');
  return recomputeDerived({ ...e, features: [bark] as never, resources: { ...e.resources, hp: { ...e.resources.hp, current: 30, maximum: 30, temp: 0 } } }, DEFAULT_RULES);
};

describe('suspension', () => {
  it('a feature with an effect adds its bonus until it is suspended', () => {
    const e = base();
    expect(e.derived.ac).toBe(12);
    const off = recomputeDerived(suspendFeature(e, 'bark', 'end_of_this_turn'), DEFAULT_RULES);
    expect(off.derived.ac).toBe(10);
    expect(isFeatureSuspended(off, 'bark')).toBe(true);
    expect(recomputeDerived(resumeFeature(off, 'bark'), DEFAULT_RULES).derived.ac).toBe(12);
  });
  it('fire damage switches it off until the end of the creature\'s next turn', () => {
    let e = startTurn(base());                     // turn 1
    e = applyDamage(e, 5, DEFAULT_RULES, 'fire');
    expect(e.derived.ac).toBe(10);
    e = startTurn(e);                              // turn 2: "the end of your next turn" is still ahead
    expect(isFeatureSuspended(e, 'bark')).toBe(true);
    expect(recomputeDerived(e, DEFAULT_RULES).derived.ac).toBe(10);
    e = startTurn(e);                              // turn 3: it is back
    expect(isFeatureSuspended(e, 'bark')).toBe(false);
    expect(e.derived.ac).toBe(12);
    expect(e.suspensions).toBeUndefined();
  });
  it('other damage types, and damage that does nothing, leave it on', () => {
    expect(applyDamage(base(), 5, DEFAULT_RULES, 'cold').derived.ac).toBe(12);
    expect(applyDamage(base(), 0, DEFAULT_RULES, 'fire').derived.ac).toBe(12);
  });
  it('fire immunity means no damage landed, so nothing switches off', () => {
    const e = base();
    const immune = recomputeDerived({
      ...e, features: [...e.features, { ...bark, id: 'imm', suspendOn: undefined, effects: [{ type: 'grant_immunity', target: 'fire', operation: 'immunity', value: null, condition: null }] }] as never,
    }, DEFAULT_RULES);
    expect(applyDamage(immune, 5, DEFAULT_RULES, 'fire').derived.ac).toBe(12);
  });
});

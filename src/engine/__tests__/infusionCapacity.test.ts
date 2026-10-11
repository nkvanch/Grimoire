// Infusion capacity follows Artificer levels and accepts a feature's bonus (the creator audit's Infusion Adept finding).
import { makeEmptyEntity, DEFAULT_RULES } from '../../store/characterStore';
import { recomputeDerived } from '../pipeline';
import { infusionCapacity } from '../infusionCapacity';
import { asClassId } from '../types';
import type { Entity, Feature } from '../types';

const bonus = (n: number): Feature & { isActive: boolean } => ({
  id: 'adept', name: 'Adept', description: '', source: { kind: 'feat', refId: 'adept' }, level: null, passive: true, actions: [], choices: [],
  effects: [{ type: 'stat_modifier', target: 'infusion_capacity', operation: 'add', value: n, condition: null }], isActive: true,
} as never);
const character = (classes: { id: string; level: number }[], features: Feature[] = []): Entity => {
  const e = makeEmptyEntity('i');
  const total = classes.reduce((s, c) => s + c.level, 0);
  return recomputeDerived({
    ...e, identity: { ...e.identity, level: total, classId: classes[0].id, classes: classes.map(c => ({ classId: asClassId(c.id), subclassId: null, level: c.level })) },
    features: features as never,
  }, DEFAULT_RULES);
};

describe('infusion capacity', () => {
  it('follows the Artificer table by Artificer level', () => {
    expect(infusionCapacity(character([{ id: 'artificer', level: 1 }]))).toBe(0);
    expect(infusionCapacity(character([{ id: 'artificer', level: 2 }]))).toBe(2);
    expect(infusionCapacity(character([{ id: 'artificer', level: 6 }]))).toBe(3);
    expect(infusionCapacity(character([{ id: 'artificer', level: 18 }]))).toBe(6);
  });
  it('uses Artificer levels, not character level, in a multiclass', () => {
    expect(infusionCapacity(character([{ id: 'fighter', level: 8 }, { id: 'artificer', level: 2 }]))).toBe(2);
  });
  it('a character with no Artificer levels has none', () => {
    expect(infusionCapacity(character([{ id: 'fighter', level: 10 }]))).toBe(0);
  });
  it('a bonus adds to an existing capacity', () => {
    expect(infusionCapacity(character([{ id: 'artificer', level: 6 }], [bonus(2)]))).toBe(5);
  });
  it('a bonus creates a capacity where there was none', () => {
    expect(infusionCapacity(character([{ id: 'fighter', level: 4 }], [bonus(2)]))).toBe(2);
  });
});

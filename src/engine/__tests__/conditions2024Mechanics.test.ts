// 2024 conditions: Incapacitated and the conditions that include it end Concentration and give Disadvantage on Initiative.
import { makeEmptyEntity, DEFAULT_RULES } from '../../store/characterStore';
import { recomputeDerived } from '../pipeline';
import { applyCondition } from '../conditions';
import { CONDITIONS_2024 } from '../../content/conditions/conditions2024';
import { ALL_CONDITIONS } from '../../content/conditions';
import type { Entity } from '../types';

const concentrating = (ruleset: 'dnd5e-2024' | 'dnd5e-2014'): Entity => {
  const e = makeEmptyEntity('c');
  return recomputeDerived({
    ...e, rulesetId: ruleset as never,
    spellcasting: { ability: 'wis', slots: {}, cantrips: [], known: [], prepared: [], concentrating: 'bless' } as never,
  }, DEFAULT_RULES);
};
const apply = (e: Entity, id: string, pool: typeof CONDITIONS_2024) =>
  applyCondition(e, id, 'test', DEFAULT_RULES, pool.find(c => c.id === id)?.features);

describe('2024 conditions', () => {
  it.each(['incapacitated', 'paralyzed', 'petrified', 'stunned', 'unconscious'])('%s ends Concentration on a 2024 character', id => {
    const e = apply(concentrating('dnd5e-2024'), id, CONDITIONS_2024);
    expect(e.spellcasting!.concentrating).toBeNull();
  });
  it('and gives Disadvantage on Initiative', () => {
    const e = apply(concentrating('dnd5e-2024'), 'stunned', CONDITIONS_2024);
    expect(e.derived.advantageStates.some(a => a.target === 'initiative' && a.state === 'disadvantage')).toBe(true);
  });
  it('a 2014 character keeps Concentration and has no initiative penalty', () => {
    const e = apply(concentrating('dnd5e-2014'), 'incapacitated', ALL_CONDITIONS as never);
    expect(e.spellcasting!.concentrating).toBe('bless');
    expect(e.derived.advantageStates.some(a => a.target === 'initiative')).toBe(false);
  });
  it('conditions that do not incapacitate leave Concentration alone', () => {
    const e = apply(concentrating('dnd5e-2024'), 'poisoned', CONDITIONS_2024);
    expect(e.spellcasting!.concentrating).toBe('bless');
  });
});

// The creation hub's "Class features" step: a class or subclass feature that asks for a pick (Fighting Style, Hunter's Prey,
// Defensive Tactics, Metamagic...) is a feature_pool choice, and the hub had no step for that kind, so a character made above
// 1st level could not make those picks while being created (found 2026-11-11 with a level-7 Hunter ranger).
import { featureChoiceProgress, pickableFeatureChoices } from '../../content/creationProgress';
import { makeEmptyEntity } from '../../engine/defaults';
import { queueChoice } from '../../engine/levelingGrants';
import type { ChoiceDefinition } from '../../engine/types';

const pool = (id: string): ChoiceDefinition => ({
  id, prompt: 'Choose one.', kind: 'feature_pool', count: 1,
  pool: [{ id: 'a', label: 'A', value: { id: `${id}_a`, name: 'A', description: '', source: { kind: 'class', refId: 'x' }, level: null, effects: [], actions: [], choices: [], passive: true } }],
  grants: [], required: true, resolved: false,
});

describe('featureChoiceProgress', () => {
  it('is null when nothing asks for a feature pick', () => {
    expect(featureChoiceProgress(makeEmptyEntity('e1'))).toBeNull();
  });

  it('counts the feature picks waiting and taken', () => {
    let e = queueChoice(makeEmptyEntity('e1'), pool('hunters_prey'), 3);
    e = queueChoice(e, pool('defensive_tactics'), 7);
    expect(featureChoiceProgress(e)).toEqual({ done: 0, total: 2 });
    e = { ...e, choices: e.choices.map(c => c.id === 'hunters_prey_3' ? { ...c, resolved: true, selections: ['a'] } : c) };
    expect(featureChoiceProgress(e)).toEqual({ done: 1, total: 2 });
  });

  it('counts picks, not choices (two Metamagic options are two picks)', () => {
    const e = queueChoice(makeEmptyEntity('e1'), { ...pool('metamagic'), count: 2, pool: [...(pool('m').pool as never[]), ...(pool('n').pool as never[])] }, 3);
    expect(featureChoiceProgress(e)).toEqual({ done: 0, total: 2 });
  });

  it('a pick with too few options left that the character lacks does not hold up creation, and is not offered', () => {
    let e = queueChoice(makeEmptyEntity('e1'), pool('style_a'), 1);
    e = { ...e, features: [...e.features, ((pool('style_a').pool as unknown as { value: object }[])[0].value) as never] };   // already has the only option
    expect(featureChoiceProgress(e)).toEqual({ done: 1, total: 1 });
    expect(pickableFeatureChoices(e)).toEqual([]);
  });

  it('leaves out other kinds of choice', () => {
    const e = queueChoice(makeEmptyEntity('e1'), { ...pool('skills'), kind: 'skill' }, 1);
    expect(featureChoiceProgress(e)).toBeNull();
  });
});

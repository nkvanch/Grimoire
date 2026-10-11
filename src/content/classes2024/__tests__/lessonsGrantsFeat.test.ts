// Lessons of the First Ones records an Origin feat AND brings that feat's own feature with it, and swapping the option takes it back out.
jest.mock('../../spellRepo', () => jest.requireActual('../../spellRepo.ts'));

import { newChar, toLevel } from '../testKit';
import { applyPoolChoiceToEntity, replacePoolOption } from '../../../engine/leveling';
import { DEFAULT_RULES } from '../../../store/characterStore';

const setup = () => {
  let e: any = toLevel(newChar('warlock'), 'warlock', 2);
  const ch = e.choices.filter((c: any) => c.definition.id.includes('invocations_') && !c.resolved);
  return { e, id: ch[ch.length - 1].id as string };
};

describe('Lessons of the First Ones', () => {
  it('grants the chosen Origin feat\'s own feature, not just a label', () => {
    const { e, id } = setup();
    const out = applyPoolChoiceToEntity(e, id, ['invocation_lessons_of_the_first_ones::alert_2024'], DEFAULT_RULES);
    const lessons = out.features.find((f: any) => f.id.endsWith('::alert_2024'));
    expect(lessons).toBeTruthy();
    const brought = out.features.find((f: any) => f.id.endsWith('::alert_2024::feat'));
    expect(brought).toBeTruthy();
    expect(brought!.name).toMatch(/Alert/);
    // Alert adds the proficiency bonus to initiative.
    const base = e.derived.initiative;
    expect(out.derived.initiative).toBe(base + out.derived.proficiencyBonus);
  });

  it('taking it for a feat with picks queues those picks', () => {
    const { e, id } = setup();
    const out = applyPoolChoiceToEntity(e, id, ['invocation_lessons_of_the_first_ones::skilled_2024'], DEFAULT_RULES);
    expect(out.choices.some((c: any) => !c.resolved && c.id.includes('::skilled_2024::feat'))).toBe(true);
  });

  it('swapping the option takes the feat\'s feature back out', () => {
    const { e, id } = setup();
    const done = applyPoolChoiceToEntity(e, id, ['invocation_lessons_of_the_first_ones::alert_2024'], DEFAULT_RULES);
    const swapped = replacePoolOption(done, id, 'invocation_lessons_of_the_first_ones::alert_2024', 'invocation_armor_of_shadows', DEFAULT_RULES);
    expect(swapped.features.some((f: any) => f.id.includes('::feat'))).toBe(false);
    expect(swapped.derived.initiative).toBe(e.derived.initiative);
  });
});

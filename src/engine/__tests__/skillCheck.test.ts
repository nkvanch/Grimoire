// Skill checks: the engine states the bonus, the advantage state and the dice (the Lupine Mask finding of the creator audit).
import { makeEmptyEntity, DEFAULT_RULES } from '../../store/characterStore';
import { recomputeDerived } from '../pipeline';
import { skillCheck } from '../skillCheck';
import { rollExpression } from '../dice';
import type { Entity, Feature, Effect } from '../types';

const feat = (id: string, effects: Effect[]): Feature & { isActive: boolean } => ({
  id, name: id, description: '', source: { kind: 'item', refId: id }, level: null, effects, actions: [], choices: [], passive: true, isActive: true,
} as never);
const adv = (target: string, operation: 'advantage' | 'disadvantage' = 'advantage', situational?: { id: string; question: string }): Effect =>
  ({ type: 'stat_modifier', target, operation, value: null, condition: null, ...(situational ? { situational } : {}) });
const withFeatures = (fs: Feature[], answers: Record<string, boolean> = {}): Entity => {
  const e = makeEmptyEntity('t');
  return recomputeDerived({ ...e, features: fs as never, situationalAnswers: answers }, DEFAULT_RULES);
};

describe('skill check', () => {
  it('is a plain d20 with no advantage source', () => {
    const c = skillCheck(withFeatures([]), 'perception', 'wis');
    expect(c.state).toBe('straight');
    expect(c.expression).toBe('1d20+0');
  });
  it('a skill-targeted advantage rolls 2d20 keep highest', () => {
    const c = skillCheck(withFeatures([feat('mask', [adv('skill:perception')])]), 'perception', 'wis');
    expect(c.state).toBe('advantage');
    expect(c.expression).toBe('2d20kh1+0');
    const total = rollExpression(c.expression).total;
    expect(total).toBeGreaterThanOrEqual(1);
    expect(total).toBeLessThanOrEqual(20);
  });
  it('applies to that skill only', () => {
    const e = withFeatures([feat('mask', [adv('skill:perception')])]);
    expect(skillCheck(e, 'stealth', 'dex').state).toBe('straight');
    expect(skillCheck(e, 'insight', 'wis').state).toBe('straight');
  });
  it('an ability-check target applies to every skill that uses the ability', () => {
    const e = withFeatures([feat('belt', [adv('ability_check:str')])]);
    expect(skillCheck(e, 'athletics', 'str').state).toBe('advantage');
    expect(skillCheck(e, 'acrobatics', 'dex').state).toBe('straight');
  });
  it('disadvantage rolls keep lowest, and advantage plus disadvantage cancel', () => {
    expect(skillCheck(withFeatures([feat('a', [adv('skill:stealth', 'disadvantage')])]), 'stealth', 'dex').expression).toBe('2d20kl1+0');
    const both = withFeatures([feat('a', [adv('skill:stealth', 'disadvantage')]), feat('b', [adv('ability_check:dex')])]);
    expect(skillCheck(both, 'stealth', 'dex').state).toBe('straight');
  });
  it('a situational advantage counts only once the player has answered Yes', () => {
    const f = feat('mask', [adv('skill:perception', 'advantage', { id: 'wearing_mask_at_night', question: 'Is it dark?' })]);
    expect(skillCheck(withFeatures([f]), 'perception', 'wis').state).toBe('straight');
    expect(skillCheck(withFeatures([f], { wearing_mask_at_night: false }), 'perception', 'wis').state).toBe('straight');
    expect(skillCheck(withFeatures([f], { wearing_mask_at_night: true }), 'perception', 'wis').state).toBe('advantage');
  });
  it('free-text advantage stays a reminder and does not change the roll', () => {
    const e = withFeatures([feat('x', [adv('Wisdom (Perception) checks that rely on smell')])]);
    expect(skillCheck(e, 'perception', 'wis').state).toBe('straight');
    expect(e.derived.advantageStates).toHaveLength(1);
  });
  it('keeps the proficiency and bonus arithmetic the screen used', () => {
    const base = withFeatures([]);
    const e = {
      ...base, stats: { ...base.stats, wis: 14 },
      skills: { ...base.skills, skills: { ...base.skills.skills, perception: { trained: true, expertise: false, bonus: 1 } } },
    } as Entity;
    expect(skillCheck(e, 'perception', 'wis').bonus).toBe(2 + e.derived.proficiencyBonus + 1);
    const expert = { ...e, skills: { ...e.skills, skills: { ...e.skills.skills, perception: { trained: true, expertise: true, bonus: 0 } } } } as Entity;
    expect(skillCheck(expert, 'perception', 'wis').bonus).toBe(2 + 2 * e.derived.proficiencyBonus);
  });
});

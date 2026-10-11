// The DM's hidden check against passive scores.
import { makeEmptyEntity, DEFAULT_RULES } from '../../store/characterStore';
import { recomputeDerived } from '../pipeline';
import { hiddenCheck, hiddenCheckSummary, passiveOf } from '../hiddenCheck';
import type { Entity } from '../types';

const pc = (name: string, wis: number, int = 10): Entity => {
  const e = makeEmptyEntity(name);
  return recomputeDerived({ ...e, identity: { ...e.identity, name }, stats: { ...e.stats, wis, int } }, DEFAULT_RULES);
};

describe('hidden check', () => {
  const party = [pc('Aria', 16), pc('Bram', 10), pc('Cato', 8, 18)];
  it('reads each kind of passive score', () => {
    expect(passiveOf(party[0], 'perception')).toBe(13);        // 10 + 3
    expect(passiveOf(party[2], 'investigation')).toBe(14);     // 10 + 4
    expect(passiveOf(party[0], 'insight')).toBe(13);
  });
  it('says who reaches a Stealth total, highest passive first', () => {
    const rows = hiddenCheck(party, 'perception', 12);
    expect(rows.map(r => r.name)).toEqual(['Aria', 'Bram', 'Cato']);
    expect(rows.map(r => r.meets)).toEqual([true, false, false]);
    expect(rows[0].margin).toBe(1);
    expect(hiddenCheckSummary(rows, 'perception', 12)).toBe('Passive Perception 12 or more: Aria.');
  });
  it('says nobody, or everybody, plainly', () => {
    expect(hiddenCheckSummary(hiddenCheck(party, 'perception', 20), 'perception', 20)).toBe("Nobody's passive Perception reaches 20.");
    expect(hiddenCheckSummary(hiddenCheck(party, 'perception', 5), 'perception', 5)).toBe("Everyone's passive Perception reaches 5.");
  });
  it('leaves out the dead and anything that is not a character', () => {
    const dead = pc('Dax', 20);
    const gone: Entity = { ...dead, resources: { ...dead.resources, deathSaves: { successes: 0, failures: 3, stable: false } } };
    const monster: Entity = { ...pc('Orc', 20), kind: 'monster' as never };
    expect(hiddenCheck([...party, gone, monster], 'perception', 10).map(r => r.name)).not.toContain('Dax');
    expect(hiddenCheck([...party, gone, monster], 'perception', 10).map(r => r.name)).not.toContain('Orc');
  });
});

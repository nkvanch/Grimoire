// The DM's awareness helpers over reported vitals: a damage preview and a hidden check against passives.
import { vitalsPreview, hiddenCheckFromVitals, hiddenCheckLine } from '../liveAwareness';
import type { CharacterVitals, ReportedCharacter } from '../types';

const vitals = (over: Partial<CharacterVitals> = {}): CharacterVitals => ({
  tempHp: 0, speed: 30, exhaustion: 0, conditions: [], concentration: null,
  deathSaves: { successes: 0, failures: 0, stable: false }, resources: [], spellSlots: null, ...over,
});
const rc = (id: string, name: string, hp: number, v?: CharacterVitals): ReportedCharacter =>
  ({ participantId: id, characterId: `c_${id}`, revision: 1, summary: { name, hp, maxHp: 30, ac: 15 }, ...(v ? { vitals: v } : {}) });

describe('damage preview from reported vitals', () => {
  it('applies reported defenses and temp HP', () => {
    const v = vitals({ tempHp: 5, defenses: { resistances: ['fire'], immunities: ['poison'], vulnerabilities: ['cold'], conditionImmunities: [], critsNegated: false } });
    const s = { name: 'A', hp: 20, maxHp: 30, ac: 15 };
    expect(vitalsPreview(s, v, 10, 'fire').dealt).toBe(5);
    expect(vitalsPreview(s, v, 10, 'poison').dealt).toBe(0);
    expect(vitalsPreview(s, v, 10, 'cold').dealt).toBe(20);
    const p = vitalsPreview(s, v, 10);
    expect(p).toMatchObject({ hpAfter: 15, tempAfter: 0 });
    expect(p.line).toContain('15/30 HP');
  });
  it('says when it would drop or kill, and works without any vitals', () => {
    expect(vitalsPreview({ name: 'A', hp: 6, maxHp: 30, ac: 10 }, undefined, 6).state).toBe('down');
    expect(vitalsPreview({ name: 'A', hp: 6, maxHp: 30, ac: 10 }, undefined, 40).state).toBe('dead');
    const dying = vitals({ deathSaves: { successes: 0, failures: 2, stable: false } });
    expect(vitalsPreview({ name: 'A', hp: 0, maxHp: 30, ac: 10 }, dying, 3).state).toBe('dead');
  });
});

describe('hidden check from reported passives', () => {
  const party = [
    rc('a', 'Aria', 20, vitals({ passives: { perception: 15, investigation: 10, insight: 12 } })),
    rc('b', 'Bram', 20, vitals({ passives: { perception: 10, investigation: 13, insight: 9 } })),
    rc('c', 'Cato', 20),
  ];
  it('lists who reaches the value and who does not report', () => {
    const rows = hiddenCheckFromVitals(party, 'perception', 12);
    expect(rows.map(r => [r.name, r.meets])).toEqual([['Aria', true], ['Bram', false], ['Cato', null]]);
    expect(hiddenCheckLine(rows, 'perception', 12)).toBe('Passive Perception 12 or more: Aria. (1 not reporting passives)');
  });
  it('reads each kind of passive', () => {
    expect(hiddenCheckFromVitals(party, 'investigation', 12).find(r => r.name === 'Bram')!.meets).toBe(true);
    expect(hiddenCheckLine(hiddenCheckFromVitals(party, 'insight', 20), 'insight', 20)).toBe("Nobody's passive Insight reaches 20. (1 not reporting passives)");
  });
  it('is honest when nothing is reported', () => {
    expect(hiddenCheckLine(hiddenCheckFromVitals([rc('z', 'Zed', 10)], 'perception', 10), 'perception', 10)).toBe('No passive scores reported yet.');
    expect(hiddenCheckLine([], 'perception', 10)).toBe('No characters reported yet.');
  });
});

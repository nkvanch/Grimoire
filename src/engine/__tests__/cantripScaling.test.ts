// A cantrip's card follows the character level: Fire Bolt 1d10, 2d10 at 5th, 3d10 at 11th, 4d10 at 17th.
import { makeEmptyEntity } from '../../store/characterStore';
import { buildLayer2ForSpell } from '../actionCards';
import { cantripTierAt, deriveCantripScaling } from '../cantripScaling';
import type { Entity, Spell } from '../types';
import srd51 from '../../../assets/packs/grimoire.srd.5.1.json';
import srd521 from '../../../assets/packs/grimoire.srd.5.2.1.json';

const cantrip = (description: string, extra: Partial<Spell> = {}): Spell => ({
  id: 'probe', name: 'Probe', level: 0, school: 'Evocation', castingTime: '1 action', range: '120 feet', components: ['V', 'S'],
  duration: 'Instantaneous', concentration: false, ritual: false, upcast: null, description, ...extra,
});
const at = (level: number): Entity => { const e = makeEmptyEntity('t'); return { ...e, identity: { ...e.identity, level } }; };
const spells = (pack: unknown): Spell[] => (pack as { homebrew: { spells: Spell[] } }).homebrew.spells;

describe('cantrip scaling', () => {
  it('derives the SRD 5.1 sentence into tiers', () => {
    const t = deriveCantripScaling(cantrip('On a hit, the target takes 1d10 fire damage. The damage increases by 1d10 at 5th level (2d10), 11th level (3d10), and 17th level (4d10).'));
    expect(t).toEqual([{ level: 5, dice: '2d10' }, { level: 11, dice: '3d10' }, { level: 17, dice: '4d10' }]);
  });
  it('derives the SRD 5.2.1 wording', () => {
    const t = deriveCantripScaling(cantrip('The target takes 1d10 Fire damage. Cantrip Upgrade. The damage increases by 1d10 when you reach levels 5 (2d10), 11 (3d10), and 17 (4d10).'));
    expect(t.map(x => `${x.level}:${x.dice}`)).toEqual(['5:2d10', '11:3d10', '17:4d10']);
  });
  it('derives the beam ladder', () => {
    const t = deriveCantripScaling(cantrip('Make a ranged spell attack. On a hit, the target takes 1d10 force damage. The spell creates more than one beam at higher levels: two beams at 5th level, three beams at 11th level, and four beams at 17th level.'));
    expect(t).toEqual([{ level: 5, count: 2 }, { level: 11, count: 3 }, { level: 17, count: 4 }]);
  });
  it('is nothing for a leveled spell or a cantrip with no ladder', () => {
    expect(deriveCantripScaling({ level: 1, description: 'The damage increases by 1d6 at 5th level (2d6).' })).toEqual([]);
    expect(deriveCantripScaling(cantrip('You touch a creature. It takes 1d6 damage.'))).toEqual([]);
  });
  it('the card shows the tier for the character level, including the audit probe', () => {
    const forceDart = cantrip('Make a ranged spell attack. A hit deals 1d10 force damage.', {
      cantripScaling: [{ level: 5, dice: '2d10' }, { level: 11, dice: '3d10' }, { level: 17, dice: '4d10' }],
    });
    expect(buildLayer2ForSpell(forceDart, at(1))).toContain('1d10 Force');
    expect(buildLayer2ForSpell(forceDart, at(4))).toContain('1d10 Force');
    expect(buildLayer2ForSpell(forceDart, at(5))).toContain('2d10 Force');
    expect(buildLayer2ForSpell(forceDart, at(10))).toContain('2d10 Force');
    expect(buildLayer2ForSpell(forceDart, at(11))).toContain('3d10 Force');
    expect(buildLayer2ForSpell(forceDart, at(17))).toContain('4d10 Force');
    expect(buildLayer2ForSpell(forceDart, at(17))).not.toContain('1d10');
  });
  it('an explicit ladder wins over the printed sentence', () => {
    const s = cantrip('Hit for 1d8 fire damage. The damage increases by 1d8 at 5th level (2d8).', { cantripScaling: [{ level: 3, dice: '3d8' }] });
    expect(cantripTierAt(s, 3)).toEqual({ level: 3, dice: '3d8' });
  });
  it('a leveled spell never scales with character level', () => {
    const s = { ...cantrip('Deals 3d6 fire damage. The damage increases by 1d6 at 5th level (2d6).'), level: 3 };
    expect(buildLayer2ForSpell(s, at(17))).toContain('3d6 Fire');
  });
  it('every damage cantrip in both SRD packs shows a higher tier at 17 than at 1', () => {
    const damage = [...spells(srd51), ...spells(srd521)].filter(s => s.level === 0 && /\d+d\d+\s+\w+\s+damage/i.test(s.description) && deriveCantripScaling(s).length > 0);
    expect(damage.length).toBeGreaterThanOrEqual(10);
    for (const s of damage) expect(buildLayer2ForSpell(s, at(17))).not.toBe(buildLayer2ForSpell(s, at(1)));
  });
  it('Fire Bolt and Eldritch Blast from the SRD 5.1 pack', () => {
    const fb = spells(srd51).find(s => s.id === 'firebolt')!;
    expect(buildLayer2ForSpell(fb, at(17))).toContain('4d10 Fire');
    const eb = spells(srd51).find(s => s.id === 'eldritch_blast')!;
    expect(buildLayer2ForSpell(eb, at(5))).toContain('×2');
    expect(buildLayer2ForSpell(eb, at(1))).not.toContain('×');
  });
});

describe("the spell builder's upgrade rows", () => {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { tiersFromDraft, draftFromTiers } = require('../cantripScaling');
  const row = (level: string, dice = '', count = '') => ({ level, dice, count });
  it('turn rows at any level into tiers, sorted', () => {
    expect(tiersFromDraft([row('11', '3d10'), row('5', '2d10'), row('17', '4d10')]))
      .toEqual([{ level: 5, dice: '2d10' }, { level: 11, dice: '3d10' }, { level: 17, dice: '4d10' }]);
  });
  it('accept custom levels, a modifier on the dice and a beam count', () => {
    expect(tiersFromDraft([row('3', '1d12+2'), row('9', '', '3'), row('14', '2d12+4', '4')]))
      .toEqual([{ level: 3, dice: '1d12+2' }, { level: 9, count: 3 }, { level: 14, dice: '2d12+4', count: 4 }]);
  });
  it('skip rows with no level, a level outside 1 to 20, or nothing usable, and let a later row replace the same level', () => {
    expect(tiersFromDraft([row('', '2d10'), row('0', '2d10'), row('21', '2d10'), row('5', 'lots'), row('5', ' 2D10 '), row('5', '3D10')]))
      .toEqual([{ level: 5, dice: '3d10' }]);
    expect(tiersFromDraft([])).toEqual([]);
  });
  it('round-trips through the builder rows', () => {
    const tiers = [{ level: 3, dice: '1d12+2' }, { level: 9, count: 3 }];
    expect(tiersFromDraft(draftFromTiers(tiers))).toEqual(tiers);
  });
  it('the card shows a custom level, a flat amount added to a damage bonus, and beams', () => {
    const s = { ...cantrip('A hit deals 1d10 force damage.'), cantripScaling: tiersFromDraft([row('3', '1d12+2'), row('9', '', '3')]) };
    expect(buildLayer2ForSpell(s, at(2))).toContain('1d10 Force');
    expect(buildLayer2ForSpell(s, at(3))).toContain('1d12+2 Force');
    expect(buildLayer2ForSpell(s, at(9))).toContain('1d12+2 Force ×3');
  });
});

describe('a printed ladder at custom levels and amounts', () => {
  it('is read at any levels, with a modifier', () => {
    const t = deriveCantripScaling(cantrip('A hit deals 1d8 acid damage. The damage increases at 3rd level (1d12+2), 9th level (2d12+4) and 15th level (3d12+6).'));
    expect(t).toEqual([{ level: 3, dice: '1d12+2' }, { level: 9, dice: '2d12+4' }, { level: 15, dice: '3d12+6' }]);
  });
  it('drives the card at those levels', () => {
    const s = cantrip('A hit deals 1d8 acid damage. The damage increases at 3rd level (1d12+2), 9th level (2d12+4) and 15th level (3d12+6).');
    expect(buildLayer2ForSpell(s, at(2))).toContain('1d8 Acid');
    expect(buildLayer2ForSpell(s, at(9))).toContain('2d12+4 Acid');
    expect(buildLayer2ForSpell(s, at(20))).toContain('3d12+6 Acid');
  });
});

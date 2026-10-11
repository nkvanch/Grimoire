// The four SRD 5.2.1 spells that name a stat block carry it in their text.
import { SPELL_VERSIONS_2024 } from '../spellVersions2024';
import { NEW_SPELLS_2024 } from '../../classes2024/spells2024';
import { SPELL_STAT_BLOCKS_2024, withStatBlock } from '../spellStatBlocks2024';

const text = (id: string): string =>
  SPELL_VERSIONS_2024[id]?.description ?? NEW_SPELLS_2024.find(s => s.id === id)?.description ?? '';

describe('SRD 5.2.1 spell stat blocks', () => {
  it.each([
    ['animate_objects', 'Animated Object', 'Slam.'],
    ['find_steed', 'Otherworldly Steed', 'Life Bond.'],
    ['giant_insect', 'Giant Insect (Large Beast', 'Venomous Spew'],
    ['summon_dragon', 'Draconic Spirit (Large Dragon', 'Breath Weapon.'],
  ])('%s shows its stat block', (id, header, line) => {
    const d = text(id);
    expect(d).toContain(header);
    expect(d).toContain(line);
    expect(d).toMatch(/AC \d+/);
    expect(d).not.toMatch(/full stat block is in the SRD/);
  });
  it('is added once, not on every read', () => {
    const once = withStatBlock('giant_insect', text('giant_insect'));
    expect(once).toBe(text('giant_insect'));
  });
  it('leaves other spells alone', () => {
    expect(withStatBlock('fireball', 'Boom.')).toBe('Boom.');
    expect(Object.keys(SPELL_STAT_BLOCKS_2024).sort()).toEqual(['animate_objects', 'find_steed', 'giant_insect', 'summon_dragon']);
  });
});

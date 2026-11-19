// SRD 5.1 class lists for spells the data had wrong (found 2026-11-14): six 7th-level spells listed no class at all, so a pick from a class's
// list could not offer them (a warlock's 7th-level Mystic Arcanum missed Plane Shift), and Gate listed the warlock, which it is only in 2024.
import { FULL_SPELL_LIBRARY } from '../index';

// the 2014 classes only: the library also tags each spell for the 2024 classes and homebrew ones (the Emperor Warlock)
const SRD51 = ['barbarian', 'bard', 'cleric', 'druid', 'fighter', 'monk', 'paladin', 'ranger', 'rogue', 'sorcerer', 'warlock', 'wizard'];
const classesOf = (id: string): string[] => (FULL_SPELL_LIBRARY.find(s => s.id === id)?.classes ?? []).filter(c => SRD51.includes(c)).sort();

describe('SRD 5.1 spells name the classes whose list they are on', () => {
  it.each([
    ['plane_shift', ['cleric', 'druid', 'sorcerer', 'warlock', 'wizard']],
    ['teleport', ['bard', 'sorcerer', 'wizard']],
    ['forcecage', ['bard', 'warlock', 'wizard']],
    ['divine_word', ['cleric']],
    ['regenerate', ['bard', 'cleric', 'druid']],
    ['resurrection', ['bard', 'cleric']],
    ['gate', ['cleric', 'sorcerer', 'wizard']],
  ])('%s', (id, classes) => {
    expect(classesOf(id)).toEqual(classes);
  });
});

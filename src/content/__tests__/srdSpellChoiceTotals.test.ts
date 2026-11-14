// The SRD 5.1 class tables give every caster a number of cantrips and (for the classes that learn spells) spells known at each level.
// These totals are written out here, apart from the class content they check, so a missing `spellChoice` in
// src/content/classes/index.ts shows up as a number that is too low. Found missing on 2026-11-02 by the desktop application's
// comparison (cleric/druid cantrips, wizard cantrips at 4 and 10, warlock spells at 11/13/15/17).
import { ALL_PROGRESSIONS } from '../classes';

const COUNT_AT = (classId: string, level: number, cantrips: boolean): number => {
  let total = 0;
  for (const entry of ALL_PROGRESSIONS[classId].entries) {
    if (entry.level > level) continue;
    for (const choice of entry.choices) {
      if (choice.kind !== 'spell') continue;
      if (choice.id.includes('cantrip') === cantrips) total += choice.count;
    }
  }
  return total;
};

// SRD 5.1 "Cantrips Known" columns, levels 1..20.
const stepped = (first: number, at4: number, at10: number) =>
  Array.from({ length: 20 }, (_, i) => (i + 1 >= 10 ? at10 : i + 1 >= 4 ? at4 : first));

const CANTRIPS: Record<string, number[]> = {
  cleric: stepped(3, 4, 5),
  druid: stepped(2, 3, 4),
  wizard: stepped(3, 4, 5),
  bard: stepped(2, 3, 4),
  sorcerer: stepped(4, 5, 6),
  warlock: stepped(2, 3, 4),
};

// SRD 5.1 "Spells Known" columns for the classes that learn spells, levels 1..20.
const KNOWN: Record<string, number[]> = {
  warlock: [2, 3, 4, 5, 6, 7, 8, 9, 10, 10, 11, 11, 12, 12, 13, 13, 14, 14, 15, 15],
  bard: [4, 5, 6, 7, 8, 9, 10, 11, 12, 14, 15, 15, 16, 18, 19, 19, 20, 22, 22, 22],
  sorcerer: [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 12, 13, 13, 14, 14, 15, 15, 15, 15],
  ranger: [0, 2, 3, 3, 4, 4, 5, 5, 6, 6, 7, 7, 8, 8, 9, 9, 10, 10, 11, 11],
};

describe('SRD 5.1 class content carries every cantrip and spell the class tables give', () => {
  for (const [classId, table] of Object.entries(CANTRIPS)) {
    it(`${classId}: cantrips known at every level`, () => {
      const got = Array.from({ length: 20 }, (_, i) => COUNT_AT(classId, i + 1, true));
      expect(got).toEqual(table);
    });
  }
  for (const [classId, table] of Object.entries(KNOWN)) {
    it(`${classId}: spells known at every level`, () => {
      const got = Array.from({ length: 20 }, (_, i) => COUNT_AT(classId, i + 1, false));
      expect(got).toEqual(table);
    });
  }
});

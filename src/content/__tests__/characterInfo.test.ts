// The Character info page lists what the character was built from, with names, never raw ids.
import { buildSrd51Pack, buildSrd521Pack } from '../packs/srdPacks';
import { packContentProvider, InstalledPack } from '../provider/contentProvider';
import { createCharacter } from '../provider/createCharacter';
import { DEFAULT_RULES } from '../../engine/defaults';
import { characterInfoRows } from '../characterInfo';
import type { Entity, RulesetId } from '../../engine/types';

const packs = [buildSrd51Pack(), buildSrd521Pack()].map(p => JSON.parse(JSON.stringify(p)) as InstalledPack);
const STATS = { str: 15, dex: 12, con: 14, int: 8, wis: 10, cha: 10 };
const dbOf = (ruleset: string) => {
  const p = packContentProvider(packs, ruleset as RulesetId);
  return { provider: p, db: { races: p.races(), classes: p.classes(), backgrounds: p.backgrounds(), feats: p.feats() } };
};
const byKey = (rows: ReturnType<typeof characterInfoRows>) => Object.fromEntries(rows.map(r => [r.key, r]));

it('a 2014 hill dwarf fighter: rules, level, class, subclass, species, subrace, background', () => {
  const { provider, db } = dbOf('dnd5e-2014');
  const made = createCharacter(provider, { id: 'b', name: 'Brakka', classId: 'fighter', raceId: 'dwarf', backgroundId: 'acolyte', stats: STATS, level: 3 }, DEFAULT_RULES);
  const e = {
    ...made,
    identity: { ...made.identity, subRaceId: 'hill_dwarf', subclassId: 'champion', alignment: 'Lawful good', xp: 900,
      classes: [{ classId: 'fighter', subclassId: 'champion', level: 3 }] },
  } as Entity;
  const rows = byKey(characterInfoRows(e, db));
  expect(rows.rules.value).toMatch(/2014/);
  expect(rows.level.value).toBe('3');
  expect(rows['class:0']).toMatchObject({ label: 'Class', value: 'Fighter' });
  expect(rows['subclass:0'].value).toBe('Champion');
  expect(rows.race.value).toBe('Dwarf');
  expect(rows.subrace.value).toBe('Hill Dwarf');
  expect(rows.background.value).toBe('Acolyte');
  expect(rows.alignment.value).toBe('Lawful good');
  expect(rows.xp.value).toBe('900');
  expect(Object.values(rows).every(r => !/_/.test(r.value))).toBe(true);   // names, not ids
});

it('a 2024 character shows its background\'s origin feat once, and a multiclass shows each class with its level', () => {
  const { provider, db } = dbOf('dnd5e-2024');
  const made = createCharacter(provider, { id: 'i', name: 'Ilse', classId: 'fighter_2024', raceId: 'human_2024', backgroundId: 'soldier_2024', stats: STATS, level: 3 }, DEFAULT_RULES);
  const e = { ...made, identity: { ...made.identity, level: 5, classes: [{ classId: 'fighter_2024', subclassId: null, level: 3 }, { classId: 'wizard_2024', subclassId: null, level: 2 }] } } as Entity;
  const rows = characterInfoRows(e, db);
  const origin = rows.find(r => r.key === 'origin-feat')!;
  expect(origin.value).toBeTruthy();
  expect(rows.filter(r => r.value === origin.value)).toHaveLength(1);
  expect(rows.filter(r => r.key.startsWith('class:')).map(r => r.value)).toEqual([expect.stringMatching(/Fighter, level 3/), expect.stringMatching(/Wizard, level 2/)]);
});

it('an id that no content knows is shown readably, never blank', () => {
  const { provider, db } = dbOf('dnd5e-2014');
  const made = createCharacter(provider, { id: 'x', name: 'X', classId: 'fighter', raceId: 'dwarf', backgroundId: 'acolyte', stats: STATS, level: 1 }, DEFAULT_RULES);
  const e = { ...made, identity: { ...made.identity, raceId: 'sky_kin', subRaceId: 'storm_born', backgroundId: 'old_sailor' } } as Entity;
  const rows = byKey(characterInfoRows(e, db));
  expect([rows.race.value, rows.subrace.value, rows.background.value]).toEqual(['Sky Kin', 'Storm Born', 'Old Sailor']);
});

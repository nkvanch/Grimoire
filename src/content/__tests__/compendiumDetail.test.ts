// An opened Compendium row is never empty for content that has something to say: a class or subclass lists its features by
// level (they live in the progression, not in `features`), and a description shows for every type that has one.
import { entryDetail, classToBrowsable, subclassToBrowsable, featToBrowsable, attachParentClassNames, itemToBrowsable } from '../compendiumBrowse';
import { officialContentDB, officialSubclassEntries } from '../officialCatalog';
import type { ItemIndexEntry } from '../itemRepo.types';

const db = officialContentDB();

it('every official class and subclass lists features by level', () => {
  expect(db.classes.length).toBeGreaterThan(0);
  for (const c of db.classes) expect(entryDetail(classToBrowsable(c, false)).features.length).toBeGreaterThan(0);
  const barbarian = db.classes.find(c => c.id === 'barbarian')!;
  expect(entryDetail(classToBrowsable(barbarian, false)).features).toContain('Level 1: Rage');
  const subs = attachParentClassNames(officialSubclassEntries(db.classes), db.classes);
  expect(subs.length).toBeGreaterThan(0);
  for (const s of subs) expect(entryDetail(subclassToBrowsable(s, false)).features.length).toBeGreaterThan(0);
});

it('a feat shows its description', () => {
  const f = db.feats.find(x => x.description)!;
  expect(entryDetail(featToBrowsable(f, false)).description).toBe(f.description.trim());
});

it('an item leaves its body to the full-record component (the index has no features)', () => {
  expect(entryDetail(itemToBrowsable({ id: 'x', name: 'X', weight: 1, cost: '1 gp', properties: [] } as unknown as ItemIndexEntry, false)))
    .toEqual({ description: null, features: [] });
});

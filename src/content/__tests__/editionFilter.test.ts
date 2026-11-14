// The Game / Version filter of the creation pickers.
import { editionOf, matchesEdition, editionOptions, editionChoiceFor } from '../editionFilter';
import { buildSrd51Pack, buildSrd521Pack } from '../packs/srdPacks';
import { packContentProvider, InstalledPack } from '../provider/contentProvider';
import type { GameId, RulesetId } from '../../engine/types';

const r2014 = 'dnd5e-2014' as RulesetId, r2024 = 'dnd5e-2024' as RulesetId, dnd = 'dnd' as GameId, pf = 'pathfinder' as GameId;
const untaggedOfficial = { rulesetId: undefined }, tagged2024 = { rulesetId: r2024 }, pf2e = { rulesetId: 'pf2e' as RulesetId };

it('official content with no tag is 2014; homebrew with no tag belongs to every edition', () => {
  expect(editionOf(untaggedOfficial, true)).toBe(r2014);
  expect(editionOf(untaggedOfficial, false)).toBeUndefined();
  expect(editionOf(tagged2024, false)).toBe(r2024);
});

it('a version shows only that version; a game shows all its versions; content of every edition always shows', () => {
  expect(matchesEdition(untaggedOfficial, true, { game: dnd, version: r2014 })).toBe(true);
  expect(matchesEdition(tagged2024, true, { game: dnd, version: r2014 })).toBe(false);
  expect(matchesEdition(untaggedOfficial, false, { game: dnd, version: r2024 })).toBe(true);   // homebrew for every edition
  expect(matchesEdition(tagged2024, true, { game: dnd, version: null })).toBe(true);
  expect(matchesEdition(pf2e, false, { game: dnd, version: null })).toBe(false);
  expect(matchesEdition(pf2e, false, { game: null, version: null })).toBe(true);
});

it('offers the games and versions present, with readable names, versions narrowed to the chosen game', () => {
  const o = editionOptions([untaggedOfficial, tagged2024], [pf2e], null);
  expect(o.games.map(g => g.label)).toEqual(['Dungeons & Dragons', 'Pathfinder']);
  expect(o.versions.map(v => v.label)).toEqual(['D&D 5e (2014)', 'D&D 5e (2024)', 'Pathfinder 2e']);
  expect(editionOptions([untaggedOfficial, tagged2024], [pf2e], pf).versions.map(v => v.id)).toEqual(['pf2e']);
});

it('starts on the character\'s own rules, or everything when it has none', () => {
  expect(editionChoiceFor(r2024)).toEqual({ game: dnd, version: r2024 });
  expect(editionChoiceFor(undefined)).toEqual({ game: null, version: null });
});

it('on the real SRD packs, the 2014 filter keeps the 5.1 classes and drops the 2024 ones, and the other way round', () => {
  const packs = [buildSrd51Pack(), buildSrd521Pack()].map(p => JSON.parse(JSON.stringify(p)) as InstalledPack);
  // the catalog the pickers list: both editions together, as the creation screens see it
  const all = [...packContentProvider(packs, r2014).classes(), ...packContentProvider(packs, r2024).classes()]
    .filter((c, i, list) => list.findIndex(x => x.id === c.id) === i);
  const ids = (version: RulesetId) => all.filter(c => matchesEdition(c, true, { game: dnd, version })).map(c => c.id);
  expect(ids(r2014)).toContain('fighter');
  expect(ids(r2014)).not.toContain('fighter_2024');
  expect(ids(r2024)).toContain('fighter_2024');
  expect(ids(r2024)).not.toContain('fighter');
});

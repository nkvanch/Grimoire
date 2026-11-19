import { sortByOption } from '../../../content/contentQuery';
import { SPELLS_AT_L1 } from '../../../content/creationProgress';
import { suggestFirst } from '../../../content/rulesetSuggestion';
import { actionType } from '../../../content/spellFilterUtils';
import type { SpellIndexEntry } from '../../../content/spellRepo.types';
import { spellSortOptions } from '../../../content/spells/spellBrowse';
import { Entity } from '../../../engine/types';
import { useEditionFilter } from '../../EditionFilter';

export function spellPoolsFor({
  classId, search, schoolFilter, castFilter, actionFilter, officialFilter, homebrewSpellIds, edition, componentFilter, spellSort, draft,
  alreadyGrantedCantrips, additionalCantripIds, alreadyGrantedSpells, additionalSpellIds, classSpells,
}: {
  classId: string;
  search: string;
  schoolFilter: string | null;
  castFilter: "all" | "ritual" | "concentration";
  actionFilter: string | null;
  officialFilter: "all" | "official" | "homebrew";
  homebrewSpellIds: Set<string>;
  edition: ReturnType<typeof useEditionFilter>;
  componentFilter: Set<string>;
  spellSort: string;
  draft: Entity;
  alreadyGrantedCantrips: string[];
  additionalCantripIds: string[];
  alreadyGrantedSpells: string[];
  additionalSpellIds: string[];
  classSpells: SpellIndexEntry[];
}) {
  // ── 3. Content-based selection ──────────────────────────────────────────────
  const targets        = SPELLS_AT_L1[classId] ?? { cantrips: 0, spells: 0 };
  const q              = search.trim().toLowerCase();
  const matchesSearch  = (s: SpellIndexEntry) => q === '' || s.name.toLowerCase().includes(q) || s.school.toLowerCase().includes(q);
  const matchesSchool  = (s: SpellIndexEntry) => !schoolFilter || s.school === schoolFilter;
  const matchesCast    = (s: SpellIndexEntry) =>
    castFilter === 'all' || (castFilter === 'ritual' ? s.ritual : s.concentration);
  const matchesAction  = (s: SpellIndexEntry) => !actionFilter || actionType(s) === actionFilter;
  const matchesOfficial = (s: SpellIndexEntry) =>
    officialFilter === 'all' || (officialFilter === 'homebrew') === homebrewSpellIds.has(s.id);
  const matchesRulesetFilter = (s: SpellIndexEntry) => edition.matches(s, !homebrewSpellIds.has(s.id));
  const matchesComponents = (s: SpellIndexEntry) =>
    componentFilter.size === 0 || Array.from(componentFilter).some(c => (s.components ?? []).includes(c));
  const spellSortOpts = spellSortOptions(s => homebrewSpellIds.has(s.id));
  const sortSpells = (list: SpellIndexEntry[]) => suggestFirst(sortByOption(list, spellSortOpts, spellSort), draft?.rulesetId);
  // Excludes anything already granted before this screen (e.g. a Divine
  // Domain's "always prepared" spells) — nothing to pick here, it's already
  // on the sheet, and letting it show as pickable would let a player select
  // it a second time for no effect while still eating into their pick count.
  const alreadyGrantedCantripSet = new Set([...alreadyGrantedCantrips, ...additionalCantripIds]);
  const alreadyGrantedSpellSet   = new Set([...alreadyGrantedSpells, ...additionalSpellIds]);
  const matchesAll = (s: SpellIndexEntry) =>
    matchesSearch(s) && matchesSchool(s) && matchesCast(s) && matchesAction(s) &&
    matchesOfficial(s) && matchesRulesetFilter(s) && matchesComponents(s);
  const cantripPool    = sortSpells(classSpells.filter(s => s.level === 0 && !alreadyGrantedCantripSet.has(s.id) && matchesAll(s)));
  const spellPool      = sortSpells(classSpells.filter(s => s.level === 1 && !alreadyGrantedSpellSet.has(s.id) && matchesAll(s)));
  const availableComponents = Array.from(new Set(classSpells.flatMap(s => s.components ?? [])));

  // Distinct schools present in this class's cantrip+level-1 pool, for the chips.
  const availableSchools = Array.from(new Set(
    classSpells.filter(s => s.level <= 1).map(s => s.school)
  )).sort();
  return { targets, spellSortOpts, cantripPool, spellPool, availableComponents, availableSchools };
}

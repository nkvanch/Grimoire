import { Dispatch, SetStateAction } from 'react';
import { View } from 'react-native';
import { ACTION_TYPES } from '../../../content/spellFilterUtils';
import type { SpellIndexEntry } from '../../../content/spellRepo.types';
import { SpellList } from '../../../engine/types';
import { useEditionFilter, EditionFilterSections } from '../../EditionFilter';
import { FilterSection, FilterChipRow, OfficialHomebrewChipRow, MultiSelectChipRow } from '../../FilterChipRow';
import { styles } from './spellsScreenStyles';

export function SpellFilterPanel({
  filtersOpen, availableSchools, schoolFilter, setSchoolFilter, castFilter, setCastFilter, actionFilter, setActionFilter, officialFilter,
  setOfficialFilter, classSpellLists, classSpellSource, classSourceLabel, activeSpellListId, setActiveSpellListId, edition, classSpells,
  homebrewSpellIds, availableComponents, componentFilter, setComponentFilter,
}: {
  filtersOpen: boolean;
  availableSchools: string[];
  schoolFilter: string | null;
  setSchoolFilter: Dispatch<SetStateAction<string | null>>;
  castFilter: "all" | "ritual" | "concentration";
  setCastFilter: Dispatch<SetStateAction<"all" | "ritual" | "concentration">>;
  actionFilter: string | null;
  setActionFilter: Dispatch<SetStateAction<string | null>>;
  officialFilter: "all" | "official" | "homebrew";
  setOfficialFilter: Dispatch<SetStateAction<"all" | "official" | "homebrew">>;
  classSpellLists: SpellList[];
  classSpellSource: { kind: "class"; classId: string; } | { kind: "list"; listId: string; } | undefined;
  classSourceLabel: string | null;
  activeSpellListId: string | null;
  setActiveSpellListId: Dispatch<SetStateAction<string | null>>;
  edition: ReturnType<typeof useEditionFilter>;
  classSpells: SpellIndexEntry[];
  homebrewSpellIds: Set<string>;
  availableComponents: string[];
  componentFilter: Set<string>;
  setComponentFilter: Dispatch<SetStateAction<Set<string>>>;
}) {
  return (
    <>
      {filtersOpen && (
        <View style={styles.filterPanel}>
          {availableSchools.length > 1 && (
            <FilterSection label="School">
              <FilterChipRow options={availableSchools.map(sc => ({ id: sc, label: sc }))} value={schoolFilter} onChange={setSchoolFilter} scrollable />
            </FilterSection>
          )}
          <FilterSection label="Ritual / Concentration">
            <FilterChipRow
              options={[
                { id: 'ritual' as const, label: 'Ritual' },
                { id: 'concentration' as const, label: 'Concentration' },
              ]}
              value={castFilter === 'all' ? null : castFilter}
              onChange={v => setCastFilter(v ?? 'all')}
            />
          </FilterSection>
          <FilterSection label="Casting Time">
            <FilterChipRow
              options={ACTION_TYPES.map(a => ({ id: a, label: a }))}
              value={actionFilter}
              onChange={setActionFilter}
            />
          </FilterSection>
          <FilterSection label="Official / Homebrew">
            <OfficialHomebrewChipRow value={officialFilter} onChange={setOfficialFilter} />
          </FilterSection>
          {(classSpellLists.length > 0 || !!classSpellSource) && (
            <FilterSection label="Spell Source">
              {/* FilterChipRow hides itself at <=1 option, so "Official" is always an
                  explicit option here — otherwise a class with exactly one Spell List
                  would render zero chips and have no way back to the normal pool. */}
              <FilterChipRow
                options={[{ id: 'official', label: classSourceLabel ? `Class default · ${classSourceLabel}` : 'Official' }, ...classSpellLists.map(l => ({ id: l.id, label: l.name }))]}
                value={activeSpellListId ?? 'official'}
                onChange={id => setActiveSpellListId(!id || id === 'official' ? null : id)}
              />
            </FilterSection>
          )}
          <EditionFilterSections edition={edition} official={classSpells.filter(sp => !homebrewSpellIds.has(sp.id))} homebrew={classSpells.filter(sp => homebrewSpellIds.has(sp.id))} />
          {availableComponents.length > 1 && (
            <FilterSection label="Components">
              <MultiSelectChipRow
                options={availableComponents.map(c => ({ id: c, label: c }))}
                values={componentFilter}
                onChange={setComponentFilter}
              />
            </FilterSection>
          )}
        </View>
      )}
    </>
  );
}

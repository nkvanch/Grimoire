import { Dispatch, SetStateAction } from 'react';
import { ContentTypeId } from '../../../content/contentQuery';
import { ACTION_TYPES } from '../../../content/spellFilterUtils';
import { FilterSection, FilterChipRow, MultiSelectChipRow } from '../../FilterChipRow';

export function SpellFilters({
  contentType, availableSpellSchools, spellSchool, setSpellSchool, spellCast, setSpellCast, spellAction, setSpellAction,
  availableSpellComponents, spellComponents, setSpellComponents,
}: {
  contentType: ContentTypeId | "all";
  availableSpellSchools: string[];
  spellSchool: string | null;
  setSpellSchool: Dispatch<SetStateAction<string | null>>;
  spellCast: "all" | "ritual" | "concentration";
  setSpellCast: Dispatch<SetStateAction<"all" | "ritual" | "concentration">>;
  spellAction: string | null;
  setSpellAction: Dispatch<SetStateAction<string | null>>;
  availableSpellComponents: string[];
  spellComponents: Set<string>;
  setSpellComponents: Dispatch<SetStateAction<Set<string>>>;
}) {
  return (
    <>
      {contentType === 'spell' && (
        <>
          <FilterSection label="School">
            <FilterChipRow options={availableSpellSchools.map(s => ({ id: s, label: s }))} value={spellSchool} onChange={setSpellSchool} scrollable />
          </FilterSection>
          <FilterSection label="Ritual / Concentration">
            <FilterChipRow options={[{ id: 'ritual' as const, label: 'Ritual' }, { id: 'concentration' as const, label: 'Concentration' }]} value={spellCast === 'all' ? null : spellCast} onChange={v => setSpellCast(v ?? 'all')} />
          </FilterSection>
          <FilterSection label="Casting Time">
            <FilterChipRow options={ACTION_TYPES.map(a => ({ id: a, label: a }))} value={spellAction} onChange={setSpellAction} />
          </FilterSection>
          {availableSpellComponents.length > 1 && (
            <FilterSection label="Components">
              <MultiSelectChipRow options={availableSpellComponents.map(c => ({ id: c, label: c }))} values={spellComponents} onChange={setSpellComponents} />
            </FilterSection>
          )}
        </>
      )}
    </>
  );
}

import { Dispatch, SetStateAction } from 'react';
import { ContentTypeId } from '../../../content/contentQuery';
import { SkillName } from '../../../engine/types';
import { FilterSection, MultiSelectChipRow, FilterChipRow } from '../../FilterChipRow';

export function BackgroundFeatFilters({
  contentType, availableBgSkills, backgroundSkill, setBackgroundSkill, availableBgTools, backgroundTool, setBackgroundTool, featPrereqType,
  setFeatPrereqType, featGrants, setFeatGrants,
}: {
  contentType: ContentTypeId | "all";
  availableBgSkills: { id: SkillName; label: string; }[];
  backgroundSkill: Set<SkillName>;
  setBackgroundSkill: Dispatch<SetStateAction<Set<SkillName>>>;
  availableBgTools: string[];
  backgroundTool: Set<string>;
  setBackgroundTool: Dispatch<SetStateAction<Set<string>>>;
  featPrereqType: string | null;
  setFeatPrereqType: Dispatch<SetStateAction<string | null>>;
  featGrants: Set<"asi" | "proficiency" | "activation">;
  setFeatGrants: Dispatch<SetStateAction<Set<"asi" | "proficiency" | "activation">>>;
}) {
  return (
    <>
      {contentType === 'background' && (
        <>
          <FilterSection label="Skill Proficiency">
            <MultiSelectChipRow options={availableBgSkills} values={backgroundSkill} onChange={setBackgroundSkill} scrollable />
          </FilterSection>
          {availableBgTools.length > 0 && (
            <FilterSection label="Tool Proficiency">
              <MultiSelectChipRow options={availableBgTools.map(t => ({ id: t, label: t }))} values={backgroundTool} onChange={setBackgroundTool} scrollable />
            </FilterSection>
          )}
        </>
      )}

      {contentType === 'feat' && (
        <>
          <FilterSection label="Prerequisite Type">
            <FilterChipRow
              options={['Ability Score', 'Spellcasting', 'Armor Proficiency', 'Weapon Proficiency', 'Level', 'Race / Species', 'None'].map(c => ({ id: c, label: c }))}
              value={featPrereqType} onChange={setFeatPrereqType} scrollable
            />
          </FilterSection>
          <FilterSection label="Grants">
            <MultiSelectChipRow
              options={[{ id: 'asi', label: 'Ability Score' }, { id: 'proficiency', label: 'Proficiency' }, { id: 'activation', label: 'Activated Ability' }]}
              values={featGrants} onChange={setFeatGrants}
            />
          </FilterSection>
        </>
      )}
    </>
  );
}

import { Dispatch, SetStateAction } from 'react';
import { CASTER_TYPES } from '../../../content/classes/classBrowse';
import { ContentTypeId } from '../../../content/contentQuery';
import { SubclassAddition, SUBCLASS_ADDITION_LABELS } from '../../../content/subclasses/subclassBrowse';
import { Ability, CharClass } from '../../../engine/types';
import { FilterSection, FilterChipRow, MultiSelectChipRow } from '../../FilterChipRow';
import { ABILITY_LABELS, ARMOR_LABELS, WEAPON_LABELS } from './compendiumModel';

export function ClassFilters({
  contentType, classCaster, setClassCaster, availableClassHitDice, classHitDie, setClassHitDie, availableClassSaves, classSave,
  setClassSave, availableClassArmor, classArmor, setClassArmor, availableClassWeapon, classWeapon, setClassWeapon, classes, subclassParent,
  setSubclassParent, subclassAdds, setSubclassAdds,
}: {
  contentType: ContentTypeId | "all";
  classCaster: string | null;
  setClassCaster: Dispatch<SetStateAction<string | null>>;
  availableClassHitDice: number[];
  classHitDie: number | null;
  setClassHitDie: Dispatch<SetStateAction<number | null>>;
  availableClassSaves: Ability[];
  classSave: Set<Ability>;
  setClassSave: Dispatch<SetStateAction<Set<Ability>>>;
  availableClassArmor: string[];
  classArmor: Set<string>;
  setClassArmor: Dispatch<SetStateAction<Set<string>>>;
  availableClassWeapon: string[];
  classWeapon: Set<string>;
  setClassWeapon: Dispatch<SetStateAction<Set<string>>>;
  classes: CharClass[];
  subclassParent: string | null;
  setSubclassParent: Dispatch<SetStateAction<string | null>>;
  subclassAdds: Set<SubclassAddition>;
  setSubclassAdds: Dispatch<SetStateAction<Set<SubclassAddition>>>;
}) {
  return (
    <>
      {contentType === 'class' && (
        <>
          <FilterSection label="Caster Type">
            <FilterChipRow options={CASTER_TYPES.map(ct => ({ id: ct, label: ct }))} value={classCaster} onChange={setClassCaster} />
          </FilterSection>
          <FilterSection label="Hit Die">
            <FilterChipRow options={availableClassHitDice.map(d => ({ id: String(d), label: `d${d}` }))} value={classHitDie === null ? null : String(classHitDie)} onChange={v => setClassHitDie(v === null ? null : Number(v))} />
          </FilterSection>
          <FilterSection label="Saving Throw Proficiency">
            <MultiSelectChipRow options={availableClassSaves.map(a => ({ id: a, label: ABILITY_LABELS[a] }))} values={classSave} onChange={setClassSave} />
          </FilterSection>
          <FilterSection label="Armor Proficiency">
            <MultiSelectChipRow options={availableClassArmor.map(a => ({ id: a, label: ARMOR_LABELS[a] ?? a }))} values={classArmor} onChange={setClassArmor} />
          </FilterSection>
          <FilterSection label="Weapon Proficiency">
            <MultiSelectChipRow options={availableClassWeapon.map(w => ({ id: w, label: WEAPON_LABELS[w] ?? w }))} values={classWeapon} onChange={setClassWeapon} />
          </FilterSection>
        </>
      )}

      {contentType === 'subclass' && (
        <>
          {classes.length > 1 && (
            <FilterSection label="Parent Class">
              <FilterChipRow options={classes.map(c => ({ id: c.id, label: c.name }))} value={subclassParent} onChange={setSubclassParent} scrollable />
            </FilterSection>
          )}
          <FilterSection label="What It Adds">
            <MultiSelectChipRow
              options={(Object.keys(SUBCLASS_ADDITION_LABELS) as SubclassAddition[]).map(a => ({ id: a, label: SUBCLASS_ADDITION_LABELS[a] }))}
              values={subclassAdds} onChange={setSubclassAdds} scrollable
            />
          </FilterSection>
        </>
      )}
    </>
  );
}

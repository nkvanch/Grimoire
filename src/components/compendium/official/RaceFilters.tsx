import { Dispatch, SetStateAction } from 'react';
import { Text } from 'react-native';
import { ContentTypeId } from '../../../content/contentQuery';
import { SubraceOwnTrait, SUBRACE_OWN_TRAIT_LABELS } from '../../../content/races/subraceBrowse';
import { Race } from '../../../engine/types';
import { Pressable } from '../../AccessibleControls';
import { FilterSection, FilterChipRow, MultiSelectChipRow } from '../../FilterChipRow';
import { styles } from './compendiumStyles';

export function RaceFilters({
  contentType, availableRaceSizes, raceSize, setRaceSize, availableRaceMovement, raceMovement, setRaceMovement, raceHasSubracesOnly,
  setRaceHasSubracesOnly, raceDarkvision, setRaceDarkvision, races, subraceParent, setSubraceParent, subraceTraits, setSubraceTraits,
}: {
  contentType: ContentTypeId | "all";
  availableRaceSizes: ("Tiny" | "Small" | "Medium" | "Large")[];
  raceSize: string | null;
  setRaceSize: Dispatch<SetStateAction<string | null>>;
  availableRaceMovement: ("fly" | "swim" | "climb" | "burrow")[];
  raceMovement: Set<string>;
  setRaceMovement: Dispatch<SetStateAction<Set<string>>>;
  raceHasSubracesOnly: boolean;
  setRaceHasSubracesOnly: Dispatch<SetStateAction<boolean>>;
  raceDarkvision: boolean;
  setRaceDarkvision: Dispatch<SetStateAction<boolean>>;
  races: Race[];
  subraceParent: string | null;
  setSubraceParent: Dispatch<SetStateAction<string | null>>;
  subraceTraits: Set<SubraceOwnTrait>;
  setSubraceTraits: Dispatch<SetStateAction<Set<SubraceOwnTrait>>>;
}) {
  return (
    <>
      {contentType === 'race' && (
        <>
          <FilterSection label="Size">
            <FilterChipRow options={availableRaceSizes.map(s => ({ id: s, label: s }))} value={raceSize} onChange={setRaceSize} />
          </FilterSection>
          <FilterSection label="Movement">
            <MultiSelectChipRow options={availableRaceMovement.map(m => ({ id: m, label: m[0].toUpperCase() + m.slice(1) }))} values={raceMovement} onChange={setRaceMovement} />
          </FilterSection>
          <Pressable style={[styles.chip, raceHasSubracesOnly && styles.chipActive]} onPress={() => setRaceHasSubracesOnly(v => !v)}>
            <Text style={[styles.chipTxt, raceHasSubracesOnly && styles.chipTxtActive]}>Has Subraces</Text>
          </Pressable>
          <Pressable style={[styles.chip, raceDarkvision && styles.chipActive]} onPress={() => setRaceDarkvision(v => !v)}>
            <Text style={[styles.chipTxt, raceDarkvision && styles.chipTxtActive]}>Darkvision</Text>
          </Pressable>
        </>
      )}

      {contentType === 'subrace' && (
        <>
          {races.length > 1 && (
            <FilterSection label="Parent Race">
              <FilterChipRow options={races.map(r => ({ id: r.id, label: r.name }))} value={subraceParent} onChange={setSubraceParent} scrollable />
            </FilterSection>
          )}
          <FilterSection label="Own Changes / Grants">
            <MultiSelectChipRow
              options={(Object.keys(SUBRACE_OWN_TRAIT_LABELS) as SubraceOwnTrait[]).map(t => ({ id: t, label: SUBRACE_OWN_TRAIT_LABELS[t] }))}
              values={subraceTraits} onChange={setSubraceTraits} scrollable
            />
          </FilterSection>
        </>
      )}
    </>
  );
}

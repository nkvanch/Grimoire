import { Dispatch, SetStateAction } from 'react';
import { View, Text } from 'react-native';
import { ContentTypeId } from '../../../content/contentQuery';
import { MONSTER_MOVEMENT_TYPES } from '../../../content/monsters/monsterBrowse';
import { Colors } from '../../../theme';
import { TextInput, Pressable } from '../../AccessibleControls';
import { FilterSection, FilterChipRow, MultiSelectChipRow } from '../../FilterChipRow';
import { styles } from './compendiumStyles';

export function MonsterFilters({
  contentType, monsterCrMin, setMonsterCrMin, monsterCrMax, setMonsterCrMax, availableMonsterTypes, monsterType, setMonsterType,
  availableMonsterSizes, monsterSize, setMonsterSize, availableMonsterAlignments, monsterAlignment, setMonsterAlignment, monsterMovement,
  setMonsterMovement, availableMonsterResistances, monsterResistance, setMonsterResistance, availableMonsterImmunities, monsterImmunity,
  setMonsterImmunity, availableMonsterCondImmunities, monsterCondImmunity, setMonsterCondImmunity, availableMonsterLanguages,
  monsterLanguage, setMonsterLanguage, monsterLegendary, setMonsterLegendary, monsterLair, setMonsterLair, monsterDarkvision,
  setMonsterDarkvision, monsterSpellcaster, setMonsterSpellcaster,
}: {
  contentType: ContentTypeId | "all";
  monsterCrMin: string;
  setMonsterCrMin: Dispatch<SetStateAction<string>>;
  monsterCrMax: string;
  setMonsterCrMax: Dispatch<SetStateAction<string>>;
  availableMonsterTypes: string[];
  monsterType: string | null;
  setMonsterType: Dispatch<SetStateAction<string | null>>;
  availableMonsterSizes: string[];
  monsterSize: string | null;
  setMonsterSize: Dispatch<SetStateAction<string | null>>;
  availableMonsterAlignments: string[];
  monsterAlignment: string | null;
  setMonsterAlignment: Dispatch<SetStateAction<string | null>>;
  monsterMovement: Set<string>;
  setMonsterMovement: Dispatch<SetStateAction<Set<string>>>;
  availableMonsterResistances: string[];
  monsterResistance: Set<string>;
  setMonsterResistance: Dispatch<SetStateAction<Set<string>>>;
  availableMonsterImmunities: string[];
  monsterImmunity: Set<string>;
  setMonsterImmunity: Dispatch<SetStateAction<Set<string>>>;
  availableMonsterCondImmunities: string[];
  monsterCondImmunity: Set<string>;
  setMonsterCondImmunity: Dispatch<SetStateAction<Set<string>>>;
  availableMonsterLanguages: string[];
  monsterLanguage: Set<string>;
  setMonsterLanguage: Dispatch<SetStateAction<Set<string>>>;
  monsterLegendary: boolean;
  setMonsterLegendary: Dispatch<SetStateAction<boolean>>;
  monsterLair: boolean;
  setMonsterLair: Dispatch<SetStateAction<boolean>>;
  monsterDarkvision: boolean;
  setMonsterDarkvision: Dispatch<SetStateAction<boolean>>;
  monsterSpellcaster: boolean;
  setMonsterSpellcaster: Dispatch<SetStateAction<boolean>>;
}) {
  return (
    <>
      {contentType === 'monster' && (
        <>
          <View style={styles.crRow}>
            <TextInput style={styles.crInput} value={monsterCrMin} onChangeText={setMonsterCrMin} placeholder="CR min" placeholderTextColor={Colors.textDim} keyboardType="decimal-pad" />
            <TextInput style={styles.crInput} value={monsterCrMax} onChangeText={setMonsterCrMax} placeholder="CR max" placeholderTextColor={Colors.textDim} keyboardType="decimal-pad" />
          </View>
          <FilterSection label="Creature Type">
            <FilterChipRow options={availableMonsterTypes.map(t => ({ id: t, label: t }))} value={monsterType} onChange={setMonsterType} scrollable />
          </FilterSection>
          <FilterSection label="Size">
            <FilterChipRow options={availableMonsterSizes.map(s => ({ id: s, label: s[0].toUpperCase() + s.slice(1) }))} value={monsterSize} onChange={setMonsterSize} scrollable />
          </FilterSection>
          <FilterSection label="Alignment">
            <FilterChipRow options={availableMonsterAlignments.map(a => ({ id: a, label: a }))} value={monsterAlignment} onChange={setMonsterAlignment} scrollable />
          </FilterSection>
          <FilterSection label="Movement">
            <MultiSelectChipRow options={MONSTER_MOVEMENT_TYPES.map(m => ({ id: m, label: m }))} values={monsterMovement} onChange={setMonsterMovement} />
          </FilterSection>
          {availableMonsterResistances.length > 0 && (
            <FilterSection label="Resistances">
              <MultiSelectChipRow options={availableMonsterResistances.map(r => ({ id: r, label: r }))} values={monsterResistance} onChange={setMonsterResistance} scrollable />
            </FilterSection>
          )}
          {availableMonsterImmunities.length > 0 && (
            <FilterSection label="Immunities">
              <MultiSelectChipRow options={availableMonsterImmunities.map(i => ({ id: i, label: i }))} values={monsterImmunity} onChange={setMonsterImmunity} scrollable />
            </FilterSection>
          )}
          {availableMonsterCondImmunities.length > 0 && (
            <FilterSection label="Condition Immunities">
              <MultiSelectChipRow options={availableMonsterCondImmunities.map(c => ({ id: c, label: c }))} values={monsterCondImmunity} onChange={setMonsterCondImmunity} scrollable />
            </FilterSection>
          )}
          {availableMonsterLanguages.length > 0 && (
            <FilterSection label="Languages">
              <MultiSelectChipRow options={availableMonsterLanguages.map(l => ({ id: l, label: l }))} values={monsterLanguage} onChange={setMonsterLanguage} scrollable />
            </FilterSection>
          )}
          <FilterSection label="Other">
            <View style={styles.chipRow}>
              <Pressable style={[styles.chip, monsterLegendary && styles.chipActive]} onPress={() => setMonsterLegendary(v => !v)}><Text style={[styles.chipTxt, monsterLegendary && styles.chipTxtActive]}>Legendary Actions</Text></Pressable>
              <Pressable style={[styles.chip, monsterLair && styles.chipActive]} onPress={() => setMonsterLair(v => !v)}><Text style={[styles.chipTxt, monsterLair && styles.chipTxtActive]}>Lair Actions</Text></Pressable>
              <Pressable style={[styles.chip, monsterDarkvision && styles.chipActive]} onPress={() => setMonsterDarkvision(v => !v)}><Text style={[styles.chipTxt, monsterDarkvision && styles.chipTxtActive]}>Darkvision</Text></Pressable>
              <Pressable style={[styles.chip, monsterSpellcaster && styles.chipActive]} onPress={() => setMonsterSpellcaster(v => !v)}><Text style={[styles.chipTxt, monsterSpellcaster && styles.chipTxtActive]}>Spellcaster</Text></Pressable>
            </View>
          </FilterSection>
        </>
      )}
    </>
  );
}

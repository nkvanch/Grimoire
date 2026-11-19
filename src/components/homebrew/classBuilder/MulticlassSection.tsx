import { Dispatch, SetStateAction } from 'react';
import { View, Text } from 'react-native';
import { Ability } from '../../../engine/types';
import { Colors } from '../../../theme';
import { Pressable, TextInput } from '../../AccessibleControls';
import { ARMOR_PROFS, WEAPON_PROFS } from './classBuilderModel';
import { styles } from './classBuilderStyles';

export function MulticlassSection({ mcArmor, setMcArmor, mcWeapons, setMcWeapons, mcTools, setMcTools, mcNeeds, setMcNeeds, mcNeedMin, setMcNeedMin, mcNeedAny, setMcNeedAny }: {
  mcArmor: string[];
  setMcArmor: Dispatch<SetStateAction<string[]>>;
  mcWeapons: string[];
  setMcWeapons: Dispatch<SetStateAction<string[]>>;
  mcTools: string;
  setMcTools: Dispatch<SetStateAction<string>>;
  mcNeeds: Ability[];
  setMcNeeds: Dispatch<SetStateAction<Ability[]>>;
  mcNeedMin: string;
  setMcNeedMin: Dispatch<SetStateAction<string>>;
  mcNeedAny: boolean;
  setMcNeedAny: Dispatch<SetStateAction<boolean>>;
}) {
  return (
    <>
      {/* ── 3a. As a second class ──────────────────────────────── */}
      <View style={styles.divider} />
      <Text style={styles.fieldLabel}>When taken as a second class</Text>
      <Text style={styles.hint}>
        What a character who already has another class gains from this one. The multiclassing rules give a reduced set;
        leave it empty to grant nothing.
      </Text>
      <View style={styles.chipRow}>
        {ARMOR_PROFS.map(p => {
          const active = mcArmor.includes(p);
          return (
            <Pressable key={p} style={[styles.chip, active && styles.chipActive]}
              onPress={() => setMcArmor(prev => prev.includes(p) ? prev.filter(x => x !== p) : [...prev, p])}>
              <Text style={[styles.chipTxt, active && styles.chipTxtActive]}>{p.charAt(0).toUpperCase() + p.slice(1)}</Text>
            </Pressable>
          );
        })}
        {WEAPON_PROFS.map(p => {
          const active = mcWeapons.includes(p);
          return (
            <Pressable key={p} style={[styles.chip, active && styles.chipActive]}
              onPress={() => setMcWeapons(prev => prev.includes(p) ? prev.filter(x => x !== p) : [...prev, p])}>
              <Text style={[styles.chipTxt, active && styles.chipTxtActive]}>{p.charAt(0).toUpperCase() + p.slice(1)}</Text>
            </Pressable>
          );
        })}
      </View>
      <TextInput style={styles.input} value={mcTools} onChangeText={setMcTools}
        placeholder="Tools, separated by commas" placeholderTextColor={Colors.textDim} />
      <Text style={styles.fieldLabel}>Abilities needed</Text>
      <Text style={styles.hint}>
        The scores a character needs to take this class with another, or to leave it for another. None picked: it asks for nothing.
      </Text>
      <View style={styles.chipRow}>
        {(['str', 'dex', 'con', 'int', 'wis', 'cha'] as Ability[]).map(a => {
          const active = mcNeeds.includes(a);
          return (
            <Pressable key={a} style={[styles.chip, active && styles.chipActive]}
              onPress={() => setMcNeeds(prev => prev.includes(a) ? prev.filter(x => x !== a) : [...prev, a])}>
              <Text style={[styles.chipTxt, active && styles.chipTxtActive]}>{a.toUpperCase()}</Text>
            </Pressable>
          );
        })}
      </View>
      {mcNeeds.length > 0 && (
        <View style={styles.chipRow}>
          <TextInput style={[styles.input, { width: 64 }]} value={mcNeedMin} onChangeText={setMcNeedMin} keyboardType="number-pad" accessibilityLabel="Minimum score" />
          {mcNeeds.length > 1 && ([false, true] as const).map(any => (
            <Pressable key={String(any)} style={[styles.chip, mcNeedAny === any && styles.chipActive]} onPress={() => setMcNeedAny(any)}>
              <Text style={[styles.chipTxt, mcNeedAny === any && styles.chipTxtActive]}>{any ? 'Any one' : 'All of them'}</Text>
            </Pressable>
          ))}
        </View>
      )}
    </>
  );
}

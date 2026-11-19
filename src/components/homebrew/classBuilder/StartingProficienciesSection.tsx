import { Dispatch, SetStateAction } from 'react';
import { View, Text } from 'react-native';
import { Colors } from '../../../theme';
import { Pressable, TextInput } from '../../AccessibleControls';
import { COMMON_TOOLS } from '../TraitEditor';
import { ARMOR_PROFS, WEAPON_PROFS } from './classBuilderModel';
import { styles } from './classBuilderStyles';
import { SectionHeader } from './SectionHeader';

export function StartingProficienciesSection({ armorProfs, toggleArmorProf, weaponProfs, toggleWeaponProf, toolProfs, toggleTool, removeTool, newTool, setNewTool, addTool }: {
  armorProfs: string[];
  toggleArmorProf: (prof: string) => void;
  weaponProfs: string[];
  toggleWeaponProf: (prof: string) => void;
  toolProfs: string[];
  toggleTool: (t: string) => void;
  removeTool: (t: string) => void;
  newTool: string;
  setNewTool: Dispatch<SetStateAction<string>>;
  addTool: () => void;
}) {
  return (
    <>
      {/* ── 3. Starting Proficiencies ─────────────────────────────────── */}
      <View style={styles.divider} />
      <SectionHeader title="Starting Proficiencies" n={3} />

      <Text style={styles.fieldLabel}>Armor</Text>
      <View style={styles.chipRow}>
        {ARMOR_PROFS.map(p => {
          const active = armorProfs.includes(p);
          return (
            <Pressable key={p}
              style={[styles.chip, active && styles.chipActive]}
              onPress={() => toggleArmorProf(p)}
            >
              <Text style={[styles.chipTxt, active && styles.chipTxtActive]}>
                {p.charAt(0).toUpperCase() + p.slice(1)}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <Text style={styles.fieldLabel}>Weapons</Text>
      <View style={styles.chipRow}>
        {WEAPON_PROFS.map(p => {
          const active = weaponProfs.includes(p);
          return (
            <Pressable key={p}
              style={[styles.chip, active && styles.chipActive]}
              onPress={() => toggleWeaponProf(p)}
            >
              <Text style={[styles.chipTxt, active && styles.chipTxtActive]}>
                {p.charAt(0).toUpperCase() + p.slice(1)}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <Text style={styles.fieldLabel}>Tools</Text>
      <Text style={styles.hint}>Tap to add a common tool, or type your own below.</Text>
      <View style={styles.chipRow}>
        {COMMON_TOOLS.map(t => {
          const active = toolProfs.includes(t);
          return (
            <Pressable key={t} style={[styles.chip, active && styles.chipActive]} onPress={() => toggleTool(t)}>
              <Text style={[styles.chipTxt, active && styles.chipTxtActive]}>{t}</Text>
            </Pressable>
          );
        })}
      </View>
      {toolProfs.filter(t => !COMMON_TOOLS.includes(t)).length > 0 && (
        <View style={styles.chipRow}>
          {toolProfs.filter(t => !COMMON_TOOLS.includes(t)).map(t => (
            <Pressable key={t} style={[styles.chip, styles.chipActive]} onPress={() => removeTool(t)}>
              <Text style={[styles.chipTxt, styles.chipTxtActive]}>{t} ✕</Text>
            </Pressable>
          ))}
        </View>
      )}
      <View style={styles.inlineAddRow}>
        <TextInput style={[styles.input, { flex: 1 }]} value={newTool} onChangeText={setNewTool}
          placeholder="Something not listed above" placeholderTextColor={Colors.textDim} onSubmitEditing={addTool} />
        <Pressable style={styles.inlineAddBtn} onPress={addTool}>
          <Text style={styles.inlineAddTxt}>Add</Text>
        </Pressable>
      </View>
    </>
  );
}

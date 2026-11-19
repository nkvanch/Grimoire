import { View, Text } from 'react-native';
import { Ability } from '../../../engine/types';
import { Pressable } from '../../AccessibleControls';
import { ABILITIES, ABILITY_LABELS } from './classBuilderModel';
import { styles } from './classBuilderStyles';
import { SectionHeader } from './SectionHeader';

export function SavingThrowsSection({ savingThrows, toggleSavingThrow }: {
  savingThrows: Ability[];
  toggleSavingThrow: (ab: Ability) => void;
}) {
  return (
    <>
      {/* ── 2. Saving Throws ──────────────────────────────────────────── */}
      <View style={styles.divider} />
      <SectionHeader title="Saving Throws" n={2} />
      <Text style={styles.hint}>
        Which saving throws does this class grant proficiency in?
      </Text>
      <View style={styles.chipRow}>
        {ABILITIES.map(ab => {
          const active = savingThrows.includes(ab);
          return (
            <Pressable key={ab}
              style={[styles.chip, active && styles.chipActive]}
              onPress={() => toggleSavingThrow(ab)}
            >
              <Text style={[styles.chipTxt, active && styles.chipTxtActive]}>
                {ABILITY_LABELS[ab]}
              </Text>
            </Pressable>
          );
        })}
      </View>
      {savingThrows.length > 2 && (
        <Text style={styles.warn}>⚠ Most classes use exactly 2 saving throw proficiencies.</Text>
      )}
    </>
  );
}

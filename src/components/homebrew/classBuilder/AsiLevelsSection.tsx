import { View, Text } from 'react-native';
import { Pressable } from '../../AccessibleControls';
import { styles } from './classBuilderStyles';
import { SectionHeader } from './SectionHeader';

export function AsiLevelsSection({ asiLevels, toggleAsiLevel }: {
  asiLevels: number[];
  toggleAsiLevel: (lvl: number) => void;
}) {
  return (
    <>
      {/* ── 6. ASI Levels ─────────────────────────────────────────────── */}
      <View style={styles.divider} />
      <SectionHeader title="Ability Score Improvements" n={6} />
      <Text style={styles.hint}>
        Tap levels to toggle ASIs. Default (gold) matches most official classes.
      </Text>

      <View style={styles.asiGrid}>
        {Array.from({ length: 20 }, (_, i) => i + 1).map(lvl => {
          const active = asiLevels.includes(lvl);
          return (
            <Pressable
              key={lvl}
              style={[styles.asiCell, active && styles.asiCellActive]}
              onPress={() => toggleAsiLevel(lvl)}
            >
              <Text style={[styles.asiCellTxt, active && styles.asiCellTxtActive]}>
                {lvl}
              </Text>
            </Pressable>
          );
        })}
      </View>
      <Text style={styles.hint}>
        Selected: {asiLevels.length > 0 ? asiLevels.join(', ') : 'none (no ASIs)'}
      </Text>
    </>
  );
}

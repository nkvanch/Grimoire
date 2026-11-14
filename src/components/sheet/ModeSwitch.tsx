// src/components/sheet/ModeSwitch.tsx
// The switch for a feature's modes (engine/featureModes.ts), on an item card or a feature row: one chip per mode, the active one lit.
import { View, Text, StyleSheet } from 'react-native';
import { Pressable } from '../AccessibleControls';
import type { Entity, Feature } from '../../engine/types';
import { activeMode } from '../../engine/featureModes';
import { Colors, Spacing, Radius, FontSize, FontWeight } from '../../theme';

export function ModeSwitch({ feature, entity, modeKey, onSet }: {
  feature: Pick<Feature, 'name' | 'modes'>; entity: Pick<Entity, 'featureModes'>; modeKey: string;
  onSet: (key: string, modeId: string, label: string) => void;
}) {
  const modes = feature.modes ?? [];
  if (!modes.length) return null;
  const active = activeMode(feature, entity, modeKey);
  return (
    <View style={styles.row} accessibilityRole="radiogroup" accessibilityLabel={`${feature.name} mode`}>
      <Text style={styles.label}>Mode</Text>
      {modes.map(m => {
        const on = active?.id === m.id;
        return (
          <Pressable key={m.id} testID={`mode-${modeKey}-${m.id}`} accessibilityRole="radio" accessibilityState={{ selected: on }}
            accessibilityLabel={`${feature.name}: ${m.name}`} style={[styles.chip, on && styles.chipOn]}
            onPress={() => { if (!on) onSet(modeKey, m.id, `${feature.name}: ${m.name}`); }}>
            <Text style={[styles.chipTxt, on && styles.chipTxtOn]}>{m.name}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: Spacing.xs, paddingVertical: Spacing.xs },
  label: { fontSize: FontSize.xs, fontWeight: FontWeight.bold, color: Colors.textSecondary, letterSpacing: 1, textTransform: 'uppercase', marginRight: Spacing.xs },
  chip: { minHeight: 44, paddingHorizontal: Spacing.md, borderRadius: Radius.full, borderWidth: 1, borderColor: Colors.border, justifyContent: 'center' },
  chipOn: { backgroundColor: Colors.gold, borderColor: Colors.gold },
  chipTxt: { color: Colors.textPrimary, fontSize: FontSize.sm },
  chipTxtOn: { color: Colors.bg, fontWeight: FontWeight.bold },
});

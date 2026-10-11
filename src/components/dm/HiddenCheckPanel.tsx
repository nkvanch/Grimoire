// src/components/dm/HiddenCheckPanel.tsx
// DM-only: type a Stealth total or a DC and see which party members' passive scores reach it, without asking the players.
import { useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet } from 'react-native';
import { Entity } from '../../engine/types';
import { hiddenCheck, hiddenCheckSummary, PassiveKind } from '../../engine/hiddenCheck';
import { Colors, Spacing, Radius, FontSize, FontWeight } from '../../theme';

const KINDS: { key: PassiveKind; label: string }[] = [
  { key: 'perception', label: 'Perception' }, { key: 'investigation', label: 'Investigation' }, { key: 'insight', label: 'Insight' },
];

export function HiddenCheckPanel({ party }: { party: Entity[] }) {
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<PassiveKind>('perception');
  const [raw, setRaw] = useState('');
  const value = parseInt(raw, 10);
  const rows = Number.isFinite(value) ? hiddenCheck(party, kind, value) : [];

  return (
    <View style={styles.card}>
      <Pressable onPress={() => setOpen(o => !o)} accessibilityRole="button" accessibilityLabel="Hidden check against passive scores">
        <Text style={styles.title}>{open ? '▾' : '▸'} Hidden check (passive scores)</Text>
      </Pressable>
      {open && (
        <View style={{ gap: Spacing.sm }}>
          <Text style={styles.hint}>Only you see this. Enter a creature's Stealth total or a DC.</Text>
          <View style={styles.chips}>
            {KINDS.map(k => (
              <Pressable key={k.key} style={[styles.chip, kind === k.key && styles.chipOn]} onPress={() => setKind(k.key)}>
                <Text style={[styles.chipTxt, kind === k.key && styles.chipTxtOn]}>{k.label}</Text>
              </Pressable>
            ))}
          </View>
          <TextInput
            style={styles.input} value={raw} onChangeText={t => setRaw(t.replace(/[^0-9]/g, ''))} keyboardType="number-pad"
            placeholder="Stealth total or DC" placeholderTextColor={Colors.textDim} accessibilityLabel="Value to check"
          />
          {rows.length > 0 && (
            <>
              <Text style={styles.summary}>{hiddenCheckSummary(rows, kind, value)}</Text>
              {rows.map(r => (
                <View key={r.entityId} style={styles.row}>
                  <Text style={[styles.name, { color: r.meets ? Colors.green : Colors.textSecondary }]}>{r.name}</Text>
                  <Text style={styles.num}>{r.passive}</Text>
                  <Text style={[styles.margin, { color: r.meets ? Colors.green : Colors.red }]}>{r.margin >= 0 ? `+${r.margin}` : r.margin}</Text>
                </View>
              ))}
            </>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card:  { backgroundColor: Colors.surface, borderRadius: Radius.lg, padding: Spacing.md, borderWidth: 1, borderColor: Colors.border, gap: Spacing.sm },
  title: { color: Colors.gold, fontWeight: FontWeight.bold, fontSize: FontSize.sm },
  hint:  { color: Colors.textSecondary, fontSize: FontSize.xs },
  chips: { flexDirection: 'row', gap: Spacing.xs, flexWrap: 'wrap' },
  chip:  { borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.md, paddingHorizontal: Spacing.sm, paddingVertical: Spacing.xs },
  chipOn: { borderColor: Colors.gold, backgroundColor: Colors.bg },
  chipTxt: { color: Colors.textSecondary, fontSize: FontSize.xs },
  chipTxtOn: { color: Colors.gold, fontWeight: FontWeight.bold },
  input: { borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.md, paddingHorizontal: Spacing.sm, paddingVertical: Spacing.xs, color: Colors.textPrimary },
  summary: { color: Colors.textPrimary, fontSize: FontSize.sm, fontWeight: FontWeight.bold },
  row:   { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  name:  { flex: 1, fontSize: FontSize.sm },
  num:   { color: Colors.textPrimary, fontSize: FontSize.sm, width: 36, textAlign: 'right' },
  margin: { fontSize: FontSize.sm, width: 40, textAlign: 'right', fontWeight: FontWeight.bold },
});

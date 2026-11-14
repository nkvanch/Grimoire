// src/components/sheet/CharacterInfoModal.tsx
// The sheet's Character info page: what the character was built from (rules, level, classes and subclasses, species and subrace,
// background, origin feat, feats, alignment, experience). Opened by tapping the level line under the name, or Character info in
// the sheet menu. A row with a description opens to show it. Read-only.
import { useState } from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { Pressable } from '../AccessibleControls';
import { Modal } from '../AppModal';
import type { InfoRow } from '../../content/characterInfo';
import { PictureField } from '../homebrew/PictureField';
import { Colors, Spacing, Radius, FontSize, FontWeight } from '../../theme';

interface Props {
  visible: boolean;
  name:    string;
  rows:    InfoRow[];
  onClose: () => void;
  /** The character's portrait, set or removed here. */
  portraitUri?: string;
  onPortrait?: (uri: string | undefined) => void;
}

export function CharacterInfoModal({ visible, name, rows, onClose, portraitUri, onPortrait }: Props) {
  const [open, setOpen] = useState<string | null>(null);
  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={styles.screen}>
        <View style={styles.header}>
          <Pressable onPress={onClose} style={styles.backBtn} accessibilityRole="button" accessibilityLabel="Back to the sheet">
            <Text style={styles.backTxt}>← Back</Text>
          </Pressable>
          <View style={{ flex: 1 }}>
            <Text style={styles.title} numberOfLines={1}>{name || 'Unnamed'}</Text>
            <Text style={styles.subtitle}>Character info</Text>
          </View>
        </View>
        <ScrollView contentContainerStyle={styles.content}>
          {onPortrait && <PictureField label="Portrait" detail={false} value={portraitUri ? { imageUri: portraitUri } : {}} onChange={p => onPortrait(p.imageUri)} />}
          <View style={styles.card}>
            {rows.map((row, i) => {
              const expanded = open === row.key;
              const body = (
                <>
                  <View style={styles.rowTop}>
                    <Text style={styles.label}>{row.label}</Text>
                    <Text style={styles.value}>{row.value}</Text>
                    {row.detail ? <Text style={styles.caret}>{expanded ? '▲' : '▼'}</Text> : <View style={styles.caretSpace} />}
                  </View>
                  {expanded && row.detail && <Text style={styles.detail}>{row.detail}</Text>}
                </>
              );
              return row.detail ? (
                <Pressable key={row.key} testID={`info-${row.key}`} style={[styles.row, i > 0 && styles.rowBorder]}
                  onPress={() => setOpen(expanded ? null : row.key)} accessibilityRole="button"
                  accessibilityState={{ expanded }} accessibilityLabel={`${row.label}: ${row.value}`} accessibilityHint="Shows its description">
                  {body}
                </Pressable>
              ) : (
                <View key={row.key} testID={`info-${row.key}`} style={[styles.row, i > 0 && styles.rowBorder]}>{body}</View>
              );
            })}
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  screen:   { flex: 1, backgroundColor: Colors.bg },
  header:   { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingTop: Spacing.xl + 8, paddingHorizontal: Spacing.md, paddingBottom: Spacing.sm },
  backBtn:  { minHeight: 44, justifyContent: 'center', paddingRight: Spacing.sm },
  backTxt:  { color: Colors.gold, fontSize: FontSize.md, fontWeight: FontWeight.bold },
  title:    { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  subtitle: { fontSize: FontSize.xs, color: Colors.textSecondary },
  content:  { padding: Spacing.md, paddingBottom: Spacing.xxl },
  card:     { backgroundColor: Colors.surface, borderRadius: Radius.lg, borderWidth: 1, borderColor: Colors.border, paddingHorizontal: Spacing.md },
  row:      { minHeight: 52, justifyContent: 'center', paddingVertical: Spacing.sm },
  rowBorder:{ borderTopWidth: 1, borderTopColor: Colors.border },
  rowTop:   { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  label:    { width: 104, fontSize: FontSize.xs, color: Colors.textSecondary, fontWeight: FontWeight.bold, textTransform: 'uppercase', letterSpacing: 1 },
  value:    { flex: 1, fontSize: FontSize.md, color: Colors.textPrimary, fontWeight: FontWeight.bold },
  caret:    { width: 16, color: Colors.textSecondary, fontSize: FontSize.xs, textAlign: 'right' },
  caretSpace: { width: 16 },
  detail:   { marginTop: Spacing.sm, fontSize: FontSize.sm, lineHeight: 20, color: Colors.textSecondary },
});

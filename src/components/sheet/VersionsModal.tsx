// src/components/sheet/VersionsModal.tsx
// The versions a character is pinned to (contract LIFE-004, the desktop sheet's version notices and "Review…"): what differs from what is
// installed, told and never applied, and the person's own choice to move the character onto the installed versions. Moving is one step,
// undone like any other.
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { Pressable } from '../AccessibleControls';
import { Modal } from '../AppModal';
import type { VersionNotes } from '../../store/pinningService';
import { Colors, Spacing, Radius, FontSize, FontWeight } from '../../theme';

interface Props {
  visible: boolean;
  notes:   VersionNotes;
  onPin:   () => void;
  onClose: () => void;
}

export function VersionsModal({ visible, notes, onPin, onClose }: Props) {
  const when = notes.lockedAt ? new Date(notes.lockedAt * 1000).toLocaleDateString() : null;
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        {/* a sibling backdrop and a plain sheet, so the list scrolls wherever the drag starts (SCROLL-TOUCH-1) */}
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={styles.sheet}>
          <Text style={styles.title}>Versions</Text>
          <Text style={styles.body}>
            {!notes.pinned
              ? 'This character is not pinned: it uses whatever versions are installed.'
              : notes.differences.length === 0
                ? `Pinned${when ? ` on ${when}` : ''}. What is installed is what it was pinned to.`
                : `Pinned${when ? ` on ${when}` : ''}. The character keeps its versions; what is installed differs:`}
          </Text>
          {notes.differences.length > 0 && (
            <ScrollView style={styles.rowsBox} contentContainerStyle={{ gap: Spacing.sm }}>
              {notes.differences.map((d, i) => <Text key={i} testID="version-difference" style={styles.rowTxt}>⚠️ {d}</Text>)}
            </ScrollView>
          )}
          {(!notes.pinned || notes.differences.length > 0) && (
            <Pressable testID="versions-pin" style={styles.pinBtn} onPress={onPin}>
              <Text style={styles.pinTxt}>{notes.pinned ? 'Use the installed versions' : 'Pin to the installed versions'}</Text>
            </Pressable>
          )}
          <Pressable style={styles.closeBtn} onPress={onClose}>
            <Text style={styles.closeTxt}>Close</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: '#000000cc', justifyContent: 'center', padding: Spacing.md },
  sheet: { backgroundColor: Colors.surfaceHigh, borderRadius: Radius.lg, padding: Spacing.md, gap: Spacing.sm, maxHeight: '90%' },
  title: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.gold, textAlign: 'center' },
  body: { fontSize: FontSize.sm, color: Colors.textPrimary },
  rowsBox: { backgroundColor: Colors.surface, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.border, padding: Spacing.sm, maxHeight: 320 },
  rowTxt: { fontSize: FontSize.sm, color: Colors.gold },
  pinBtn: { borderWidth: 1, borderColor: Colors.gold, borderRadius: Radius.md, padding: Spacing.md, alignItems: 'center' },
  pinTxt: { color: Colors.gold, fontWeight: FontWeight.bold, fontSize: FontSize.md },
  closeBtn: { backgroundColor: Colors.gold, borderRadius: Radius.md, padding: Spacing.md, alignItems: 'center' },
  closeTxt: { color: Colors.bg, fontWeight: FontWeight.bold, fontSize: FontSize.md },
});

// src/components/sheet/RenameModal.tsx
// Renaming a character after creation: opened by tapping the name in the sheet header, or Rename in its menu. A blank name is not
// saved. Same backdrop/sheet shape as the other sheet pop-ups.
import { useEffect, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Pressable, TextInput } from '../AccessibleControls';
import { Modal } from '../AppModal';
import { useEdited, closeAsking } from '../../hooks/useDiscardGuard';
import { Colors, Spacing, Radius, FontSize, FontWeight } from '../../theme';
import { NAME_INPUT } from '../nameInput';

export const MAX_CHARACTER_NAME = 60;

interface Props {
  visible: boolean;
  name:    string;
  onSave:  (name: string) => void;
  onClose: () => void;
}

export function RenameModal({ visible, name, onSave, onClose }: Props) {
  const [text, setText] = useState(name);
  useEffect(() => { if (visible) setText(name); }, [visible, name]);
  // Closing with edits asks first (src/hooks/useDiscardGuard.ts); an explicit Discard does not.
  const close = closeAsking(useEdited(() => text, visible), onClose);
  const trimmed = text.trim();
  const canSave = trimmed.length > 0 && trimmed !== name;
  const save = () => { if (canSave) { onSave(trimmed); onClose(); } };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={close}>
      <View style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={close} accessible={false} />
        <View style={styles.sheet}>
          <Text style={styles.title}>Rename character</Text>
          <TextInput {...NAME_INPUT}
            testID="rename-input"
            accessibilityLabel="Character name"
            style={styles.input}
            value={text}
            onChangeText={setText}
            onSubmitEditing={save}
            maxLength={MAX_CHARACTER_NAME}
            autoFocus
            selectTextOnFocus
            returnKeyType="done"
          />
          <View style={styles.buttons}>
            <Pressable style={styles.cancelBtn} onPress={close} accessibilityRole="button">
              <Text style={styles.cancelTxt}>Cancel</Text>
            </Pressable>
            <Pressable testID="rename-save" style={[styles.saveBtn, !canSave && styles.saveBtnOff]} onPress={save} disabled={!canSave} accessibilityRole="button">
              <Text style={styles.saveTxt}>Save</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: '#000000cc', justifyContent: 'center', padding: Spacing.md },
  sheet:    { backgroundColor: Colors.surfaceHigh, borderRadius: Radius.lg, padding: Spacing.md, gap: Spacing.md },
  title:    { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.gold, textAlign: 'center' },
  input: {
    minHeight: 48, borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.md, backgroundColor: Colors.bg,
    color: Colors.textPrimary, fontSize: FontSize.lg, paddingHorizontal: Spacing.md,
  },
  buttons:    { flexDirection: 'row', gap: Spacing.sm },
  cancelBtn:  { flex: 1, minHeight: 48, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.border, alignItems: 'center', justifyContent: 'center' },
  cancelTxt:  { color: Colors.textPrimary, fontWeight: FontWeight.bold, fontSize: FontSize.md },
  saveBtn:    { flex: 1, minHeight: 48, borderRadius: Radius.md, backgroundColor: Colors.gold, alignItems: 'center', justifyContent: 'center' },
  saveBtnOff: { opacity: 0.4 },
  saveTxt:    { color: Colors.bg, fontWeight: FontWeight.bold, fontSize: FontSize.md },
});

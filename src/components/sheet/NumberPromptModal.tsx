import { useState } from 'react';
import { Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Spacing, Colors } from '../../theme';
import { Pressable, TextInput } from '../AccessibleControls';
import { Modal } from '../AppModal';
import { styles } from './tabCharacterStyles';

// ── Number Prompt Modal (manual HP set / add temp HP) ─────────────────────────

export function NumberPromptModal({
  visible, title, label, confirmLabel, onConfirm, onClose,
}: {
  visible: boolean;
  title: string;
  label: string;
  confirmLabel: string;
  onConfirm: (n: number) => void;
  onClose: () => void;
}) {
  const [text, setText] = useState('');
  const insets = useSafeAreaInsets();
  const n = parseInt(text, 10);
  const valid = !isNaN(n) && n >= 0;

  function submit() {
    if (!valid) return;
    onConfirm(n);
    setText('');
    onClose();
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={[styles.concSheet, { paddingBottom: Math.max(insets.bottom, Spacing.md) }]} onPress={e => e.stopPropagation()}>
          <Text style={styles.concTitle}>{title}</Text>
          <Text style={styles.concSpell}>{label}</Text>
          <TextInput
            style={styles.numInput}
            value={text}
            onChangeText={setText}
            keyboardType="number-pad"
            placeholder="0"
            placeholderTextColor={Colors.textDim}
            autoFocus
          />
          <Pressable style={[styles.rollBtn, !valid && { opacity: 0.4 }]} onPress={submit} disabled={!valid}>
            <Text style={styles.rollBtnTxt}>{confirmLabel}</Text>
          </Pressable>
          <Pressable style={styles.closeBtnSm} onPress={onClose}>
            <Text style={styles.closeBtnSmTxt}>Cancel</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

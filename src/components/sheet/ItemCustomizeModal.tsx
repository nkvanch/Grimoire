// src/components/sheet/ItemCustomizeModal.tsx
// The pop-up behind "Customize" on an owned item: its name, description, uses (charges and when they come back) and what it does to
// ability scores ("sets Strength to 22"), and modes to switch between on the sheet. Saving makes the person's own homebrew copy of an official item, or changes their own
import { useEffect, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { ScrollView } from '../Lists';
import { Pressable, TextInput } from '../AccessibleControls';
import { Modal } from '../AppModal';
import { useEdited, closeAsking } from '../../hooks/useDiscardGuard';
import type { Item } from '../../engine/types';
import { itemEditsOf, type ItemEdits, type ItemRecharge } from '../../engine/itemCustomize';
import { AbilityChangesEditor, ModesEditor } from './AbilityModesEditor';
import { Colors, Spacing, Radius, FontSize, FontWeight } from '../../theme';
import { NAME_INPUT } from '../nameInput';

const RECHARGE_LABELS: [ItemRecharge, string][] = [['short_rest', 'Short rest'], ['long_rest', 'Long rest'], ['dawn', 'Dawn'], ['never', 'Never']];

interface Props {
  visible: boolean;
  item:    Item | null;
  /** true: the item is official and saving makes a copy. false: it is the person's own homebrew and is changed in place. */
  makesCopy: boolean;
  onSave:  (edits: ItemEdits) => void;
  onClose: () => void;
}

export function ItemCustomizeModal({ visible, item, makesCopy, onSave, onClose }: Props) {
  const [edits, setEdits] = useState<ItemEdits | null>(null);
  // bumped on every opening, so the ability boxes start again from the item
  const [opened, setOpened] = useState(0);
  const [usesText, setUsesText] = useState('');
  // Closing with edits asks first (src/hooks/useDiscardGuard.ts); an explicit Discard does not.
  const close = closeAsking(useEdited(() => edits, visible), onClose);

  useEffect(() => {
    if (!visible || !item) return;
    const start = itemEditsOf(item);
    setEdits(start);
    setOpened(n => n + 1);
    setUsesText(start.uses ? String(start.uses.maximum) : '');
  }, [visible, item]);

  if (!item || !edits) return null;
  const set = (patch: Partial<ItemEdits>) => setEdits({ ...edits, ...patch });
  const setUses = (text: string) => {
    setUsesText(text);
    const n = parseInt(text, 10);
    set({ uses: text.trim() === '' || Number.isNaN(n) || n <= 0 ? null : { maximum: n, recharge: edits.uses?.recharge ?? 'long_rest' } });
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={close}>
      <View style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={close} accessible={false} />
        <View style={styles.sheet}>
          <Text style={styles.title}>Customize item</Text>
          <Text style={styles.note}>
            {makesCopy
              ? 'Saves your own homebrew copy. The official item stays as it is, and this character gets your copy.'
              : 'This is your homebrew item: changes apply everywhere it is used.'}
          </Text>

          <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
            <Text style={styles.label}>Name</Text>
            <TextInput {...NAME_INPUT} testID="item-custom-name" accessibilityLabel="Item name" style={styles.input} value={edits.name} onChangeText={name => set({ name })} maxLength={80} />

            <Text style={styles.label}>Description</Text>
            <TextInput
              testID="item-custom-description" accessibilityLabel="Item description" style={[styles.input, styles.multiline]}
              value={edits.description} onChangeText={description => set({ description })} multiline textAlignVertical="top"
            />

            <Text style={styles.label}>Uses</Text>
            <View style={styles.usesRow}>
              <TextInput
                testID="item-custom-uses" accessibilityLabel="Number of uses, blank for none" style={[styles.input, styles.numBox]}
                value={usesText} onChangeText={setUses} keyboardType="number-pad" placeholder="none" placeholderTextColor={Colors.textDim}
              />
              <Text style={styles.hint}>{edits.uses ? 'uses, back on' : 'Leave blank if it has no uses'}</Text>
            </View>
            {edits.uses && (
              <View style={styles.chips}>
                {RECHARGE_LABELS.map(([id, label]) => (
                  <Pressable key={id} accessibilityRole="radio" accessibilityState={{ selected: edits.uses!.recharge === id }}
                    style={[styles.chip, edits.uses!.recharge === id && styles.chipOn]} onPress={() => set({ uses: { ...edits.uses!, recharge: id } })}>
                    <Text style={[styles.chipTxt, edits.uses!.recharge === id && styles.chipTxtOn]}>{label}</Text>
                  </Pressable>
                ))}
              </View>
            )}

            <Text style={styles.label}>Ability scores</Text>
            <Text style={styles.hint}>"Set to" makes the score that number while the item works, unless it is already higher (Belt of Giant Strength). "Add" changes it, and its minimum is as low as it can go.</Text>
            <AbilityChangesEditor key={`base-${opened}`} idPrefix="item-custom" value={edits.abilities} onChange={abilities => set({ abilities })} />

            <Text style={styles.label}>Modes</Text>
            <ModesEditor key={`modes-${opened}`} idPrefix="item-custom" modes={edits.modes} onChange={modes => set({ modes })} />
          </ScrollView>

          <View style={styles.buttons}>
            <Pressable style={styles.cancelBtn} onPress={close} accessibilityRole="button"><Text style={styles.cancelTxt}>Cancel</Text></Pressable>
            <Pressable testID="item-custom-save" style={styles.saveBtn} onPress={() => onSave(edits)} accessibilityRole="button">
              <Text style={styles.saveTxt}>{makesCopy ? 'Save my copy' : 'Save'}</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: '#000000cc', justifyContent: 'flex-end' },
  sheet: { backgroundColor: Colors.surfaceHigh, borderTopLeftRadius: Radius.lg, borderTopRightRadius: Radius.lg, padding: Spacing.md, gap: Spacing.sm, maxHeight: '92%' },
  title: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.gold, textAlign: 'center' },
  note:  { fontSize: FontSize.xs, color: Colors.textSecondary, textAlign: 'center' },
  scroll: { flexGrow: 0 },
  scrollContent: { gap: Spacing.xs, paddingBottom: Spacing.md },
  label: { fontSize: FontSize.xs, fontWeight: FontWeight.bold, color: Colors.textSecondary, letterSpacing: 1.5, marginTop: Spacing.sm, textTransform: 'uppercase' },
  hint:  { fontSize: FontSize.xs, color: Colors.textSecondary, flexShrink: 1 },
  input: {
    minHeight: 44, borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.md, backgroundColor: Colors.bg,
    color: Colors.textPrimary, fontSize: FontSize.md, paddingHorizontal: Spacing.sm,
  },
  multiline: { minHeight: 96, paddingTop: Spacing.sm },
  usesRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  numBox: { width: 64, textAlign: 'center', paddingHorizontal: 0 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.xs },
  chip: { minHeight: 44, paddingHorizontal: Spacing.md, borderRadius: Radius.full, borderWidth: 1, borderColor: Colors.border, justifyContent: 'center' },
  chipOn: { backgroundColor: Colors.gold, borderColor: Colors.gold },
  chipTxt: { color: Colors.textPrimary, fontSize: FontSize.sm },
  chipTxtOn: { color: Colors.bg, fontWeight: FontWeight.bold },
  buttons: { flexDirection: 'row', gap: Spacing.sm },
  cancelBtn: { flex: 1, minHeight: 48, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.border, alignItems: 'center', justifyContent: 'center' },
  cancelTxt: { color: Colors.textPrimary, fontWeight: FontWeight.bold, fontSize: FontSize.md },
  saveBtn: { flex: 1, minHeight: 48, borderRadius: Radius.md, backgroundColor: Colors.gold, alignItems: 'center', justifyContent: 'center' },
  saveTxt: { color: Colors.bg, fontWeight: FontWeight.bold, fontSize: FontSize.md },
});

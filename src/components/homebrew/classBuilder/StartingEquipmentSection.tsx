import { Dispatch, SetStateAction } from 'react';
import { View, Text } from 'react-native';
import { ItemIndexEntry } from '../../../content/itemRepo.types';
import { Colors, Spacing } from '../../../theme';
import { Pressable, TextInput } from '../../AccessibleControls';
import { styles } from './classBuilderStyles';

export function StartingEquipmentSection({ startingEquipment, removeStartingItem, equipSearch, setEquipSearch, equipResults, addStartingItem, equipmentNotes, setEquipmentNotes }: {
  startingEquipment: { id: string; name: string; }[];
  removeStartingItem: (id: string) => void;
  equipSearch: string;
  setEquipSearch: Dispatch<SetStateAction<string>>;
  equipResults: ItemIndexEntry[];
  addStartingItem: (id: string, name: string) => void;
  equipmentNotes: string;
  setEquipmentNotes: Dispatch<SetStateAction<string>>;
}) {
  return (
    <>
      {/* ── 3b. Starting Equipment ───────────────────────────── */}
      <View style={styles.divider} />
      <Text style={styles.fieldLabel}>Starting Equipment</Text>
      <Text style={styles.hint}>
        Fixed gear granted automatically — not a choice between options,
        just what this class always starts with.
      </Text>
      {startingEquipment.length > 0 && (
        <View style={styles.chipRow}>
          {startingEquipment.map(i => (
            <Pressable key={i.id} style={[styles.chip, styles.chipActive]} onPress={() => removeStartingItem(i.id)}>
              <Text style={[styles.chipTxt, styles.chipTxtActive]}>{i.name} ✕</Text>
            </Pressable>
          ))}
        </View>
      )}
      <TextInput style={styles.input} value={equipSearch} onChangeText={setEquipSearch}
        placeholder="Search items to add…" placeholderTextColor={Colors.textDim} />
      {equipResults.length > 0 && (
        <View style={styles.equipResults}>
          {equipResults.map(item => (
            <Pressable key={item.id} style={styles.equipResultRow} onPress={() => addStartingItem(item.id, item.name)}>
              <Text style={styles.equipResultTxt}>{item.name}</Text>
              <Text style={styles.equipResultAdd}>+ Add</Text>
            </Pressable>
          ))}
        </View>
      )}
      <Text style={[styles.fieldLabel, { marginTop: Spacing.sm }]}>Other Equipment Notes (optional)</Text>
      <Text style={styles.hint}>
        For gear that isn't a real item in the catalog — shown as flavor text only,
        not granted as an actual inventory item (there'd be nothing for it to resolve to).
      </Text>
      <TextInput style={[styles.input, styles.textArea]} value={equipmentNotes} onChangeText={setEquipmentNotes}
        placeholder="e.g. a set of masterwork lockpicks, a tattered field journal…"
        placeholderTextColor={Colors.textDim} multiline textAlignVertical="top" />
    </>
  );
}

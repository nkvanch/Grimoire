import { Dispatch, SetStateAction } from 'react';
import { View, StyleSheet, Text } from 'react-native';
import { ScrollView } from '../../Lists';
import { DurationTracker } from '../../../engine/types';
import { Colors } from '../../../theme';
import { Pressable, TextInput } from '../../AccessibleControls';
import { Modal } from '../../AppModal';
import { styles } from '../tabCharacterStyles';

export function ConditionPickerModal({ condModal, closeConditionFlow, pendingConditionId, condSearch, setCondSearch, filteredConds, setPendingConditionId, onAddCondition, setCondModal, setRoundsPromptOpen }: {
  condModal: boolean;
  closeConditionFlow: () => void;
  pendingConditionId: string | null;
  condSearch: string;
  setCondSearch: Dispatch<SetStateAction<string>>;
  filteredConds: string[];
  setPendingConditionId: Dispatch<SetStateAction<string | null>>;
  onAddCondition: (id: string, duration: DurationTracker | null) => void;
  setCondModal: Dispatch<SetStateAction<boolean>>;
  setRoundsPromptOpen: Dispatch<SetStateAction<boolean>>;
}) {
  return (
    <>
      {/* Condition Picker Modal */}
      <Modal visible={condModal} transparent animationType="slide" onRequestClose={closeConditionFlow}>
        <View style={styles.backdrop}>
          {/* SCROLL-TOUCH-1: backdrop is a sibling, not an ancestor, of the sheet (see TabInventory AddItemModal) */}
          <Pressable style={StyleSheet.absoluteFill} onPress={closeConditionFlow} accessible={false} />
          <View style={styles.condPickerSheet}>
            {pendingConditionId === null ? (
              <>
                <Text style={styles.condPickerTitle}>Add Condition</Text>
                <TextInput
                  style={styles.condSearch}
                  value={condSearch}
                  onChangeText={setCondSearch}
                  placeholder="Search conditions…"
                  placeholderTextColor={Colors.textDim}
                />
                <ScrollView>
                  {filteredConds.map(c => (
                    <Pressable key={c} style={styles.condPickerItem} onPress={() => setPendingConditionId(c)}>
                      <Text style={styles.condPickerItemTxt}>{c}</Text>
                    </Pressable>
                  ))}
                  {filteredConds.length === 0 && (
                    <Text style={styles.emptyNote}>No conditions found</Text>
                  )}
                </ScrollView>
                <Pressable style={styles.cancelBtn} onPress={closeConditionFlow}>
                  <Text style={styles.cancelTxt}>Cancel</Text>
                </Pressable>
              </>
            ) : (
              <>
                <Text style={styles.condPickerTitle}>How long — {pendingConditionId}?</Text>
                <Pressable
                  style={styles.condPickerItem}
                  onPress={() => { onAddCondition(pendingConditionId, null); closeConditionFlow(); }}
                >
                  <Text style={styles.condPickerItemTxt}>Permanent</Text>
                </Pressable>
                <Pressable
                  style={styles.condPickerItem}
                  onPress={() => { onAddCondition(pendingConditionId, { unit: 'until_rest', remaining: 0 }); closeConditionFlow(); }}
                >
                  <Text style={styles.condPickerItemTxt}>Until Next Rest</Text>
                </Pressable>
                <Pressable
                  style={styles.condPickerItem}
                  onPress={() => { setCondModal(false); setRoundsPromptOpen(true); }}
                >
                  <Text style={styles.condPickerItemTxt}>N Rounds…</Text>
                </Pressable>
                <Pressable style={styles.cancelBtn} onPress={() => setPendingConditionId(null)}>
                  <Text style={styles.cancelTxt}>Back</Text>
                </Pressable>
              </>
            )}
          </View>
        </View>
      </Modal>
    </>
  );
}

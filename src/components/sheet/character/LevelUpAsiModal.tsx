import { Dispatch, SetStateAction } from 'react';
import { View, Text } from 'react-native';
import { Entity, CampaignRules } from '../../../engine/types';
import { Pressable } from '../../AccessibleControls';
import { Modal } from '../../AppModal';
import { AsiFeatPicker } from '../../AsiFeatPicker';
import { styles } from '../tabCharacterStyles';

export function LevelUpAsiModal({ levelUpAsiOpen, setLevelUpAsiOpen, entity, rules, onEntityUpdate }: {
  levelUpAsiOpen: boolean;
  setLevelUpAsiOpen: Dispatch<SetStateAction<boolean>>;
  entity: Entity;
  rules: CampaignRules;
  onEntityUpdate: (updated: Entity) => void;
}) {
  return (
    <>
      {/* Level-up ASI / Feat picker */}
      <Modal visible={levelUpAsiOpen} animationType="slide" onRequestClose={() => setLevelUpAsiOpen(false)}>
        <View style={styles.lvModalRoot}>
          {(() => {
            const pending = entity.choices.filter(c => c.definition.kind === 'asi' && !c.resolved);
            if (pending.length === 0) {
              return (
                <View style={styles.lvDone}>
                  <Text style={styles.lvDoneTxt}>All set — no improvements to resolve.</Text>
                  <Pressable style={styles.lvDoneBtn} onPress={() => setLevelUpAsiOpen(false)}>
                    <Text style={styles.lvDoneBtnTxt}>Done</Text>
                  </Pressable>
                </View>
              );
            }
            return (
              <AsiFeatPicker
                entity={entity}
                choice={pending[0]}
                rules={rules}
                onClose={() => setLevelUpAsiOpen(false)}
                onResolved={(updated) => {
                  onEntityUpdate(updated);
                  const more = updated.choices.some(c => c.definition.kind === 'asi' && !c.resolved);
                  if (!more) setLevelUpAsiOpen(false);
                }}
                browseStateKey="feat:levelup"
              />
            );
          })()}
        </View>
      </Modal>
    </>
  );
}

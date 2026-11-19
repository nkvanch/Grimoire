import { Dispatch, SetStateAction } from 'react';
import { View } from 'react-native';
import { Entity, CampaignRules } from '../../../engine/types';
import { Modal } from '../../AppModal';
import { AsiFeatPicker } from '../../AsiFeatPicker';
import { styles } from '../tabCharacterStyles';

export function AddFeatModal({ addFeatOpen, setAddFeatOpen, entity, rules, onEntityUpdate }: {
  addFeatOpen: boolean;
  setAddFeatOpen: Dispatch<SetStateAction<boolean>>;
  entity: Entity;
  rules: CampaignRules;
  onEntityUpdate: (updated: Entity) => void;
}) {
  return (
    <>
      {/* Add a feat ad-hoc from the sheet */}
      <Modal visible={addFeatOpen} animationType="slide" onRequestClose={() => setAddFeatOpen(false)}>
        <View style={styles.lvModalRoot}>
          <AsiFeatPicker
            entity={entity}
            choice={makeAdHocFeatChoice()}
            rules={rules}
            featOnly
            onClose={() => setAddFeatOpen(false)}
            onResolved={(updated) => {
              onEntityUpdate(updated);
              setAddFeatOpen(false);
            }}
            browseStateKey="feat:live"
          />
        </View>
      </Modal>
    </>
  );
}

// ── Ad-hoc feat choice ────────────────────────────────────────────────────────

/**
 * Synthesizes a one-off ASI/feat ChoiceState so a player can take a feat
 * directly from the sheet (outside the normal level-up flow). The picker in
 * featOnly mode resolves a feat against this choice; applyFeatToEntity records
 * it as a resolved choice on the entity.
 */
export function makeAdHocFeatChoice(): import('../../../engine/types').ChoiceState {
  const id = `adhoc_feat_${Date.now().toString(36)}`;
  return {
    id,
    grantedAt: 0,
    resolved: false,
    selections: [],
    definition: {
      id,
      prompt: 'Take a feat',
      kind: 'asi',
      count: 1,
      pool: 'all',
      grants: [],
      required: false,
      resolved: false,
    },
  };
}

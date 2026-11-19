import { View, StyleSheet, Text } from 'react-native';
import { ScrollView } from '../Lists';
import { isFeatureAvailable } from '../../engine/actionCardAvailability';
import { Entity, ActionCard, ActivationOption } from '../../engine/types';
import { Spacing } from '../../theme';
import { Pressable } from '../AccessibleControls';
import { Modal } from '../AppModal';
import { styles } from './tabActionsStyles';

// ── Activation option picker (A-57) ────────────────────────────────────────────
// Shown BEFORE spending, when a card's activation declares multiple discrete
// ways to use it (e.g. Divine Smite's spell-slot tier choice). Picking an
// option is what triggers applyActionCardUse — see handleChooseOption above.

interface ActivationOptionModalProps {
  entity: Entity;
  card:     ActionCard | null;
  onChoose: (option: ActivationOption) => void;
  onClose:  () => void;
  /**
   * Rules-engine HIGH-batch closure (C7): the SAME `bypassIncapacitated`
   * decision the player already made (before this picker opened) —
   * threaded through so an option row isn't disabled a SECOND time by the
   * exact status restriction they already agreed to override. Never
   * bypasses a genuinely missing resource/payment for that option.
   */
  bypassIncapacitated?: boolean;
}

export function ActivationOptionModal({ entity, card, onChoose, onClose, bypassIncapacitated }: ActivationOptionModalProps) {
  if (!card || !card.activation.options || card.activation.options.length === 0) return null;
  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      {/* Sibling backdrop and a plain-View sheet, so the option list can scroll (SCROLL-TOUCH-1). */}
      <View style={styles.modalOverlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={styles.modalSheet}>
          <Text style={styles.modalName}>{card.name}</Text>
          <Text style={styles.modalL1}>Choose how to use this:</Text>
          {/* A long list (Wild Shape lists every form the level allows) scrolls inside the sheet. */}
          <ScrollView style={{ maxHeight: 420 }} contentContainerStyle={{ gap: Spacing.sm }}>
            {card.activation.options.map(opt => (
              <Pressable key={opt.id} style={styles.optionRow}
                disabled={!isFeatureAvailable({ activation: { ...card.activation, options: undefined,
                  resourceCost: opt.resourceCost ?? card.resourceCost } }, entity, bypassIncapacitated).available}
                onPress={() => onChoose(opt)}>
                <Text style={styles.optionLabel}>{opt.label}</Text>
                {opt.description && <Text style={styles.optionDesc}>{opt.description}</Text>}
              </Pressable>
            ))}
          </ScrollView>
          <Pressable style={styles.closeBtn} onPress={onClose}>
            <Text style={styles.closeBtnTxt}>Cancel</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

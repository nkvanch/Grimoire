import { useState } from 'react';
import { Text, View } from 'react-native';
import { recomputeDerived } from '../../engine/pipeline';
import { Entity, CampaignRules } from '../../engine/types';
import { Colors } from '../../theme';
import { Pressable, TextInput } from '../AccessibleControls';
import { Modal } from '../AppModal';
import { styles } from './tabCharacterStyles';

export type MoveType = 'fly' | 'swim' | 'climb' | 'burrow';
export const MOVE_TYPE_LABELS: Record<MoveType, string> = { fly: 'Fly', swim: 'Swim', climb: 'Climb', burrow: 'Burrow' };
export const MOVE_TYPE_OPTIONS: MoveType[] = ['climb', 'swim', 'fly', 'burrow'];
export const MANUAL_MOVEMENT_FEATURE_ID = 'manual_movement';

// ── Movement editor modal ─────────────────────────────────────────────────────
// Same pattern as manual senses above — a mid-session grant (gained a
// climbing speed from an in-game event) that isn't coming from a
// race/feat/item the content pipeline already knows about.
type ManualMove = { type: MoveType; range: number };
function readManualMovement(entity: Entity): ManualMove[] {
  const f = entity.features.find(ft => ft.id === MANUAL_MOVEMENT_FEATURE_ID);
  if (!f) return [];
  return (f.effects ?? [])
    .filter(e => e.type === 'grant_movement' && e.movementType)
    .map(e => ({ type: e.movementType as MoveType, range: e.movementRange ?? 0 }));
}
function writeManualMovement(entity: Entity, moves: ManualMove[], rules: CampaignRules): Entity {
  const effects = moves.map(m => ({
    type: 'grant_movement' as const, target: 'movement', operation: 'add' as const,
    value: null, condition: null,
    movementType: m.type, movementRange: m.range,
  }));
  const others = entity.features.filter(ft => ft.id !== MANUAL_MOVEMENT_FEATURE_ID);
  const updatedFeatures = effects.length === 0 ? others : [...others, {
    id: MANUAL_MOVEMENT_FEATURE_ID, name: 'Movement', description: 'Player-set movement speeds.',
    source: { kind: 'campaign' as const, refId: MANUAL_MOVEMENT_FEATURE_ID },
    level: null, effects, actions: [], choices: [], passive: true, isActive: true,
  }];
  return recomputeDerived({ ...entity, features: updatedFeatures }, rules);
}

export function MovementModal({
  visible, entity, rules, onUpdate, onClose,
}: {
  visible: boolean;
  entity: Entity;
  rules: CampaignRules;
  onUpdate: (u: Entity) => void;
  onClose: () => void;
}) {
  const manual = readManualMovement(entity);
  const [type, setType] = useState<MoveType>('climb');
  const [range, setRange] = useState('30');

  function addMove() {
    const r = parseInt(range, 10);
    if (isNaN(r) || r <= 0) return;
    onUpdate(writeManualMovement(entity, [...manual.filter(m => m.type !== type), { type, range: r }], rules));
  }
  function removeMove(t: MoveType) {
    onUpdate(writeManualMovement(entity, manual.filter(m => m.type !== t), rules));
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.condPickerSheet} onPress={e => e.stopPropagation()}>
          <Text style={styles.condPickerTitle}>Movement</Text>
          <Text style={styles.emptyNote}>
            Walking speed comes from your race/class — this is for extra movement
            types (climbing, swimming, flying, burrowing) gained mid-campaign.
          </Text>

          {manual.length > 0 && (
            <View style={styles.senseChips}>
              {manual.map(m => (
                <View key={m.type} style={styles.senseChip}>
                  <Text style={styles.senseChipTxt}>{MOVE_TYPE_LABELS[m.type]} {m.range}ft</Text>
                  <Pressable onPress={() => removeMove(m.type)} hitSlop={8}>
                    <Text style={styles.condX}>✕</Text>
                  </Pressable>
                </View>
              ))}
            </View>
          )}

          <View style={styles.senseTypeRow}>
            {MOVE_TYPE_OPTIONS.map(t => (
              <Pressable
                key={t}
                style={[styles.senseTypeChip, type === t && styles.senseTypeChipActive]}
                onPress={() => setType(t)}
              >
                <Text style={[styles.senseTypeTxt, type === t && styles.senseTypeTxtActive]}>
                  {MOVE_TYPE_LABELS[t]}
                </Text>
              </Pressable>
            ))}
          </View>

          <View style={styles.senseInputRow}>
            <TextInput
              style={[styles.condSearch, { flex: 1 }]}
              value={range}
              onChangeText={setRange}
              keyboardType="number-pad"
              placeholder="Speed (ft)"
              placeholderTextColor={Colors.textDim}
            />
          </View>

          <Pressable style={styles.rollBtn} onPress={addMove}>
            <Text style={styles.rollBtnTxt}>Add / Update Speed</Text>
          </Pressable>
          <Pressable style={styles.cancelBtn} onPress={onClose}>
            <Text style={styles.cancelTxt}>Done</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

import { Text, View } from 'react-native';
import { useState } from 'react';
import { recomputeDerived } from '../../engine/pipeline';
import { Entity, CampaignRules } from '../../engine/types';
import { styles } from './tabCharacterStyles';
import { Modal } from '../AppModal';
import { Pressable, TextInput } from '../AccessibleControls';
import { Colors } from '../../theme';

// Display labels for the four structured sense types.
export const SENSE_LABELS: Record<string, string> = {
  darkvision:  'Darkvision',
  blindsight:  'Blindsight',
  tremorsense: 'Tremorsense',
  truesight:   'Truesight',
};

// ── Senses editor modal ───────────────────────────────────────────────────────

const MANUAL_SENSES_FEATURE_ID = 'manual_senses';
export const SENSE_TYPE_OPTIONS: import('../../engine/types').SenseType[] =
  ['darkvision', 'blindsight', 'tremorsense', 'truesight'];

/**
 * Reads the player-managed senses from the dedicated manual-senses feature
 * (source.kind 'campaign', id 'manual_senses'). These are the senses the player
 * can add/remove here; senses granted by race/feat/item features are aggregated
 * separately by the pipeline and shown read-only.
 */
export function readManualSenses(entity: Entity): import('../../engine/types').Sense[] {
  const f = entity.features.find(ft => ft.id === MANUAL_SENSES_FEATURE_ID);
  if (!f) return [];
  return (f.effects ?? [])
    .filter(e => e.type === 'grant_sense' && e.senseType)
    .map(e => ({ type: e.senseType!, range: e.senseRange ?? 0, note: e.senseNote }));
}

/** Writes the manual senses back onto the manual-senses feature (replacing it). */
export function writeManualSenses(
  entity: Entity,
  senses: import('../../engine/types').Sense[],
  rules: CampaignRules,
): Entity {
  const effects = senses.map(s => ({
    type: 'grant_sense' as const,
    target: 'senses',
    operation: 'add' as const,
    value: null,
    condition: null,
    senseType: s.type,
    senseRange: s.range,
    senseNote: s.note,
  }));
  const others = entity.features.filter(ft => ft.id !== MANUAL_SENSES_FEATURE_ID);
  const updatedFeatures = effects.length === 0
    ? others
    : [...others, {
        id: MANUAL_SENSES_FEATURE_ID,
        name: 'Senses',
        description: 'Player-set senses.',
        source: { kind: 'campaign' as const, refId: MANUAL_SENSES_FEATURE_ID },
        level: null,
        effects,
        actions: [],
        choices: [],
        passive: true,
        isActive: true,
      }];
  return recomputeDerived({ ...entity, features: updatedFeatures }, rules);
}

export function SensesModal({
  visible, entity, rules, onUpdate, onClose,
}: {
  visible: boolean;
  entity: Entity;
  rules: CampaignRules;
  onUpdate: (u: Entity) => void;
  onClose: () => void;
}) {
  const manual = readManualSenses(entity);
  const [type, setType] = useState<import('../../engine/types').SenseType>('darkvision');
  const [range, setRange] = useState('60');
  const [note, setNote] = useState('');

  function addSense() {
    const r = parseInt(range, 10);
    if (isNaN(r) || r <= 0) return;
    // Replace any existing manual sense of the same type.
    const next = [
      ...manual.filter(s => s.type !== type),
      { type, range: r, note: note.trim() || undefined },
    ];
    onUpdate(writeManualSenses(entity, next, rules));
    setNote('');
  }

  function removeSense(t: string) {
    onUpdate(writeManualSenses(entity, manual.filter(s => s.type !== t), rules));
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.condPickerSheet} onPress={e => e.stopPropagation()}>
          <Text style={styles.condPickerTitle}>Senses</Text>

          {/* Current manual senses */}
          {manual.length > 0 && (
            <View style={styles.senseChips}>
              {manual.map(s => (
                <View key={s.type} style={styles.senseChip}>
                  <Text style={styles.senseChipTxt}>
                    {SENSE_LABELS[s.type]} {s.range}ft{s.note ? ` · ${s.note}` : ''}
                  </Text>
                  <Pressable onPress={() => removeSense(s.type)} hitSlop={8}>
                    <Text style={styles.condX}>✕</Text>
                  </Pressable>
                </View>
              ))}
            </View>
          )}

          {/* Type selector */}
          <View style={styles.senseTypeRow}>
            {SENSE_TYPE_OPTIONS.map(t => (
              <Pressable
                key={t}
                style={[styles.senseTypeChip, type === t && styles.senseTypeChipActive]}
                onPress={() => setType(t)}
              >
                <Text style={[styles.senseTypeTxt, type === t && styles.senseTypeTxtActive]}>
                  {SENSE_LABELS[t]}
                </Text>
              </Pressable>
            ))}
          </View>

          {/* Range + note */}
          <View style={styles.senseInputRow}>
            <TextInput
              style={[styles.condSearch, { flex: 1 }]}
              value={range}
              onChangeText={setRange}
              keyboardType="number-pad"
              placeholder="Range (ft)"
              placeholderTextColor={Colors.textDim}
            />
            <TextInput
              style={[styles.condSearch, { flex: 2 }]}
              value={note}
              onChangeText={setNote}
              placeholder="Note (e.g. in color, heat)"
              placeholderTextColor={Colors.textDim}
            />
          </View>

          <Pressable style={styles.rollBtn} onPress={addSense}>
            <Text style={styles.rollBtnTxt}>Add / Update Sense</Text>
          </Pressable>
          <Pressable style={styles.cancelBtn} onPress={onClose}>
            <Text style={styles.cancelTxt}>Done</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

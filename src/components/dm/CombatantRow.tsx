import { useState } from 'react';
import { View, Text } from 'react-native';
import { InitiativeEntry } from '../../engine/combat';
import { Entity } from '../../engine/types';
import { Colors } from '../../theme';
import { Pressable, TextInput } from '../AccessibleControls';
import { entityDmHidden, entityCombatantNotes } from './encounterEntity';
import { styles } from './encounterStyles';

// ── Combatant Row ─────────────────────────────────────────────────────────────

interface CombatantRowProps {
  entry:      InitiativeEntry;
  entity:     Entity | undefined;
  isCurrent:  boolean;
  isSelected?: boolean;
  onPress:    () => void;
  /** Manual reorder — wires combatStore's own pre-existing setOrder action,
   *  which had zero UI consumer anywhere (audit finding S9-03) despite
   *  being fully implemented and documented as "DM drag-to-reorder".
   *  Simple up/down swap rather than a drag gesture — smaller, safer
   *  addition that still closes the actual gap (no way to manually
   *  reorder initiative at all). undefined at a list boundary (nothing to
   *  swap with) hides that direction's button instead of disabling it. */
  onMoveUp?:   () => void;
  onMoveDown?: () => void;
  /** Table-first initiative: tapping the number opens an inline editor that
   *  calls setInitiative directly — this row's own primary path for
   *  entering a table-rolled result. Both are always supplied by the
   *  active-combat view (undefined only if a future caller reuses this row
   *  read-only). */
  onSetInitiative?:  (value: number) => void;
  /** Secondary convenience — rolls just this one combatant's initiative
   *  in app, then calls onSetInitiative with the result so both paths
   *  funnel through the exact same store mutation. */
  onRollInitiative?: () => void;
}

export function CombatantRow({ entry, entity, isCurrent, isSelected, onPress, onMoveUp, onMoveDown, onSetInitiative, onRollInitiative }: CombatantRowProps) {
  const hp     = entity?.resources.hp;
  const hpPct  = hp && hp.maximum > 0 ? hp.current / hp.maximum : 0;

  // Player-facing visibility: Bloodied / Healthy / Dead only
  const isMonster = entity?.kind === 'monster';
  const isDead    = hp ? hp.current <= 0 : false;
  const isBloodied = hp ? hp.current < hp.maximum / 2 : false;

  const statusLabel = isDead ? '💀 Dead'
    : isBloodied ? '🩸 Bloodied'
    : '✅ Healthy';

  const hpColor = hpPct > 0.5 ? Colors.green : hpPct > 0.25 ? Colors.gold : Colors.red;

  // Table-first initiative entry: tap the number to open a small inline
  // input (same shape as QuickPanel's damage/heal numeric input), submit to
  // call setInitiative directly. This is the PRIMARY path — entering a
  // table-rolled result. The 🎲 button next to it is the secondary in-app
  // convenience, and calls the exact same onSetInitiative with its result,
  // so both paths share one mutation (setInitiative), never two.
  const [editing, setEditing] = useState(false);
  const [draft,   setDraft]   = useState(String(entry.initiative));

  function submitEdit() {
    const value = parseInt(draft, 10);
    if (!isNaN(value) && onSetInitiative) onSetInitiative(value);
    setEditing(false);
  }

  return (
    <Pressable
      style={[styles.combatantRow, isCurrent && styles.combatantRowActive, isSelected && styles.combatantRowSelected]}
      onPress={onPress}
    >
      {editing ? (
        <View style={styles.initEditBox}>
          <TextInput
            style={styles.initEditInput}
            value={draft}
            onChangeText={setDraft}
            keyboardType="number-pad"
            autoFocus
            selectTextOnFocus
            onBlur={submitEdit}
            onSubmitEditing={submitEdit}
          />
        </View>
      ) : (
        <Pressable
          style={styles.initBox}
          disabled={!onSetInitiative}
          onPress={() => { setDraft(String(entry.initiative)); setEditing(true); }}
        >
          <Text style={styles.initNum}>{entry.initiative}</Text>
        </Pressable>
      )}

      {onRollInitiative && !editing && (
        <Pressable hitSlop={8} style={styles.initRollBtn} onPress={onRollInitiative}>
          <Text style={styles.initRollBtnTxt}>🎲</Text>
        </Pressable>
      )}

      <View style={styles.combatantInfo}>
        <Text style={styles.combatantName}>
          {isSelected ? '☑ ' : ''}{entity && entityDmHidden(entity) ? '🔒 ' : ''}{entry.name}
        </Text>
        {entity && entityCombatantNotes(entity) && (
          <Text style={styles.combatantNotesTxt} numberOfLines={1}>📝 {entityCombatantNotes(entity)}</Text>
        )}
        {entity && (
          <View style={styles.combatantStatus}>
            {/* DM sees full HP; players see status label only */}
            {!isMonster && hp && (
              <View style={styles.hpBarOuter}>
                <View style={[styles.hpBarFill, {
                  width: `${Math.round(Math.max(0,Math.min(1,hpPct))*100)}%` as any,
                  backgroundColor: hpColor,
                }]} />
              </View>
            )}
            <Text style={styles.statusLbl}>{statusLabel}</Text>
            {/* Conditions */}
            {entity.conditions.slice(0,3).map(c => (
              <View key={c.id} style={styles.condChip}>
                <Text style={styles.condChipTxt}>{c.id.slice(0,6)}</Text>
              </View>
            ))}
          </View>
        )}
      </View>

      {(onMoveUp || onMoveDown) && (
        <View style={styles.reorderBtns}>
          <Pressable hitSlop={8} disabled={!onMoveUp} onPress={onMoveUp} style={!onMoveUp && styles.reorderBtnHidden}>
            <Text style={styles.reorderBtnTxt}>▲</Text>
          </Pressable>
          <Pressable hitSlop={8} disabled={!onMoveDown} onPress={onMoveDown} style={!onMoveDown && styles.reorderBtnHidden}>
            <Text style={styles.reorderBtnTxt}>▼</Text>
          </Pressable>
        </View>
      )}

      {isCurrent && (
        <View style={styles.currentIndicator}>
          <Text style={styles.currentIndicatorTxt}>▶</Text>
        </View>
      )}
    </Pressable>
  );
}

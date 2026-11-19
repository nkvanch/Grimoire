import { Dispatch, SetStateAction } from 'react';
import { View, Text } from 'react-native';
import { DerivedStats } from '../../../engine/types';
import { Pressable } from '../../AccessibleControls';
import { MOVE_TYPE_LABELS } from '../MovementModal';
import { SENSE_LABELS } from '../SensesModal';
import { styles } from '../tabCharacterStyles';

export function AttacksSection({ weapons, derived, setMovementOpen, setSensesOpen }: {
  weapons: { itemId: string; name: string; attackBonus: number; damage: string; isRanged: boolean; }[];
  derived: DerivedStats;
  setMovementOpen: Dispatch<SetStateAction<boolean>>;
  setSensesOpen: Dispatch<SetStateAction<boolean>>;
}) {
  return (
    <>
      {/* Weapon Attacks */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>ATTACKS</Text>
        {weapons.length === 0 ? (
          <Text style={styles.emptyNote}>No weapons equipped</Text>
        ) : (
          weapons.map(w => (
            <View key={w.itemId} style={styles.weaponRow}>
              <View style={styles.weaponInfo}>
                <Text style={styles.weaponName}>{w.name}</Text>
                <Text style={styles.weaponDamage}>{w.damage}</Text>
              </View>
              <View style={styles.weaponRight}>
                <Text style={styles.weaponBonus}>
                  {w.attackBonus >= 0 ? `+${w.attackBonus}` : String(w.attackBonus)}
                </Text>
                <View style={[styles.weaponBadge, w.isRanged && styles.weaponBadgeRanged]}>
                  <Text style={styles.weaponBadgeTxt}>{w.isRanged ? 'Ranged' : 'Melee'}</Text>
                </View>
              </View>
            </View>
          ))
        )}
      </View>

      {/* Movement types — fly/swim/climb/burrow, visible in combat too since
          "can I climb this wall to escape" is a combat-turn decision. Walking
          speed alone stays in the AC/Speed/Init/Perc stat row above. */}
      {(() => {
        const mv = derived.movement;
        const extraMoves = (['fly', 'swim', 'climb', 'burrow'] as const)
          .filter(t => (mv[t] ?? 0) > 0)
          .map(t => ({ type: t, value: mv[t]! }));
        return (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>MOVEMENT</Text>
              <Pressable style={styles.sectionActionBtn} onPress={() => setMovementOpen(true)}>
                <Text style={styles.sectionActionTxt}>✎ Edit</Text>
              </Pressable>
            </View>
            {extraMoves.length === 0 ? (
              <Text style={styles.emptyNote}>Walking speed only</Text>
            ) : (
              <View style={styles.senseChips}>
                {extraMoves.map(m => (
                  <View key={m.type} style={styles.senseChip}>
                    <Text style={styles.senseChipTxt}>{MOVE_TYPE_LABELS[m.type]} {m.value}ft</Text>
                  </View>
                ))}
              </View>
            )}
          </View>
        );
      })()}

      {/* Senses — visible in combat too (not just Exploration), since knowing
          your darkvision/blindsight range matters mid-fight (fighting in
          darkness, tracking an invisible enemy, etc.). */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>SENSES</Text>
          <Pressable style={styles.sectionActionBtn} onPress={() => setSensesOpen(true)}>
            <Text style={styles.sectionActionTxt}>✎ Edit</Text>
          </Pressable>
        </View>
        {derived.senses.length === 0 ? (
          <Text style={styles.emptyNote}>Normal vision only</Text>
        ) : (
          <View style={styles.senseChips}>
            {derived.senses.map(s => (
              <View key={s.type} style={styles.senseChip}>
                <Text style={styles.senseChipTxt}>
                  {SENSE_LABELS[s.type]} {s.range}ft{s.note ? ` · ${s.note}` : ''}
                </Text>
              </View>
            ))}
          </View>
        )}
      </View>
    </>
  );
}

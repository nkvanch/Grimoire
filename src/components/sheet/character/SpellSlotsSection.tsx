import { View, Text } from 'react-native';
import { SpellcastingBlock } from '../../../engine/types';
import { Pressable } from '../../AccessibleControls';
import { styles } from '../tabCharacterStyles';

export function SpellSlotsSection({ spellcasting, SLOT_TIERS, onSpendSlot, onRestoreSlot }: {
  spellcasting: SpellcastingBlock | null;
  SLOT_TIERS: readonly ["1", "2", "3", "4", "5", "6", "7", "8", "9"];
  onSpendSlot: (tier: string, kind?: "normal" | "pact") => void;
  onRestoreSlot: (tier: string, kind?: "normal" | "pact") => void;
}) {
  return (
    <>
      {/* Spell Slots */}
      {spellcasting && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>SPELL SLOTS</Text>
          <View style={styles.slotGrid}>
            {(['normal', 'pact'] as const).flatMap(kind => SLOT_TIERS.map(tier => ({ kind, tier }))).map(({ kind, tier }) => {
              const slot = (kind === 'pact' ? spellcasting.pactSlots : spellcasting.slots)?.[tier];
              if (!slot || slot.total === 0) return null;
              return (
                <View key={kind + tier} style={styles.slotBlock}>
                  <Text style={styles.slotTier}>{kind === 'pact' ? 'Pact · ' : ''}Lv {tier}</Text>
                  {/* Re-audit closure item 1: pips are spend-ONLY now — tapping
                      any pip always spends one slot (a no-op once fully
                      exhausted, since spendSpellSlot's own invariant refuses
                      to spend past total). Restoration is a deliberate,
                      separate action via the explicit "+" button below (same
                      pattern the RESOURCES section above already uses for
                      its own −/+ controls) — never triggered by an ordinary
                      pip tap, so casually tapping an exhausted slot row can
                      no longer silently heal a slot back. */}
                  <View style={styles.slotPips}>
                    {Array.from({ length: slot.total }).map((_, i) => (
                      <Pressable
                        key={i}
                        hitSlop={10}
                        style={[styles.pip2, i < slot.used && styles.pip2Used]}
                        onPress={() => onSpendSlot(tier, kind)}
                      />
                    ))}
                  </View>
                  <View style={styles.slotCountRow}>
                    <Pressable
                      hitSlop={8}
                      style={styles.slotRestoreBtn}
                      disabled={slot.used === 0}
                      onPress={() => onRestoreSlot(tier, kind)}
                      accessibilityLabel={`Restore a level ${tier} slot`}
                    >
                      <Text style={[styles.slotRestoreBtnTxt, slot.used === 0 && styles.disabled]}>+</Text>
                    </Pressable>
                    <Text style={styles.slotCount}>{slot.total - slot.used}/{slot.total}</Text>
                  </View>
                </View>
              );
            })}
          </View>
        </View>
      )}
    </>
  );
}

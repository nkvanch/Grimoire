import { useState, useEffect } from 'react';
import { View, Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { doubleDiceCount, readableExpression } from '../../engine/dice';
import { ActionCard, SpellCastingContext, RiderOffer, OutcomeOffer, DiceRoll } from '../../engine/types';
import { useDiceLogStore } from '../../store/diceLogStore';
import { Spacing } from '../../theme';
import { Pressable } from '../AccessibleControls';
import { Modal } from '../AppModal';
import { ManualRollInput } from '../ManualRollInput';
import { actionCardIdentity, CARD_COLORS } from './actionCardUi';
import { styles } from './tabActionsStyles';

/**
 * Rules-engine blocker RE-AUDIT closure (2F — activation-option context
 * preservation): the transient UI/application state for a cast that's
 * paused waiting on an activation-option choice. Codex found that choosing
 * a casting source (and/or a preparation Cast Anyway decision) BEFORE the
 * option picker opened was silently discarded — the old flow only
 * remembered the bare `card`, so `handleChooseOption` always executed with
 * bypassSpellPreparation/selectedSpellCastingContext both undefined,
 * re-prompting or wrongly blocking a cast the player had already resolved.
 * This is deliberately local component state, not persisted anywhere on
 * the character.
 */
export type PendingActionUse = {
  card: ActionCard;
  bypassSpellPreparation?: boolean;
  selectedSpellCastingContext?: SpellCastingContext;
  /**
   * Rules-engine HIGH-batch closure (C7/C8): the SAME `bypassIncapacitated`
   * flag applyActionCardUse accepts (actionUse.ts) — carried alongside the
   * card exactly like bypassSpellPreparation above, so a "Use Anyway"
   * decision made before an activation-option picker opens survives into
   * handleChooseOption instead of being silently discarded (the same bug
   * class closure 2F already fixed for bypassSpellPreparation).
   */
  bypassIncapacitated?: boolean;
  /** Rules-completeness batch (ritual casting): the SAME `castMode`
   *  decision already made before the activation-option picker opened —
   *  carried alongside every other already-resolved decision here so it
   *  survives into handleChooseOption, exactly like bypassSpellPreparation/
   *  bypassIncapacitated above (same bug class those two already fixed). */
  castMode?: 'ritual';
};

// ── Use Result Modal ──────────────────────────────────────────────────────────

export interface UseModalProps {
  card:    ActionCard | null;
  /** Riders from the character's features that can ride this attack or spell, with whether each can be used now. */
  riders?: RiderOffer[];
  /** Uses one: spends its cost and records the use. The extra damage is rolled by the player alongside the card's own. */
  onApplyRider?: (offer: RiderOffer) => void;
  /** Outcomes of this use waiting on the table (it hit, the save failed): press the one that happened. */
  outcomeOffers?: OutcomeOffer[];
  onConfirmOutcome?: (offer: OutcomeOffer) => void;
  /** None of them happened. */
  onDismissOutcomes?: () => void;
  /** `crit` (item 11 — roll improvements): true when the player has toggled
   *  "Critical Hit" before rolling — the caller is responsible for doubling
   *  the dice portion (dice.ts's doubleDiceCount) before rolling, not this
   *  modal, since only the caller knows which expression is actually being
   *  rolled and how to log it. */
  onRoll:  (crit: boolean) => DiceRoll | null;
  onClose: () => void;
}

export function UseModal({ card, riders, onApplyRider, outcomeOffers, onConfirmOutcome, onDismissOutcomes, onRoll, onClose }: UseModalProps) {
  const insets = useSafeAreaInsets();
  const [result, setResult] = useState<DiceRoll | null>(null);
  const [crit, setCrit] = useState(false);
  const [attack, setAttack] = useState<DiceRoll | null>(null);
  const [applied, setApplied] = useState<RiderOffer[]>([]);

  // Reset the stored roll whenever the modal switches to a different card (or
  // closes). Without this, the previous spell's result lingers: the modal shows
  // a stale number and the `!result` guard hides the fresh Roll button, so a
  // different spell appears to "reuse" the last roll instead of rolling anew.
  const cardKey = card ? actionCardIdentity(card) : null;
  useEffect(() => {
    setResult(null);
    setCrit(false);
    setAttack(null);
    setApplied([]);
  }, [cardKey]);

  if (!card) return null;

  // Extract the primary dice expression from abilityEffects via layer2
  const diceExpr = card.layer2.match(/(\d+d\d+(?:[+-]\d+)?)/)?.[1] ?? null;

  // The attack bonus as the card states it ("+6 to hit"), for the d20 roll that comes before damage.
  const toHit = card.layer2.match(/([+-]\d+) to hit/)?.[1] ?? null;

  function handleRoll() {
    setResult(onRoll(crit));
  }

  // shortcut: one plain d20, a natural 20 switches Critical Hit on. Advantage, disadvantage and wider crit ranges are
  // left to the player (the dice roller has both); add them here if cards start carrying them.
  function handleAttackRoll() {
    const roll = useDiceLogStore.getState().rollAndLog(`1d20${toHit}`, `${card!.name} attack`, true);
    setAttack(roll);
    if (roll.rolls[0] === 20) setCrit(true);
  }

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.modalOverlay} onPress={onClose}>
        <Pressable style={[styles.modalSheet, { paddingBottom: Math.max(Spacing.lg, insets.bottom + Spacing.md) }]} onPress={e => e.stopPropagation()}>
          <View style={[styles.modalColorBar, { backgroundColor: CARD_COLORS[card.color] }]} />

          <Text style={styles.modalName}>{card.name}</Text>
          <Text style={styles.modalL1}>{card.layer1}</Text>
          <Text style={styles.modalL2}>{card.layer2}</Text>
          {card.layer3 ? <Text style={styles.modalL3}>{card.layer3}</Text> : null}
          {card.triggerNote ? <Text style={styles.modalOutcome}>{card.triggerNote}</Text> : null}
          {card.outcomes.map((line, i) => (
            <Text key={i} style={styles.modalOutcome}>{line}</Text>
          ))}

          {(outcomeOffers ?? []).length > 0 && (
            <View style={{ gap: Spacing.xs }}>
              <Text style={styles.modalOutcome}>What happened? Press the one that did; nothing is applied until you do.</Text>
              {(outcomeOffers ?? []).map(o => (
                <Pressable key={o.key} style={styles.riderBtn} onPress={() => onConfirmOutcome?.(o)} accessibilityLabel={`Confirm: ${o.label}`}>
                  <Text style={styles.riderBtnTxt}>{o.label}{o.effects ? `: ${o.effects}` : ''}</Text>
                </Pressable>
              ))}
              <Pressable style={[styles.riderBtn, styles.riderBtnOff]} onPress={() => onDismissOutcomes?.()} accessibilityLabel="None of these happened">
                <Text style={[styles.riderBtnTxt, styles.riderBtnTxtOff]}>None of these</Text>
              </Pressable>
            </View>
          )}

          {applied.map(r => (
            <Text key={`${r.featureId}:${r.riderId}`} style={styles.riderApplied}>
              + {r.name}{r.damage ? `: also roll ${crit ? doubleDiceCount(r.damage.dice) : r.damage.dice} ${r.damage.damageType}` : ''}{r.note ? ` (${r.note})` : ''}
            </Text>
          ))}
          {(riders ?? []).filter(r => !applied.some(a => a.featureId === r.featureId && a.riderId === r.riderId)).map(r => (
            <Pressable
              key={`${r.featureId}:${r.riderId}`}
              disabled={!r.available}
              style={[styles.riderBtn, !r.available && styles.riderBtnOff]}
              onPress={() => { onApplyRider?.(r); setApplied(a => [...a, r]); }}
              accessibilityLabel={`Add rider ${r.name}`}
            >
              <Text style={[styles.riderBtnTxt, !r.available && styles.riderBtnTxtOff]}>
                {r.available
                  ? `Add ${r.name}${r.damage ? ` (+${r.damage.dice} ${r.damage.damageType})` : ''}`
                  : `${r.name}: ${r.reason ?? 'not available'}`}
              </Text>
            </Pressable>
          ))}

          {toHit && (attack
            ? <Text style={styles.modalL2} testID="attack-roll-result">To hit: {attack.total} (rolled {attack.rolls[0]}{toHit}){attack.rolls[0] === 20 ? ', natural 20' : attack.rolls[0] === 1 ? ', natural 1' : ''}</Text>
            : (
              <Pressable style={styles.riderBtn} onPress={handleAttackRoll} testID="attack-roll" accessibilityLabel={`Roll to hit, 1d20${toHit}`}>
                <Text style={styles.riderBtnTxt}>🎲 Roll to hit (1d20{toHit})</Text>
              </Pressable>
            ))}

          {diceExpr && !result && (
            <View style={styles.rollPrompt}>
              {/* Only an attack roll can be a critical hit: not healing, a saving throw or any other roll. */}
              {/[+-]\d+ to hit/.test(card.layer2) && (
                <Pressable style={[styles.critToggle, crit && styles.critToggleActive]} onPress={() => setCrit(c => !c)}>
                  <Text style={[styles.critToggleTxt, crit && styles.critToggleTxtActive]}>💥 Critical Hit</Text>
                </Pressable>
              )}
              <Text style={styles.rollExpr}>Roll: {crit ? doubleDiceCount(diceExpr) : diceExpr}</Text>
              <Pressable style={styles.rollBtn} onPress={handleRoll}>
                <Text style={styles.rollBtnTxt}>🎲 Roll</Text>
              </Pressable>
              <ManualRollInput expression={crit ? doubleDiceCount(diceExpr) : diceExpr} label={card.name} onSubmit={setResult} />
            </View>
          )}

          {result && (
            <View style={styles.resultBox}>
              <Text style={styles.resultTotal}>{result.total}</Text>
              <Text style={styles.resultBreakdown}>
                [{result.rolls.join(', ')}]{result.modifier !== 0 ? ` + ${result.modifier}` : ''}
              </Text>
              <Text style={styles.resultExpr}>{readableExpression(result.expression)}</Text>
            </View>
          )}

          <Pressable style={styles.closeBtn} onPress={onClose}>
            <Text style={styles.closeBtnTxt}>Done</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

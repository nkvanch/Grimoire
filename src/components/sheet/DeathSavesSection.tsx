import { useState, useRef } from 'react';
import { View, Text } from 'react-native';
import { rollExpression } from '../../engine/dice';
import { recomputeDerived } from '../../engine/pipeline';
import { Entity, CampaignRules } from '../../engine/types';
import { Colors } from '../../theme';
import { Pressable } from '../AccessibleControls';
import { styles } from './tabCharacterStyles';

// ── Death Saves Section ───────────────────────────────────────────────────────

export function DeathSavesSection({
  entity, rules, saves, onSavesChange, onEntityUpdate,
}: {
  entity: Entity;
  rules: CampaignRules;
  saves: { successes: number; failures: number };
  onSavesChange: (s: { successes: number; failures: number }) => void;
  onEntityUpdate: (u: Entity) => void;
}) {
  const isDead   = saves.failures  >= 3;
  const isStable = saves.successes >= 3;
  const [lastRoll, setLastRoll] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function showResult(msg: string) {
    setLastRoll(msg);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setLastRoll(null), 3000);
  }

  function stabilize() {
    // 3 successes = STABLE at 0 HP (book rule) — NOT healed. The creature
    // stops making death saves and stays at 0 HP, unconscious, until healed
    // by any means. Only a natural 20 heals to 1 HP (see reviveNat20 below).
    onSavesChange({ ...saves, successes: 3 });
  }

  function reviveNat20() {
    // Natural 20 on a death save: regain 1 HP immediately (book rule) and
    // clear both counters, since the creature is no longer dying.
    const updated: Entity = {
      ...entity,
      resources: { ...entity.resources, hp: { ...entity.resources.hp, current: 1 } },
    };
    onEntityUpdate(recomputeDerived(updated, rules));
    onSavesChange({ successes: 0, failures: 0 });
  }

  function addSuccess() {
    if (isDead || isStable) return;
    const next = Math.min(3, saves.successes + 1);
    if (next >= 3) { stabilize(); showResult('Stable at 0 HP'); }
    else { onSavesChange({ ...saves, successes: next }); showResult(`Success (${next}/3)`); }
  }

  function addFailure() {
    if (isDead || isStable) return;
    const next = Math.min(3, saves.failures + 1);
    onSavesChange({ ...saves, failures: next });
    showResult(next >= 3 ? 'Dead' : `Failure (${next}/3)`);
  }

  function handleRoll() {
    if (isDead || isStable) return;
    const result = rollExpression('1d20').total;
    if (result === 20) {
      showResult('Natural 20 — revived!');
      reviveNat20();
    } else if (result === 1) {
      const next = Math.min(3, saves.failures + 2);
      onSavesChange({ ...saves, failures: next });
      showResult(next >= 3 ? '1 — Dead' : `1 — Two failures! (${next}/3)`);
    } else if (result >= 10) {
      const next = Math.min(3, saves.successes + 1);
      if (next >= 3) { stabilize(); showResult(`${result} — Stable at 0 HP`); }
      else { onSavesChange({ ...saves, successes: next }); showResult(`${result} — Success (${next}/3)`); }
    } else {
      const next = Math.min(3, saves.failures + 1);
      onSavesChange({ ...saves, failures: next });
      showResult(next >= 3 ? `${result} — Dead` : `${result} — Failure (${next}/3)`);
    }
  }

  const resultColor = !lastRoll ? Colors.textDim
    : (lastRoll.includes('Success') || lastRoll.includes('Stable')) ? Colors.green
    : lastRoll.includes('20') ? Colors.gold
    : Colors.red;
  return (
    <View style={styles.deathSection}>
      <Text style={styles.sectionTitle}>DEATH SAVING THROWS</Text>
      {isDead   && <Text style={styles.deathMsg}>💀 This character has died.</Text>}
      {isStable && <Text style={styles.stableMsg}>✅ Stable — 1 HP</Text>}
      {!isDead && !isStable && (
        <>
          <View style={styles.pipRows}>
            <View style={styles.pipRow}>
              <Text style={styles.pipLabel}>Successes</Text>
              <View style={styles.pips}>
                {[0,1,2].map(i => (
                  <View key={i} style={[styles.pip, i < saves.successes && styles.pipSuccess]} />
                ))}
              </View>
            </View>
            <View style={styles.pipRow}>
              <Text style={styles.pipLabel}>Failures</Text>
              <View style={styles.pips}>
                {[0,1,2].map(i => (
                  <View key={i} style={[styles.pip, i < saves.failures && styles.pipFailure]} />
                ))}
              </View>
            </View>
          </View>
          {/* Failure | Roll | Success */}
          <View style={styles.deathBtnRow}>
            <Pressable style={[styles.deathBtn, styles.deathBtnFail]} onPress={addFailure}>
              <Text style={styles.deathBtnFailTxt}>✖ Failure</Text>
            </Pressable>
            <Pressable style={[styles.deathBtn, styles.deathBtnRoll]} onPress={handleRoll}>
              <Text style={styles.deathBtnRollTxt}>🎲 Roll</Text>
            </Pressable>
            <Pressable style={[styles.deathBtn, styles.deathBtnPass]} onPress={addSuccess}>
              <Text style={styles.deathBtnPassTxt}>✔ Success</Text>
            </Pressable>
          </View>
          {lastRoll && (
            <Text style={[styles.dieResultTxt, { color: resultColor }]}>{lastRoll}</Text>
          )}
        </>
      )}
      {(saves.successes > 0 || saves.failures > 0 || isDead || isStable) && (
        <Pressable style={styles.deathResetBtn} onPress={() => onSavesChange({ successes: 0, failures: 0 })}>
          <Text style={styles.deathResetTxt}>↺ Reset Death Saves</Text>
        </Pressable>
      )}
    </View>
  );
}

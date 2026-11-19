import { useState, useMemo } from 'react';
import { View, Text } from 'react-native';
import { Entity } from '../../engine/types';
import { useHomebrewStore } from '../../store/homebrewStore';
import { Colors } from '../../theme';
import { Alert } from '../../utils/alert';
import { Pressable, TextInput } from '../AccessibleControls';
import { COMMON_DAMAGE_TYPES } from '../homebrew/TraitEditor';
import { styles } from './encounterStyles';

// ── Multi-Target Panel ────────────────────────────────────────────────────────
// DM multi-target tools: apply the same damage/heal/condition action to every
// currently-selected combatant in one operation, instead of repeating the
// single-target QuickPanel flow once per entity. Reuses the exact same
// engine mutators (applyDamage/applyHealing/applyCondition/removeCondition)
// QuickPanel already uses — this is a UI/looping addition, not a new engine
// mechanism. Disclosed limitation: unlike QuickPanel's single-target damage,
// bulk damage does NOT open a concentration-check modal per affected caster
// (a correct multi-modal queue is real, separate UI work) — a DM bulk-
// damaging a group that includes a concentrating spellcaster should resolve
// that check manually afterward, or damage that entity individually via
// QuickPanel instead.

interface MultiTargetPanelProps {
  entities: Entity[];
  onDamage: (amount: number, damageType?: string, nonmagicalAttack?: boolean) => void;
  onHeal:   (amount: number) => void;
  onKill:   () => void;
  onAddCondition:    (conditionId: string) => void;
  onRemoveCondition: (conditionId: string) => void;
  onRuling: () => void;
  onClose:  () => void;
}

export function MultiTargetPanel({ entities, onDamage, onHeal, onKill, onAddCondition, onRemoveCondition, onRuling, onClose }: MultiTargetPanelProps) {
  const [mode,        setMode]        = useState<'damage'|'heal'|'condition'|null>(null);
  const [valueStr,    setValueStr]    = useState('');
  const [damageType,  setDamageType]  = useState('');
  // Rules-engine blocker RE-AUDIT closure (3B) — see QuickPanel's own
  // identical state/comment above; applies per-entity in bulkDamage (a
  // no-op for any selected entity it isn't relevant to).
  const [nonmagicalAttack, setNonmagicalAttack] = useState(false);
  const [condSearch,  setCondSearch]  = useState('');
  // Bulk damage skips the per-entity concentration-check modal QuickPanel's
  // single-target damage has (a real, disclosed limitation — building a
  // sequential per-caster modal queue is separate, larger UI work) — but
  // the DM was previously given no signal at all that a check was skipped.
  // Names any concentrating caster in the selection right before the
  // damage is applied, so the DM knows to resolve it manually (audit
  // finding DM-3).
  const [concWarning, setConcWarning] = useState<string[] | null>(null);

  const amount = parseInt(valueStr, 10);
  const validNum = !isNaN(amount) && amount > 0;

  function submitDamage() {
    if (!validNum) return;
    const concentrating = entities.filter(e => e.spellcasting?.concentrating).map(e => e.identity.name);
    setConcWarning(concentrating.length > 0 ? concentrating : null);
    onDamage(amount, damageType.trim() || undefined, nonmagicalAttack);
    setMode(null); setValueStr(''); setDamageType(''); setNonmagicalAttack(false);
  }
  function submitHeal() {
    if (!validNum) return;
    onHeal(amount);
    setMode(null); setValueStr('');
  }
  function submitKill() {
    Alert.alert('Kill', `Set all ${entities.length} selected combatants' HP to 0?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Kill', style: 'destructive', onPress: onKill },
    ]);
  }

  // Conditions already on every selected entity — removable in one tap.
  // Conditions on only SOME of the selection aren't offered for removal
  // here (ambiguous which subset "remove" should target); use QuickPanel
  // per-entity for that case.
  const sharedActive = entities.length > 0
    ? entities[0].conditions.filter(c => entities.every(e => e.conditions.some(ac => ac.id === c.id))).map(c => c.id)
    : [];
  // Sourced from the merged content DB, matching QuickPanel — see its own
  // comment (audit findings KNOWN_CONDITIONS-1 / CONTENT-8).
  const getMergedContentDB = useHomebrewStore(s => s.getMergedContentDB);
  const mergedContentDB = getMergedContentDB();
  // Memoized — same pattern as QuickPanel's filteredConds (ENCOUNTER-PERF-2).
  const filteredConds = useMemo(() => mergedContentDB.conditions
    .map(c => c.id)
    .filter(c => c.includes(condSearch.toLowerCase())),
    [mergedContentDB, condSearch]);

  return (
    <View style={[styles.quickPanel, styles.multiPanel]}>
      <View style={styles.quickHeader}>
        <Text style={styles.quickName}>{entities.length} selected</Text>
        <Pressable onPress={onClose}><Text style={styles.closeTxt}>✕</Text></Pressable>
      </View>
      <Text style={styles.multiNames} numberOfLines={2}>
        {entities.map(e => e.identity.name).join(', ')}
      </Text>

      {concWarning && (
        <Text style={styles.concWarningTxt}>
          🧠 Bulk damage doesn't auto-check concentration — resolve manually for: {concWarning.join(', ')}
        </Text>
      )}

      <View style={styles.quickBtns}>
        <Pressable style={[styles.qBtn, styles.qBtnRed]} onPress={() => setMode('damage')}>
          <Text style={styles.qBtnTxt}>⚔️ Damage</Text>
        </Pressable>
        <Pressable style={[styles.qBtn, styles.qBtnGreen]} onPress={() => setMode('heal')}>
          <Text style={styles.qBtnTxt}>💚 Heal</Text>
        </Pressable>
        <Pressable style={[styles.qBtn, styles.qBtnPurple]} onPress={() => setMode('condition')}>
          <Text style={styles.qBtnTxt}>🔮 Cond</Text>
        </Pressable>
        <Pressable style={[styles.qBtn, styles.qBtnDark]} onPress={submitKill}>
          <Text style={styles.qBtnTxt}>💀 Kill</Text>
        </Pressable>
      </View>
      <Pressable style={styles.rulingBtn} onPress={onRuling}>
        <Text style={styles.rulingBtnTxt}>📜 Add Ruling to all {entities.length}…</Text>
      </Pressable>

      {(mode === 'damage' || mode === 'heal') && (
        <View style={styles.inputRow}>
          <TextInput
            style={styles.numInput}
            value={valueStr}
            onChangeText={setValueStr}
            keyboardType="number-pad"
            placeholder="Amount"
            placeholderTextColor={Colors.textDim}
            autoFocus
          />
          <Pressable
            style={[styles.submitBtn, !validNum && styles.btnDisabled]}
            onPress={mode === 'damage' ? submitDamage : submitHeal}
            disabled={!validNum}
          >
            <Text style={styles.submitBtnTxt}>{mode === 'damage' ? 'Apply Damage' : 'Apply Heal'}</Text>
          </Pressable>
        </View>
      )}

      {mode === 'damage' && (
        <View style={styles.dmgTypeWrap}>
          {COMMON_DAMAGE_TYPES.map(t => (
            <Pressable key={t} style={[styles.dmgTypeChip, damageType === t && styles.dmgTypeChipActive]}
              onPress={() => setDamageType(damageType === t ? '' : t)}>
              <Text style={[styles.dmgTypeChipTxt, damageType === t && styles.dmgTypeChipTxtActive]}>{t}</Text>
            </Pressable>
          ))}
        </View>
      )}
      {/* Rules-engine blocker RE-AUDIT closure (3B) — see QuickPanel's own
          identical block/comment above. */}
      {mode === 'damage' && (damageType === 'bludgeoning' || damageType === 'piercing' || damageType === 'slashing') && (
        <Pressable style={styles.dmgTypeWrap} onPress={() => setNonmagicalAttack(v => !v)}>
          <View style={[styles.dmgTypeChip, nonmagicalAttack && styles.dmgTypeChipActive]}>
            <Text style={[styles.dmgTypeChipTxt, nonmagicalAttack && styles.dmgTypeChipTxtActive]}>
              {nonmagicalAttack ? '☑' : '☐'} Nonmagical attack
            </Text>
          </View>
        </Pressable>
      )}

      {mode === 'condition' && (
        <View style={styles.condPicker}>
          <TextInput
            style={styles.condSearch}
            value={condSearch}
            onChangeText={setCondSearch}
            placeholder="Search conditions…"
            placeholderTextColor={Colors.textDim}
          />
          {sharedActive.map(c => (
            <Pressable key={c} style={styles.condRowItem} onPress={() => onRemoveCondition(c)}>
              <Text style={styles.condItemTxt}>{c} — on all selected (tap to remove from all)</Text>
            </Pressable>
          ))}
          {filteredConds.map(c => (
            <Pressable key={c} style={[styles.condRowItem, styles.condRowAdd]} onPress={() => {
              onAddCondition(c);
              setCondSearch('');
            }}>
              <Text style={styles.condItemTxt}>+ {c} (to all selected)</Text>
            </Pressable>
          ))}
        </View>
      )}
    </View>
  );
}

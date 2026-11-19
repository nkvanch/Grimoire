import { useState, useMemo } from 'react';
import { View, Text } from 'react-native';
import { generateActionCard } from '../../engine/actionCards';
import { applyDamage, applyHealing } from '../../engine/combatDamage';
import { findRechargeableFeatures, rollRecharge } from '../../engine/combatRecharge';
import { applyWildShapeDamage, endWildShape } from '../../engine/combatWildShape';
import { removeCondition, applyCondition } from '../../engine/conditions';
import { damagePreview } from '../../engine/defenses';
import { recomputeDerived } from '../../engine/pipeline';
import { LEGENDARY_ACTIONS_RESOURCE_ID } from '../../engine/ruleset/dnd5e';
import { Entity, CampaignRules, ActionCard, ActivationOption } from '../../engine/types';
import { useHomebrewStore } from '../../store/homebrewStore';
import { Colors } from '../../theme';
import { Alert } from '../../utils/alert';
import { Pressable, TextInput } from '../AccessibleControls';
import { COMMON_DAMAGE_TYPES } from '../homebrew/TraitEditor';
import { ActivationOptionModal } from '../sheet/ActivationOptionModal';
import { ConcentrationModal } from '../sheet/ConcentrationModal';
import { useSpellPayment } from '../sheet/SpellPaymentChooser';
import { applyActionCardUse } from '../sheet/TabActions';
import { styles } from './encounterStyles';

// ── Inline Quick Panel ────────────────────────────────────────────────────────

interface QuickPanelProps {
  entity:    Entity;
  rules:     CampaignRules;
  onUpdate:  (updated: Entity, label?: string) => void;
  onRuling:  () => void;
  onClose:   () => void;
}

export function QuickPanel({ entity, rules, onUpdate, onRuling, onClose }: QuickPanelProps) {
  const [mode,     setMode]     = useState<'damage'|'heal'|'condition'|null>(null);
  const [valueStr, setValueStr] = useState('');
  const [damageType, setDamageType] = useState('');
  // Rules-engine blocker RE-AUDIT closure (3B): table-first, per-hit fact —
  // only meaningful for a bludgeoning/piercing/slashing hit against a
  // transformed elemental form with nonmagicalPhysicalResistance; a no-op
  // otherwise. See applyWildShapeDamage's own doc comment (combat.ts).
  const [nonmagicalAttack, setNonmagicalAttack] = useState(false);
  const [condSearch, setCondSearch] = useState('');
  const [concOpen,   setConcOpen]   = useState(false);
  const [concEntity, setConcEntity] = useState<Entity | null>(null);
  const [concDamage, setConcDamage] = useState(0);
  // Sourced from the merged content DB (not the hardcoded, official-only
  // KNOWN_CONDITIONS array this used to be) so homebrew conditions are
  // both pickable AND get their mechanical features attached on apply —
  // audit findings KNOWN_CONDITIONS-1 and CONTENT-8, which are the same
  // underlying gap seen from two angles and fixed together here.
  const getMergedContentDB = useHomebrewStore(s => s.getMergedContentDB);
  const allConditions = getMergedContentDB(entity.rulesetId).conditions;

  const amount = parseInt(valueStr, 10);
  const validNum = !isNaN(amount) && amount > 0;

  // While Wild Shaped, damage/heal/kill must hit the BEAST's hp pool, not the
  // player's real HP underneath — same rule and same branch app/sheet/[id].tsx's
  // handleDamage/handleHeal already apply for the player's own controls.
  // These DM-facing controls previously always hit real HP unconditionally.
  // Wild Shape/companion damage deliberately skips the concentration check
  // below — neither concentrates.
  function submitDamage() {
    if (!validNum) return;
    const dt = damageType.trim() || undefined;
    const label = `${entity.identity.name}: took ${amount}${dt ? ` ${dt}` : ''} damage`;
    if (entity.wildShapeState?.active) {
      // Rules-engine blocker fix: damage type now threads through so
      // overflow damage that carries into the player's real HP (see
      // applyWildShapeDamage's own doc comment) still resolves the
      // player's own resistance/vulnerability correctly — the beast-pool
      // absorption step itself still never resolves type at all.
      onUpdate(applyWildShapeDamage(entity, amount, rules, dt, nonmagicalAttack), label);
    } else {
      const updated = applyDamage(entity, amount, rules, dt);
      onUpdate(updated, label);
      if (updated.spellcasting?.concentrating) {
        setConcEntity(updated);
        setConcDamage(amount);
        setConcOpen(true);
      }
    }
    setMode(null); setValueStr(''); setDamageType(''); setNonmagicalAttack(false);
  }

  function submitHeal() {
    if (!validNum) return;
    if (entity.wildShapeState?.active) { setMode(null); setValueStr(''); return; }
    onUpdate(applyHealing(entity, amount, rules), `${entity.identity.name}: healed ${amount}`);
    setMode(null); setValueStr('');
  }

  function submitKill() {
    Alert.alert('Kill', `Set ${entity.identity.name}'s HP to 0?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Kill', style: 'destructive', onPress: () => {
        const label = `${entity.identity.name}: set HP to 0 (Kill)`;
        if (entity.wildShapeState?.active) {
          // Rules-engine blocker fix (closure 3I): this used to send
          // beastHpMax as "damage" through applyWildShapeDamage — harmless
          // before the overflow fix above (excess damage was discarded),
          // but a REAL bug now that overflow correctly carries into real
          // HP: an already-damaged form (e.g. beastHp 4 of beastHpMax 20)
          // would compute 16 points of fake overflow into the player's real
          // HP. "Kill" means exactly what the non-transformed branch below
          // does — zero out the CURRENTLY ACTIVE HP pool, nothing else — so
          // for a transformed entity that's ending the transformation
          // (beast HP effectively hits 0), never a damage roll against real
          // HP.
          onUpdate(endWildShape(entity, rules), label);
          return;
        }
        const updated = { ...entity, resources: { ...entity.resources, hp: { ...entity.resources.hp, current: 0 } } };
        onUpdate(recomputeDerived(updated, rules), label);
      }},
    ]);
  }

  // ENCOUNTER-PERF-2: was recomputed on every render/keystroke — same
  // pattern already fixed in TabCharacter.tsx (TABCHAR-PERF-1).
  const filteredConds = useMemo(() => allConditions
    .map(c => c.id)
    .filter(c => c.includes(condSearch.toLowerCase()) && !entity.conditions.some(ac => ac.id === c)),
    [allConditions, condSearch, entity.conditions]);

  // Legendary Actions — only shown when the entity actually has the pool
  // (a monster template with resources: [{resourceId:'legendary_actions',...}]).
  // Reuses the same ActionCard/applyActionCardUse machinery every player
  // action card already goes through — a legendary-action Feature is just a
  // Feature whose activation.resourceCost.resourceId is 'legendary_actions',
  // same generic ResourceCost mechanism spell slots already use. No preview
  // gate: matches this app's existing "direct, no-confirm" convention for
  // every other QuickPanel action (damage/heal/kill/condition).
  const { requestPayment, paymentChooser } = useSpellPayment(entity);
  const [pendingActivation, setPendingActivation] = useState<ActionCard | null>(null);
  // Closure 2 (rechargeable monster ability live use): shared by Legendary
  // Actions AND the new Rechargeable Abilities section below — both are
  // just "a Feature whose resourceCost is a generic CustomResource," so
  // both use it the exact same way applyActionCardUse already handles for
  // every player action card. Reusing this ONE path (rather than a second,
  // narrower "just spend the resource" mutation) means a rechargeable
  // ability's deterministic self-effects (spend a resource, mark a use,
  // activate a self-buff) still apply on Use exactly as they would from
  // any other card, while a target-contingent effect (e.g. Ghost's
  // Possession, or Chimera's Fire Breath save) is correctly left for the
  // DM to resolve manually — applyAbilityEffects' own isSelfAndUnconditional
  // gate (combat.ts) already prevents it from self-applying to the monster,
  // and nothing here bypasses that gate.
  function handleUseCard(card: ActionCard, option?: ActivationOption) {
    if (!option && card.activation.options?.length) { setPendingActivation(card); return; }
    requestPayment(card, option, payment => {
      const updated = applyActionCardUse(entity, card, rules, option, payment);
      if (updated !== entity) onUpdate(updated, entity.identity.name + ': used ' + card.name);
    });
  }
  const legendaryPool = entity.resources.custom.find(r => r.id === LEGENDARY_ACTIONS_RESOURCE_ID);
  const legendaryCards = legendaryPool
    ? entity.features
        .filter(f => f.activation?.resourceCost?.resourceId === 'legendary_actions')
        .map(f => generateActionCard(f, entity))
        .filter((c): c is NonNullable<typeof c> => c !== null)
    : [];

  // Closure 2 (rechargeable monster ability live use): a monster's Recharge
  // N[-6] feature (e.g. Chimera's Fire Breath, Ghost's Possession) is
  // synthesized at spawn time (monsterFactory.ts) into an ordinary
  // CustomResource with a matching resourceCost — this finds every such
  // feature (by walking entity.features and checking whether its OWN
  // resourceCost resolves to a resource whose recharge string
  // parseRechargeThreshold recognizes) and gives it a full live-use loop:
  // Available → [Use] (via handleUseCard above, spends this SAME resource)
  // → Spent → [Recharge] (primary, full one-tap restore) or
  // [🎲 Roll Recharge] (secondary, 1d6, success calls the exact same
  // restore mutation, failure changes nothing) → Available again.
  // parseRechargeThreshold's strict/anchored match naturally excludes
  // 'start_of_turn' (Legendary Actions' own pool, already shown above with
  // its own auto-refresh) and every rest-based/freeform resource, so
  // nothing here duplicates another control — the SAME resource that gates
  // availability is the one Use spends and Recharge restores (no second,
  // parallel "spent" state).
  const rechargeableFeatures = findRechargeableFeatures(entity);

  function manualRecharge(resourceId: string, label: string) {
    onUpdate({
      ...entity,
      resources: {
        ...entity.resources,
        custom: entity.resources.custom.map(r => r.id === resourceId ? { ...r, current: r.maximum } : r),
      },
    }, `${entity.identity.name}: ${label} manually recharged`);
  }
  function rollRechargeFor(resourceId: string, threshold: number, name: string) {
    const { roll, success } = rollRecharge(threshold);
    if (success) manualRecharge(resourceId, `${name} (rolled ${roll})`);
    Alert.alert('Recharge Roll', `${name}: rolled ${roll} — ${success ? 'recharged!' : 'no charge'}`);
  }

  return (
    <View style={styles.quickPanel}>
      {paymentChooser}
      <ActivationOptionModal entity={entity} card={pendingActivation}
        onClose={() => setPendingActivation(null)}
        onChoose={option => {
          const card = pendingActivation;
          setPendingActivation(null);
          if (card) handleUseCard(card, option);
        }} />
      <View style={styles.quickHeader}>
        <Text style={styles.quickName}>{entity.identity.name}</Text>
        <Text style={styles.quickHp}>
          {entity.resources.hp.current}/{entity.resources.hp.maximum} HP
        </Text>
        <Pressable onPress={onClose}><Text style={styles.closeTxt}>✕</Text></Pressable>
      </View>

      {/* Action buttons */}
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
        <Text style={styles.rulingBtnTxt}>📜 Add Ruling…</Text>
      </Pressable>

      {/* Legendary Actions */}
      {legendaryPool && (
        <View style={styles.legendaryWrap}>
          <Text style={styles.legendaryHeader}>
            🐉 Legendary Actions — {legendaryPool.current}/{legendaryPool.maximum}
          </Text>
          {legendaryCards.map(card => (
            <Pressable
              key={card.featureId}
              style={[styles.legendaryRow, !card.available && styles.btnDisabled]}
              disabled={!card.available}
              onPress={() => handleUseCard(card)}
            >
              <Text style={styles.legendaryName}>{card.name}</Text>
              <Text style={styles.legendaryDesc}>{card.layer2}{card.layer3 ? ` · ${card.layer3}` : ''}</Text>
              {!card.available && card.unavailableReason && (
                <Text style={styles.legendaryReason}>{card.unavailableReason}</Text>
              )}
            </Pressable>
          ))}
        </View>
      )}

      {/* Rechargeable Abilities (closure 2): the full Available → Use →
          Spent → Recharge/Roll Recharge → Available loop for any monster
          feature whose own resourceCost points at a "Recharge N[-6]"
          resource — e.g. Chimera's Fire Breath, Ghost's Possession. */}
      {rechargeableFeatures.length > 0 && (
        <View style={styles.legendaryWrap}>
          <Text style={styles.legendaryHeader}>🔄 Rechargeable Abilities</Text>
          {rechargeableFeatures.map(({ feature, resource, threshold }) => {
            const spent = resource.current <= 0;
            const card = spent ? null : generateActionCard(feature, entity);
            if (spent) {
              return (
                <View key={feature.id} style={styles.rechargeRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.legendaryName}>{feature.name}</Text>
                    <Text style={styles.legendaryDesc}>⚫ Spent · {resource.recharge}</Text>
                  </View>
                  <Pressable style={styles.rechargeManualBtn} onPress={() => manualRecharge(resource.id, feature.name)}>
                    <Text style={styles.rechargeManualBtnTxt}>Recharge</Text>
                  </Pressable>
                  <Pressable style={styles.rechargeRollBtn} onPress={() => rollRechargeFor(resource.id, threshold, feature.name)}>
                    <Text style={styles.rechargeRollBtnTxt}>🎲</Text>
                  </Pressable>
                </View>
              );
            }
            return (
              <Pressable
                key={feature.id}
                style={[styles.legendaryRow, !card?.available && styles.btnDisabled]}
                disabled={!card?.available}
                onPress={() => card && handleUseCard(card)}
              >
                <Text style={styles.legendaryName}>{feature.name}</Text>
                <Text style={styles.legendaryDesc}>⚪ Available{card?.layer2 ? ` · ${card.layer2}` : ''}</Text>
                {!card?.available && card?.unavailableReason && (
                  <Text style={styles.legendaryReason}>{card.unavailableReason}</Text>
                )}
              </Pressable>
            );
          })}
        </View>
      )}

      {/* Number input for damage/heal */}
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

      {mode === 'damage' && validNum && (() => {
        const p = damagePreview(entity, amount, damageType.trim() || undefined);
        return (
          <Text
            style={[styles.previewLine, p.state === 'dead' || p.state === 'dead_risk' ? { color: Colors.red } : p.state === 'down' ? { color: Colors.gold } : null]}
            accessibilityLabel={`Preview: ${p.line}`}
          >
            {p.line}
          </Text>
        );
      })()}

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
      {/* Rules-engine blocker RE-AUDIT closure (3B): only meaningful for a
          transformed entity taking bludgeoning/piercing/slashing damage —
          hidden otherwise so this doesn't clutter every ordinary hit. */}
      {mode === 'damage' && entity.wildShapeState?.active
        && (damageType === 'bludgeoning' || damageType === 'piercing' || damageType === 'slashing') && (
        <Pressable style={styles.dmgTypeWrap} onPress={() => setNonmagicalAttack(v => !v)}>
          <View style={[styles.dmgTypeChip, nonmagicalAttack && styles.dmgTypeChipActive]}>
            <Text style={[styles.dmgTypeChipTxt, nonmagicalAttack && styles.dmgTypeChipTxtActive]}>
              {nonmagicalAttack ? '☑' : '☐'} Nonmagical attack
            </Text>
          </View>
        </Pressable>
      )}

      {/* Condition picker */}
      {mode === 'condition' && (
        <View style={styles.condPicker}>
          <TextInput
            style={styles.condSearch}
            value={condSearch}
            onChangeText={setCondSearch}
            placeholder="Search conditions…"
            placeholderTextColor={Colors.textDim}
          />
          {/* Active conditions with remove */}
          {entity.conditions.map(c => (
            <Pressable key={c.id} style={styles.condRowItem} onPress={() => {
              onUpdate(removeCondition(entity, c.id, rules), `${entity.identity.name}: removed condition: ${c.id}`);
            }}>
              <Text style={styles.condItemTxt}>{c.id} (tap to remove)</Text>
            </Pressable>
          ))}
          {/* Add new condition */}
          {filteredConds.map(c => (
            <Pressable key={c} style={[styles.condRowItem, styles.condRowAdd]} onPress={() => {
              const features = allConditions.find(cond => cond.id === c)?.features;
              onUpdate(applyCondition(entity, c, 'dm', rules, features), `${entity.identity.name}: added condition: ${c}`);
              setCondSearch('');
            }}>
              <Text style={styles.condItemTxt}>+ {c}</Text>
            </Pressable>
          ))}
        </View>
      )}

      {concEntity && (
        <ConcentrationModal
          visible={concOpen}
          damageTaken={concDamage}
          entity={concEntity}
          rules={rules}
          onResolve={updated => { onUpdate(updated, `${entity.identity.name}: concentration check`); setConcOpen(false); }}
          onClose={() => setConcOpen(false)}
        />
      )}
    </View>
  );
}

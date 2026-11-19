import { findBeastForm } from '../../content/runtimeRules';
import { MissingPacksBanner } from './MissingPacksBanner';
import { formatDamage } from '../../engine/actionCardText';
import { useSpellPayment } from './SpellPaymentChooser';
// app/sheet/TabCharacter.tsx
// Tab 1 — Combat dashboard. Players live here.
// Includes: HP, stat row, conditions/exhaustion, resources, spell slots,
//           death saves (when HP=0), concentration check, level-up button.
import { useState, useCallback, useRef, useMemo, memo } from 'react';
import { View, Text } from 'react-native';
import { ScrollView } from '../Lists';
import { Pressable } from '../AccessibleControls';
import { Entity, CampaignRules, ActionCard, DurationTracker, ActivationOption } from '../../engine/types';
import { useCharacterStore } from '../../store/characterStore';
import { recomputeDerived } from '../../engine/pipeline';
import { spendHitDie, spendHitDieManual, currentHitDieSize, spendableHitDicePools } from '../../engine/rest';
import { doubleDiceCount } from '../../engine/dice';
import { useDiceLogStore } from '../../store/diceLogStore';
import { useHomebrewStore } from '../../store/homebrewStore';
import { AuditModal } from './AuditModal';
import { HpModal } from './HpModal';
import { HeroicInspirationPanel } from './HeroicInspirationPanel';
import { CombatStatePanel } from './CombatStatePanel';
import { ConcentrationModal } from './ConcentrationModal';
import { CompanionSection } from './CompanionSection';
import { applyActionCardUse } from './TabActions';
import { ActivationOptionModal } from './ActivationOptionModal';
import { UseModal } from './UseModal';
import { isFavoriteCard } from './actionCardUi';
import { useCardContent } from './actionCardUi';
import { Colors } from '../../theme';
import { styles } from './tabCharacterStyles';
import { DeathSavesSection } from './DeathSavesSection';
import { LevelUpSection } from './LevelUpSection';
import { NumberPromptModal } from './NumberPromptModal';
import { SensesModal } from './SensesModal';
import { MovementModal } from './MovementModal';
import { HpSection } from './character/HpSection';
import { StatRowSection } from './character/StatRowSection';
import { AttacksSection } from './character/AttacksSection';
import { HitDiceSection } from './character/HitDiceSection';
import { ConditionsSection } from './character/ConditionsSection';
import { ConcentrationIndicator } from './character/ConcentrationIndicator';
import { ResourcesSection } from './character/ResourcesSection';
import { SpellSlotsSection } from './character/SpellSlotsSection';
import { ConditionPickerModal } from './character/ConditionPickerModal';
import { LevelUpAsiModal } from './character/LevelUpAsiModal';
import { AddFeatModal } from './character/AddFeatModal';

// Death saves live in entity.resources.deathSaves — persisted and synced,
// same as HP. combat.ts resets them automatically when HP drops to 0 for the
// first time or rises above 0 (healed/revived); this component only handles
// recording each save result and the stabilize/nat-20 special cases.

// ── Props ─────────────────────────────────────────────────────────────────────

interface Props {
  entity:       Entity;
  rules:        CampaignRules;
  isDm:         boolean;
  campaignId:   string;
  deviceId:     string;
  onDamage:     (amount: number, damageType?: string, isNonmagicalAttack?: boolean) => void;
  onHeal:       (amount: number) => void;
  onAddCondition:    (id: string, duration: DurationTracker | null) => void;
  onRemoveCondition: (id: string) => void;
  onResourceChange:  (resourceId: string, delta: number) => void;
  onSpendSlot:       (tier: string, kind?: 'normal' | 'pact') => void;
  onRestoreSlot:     (tier: string, kind?: 'normal' | 'pact') => void;
  /** Manually ends the current concentration (and its linked effects) — the
   *  one shared handler app/sheet/[id].tsx also gives the Spells tab. */
  onEndConcentration: (spellName: string) => void;
  onEntityUpdate:    (updated: Entity) => void;
  /** Closure item 16 — the one authoritative End Turn entry point, shared
   *  verbatim with the Actions and Spells tabs (see app/sheet/[id].tsx's
   *  handleEndTurn). */
  onEndTurn:         () => void;
}


// ── Main component ────────────────────────────────────────────────────────────

function TabCharacterInner({
  entity, rules, isDm, campaignId, deviceId,
  onDamage, onHeal, onAddCondition, onRemoveCondition,
  onResourceChange, onSpendSlot, onRestoreSlot, onEndConcentration, onEntityUpdate, onEndTurn,
}: Props) {
  // Sourced from the merged content DB (not a hardcoded, official-only id
  // list) so homebrew conditions are actually pickable here — audit
  // finding KNOWN_CONDITIONS-1.
  const getMergedContentDB = useHomebrewStore(s => s.getMergedContentDB);
  const [hpOpen,     setHpOpen]     = useState(false);
  const [auditStat,  setAuditStat]  = useState<string | null>(null);
  const [auditLabel, setAuditLabel] = useState('');
  const [condModal,  setCondModal]  = useState(false);
  const [condSearch, setCondSearch] = useState('');
  // Set once a condition name is tapped, before its duration is chosen —
  // drives the "how long?" sub-step shown in the same modal (or the
  // separate NumberPromptModal for the "N Rounds" case).
  const [pendingConditionId, setPendingConditionId] = useState<string | null>(null);
  const [roundsPromptOpen,   setRoundsPromptOpen]   = useState(false);

  function closeConditionFlow() {
    setCondModal(false);
    setCondSearch('');
    setPendingConditionId(null);
    setRoundsPromptOpen(false);
  }
  const [concOpen,   setConcOpen]   = useState(false);
  const [concDamage, setConcDamage] = useState(0);
  const [manualHpOpen, setManualHpOpen] = useState(false);
  const [maxHpOpen,    setMaxHpOpen]    = useState(false);
  const [tempHpOpen,   setTempHpOpen]   = useState(false);
  const [activeFavCard, setActiveFavCard] = useState<ActionCard | null>(null);
  // Rules-engine blocker RE-AUDIT closure (2F): carries the bypass/context
  // decision ALONGSIDE the card, not just the card alone — see
  // TabActions.tsx's PendingActionUse for the same fix and its own doc
  // comment on why this was a real bug (a chosen source/Cast-Anyway
  // decision used to be silently discarded by the activation-option picker).
  const [pendingFavUse, setPendingFavUse] = useState<{
    card: ActionCard;
    bypassSpellPreparation?: boolean;
    selectedSpellCastingContext?: import('../../engine/types').SpellCastingContext;
    bypassIncapacitated?: boolean;
    /** Rules-completeness batch (ritual casting) — see TabActions.tsx's
     *  PendingActionUse.castMode for the identical fix. */
    castMode?: 'ritual';
  } | null>(null);
  const [levelUpAsiOpen, setLevelUpAsiOpen] = useState(false);
  const [sensesOpen, setSensesOpen] = useState(false);
  const [movementOpen, setMovementOpen] = useState(false);
  const [addFeatOpen, setAddFeatOpen] = useState(false);
  // Inline hit-die result — shown for 3s then cleared, no Alert needed
  const [hitDieResult, setHitDieResult] = useState<string | null>(null);
  const hitDieTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Table-first: "Use Hit Die" opens this inline entry instead of an Alert —
  // same compact pattern as the death-save/initiative inline controls.
  const [hitDieEntry, setHitDieEntry] = useState(false);
  const [hitDieDraft, setHitDieDraft] = useState('');
  // Rules-completeness batch (mixed hit-die pools), C2/C4: which die SIZE
  // the player has explicitly chosen to spend next — only meaningful (and
  // only rendered as a picker) when 2+ distinct sizes are currently
  // spendable; a single-pool character never sees this at all and every
  // spend call below omits dieSize exactly as before this batch. Reset
  // whenever the spendable set changes shape (a spend/rest/level-up) so a
  // stale selection (e.g. a pool that just hit 0) can't linger.
  const [selectedHitDieSize, setSelectedHitDieSize] = useState<number | null>(null);
  const [openResource, setOpenResource] = useState<string | null>(null);   // a tapped resource shows what it is for
  const spendableHitDice = spendableHitDicePools(entity.resources.hitDice);
  const hitDieChoiceNeeded = spendableHitDice.length > 1;
  const effectiveHitDieSize = hitDieChoiceNeeded
    ? (spendableHitDice.some(p => p.die === selectedHitDieSize) ? selectedHitDieSize : null)
    : (spendableHitDice[0]?.die ?? null);

  function showHitDieResult(msg: string) {
    setHitDieResult(msg);
    if (hitDieTimer.current) clearTimeout(hitDieTimer.current);
    hitDieTimer.current = setTimeout(() => setHitDieResult(null), 3000);
  }

  const { identity, resources, derived, conditions, spellcasting } = entity;

  // Favorited Actions-tab cards, surfaced here too — starred via the same
  // ☆/★ toggle on the Actions tab (Entity.favoriteActionIds — see
  // isFavoriteCard's doc comment in TabActions.tsx for why this isn't just
  // a Feature.favoriteTag lookup: spell-based and synthetic cards like
  // Unarmed Strike have no backing Feature to store a flag on).
  const { requestPayment, paymentChooser } = useSpellPayment(entity);
  const favoriteCardContent = useCardContent(entity);
  const favoriteCards = (entity.actionCards ?? []).filter(c => isFavoriteCard(entity, c));
  function handleUseFavorite(card: ActionCard, bypassSpellPreparation?: boolean, selectedSpellCastingContext?: import('../../engine/types').SpellCastingContext, bypassIncapacitated?: boolean, castMode?: 'ritual') {
    // A-57 (item 10): a favorited card with discrete use-time options
    // (e.g. Divine Smite's spell-slot tier) must resolve the picker BEFORE
    // spending anything, same as TabActions' own handleUse — this call
    // site used to always pass chosenOption undefined, silently falling
    // back to the card's default cost/tier instead of asking.
    if (card.activation.options && card.activation.options.length > 0) {
      // Rules-engine blocker RE-AUDIT closure 2F (extended, HIGH batch C7/
      // C8): preserve the bypass/context/status-override decision
      // ActionCardRow already made, not just the card.
      setPendingFavUse({ card, bypassSpellPreparation, selectedSpellCastingContext, bypassIncapacitated, castMode });
      return;
    }
    // Rules-completeness batch (ritual casting), A4: never request a slot
    // payment for a ritual cast.
    if (castMode === 'ritual') {
      const updated = applyActionCardUse(entity, card, rules, undefined, undefined, bypassSpellPreparation, selectedSpellCastingContext, favoriteCardContent, bypassIncapacitated, castMode);
      if (updated === entity) return;
      onEntityUpdate(updated);
      setActiveFavCard(card);
      return;
    }
    // Same fix as TabActions' handleUse — always run applyActionCardUse
    // (it no-ops correctly with nothing to spend) so a cost-less
    // concentration cantrip favorited here also tracks concentration.
    // bypassSpellPreparation threads the Quick Override "Cast Anyway"
    // choice from ActionCardRow (rules-engine blocker closure 1F) through
    // to the same shared applyActionCardUse every other cast surface uses.
    requestPayment(card, undefined, payment => {
      const updated = applyActionCardUse(entity, card, rules, undefined, payment, bypassSpellPreparation, selectedSpellCastingContext, favoriteCardContent, bypassIncapacitated);
      if (updated === entity) return;
      onEntityUpdate(updated);
      setActiveFavCard(card);
    });
  }
  function handleChooseFavoriteOption(option: ActivationOption) {
    const pending = pendingFavUse;
    setPendingFavUse(null);
    if (!pending) return;
    const { card, bypassSpellPreparation, selectedSpellCastingContext, bypassIncapacitated, castMode } = pending;
    if (castMode === 'ritual') {
      const updated = applyActionCardUse(entity, card, rules, option, undefined, bypassSpellPreparation, selectedSpellCastingContext, favoriteCardContent, bypassIncapacitated, castMode);
      if (updated === entity) return;
      onEntityUpdate(updated);
      setActiveFavCard(card);
      return;
    }
    requestPayment(card, option, payment => {
      const updated = applyActionCardUse(entity, card, rules, option, payment, bypassSpellPreparation, selectedSpellCastingContext, favoriteCardContent, bypassIncapacitated);
      if (updated === entity) return;
      onEntityUpdate(updated);
      setActiveFavCard(card);
    });
  }
  function rollForFavorite(crit: boolean): import('../../engine/types').DiceRoll | null {
    if (!activeFavCard) return null;
    const expr = activeFavCard.layer2.match(/(\d+d\d+(?:[+-]\d+)?)/)?.[1];
    if (!expr) return null;
    const finalExpr = crit ? doubleDiceCount(expr) : expr;
    try { return useDiceLogStore.getState().rollAndLog(finalExpr, activeFavCard.name, true); }
    catch { return null; }
  }

  // Equipped weapon attack/damage cards
  const weapons = derived.attackBonuses.map(ab => {
    return {
      itemId:      ab.id,
      name:        ab.name,
      attackBonus: ab.bonus,
      damage:      `${formatDamage(ab.damageDice, ab.damageBonus)} ${ab.damageType}`.trim(),
      isRanged:    ab.type === 'ranged',
    };
  });

  // ── HP / Hit Dice handlers ──────────────────────────────────────────────────
  function handleSetHp(value: number) {
    const clamped = Math.max(0, Math.min(resources.hp.maximum, value));
    onEntityUpdate(recomputeDerived(
      { ...entity, resources: { ...entity.resources, hp: { ...entity.resources.hp, current: clamped } } },
      rules,
    ));
  }
  function handleSetMaxHp(value: number) {
    // Manual max-HP override. recomputeDerived never touches resources.hp, so this
    // persists. Clamp current HP down if the new max is lower.
    const newMax     = Math.max(1, value);
    const newCurrent = Math.min(entity.resources.hp.current, newMax);
    onEntityUpdate(recomputeDerived(
      { ...entity, resources: { ...entity.resources, hp: { ...entity.resources.hp, maximum: newMax, current: newCurrent } } },
      rules,
    ));
  }
  function handleAddTempHp(value: number) {
    // Temp HP doesn't stack — keep whichever pool is larger.
    const newTemp = Math.max(entity.resources.hp.temp, value);
    onEntityUpdate(recomputeDerived(
      { ...entity, resources: { ...entity.resources, hp: { ...entity.resources.hp, temp: newTemp } } },
      rules,
    ));
  }
  function handleClearTempHp() {
    onEntityUpdate(recomputeDerived(
      { ...entity, resources: { ...entity.resources, hp: { ...entity.resources.hp, temp: 0 } } },
      rules,
    ));
  }
  // Death saves used to be session-local React state that never persisted or
  // synced (see git history) — now writes into entity.resources.deathSaves,
  // same mutate-then-recompute pattern as every other HP change, so it
  // survives app restarts and syncs to other devices via the normal entity
  // broadcast path.
  function handleDeathSavesChange(next: { successes: number; failures: number }) {
    onEntityUpdate(recomputeDerived(
      {
        ...entity,
        resources: {
          ...entity.resources,
          deathSaves: { successes: next.successes, failures: next.failures, stable: next.successes >= 3 },
        },
      },
      rules,
    ));
  }
  // Rules-completeness batch (mixed hit-die pools), C2: both hit-die spend
  // paths below require an explicit, currently-valid pool choice before
  // doing anything — `effectiveHitDieSize` is only non-null when either
  // there's nothing to choose between (one spendable pool) or the player
  // has already tapped one of the picker chips. Neither path falls back to
  // spendHitDie/spendHitDieManual's own single-pool convenience omission
  // once 2+ pools exist — that would silently reintroduce the exact
  // largest-first auto-pick this batch removes.
  function handleRollHitDie() {
    if (resources.hitDice.remaining <= 0 || effectiveHitDieSize === null) return;
    const before  = resources.hp.current;
    const updated = spendHitDie(entity, rules, effectiveHitDieSize);
    if (updated === entity) return;
    onEntityUpdate(updated);
    setSelectedHitDieSize(null);
    const healed = updated.resources.hp.current - before;
    showHitDieResult(`+${healed} HP restored`);
  }
  // Table-first primary path: the die was already rolled physically —
  // enter that result, spend the die and heal in one action via the exact
  // same final mutation (healFromSpentHitDie, inside spendHitDieManual)
  // handleRollHitDie's in-app convenience uses.
  function openHitDieEntry() {
    if (resources.hitDice.remaining <= 0 || effectiveHitDieSize === null) return;
    setHitDieDraft('');
    setHitDieEntry(true);
  }
  function submitHitDieEntry() {
    if (effectiveHitDieSize === null) return;
    const dieSize = currentHitDieSize(entity, effectiveHitDieSize, rules);
    const roll = parseInt(hitDieDraft, 10);
    if (isNaN(roll) || roll < 1 || roll > dieSize) return;
    const before  = resources.hp.current;
    const updated = spendHitDieManual(entity, roll, rules, effectiveHitDieSize);
    if (updated === entity) return;
    onEntityUpdate(updated);
    setSelectedHitDieSize(null);
    const healed = updated.resources.hp.current - before;
    showHitDieResult(`+${healed} HP restored`);
    setHitDieEntry(false);
  }

  function openAudit(stat: string, label: string) {
    setAuditStat(stat);
    setAuditLabel(label);
  }

  // Damage handler — triggers concentration check modal if needed.
  // Reads fresh entity state AFTER onDamage (Zustand is synchronous)
  // so the modal gets the correct entity, not the stale prop.
  const handleDamage = useCallback((amount: number, damageType?: string, isNonmagicalAttack?: boolean) => {
    onDamage(amount, damageType, isNonmagicalAttack);
    const { characters } = useCharacterStore.getState();
    const fresh = characters.find(c => c.id === entity.id);
    if (fresh?.spellcasting?.concentrating) {
      setConcDamage(amount);
      setConcOpen(true);
    }
  }, [onDamage, entity.id]);

  // Rules-engine blocker RE-AUDIT closure (3A): visible only while
  // transformed into a form that actually declares
  // nonmagicalPhysicalResistance — HpModal itself further gates on the
  // selected damage type being bludgeoning/piercing/slashing.
  const activeBeastForm = entity.wildShapeState?.active
    ? findBeastForm(entity.wildShapeState.formId)
    : undefined;
  const showNonmagicalOption = !!activeBeastForm?.nonmagicalPhysicalResistance;

  const hpPct = resources.hp.maximum > 0
    ? Math.max(0, Math.min(1, resources.hp.current / resources.hp.maximum))
    : 0;
  const hpColor = hpPct > 0.5 ? Colors.green : hpPct > 0.25 ? Colors.gold : Colors.red;
  const isDying = resources.hp.current === 0 && resources.hp.maximum > 0;

  const exhaustion = entity.conditionMonitor.exhaustion;

  // TABCHAR-PERF-1: was recomputed (map+filter over the merged condition
  // list) on every render, including every keystroke in condSearch and
  // every render triggered by something unrelated to conditions at all
  // (this is the default/most-rendered character-sheet tab). getMergedContentDB()
  // itself is called once per render (cheap — cached at the store level as
  // of CONTENT-REGISTRY-PERF-1, returns the same reference when nothing in
  // the content store changed), and used as a stable useMemo dependency.
  const mergedContentDB = getMergedContentDB(entity.rulesetId);
  const filteredConds = useMemo(() => mergedContentDB.conditions
    .map(c => c.id)
    .filter(c =>
      c.includes(condSearch.toLowerCase()) &&
      !conditions.some(ac => ac.id === c)
    ), [mergedContentDB, condSearch, conditions]);

  const SLOT_TIERS = ['1','2','3','4','5','6','7','8','9'] as const;

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>

      <MissingPacksBanner entity={entity} />

      <HpSection
        setHpOpen={setHpOpen}
        isDying={isDying}
        hpColor={hpColor}
        resources={resources}
        hpPct={hpPct}
        setManualHpOpen={setManualHpOpen}
        setMaxHpOpen={setMaxHpOpen}
        handleClearTempHp={handleClearTempHp}
        setTempHpOpen={setTempHpOpen}
      />

      {/* Death Saves (only when HP = 0) */}
      {isDying && (
        <DeathSavesSection
          entity={entity}
          rules={rules}
          saves={resources.deathSaves}
          onSavesChange={handleDeathSavesChange}
          onEntityUpdate={onEntityUpdate}
        />
      )}

      <HeroicInspirationPanel entity={entity} onEntityUpdate={onEntityUpdate} />
      <CombatStatePanel entity={entity} onEntityUpdate={onEntityUpdate} />

      <StatRowSection
        derived={derived}
        entity={entity}
        openAudit={openAudit}
        favoriteCards={favoriteCards}
        handleUseFavorite={handleUseFavorite}
        onEntityUpdate={onEntityUpdate}
      />

      {/* Level Up + Add Feat */}
      <View style={styles.levelUpRow}>
        <View style={{ flex: 1 }}>
          <LevelUpSection
            entity={entity}
            rules={rules}
            onEntityUpdate={onEntityUpdate}
            onLeveled={(updated) => {
              const hasAsi = updated.choices.some(c => c.definition.kind === 'asi' && !c.resolved);
              if (hasAsi) setLevelUpAsiOpen(true);
              // Other pending choices (subclass, spells) surface in the Features tab automatically
            }}
          />
        </View>
        <Pressable style={styles.addFeatBtn} onPress={() => setAddFeatOpen(true)}>
          <Text style={styles.addFeatTxt}>+ Feat</Text>
        </Pressable>
      </View>

      {/* Companion (Steel Defender, Eldritch Cannon, etc.) — self-contained,
          renders nothing if this entity has no companion-granting feature. */}
      <CompanionSection owner={entity} rules={rules} />

      <AttacksSection weapons={weapons} derived={derived} setMovementOpen={setMovementOpen} setSensesOpen={setSensesOpen} />

      <HitDiceSection
        resources={resources}
        hitDieChoiceNeeded={hitDieChoiceNeeded}
        hitDieEntry={hitDieEntry}
        spendableHitDice={spendableHitDice}
        selectedHitDieSize={selectedHitDieSize}
        setSelectedHitDieSize={setSelectedHitDieSize}
        entity={entity}
        rules={rules}
        effectiveHitDieSize={effectiveHitDieSize}
        hitDieDraft={hitDieDraft}
        setHitDieDraft={setHitDieDraft}
        submitHitDieEntry={submitHitDieEntry}
        setHitDieEntry={setHitDieEntry}
        openHitDieEntry={openHitDieEntry}
        handleRollHitDie={handleRollHitDie}
        hitDieResult={hitDieResult}
      />

      <ConditionsSection
        setCondModal={setCondModal}
        exhaustion={exhaustion}
        entity={entity}
        resources={resources}
        conditions={conditions}
        onRemoveCondition={onRemoveCondition}
        onEntityUpdate={onEntityUpdate}
        onEndTurn={onEndTurn}
        derived={derived}
      />

      <ConcentrationIndicator spellcasting={spellcasting} entity={entity} onEndConcentration={onEndConcentration} />

      <ResourcesSection
        resources={resources}
        entity={entity}
        onEntityUpdate={onEntityUpdate}
        rules={rules}
        setOpenResource={setOpenResource}
        openResource={openResource}
        onResourceChange={onResourceChange}
        showHitDieResult={showHitDieResult}
      />

      <SpellSlotsSection spellcasting={spellcasting} SLOT_TIERS={SLOT_TIERS} onSpendSlot={onSpendSlot} onRestoreSlot={onRestoreSlot} />

      {/* Modals */}
      <AuditModal
        entity={entity}
        stat={auditStat}
        label={auditLabel}
        rules={rules}
        isDm={isDm}
        campaignId={campaignId}
        deviceId={deviceId}
        onUpdate={onEntityUpdate}
        onClose={() => setAuditStat(null)}
      />

      <HpModal
        visible={hpOpen}
        currentHp={resources.hp.current}
        maxHp={resources.hp.maximum}
        onDamage={handleDamage}
        onHeal={onHeal}
        onClose={() => setHpOpen(false)}
        showNonmagicalOption={showNonmagicalOption}
      />

      <NumberPromptModal
        visible={manualHpOpen}
        title="Set HP"
        label={`Set current HP to (max ${resources.hp.maximum}):`}
        confirmLabel="Set HP"
        onConfirm={handleSetHp}
        onClose={() => setManualHpOpen(false)}
      />

      <NumberPromptModal
        visible={maxHpOpen}
        title="Set Max HP"
        label="Set maximum HP to (overrides the calculated value):"
        confirmLabel="Set Max HP"
        onConfirm={handleSetMaxHp}
        onClose={() => setMaxHpOpen(false)}
      />

      <NumberPromptModal
        visible={tempHpOpen}
        title="Add Temporary HP"
        label="Temp HP only replaces if higher than current."
        confirmLabel="Add Temp HP"
        onConfirm={handleAddTempHp}
        onClose={() => setTempHpOpen(false)}
      />

      <ConcentrationModal
        visible={concOpen}
        damageTaken={concDamage}
        entity={useCharacterStore.getState().characters.find(c => c.id === entity.id) ?? entity}
        rules={rules}
        onResolve={updated => { onEntityUpdate(updated); setConcOpen(false); }}
        onClose={() => setConcOpen(false)}
      />

      <ConditionPickerModal
        condModal={condModal}
        closeConditionFlow={closeConditionFlow}
        pendingConditionId={pendingConditionId}
        condSearch={condSearch}
        setCondSearch={setCondSearch}
        filteredConds={filteredConds}
        setPendingConditionId={setPendingConditionId}
        onAddCondition={onAddCondition}
        setCondModal={setCondModal}
        setRoundsPromptOpen={setRoundsPromptOpen}
      />

      <NumberPromptModal
        visible={roundsPromptOpen}
        title={`${pendingConditionId} — Rounds`}
        label="How many rounds until it expires?"
        confirmLabel="Add Condition"
        onConfirm={n => { onAddCondition(pendingConditionId!, { unit: 'rounds', remaining: Math.max(1, n) }); closeConditionFlow(); }}
        onClose={closeConditionFlow}
      />

      <LevelUpAsiModal
        levelUpAsiOpen={levelUpAsiOpen}
        setLevelUpAsiOpen={setLevelUpAsiOpen}
        entity={entity}
        rules={rules}
        onEntityUpdate={onEntityUpdate}
      />

      {/* Senses editor */}
      <SensesModal
        visible={sensesOpen}
        entity={entity}
        rules={rules}
        onClose={() => setSensesOpen(false)}
        onUpdate={(u) => { onEntityUpdate(u); }}
      />

      {/* Movement editor */}
      <MovementModal
        visible={movementOpen}
        entity={entity}
        rules={rules}
        onClose={() => setMovementOpen(false)}
        onUpdate={(u) => { onEntityUpdate(u); }}
      />

      {paymentChooser}
      <UseModal
        card={activeFavCard}
        onRoll={rollForFavorite}
        onClose={() => setActiveFavCard(null)}
      />

      <ActivationOptionModal
        entity={entity}
        card={pendingFavUse?.card ?? null}
        onChoose={handleChooseFavoriteOption}
        onClose={() => setPendingFavUse(null)}
        bypassIncapacitated={pendingFavUse?.bypassIncapacitated}
      />

      <AddFeatModal
        addFeatOpen={addFeatOpen}
        setAddFeatOpen={setAddFeatOpen}
        entity={entity}
        rules={rules}
        onEntityUpdate={onEntityUpdate}
      />

    </ScrollView>
  );
}

// EDIT-PERF-1: memoized so opening an unrelated sheet-level modal (Free
// Edit, Ruleset Change, History, ...) doesn't force this tab to re-render —
// only actually matters combined with the caller passing stable prop
// references (see app/sheet/[id].tsx's onCombatEntityUpdate etc.).
export const TabCharacter = memo(TabCharacterInner);

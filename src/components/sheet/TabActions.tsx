// app/sheet/TabActions.tsx
// Tab 2 — Action Cards. [Use] consumes resources and shows a dice result modal.
import { useState, useCallback, memo } from 'react';
import { View, Text } from 'react-native';
import { ScrollView } from '../Lists';
import { Pressable } from '../AccessibleControls';
import { Entity, ActionCard, CampaignRules, ActivationOption, SpellCastingContext } from '../../engine/types';
import { ridersForCard, applyRider } from '../../engine/riders';
import { outcomeOffersForCard, confirmOutcome, dismissOutcomes } from '../../engine/outcomes';
import { endAttackSequence } from '../../engine/combat';
import { endWildShape } from '../../engine/combatWildShape';
import { collectAllEffects } from '../../engine/pipeline';
import { getTriggeredFeatures } from '../../engine/actionCardAvailability';
import { applyActionCardUse, type CardOverrule } from '../../engine/actionUse';
import type { SpellPaymentOption } from '../../engine/spellPayment';
import { useSpellPayment } from './SpellPaymentChooser';
import { doubleDiceCount, withDamageDieRule } from '../../engine/dice';
import { useDiceLogStore } from '../../store/diceLogStore';
import { DiceRoll } from '../../engine/types';
import { Alert } from '../../utils/alert';
import { styles } from './tabActionsStyles';
import { isFavoriteCard, CardLike, actionCardIdentity, useCardContent } from './actionCardUi';
import { PendingActionUse, UseModal } from './UseModal';
import { ActivationOptionModal } from './ActivationOptionModal';
import { ActionCardRow } from './ActionCardRow';

export { applyActionCardUse } from '../../engine/actionUse';

/**
 * Toggles an Actions-tab favorite star (surfaces on Combat tab's FAVORITES
 * section when on). Writes to Entity.favoriteActionIds, NOT the underlying
 * Feature — that only worked for feature-backed cards, silently no-op'ing
 * for spell-based cards (ActionCard.featureId is a spell id, no Feature
 * with that id exists) and synthetic cards like Unarmed Strike (no backing
 * Feature at all). Toggling off also clears a legacy Feature.favoriteTag if
 * present, so switching off a pre-migration favorite actually turns it off
 * rather than isFavoriteCard's fallback keeping it lit.
 *
 * Item-identity closure (pass 3, finding G): stores/removes the card's
 * exact modern identity (see actionCardIdentity), never a bare featureId
 * for an item card — favoriting instance A must never implicitly favorite
 * instance B merely because they share featureId. When turning OFF an item
 * card that's currently favorited via the legacy bare-featureId fallback
 * (isFavoriteCard's own doc comment), this also removes that bare entry —
 * the player just told this app "this is off," and leaving the shared
 * legacy entry in place would keep every OTHER same-feature instance lit
 * with no way to turn it off independently. This is the one place that
 * ambiguous legacy state gets resolved into the modern per-instance model.
 */
export function toggleFavoriteTag(entity: Entity, card: string | CardLike): Entity {
  const featureId = typeof card === 'string' ? card : card.featureId;
  const identity   = typeof card === 'string' ? card : actionCardIdentity(card);
  const current = entity.favoriteActionIds ?? [];
  if (isFavoriteCard(entity, card)) {
    return {
      ...entity,
      favoriteActionIds: current.filter(id => id !== identity && id !== featureId),
      features: entity.features.map(f => f.id === featureId ? { ...f, favoriteTag: false } : f),
      inventory: {
        ...entity.inventory,
        equipped: entity.inventory.equipped.map(inst => ({
          ...inst,
          features: inst.features.map(f => f.id === featureId ? { ...f, favoriteTag: false } : f),
        })),
      },
    };
  }
  return { ...entity, favoriteActionIds: [...current, identity] };
}

/**
 * Extra Attack sequence closure: a fresh, opaque correlation token for one
 * Attack-action sequence — see AttackSequenceUse's own doc comment
 * (types.ts) for why this never needs to be unguessable/cryptographic. It
 * only correlates this UI's own successive calls against the engine's own
 * authoritative entity.attackSequence record; it grants no authority by
 * itself.
 */
function generateSequenceId(): string {
  return `attack-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

// ── Section ───────────────────────────────────────────────────────────────────

function Section({ title, cards, entity, onUse, onToggleFavorite, onOverrule }: {
  title: string; cards: ActionCard[]; entity: Entity;
  onUse: (c: ActionCard, bypassSpellPreparation?: boolean, selectedSpellCastingContext?: SpellCastingContext, bypassIncapacitated?: boolean, castMode?: 'ritual') => void;
  onToggleFavorite?: (c: ActionCard) => void;
  onOverrule?: (c: ActionCard, overrule: ReadonlySet<CardOverrule>) => void;
}) {
  if (cards.length === 0) return null;
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {cards.map(c => (
        <ActionCardRow
          key={actionCardIdentity(c)}
          card={c}
          entity={entity}
          onUse={onUse}
          isFavorite={isFavoriteCard(entity, c)}
          onToggleFavorite={onToggleFavorite}
          onOverrule={onOverrule}
        />
      ))}
    </View>
  );
}

// ── Universal actions (always available, no class/resource involved) ──────────
// Every creature can take these on its turn regardless of class or level — the
// app has no Feature/resource driving them (there's nothing to "spend"), so
// they never show up as actionCards the way spells/class features do. Purely
// a reference list, collapsed by default since it's rarely-needed reminder
// text rather than something reached for every turn.

const UNIVERSAL_ACTIONS: { name: string; blurb: string }[] = [
  { name: 'Dash', blurb: "Gain extra movement for the turn, equal to your speed." },
  { name: 'Disengage', blurb: "Your movement doesn't provoke opportunity attacks for the rest of the turn." },
  { name: 'Dodge', blurb: 'Until your next turn, attacks against you have disadvantage if you can see the attacker, and you have advantage on Dexterity saves.' },
  { name: 'Help', blurb: 'Aid an ally on a task, granting advantage on their next check for it, or on their next attack against a creature within 5 feet of you.' },
  { name: 'Hide', blurb: 'Make a Stealth check to try to become unseen and unheard.' },
  { name: 'Ready', blurb: 'Prepare to act later this round — choose a trigger, then use your reaction to take the readied action when it happens.' },
  { name: 'Search', blurb: "Devote your full attention to finding something, usually with a Perception or Investigation check." },
  { name: 'Use an Object', blurb: 'Interact with a second object or feature of the environment this turn, beyond the one free interaction you already get.' },
];

/** Universal actions a feature/condition forbids: an effect on target `disable_action:<name>`
 *  (e.g. `disable_action:dash` from the Braced condition) with operation 'set' and a truthy value. */
function disabledUniversalActions(entity: Entity): Set<string> {
  const out = new Set<string>();
  for (const ae of collectAllEffects(entity)) {
    const e = ae.effect;
    if (e.operation === 'set' && e.value && e.target.startsWith('disable_action:')) {
      out.add(e.target.slice('disable_action:'.length).toLowerCase());
    }
  }
  return out;
}

function UniversalActionsSection({ entity }: { entity: Entity }) {
  const [open, setOpen] = useState(false);
  const disabled = disabledUniversalActions(entity);
  return (
    <View style={styles.section}>
      <Pressable style={styles.universalHeader} onPress={() => setOpen(o => !o)}>
        <Text style={styles.sectionTitle}>OTHER ACTIONS (ALWAYS AVAILABLE)</Text>
        <Text style={styles.universalChevron}>{open ? '▲' : '▼'}</Text>
      </Pressable>
      {open && UNIVERSAL_ACTIONS.map(a => (
        <View key={a.name} style={styles.universalRow}>
          <Text style={[styles.universalName, disabled.has(a.name.toLowerCase()) && { textDecorationLine: 'line-through', opacity: 0.6 }]}>{a.name}</Text>
          <Text style={styles.universalBlurb}>
            {disabled.has(a.name.toLowerCase()) ? "Unavailable right now — an active condition or feature forbids it." : a.blurb}
          </Text>
        </View>
      ))}
    </View>
  );
}

// ── Triggered features (trigger text, but no activation — no card to show) ────
// Sneak Attack is the headline example: passive:true, no activation at all, so
// generateActionCard's own gate never produces a card for it. Same collapsed
// reference-list shape as UniversalActionsSection, but DYNAMIC — driven by the
// entity's own active features instead of a hardcoded list.

function TriggeredFeaturesSection({ entity }: { entity: Entity }) {
  const [open, setOpen] = useState(false);
  const triggered = getTriggeredFeatures(entity);
  if (triggered.length === 0) return null;
  return (
    <View style={styles.section}>
      <Pressable style={styles.universalHeader} onPress={() => setOpen(o => !o)}>
        <Text style={styles.sectionTitle}>TRIGGERED FEATURES</Text>
        <Text style={styles.universalChevron}>{open ? '▲' : '▼'}</Text>
      </Pressable>
      {open && triggered.map(f => (
        <View key={f.id} style={styles.universalRow}>
          <Text style={styles.universalName}>{f.name}</Text>
          <Text style={styles.universalBlurb}>{f.trigger}</Text>
        </View>
      ))}
    </View>
  );
}

// ── Tab Actions ───────────────────────────────────────────────────────────────

interface Props {
  entity:       Entity;
  rules?:       CampaignRules;
  onEntityUpdate?: (updated: Entity) => void;
  /** Closure item 16 — the one authoritative End Turn entry point, shared
   *  verbatim with the Character and Spells tabs (see app/sheet/[id].tsx's
   *  handleEndTurn). Optional only so this component doesn't hard-require
   *  it in contexts that never render the End Turn button. */
  onEndTurn?: () => void;
}

function TabActionsInner({ entity, rules, onEntityUpdate, onEndTurn }: Props) {
  const [activeCard, setActiveCard] = useState<ActionCard | null>(null);
  // A-57: set instead of activeCard when a card declares activation.options
  // — the picker must resolve BEFORE spending, since handleUse below
  // otherwise spends immediately on tap. Rules-engine blocker RE-AUDIT
  // closure 2F: carries the bypass/context decision ALONGSIDE the card, not
  // just the card alone — see PendingActionUse's own doc comment.
  const [pendingUse, setPendingUse] = useState<PendingActionUse | null>(null);
  // Extra Attack sequence closure: which attack of the CURRENT Attack action
  // sequence comes next, plus the opaque `sequenceId` token correlating every
  // call in this sequence — transient UI-only state, never persisted (the
  // character only ever records entity.attackSequence, the ENGINE's own
  // authoritative, transient record — see AttackSequenceState's doc comment,
  // types.ts). `attackNumber`/`totalAttacks` here are for DISPLAY only (which
  // Alert prompt to show next); they are never trusted by the engine — every
  // call still passes `{ sequenceId }` and the engine re-derives the real
  // count from entity.attackSequence itself (Part N: UI may display sequence
  // state, but engine/application validation enforces it independently).
  // Null whenever no sequence is in progress (the overwhelmingly common case
  // for a character without Extra Attack).
  const [attackSequence, setAttackSequence] = useState<{ sequenceId: string; totalAttacks: number; attackNumber: number } | null>(null);

  const { requestPayment, paymentChooser } = useSpellPayment(entity);
  const cardContent = useCardContent(entity);
  const all        = (entity.actionCards ?? []).filter(c => c.tabs.includes('actions'));
  const actions      = all.filter(c => c.activation.actionType === 'action');
  const bonusActions = all.filter(c => c.activation.actionType === 'bonus_action');
  const reactions    = all.filter(c => c.activation.actionType === 'reaction');
  // 'free' — usable alongside another action (e.g. a maneuver riding a normal
  // attack) rather than costing its own action/bonus action/reaction.
  const freeActions  = all.filter(c => c.activation.actionType === 'free');

  // Extra Attack / action-structure batch, Part C: the Attack action's own
  // attack opportunities are exactly the cards flagged isWeaponAttack (see
  // that field's own doc comment, types.ts) — never every 'action'-type
  // card (that would wrongly include e.g. Second Wind). Shown as a
  // dedicated "Attack (N attacks)" entry ONLY when the character actually
  // has more than the base 1 (attackActionAttacks — see DerivedStats' own
  // doc comment) AND owns at least one such attack right now; a character
  // without Extra Attack never sees this at all, and their individual
  // weapon-attack cards below are completely unaffected.
  const eligibleAttacks = actions.filter(c => c.isWeaponAttack);
  const attackActionCount = entity.derived.attackActionAttacks ?? 1;
  const showAttackAction = attackActionCount > 1 && eligibleAttacks.length > 0;
  const canStartAttackAction = eligibleAttacks.some(c => c.available || c.incapacitatedOverridable);

  // Part C5/C9: one Alert-style chooser per attack, mirroring this file's
  // existing "Cast as..." context-chooser convention exactly — no target
  // binding (this app never models targets on any card, so C9's "each
  // attack may pick its own target" is already true by construction: the
  // player just says who out loud at the table), no forced same-weapon
  // (C4: recomputed fresh every call, so attack 2 can pick a different
  // card than attack 1), and no auto-roll (C5: picking a card here only
  // resolves payment/economy — the roll/manual-entry UseModal below still
  // requires its own explicit tap, exactly like a standalone attack).
  //
  // Extra Attack sequence closure, Part O: "Done"/"Cancel" both call
  // closeSequence() — a no-op via endAttackSequence when nothing has
  // succeeded yet (Cancel before attack 1: entity.attackSequence was never
  // set), and an explicit close of the authoritative engine-side record
  // otherwise (Done after 1+ successful attacks) so a stale sequenceId can
  // never be resumed later in the same turn.
  function openAttackChooser(attackNumber: number, totalAttacks: number, sequenceId: string) {
    const eligible = actions.filter(c => c.isWeaponAttack);
    if (eligible.length === 0) { closeSequence(); return; }
    Alert.alert(
      `Attack ${attackNumber} of ${totalAttacks}`,
      undefined,
      [
        ...eligible.map(card => ({
          text: card.name,
          onPress: () => handleAttackChoice(card, attackNumber, totalAttacks, sequenceId),
        })),
        { text: attackNumber > 1 ? 'Done' : 'Cancel', style: 'cancel' as const, onPress: () => closeSequence() },
      ],
    );
  }

  function closeSequence() {
    setAttackSequence(null);
    if (!onEntityUpdate) return;
    const closed = endAttackSequence(entity);
    // endAttackSequence is a no-op (returns the same reference) when there
    // was nothing to close — e.g. Cancel before any attack succeeded — so
    // this never pushes a spurious no-op update, matching every other
    // caller's `if (updated === entity) return;` convention in this file.
    if (closed !== entity) onEntityUpdate(closed);
  }

  // Part C7/H: calls applyActionCardUse DIRECTLY (weapon attacks never
  // carry a spell-slot resourceCost, so useSpellPayment's chooser would
  // just call its commit callback immediately anyway) with the SAME
  // `sequenceId` token on every call of this sequence — the engine (not
  // this attackNumber param, which is display-only) decides whether this is
  // the paying lead attack or a bypass-eligible chained one, by matching the
  // token against entity.attackSequence (see applyActionCardUse's own doc
  // comment for the full authority model). Preserves Use Anyway (K13) for a
  // lead attack blocked only by incapacitation, and preserves item-instance
  // stale-attack rejection (H2/K14) via the exact same revalidation
  // applyActionCardUse already does for every card.
  function handleAttackChoice(card: ActionCard, attackNumber: number, totalAttacks: number, sequenceId: string, bypassIncapacitated?: boolean) {
    if (!onEntityUpdate || !rules) return;
    const updated = applyActionCardUse(entity, card, rules, undefined, undefined, undefined, undefined, cardContent, bypassIncapacitated, undefined, { sequenceId });
    if (updated === entity) {
      if (!bypassIncapacitated && card.incapacitatedOverridable) {
        Alert.alert(
          `${card.name}: ${card.unavailableReason ?? 'Incapacitated'}`,
          'Use it anyway as a one-off table ruling? This does not change HP, conditions, or death-save state.',
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Use Anyway', onPress: () => handleAttackChoice(card, attackNumber, totalAttacks, sequenceId, true) },
          ],
        );
        return;
      }
      // Stale/removed weapon (H2), an exhausted/rejected sequence, or some
      // other now-illegal attack — never retargets a different same-
      // definition instance; the player picks again or ends the sequence.
      // The already-spent Action (if this isn't the lead attack) is
      // unaffected either way, and the count never advanced (Part J).
      Alert.alert(`Can't use ${card.name}`, card.unavailableReason ?? 'That attack is no longer available.', [
        { text: 'Try Again', onPress: () => openAttackChooser(attackNumber, totalAttacks, sequenceId) },
        { text: 'End Attack Action', style: 'cancel', onPress: () => closeSequence() },
      ]);
      return;
    }
    onEntityUpdate(updated);
    setActiveCard(card); // same roll/manual-entry UseModal every standalone attack already uses
    // Part C6/C7/E: the NEXT prompt is driven by the engine's OWN post-use
    // record (updated.attackSequence), never a locally-incremented counter —
    // null means the engine itself closed the sequence (exhausted after this
    // attack), so the chooser simply doesn't reopen. This is what makes
    // "cancel before the first attack" spend nothing (this function is never
    // called at all) and "stop after attack 1 of 2" leave the Action spent
    // with the second opportunity discarded — never a second Action, never
    // forced completion.
    const active = updated.attackSequence;
    setAttackSequence(active ? { sequenceId, totalAttacks: active.maxAttacks, attackNumber: active.usedAttacks + 1 } : null);
  }

  // Part H: the roll/manual-entry modal closing is what advances to the
  // NEXT attack chooser (if any remain) — so the player sees their damage
  // result before being asked to pick the next attack, and a sequence with
  // no attacks left to make (or that was ended early via "Done"/"End
  // Attack Action") never reopens anything.
  function handleCloseUseModal() {
    setActiveCard(null);
    if (attackSequence) openAttackChooser(attackSequence.attackNumber, attackSequence.totalAttacks, attackSequence.sequenceId);
  }

  const handleUse = useCallback((card: ActionCard, bypassSpellPreparation?: boolean, selectedSpellCastingContext?: SpellCastingContext, bypassIncapacitated?: boolean, castMode?: 'ritual') => {
    if (card.activation.options && card.activation.options.length > 0) {
      // Rules-engine blocker RE-AUDIT closure 2F (extended, HIGH batch C7/C8):
      // preserve whatever source/Cast-Anyway/Use-Anyway decision
      // ActionCardRow already made (bypassSpellPreparation/
      // selectedSpellCastingContext/bypassIncapacitated/castMode), not just
      // the bare card — handleChooseOption below reads these back out once
      // the option is picked.
      setPendingUse({ card, bypassSpellPreparation, selectedSpellCastingContext, bypassIncapacitated, castMode });
      return;
    }
    if (!onEntityUpdate || !rules) {
      // No update handler — just show the roll modal.
      setActiveCard(card);
      return;
    }
    // Rules-completeness batch (ritual casting), A4: never request a slot
    // payment for a ritual cast — the chooser modal simply never opens.
    if (castMode === 'ritual') {
      const updated = applyActionCardUse(entity, card, rules, undefined, undefined, bypassSpellPreparation, selectedSpellCastingContext, cardContent, bypassIncapacitated, castMode);
      if (updated === entity) return;
      onEntityUpdate(updated);
      setActiveCard(card);
      return;
    }
    // Always run applyActionCardUse, even for cost-less cards (cantrips,
    // at-will attacks) — it already no-ops correctly when there's nothing
    // to spend (see its own cost-branch), but a cost-less concentration
    // cantrip (True Strike, etc.) still needs the concentration-tracking
    // half to run, which previously never fired because this whole call
    // was gated on resourceCost being truthy.
    requestPayment(card, undefined, payment => {
      const updated = applyActionCardUse(entity, card, rules, undefined, payment, bypassSpellPreparation, selectedSpellCastingContext, cardContent, bypassIncapacitated);
      if (updated === entity) return;
      onEntityUpdate(updated);
      setActiveCard(card);
    });
  }, [entity, rules, onEntityUpdate, requestPayment, cardContent]);

  const handleChooseOption = useCallback((option: ActivationOption) => {
    const pending = pendingUse;
    setPendingUse(null);
    if (!pending) return;
    const { card, bypassSpellPreparation, selectedSpellCastingContext, bypassIncapacitated, castMode } = pending;
    if (!onEntityUpdate || !rules) return;
    if (castMode === 'ritual') {
      const updated = applyActionCardUse(entity, card, rules, option, undefined, bypassSpellPreparation, selectedSpellCastingContext, cardContent, bypassIncapacitated, castMode);
      if (updated === entity) return;
      onEntityUpdate(updated);
      setActiveCard(card);
      return;
    }
    requestPayment(card, option, payment => {
      const updated = applyActionCardUse(entity, card, rules, option, payment, bypassSpellPreparation, selectedSpellCastingContext, cardContent, bypassIncapacitated);
      if (updated === entity) return;
      onEntityUpdate(updated);
      setActiveCard(card);
    });
  }, [entity, rules, onEntityUpdate, pendingUse, requestPayment, cardContent]);

  // Overrule: the card is used past the stops the person named, and nothing else (actionUse.ts cardOverrulable).
  const handleOverrule = useCallback((card: ActionCard, overrule: ReadonlySet<CardOverrule>) => {
    if (!onEntityUpdate || !rules) return;
    const run = (payment?: SpellPaymentOption) => {
      const updated = applyActionCardUse(entity, card, rules, undefined, payment, undefined, undefined, cardContent, undefined, undefined, undefined, overrule);
      if (updated === entity) { Alert.alert('Not done', `${card.name} is blocked by something that cannot be overruled.`); return; }
      onEntityUpdate(updated);
      setActiveCard(card);
    };
    if (overrule.has('no_slot') || card.activation.resourceCost?.resourceId !== 'spell_slots') run();
    else requestPayment(card, undefined, run);
  }, [entity, rules, onEntityUpdate, requestPayment, cardContent]);

  const handleToggleFavorite = useCallback((card: ActionCard) => {
    if (onEntityUpdate) onEntityUpdate(toggleFavoriteTag(entity, card));
  }, [entity, onEntityUpdate]);

  function rollForCard(crit: boolean): DiceRoll | null {
    if (!activeCard) return null;
    const plain = activeCard.layer2.match(/(\d+d\d+(?:[+-]\d+)?)/)?.[1];
    if (!plain) return null;
    const expr = withDamageDieRule(plain, activeCard.damageDieRule);   // Great Weapon Fighting
    const finalExpr = crit ? doubleDiceCount(expr) : expr;
    // rollAndLog (not a bare rollExpression call) so a card roll shows up in
    // the same shared history as GlobalDiceRoller's — item 11 (roll
    // improvements): these used to be two disconnected roll logs.
    try { return useDiceLogStore.getState().rollAndLog(finalExpr, activeCard.name, true); }
    catch { return null; }
  }

  const isEmpty = all.length === 0;

  function handleRevert() {
    if (!rules || !onEntityUpdate) return;
    onEntityUpdate(endWildShape(entity, rules));
  }

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
      {/* Closure item 16: calls the ONE shared onEndTurn handler
          (app/sheet/[id].tsx's handleEndTurn) instead of computing
          playerEndTurn() locally and routing it through this tab's own
          differently-labeled onEntityUpdate — guarantees identical
          timeline label/category/sync/undo behavior regardless of which
          tab End Turn is pressed from. No preview gate (advancing a turn
          is expected/mundane, not a surprising commit). */}
      {onEndTurn && (
        <Pressable
          style={styles.endTurnBtn}
          onPress={onEndTurn}
        >
          <Text style={styles.endTurnBtnTxt}>⏭ End Turn</Text>
        </Pressable>
      )}
      {entity.wildShapeState?.active && (
        <View style={styles.wildShapeBanner}>
          <View style={{ flex: 1 }}>
            <Text style={styles.wildShapeBannerTitle}>🐾 Wild Shape Active</Text>
            <Text style={styles.wildShapeBannerSub}>
              Beast HP: {entity.wildShapeState.beastHp}/{entity.wildShapeState.beastHpMax}
            </Text>
          </View>
          <Pressable style={styles.revertBtn} onPress={handleRevert}>
            <Text style={styles.revertBtnTxt}>Revert</Text>
          </Pressable>
        </View>
      )}
      {isEmpty && (
        <View style={styles.empty}>
          <Text style={styles.emptyIcon}>⚔️</Text>
          <Text style={styles.emptyTxt}>No action cards yet.</Text>
          <Text style={styles.emptySubTxt}>Level up or learn spells to unlock abilities.</Text>
        </View>
      )}
      {/* Extra Attack / action-structure batch, Part I: kept minimal — one
          entry, only when it's actually meaningful, no combat planner. */}
      {showAttackAction && (
        <Pressable
          style={[styles.attackActionBtn, !canStartAttackAction && styles.attackActionBtnDisabled]}
          disabled={!canStartAttackAction}
          onPress={() => openAttackChooser(1, attackActionCount, generateSequenceId())}
        >
          <Text style={styles.attackActionBtnTxt}>⚔️ Attack</Text>
          <Text style={styles.attackActionBtnSub}>{attackActionCount} attacks</Text>
        </Pressable>
      )}
      <Section title="ACTIONS"       cards={actions}      entity={entity} onUse={handleUse} onToggleFavorite={handleToggleFavorite} onOverrule={onEntityUpdate && rules ? handleOverrule : undefined} />
      <Section title="BONUS ACTIONS" cards={bonusActions} entity={entity} onUse={handleUse} onToggleFavorite={handleToggleFavorite} onOverrule={onEntityUpdate && rules ? handleOverrule : undefined} />
      <Section title="REACTIONS"     cards={reactions}    entity={entity} onUse={handleUse} onToggleFavorite={handleToggleFavorite} onOverrule={onEntityUpdate && rules ? handleOverrule : undefined} />
      <Section title="FREE (WITH ANOTHER ACTION)" cards={freeActions} entity={entity} onUse={handleUse} onToggleFavorite={handleToggleFavorite} onOverrule={onEntityUpdate && rules ? handleOverrule : undefined} />
      <UniversalActionsSection entity={entity} />
      <TriggeredFeaturesSection entity={entity} />

      {paymentChooser}
      <UseModal
        card={activeCard}
        riders={activeCard && onEntityUpdate ? ridersForCard(entity, activeCard) : []}
        onApplyRider={offer => onEntityUpdate?.(applyRider(entity, offer.featureId, offer.riderId))}
        outcomeOffers={activeCard && onEntityUpdate ? outcomeOffersForCard(entity, activeCard) : []}
        onConfirmOutcome={offer => onEntityUpdate?.(confirmOutcome(entity, offer.featureId, offer.key, rules))}
        onDismissOutcomes={() => activeCard && onEntityUpdate?.(dismissOutcomes(entity, activeCard.featureId))}
        onRoll={rollForCard}
        onClose={handleCloseUseModal}
      />
      <ActivationOptionModal
        entity={entity}
        card={pendingUse?.card ?? null}
        onChoose={handleChooseOption}
        onClose={() => setPendingUse(null)}
        bypassIncapacitated={pendingUse?.bypassIncapacitated}
      />
    </ScrollView>
  );
}

// EDIT-PERF-1: see TabCharacter.tsx's identical comment.
export const TabActions = memo(TabActionsInner);

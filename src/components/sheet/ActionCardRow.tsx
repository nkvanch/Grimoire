import { useState } from 'react';
import { View, Text } from 'react-native';
import { type CardOverrule, cardOverrulable } from '../../engine/actionUse';
import { cardDescription } from '../../engine/featureText';
import { needsPreparationOverride, isContextLegalForCastMode, formatCastingContextLabel } from '../../engine/spellCastingContext';
import { ActionCard, Entity, SpellCastingContext } from '../../engine/types';
import { Alert } from '../../utils/alert';
import { Pressable } from '../AccessibleControls';
import { CARD_COLORS, useCardContent } from './actionCardUi';
import { styles } from './tabActionsStyles';

// ── Action Card Row ───────────────────────────────────────────────────────────

interface CardRowProps {
  card:    ActionCard;
  /** Rules-engine blocker RE-AUDIT closure (1C) — needed to resolve the
   *  merged/ruleset-aware class list for the "Cast as..." chooser's labels
   *  (formatCastingContextLabel). */
  entity:  Entity;
  /**
   * Rules-engine blocker closure (1F — Quick Override on all normal cast
   * surfaces): the second param is the SAME `bypassSpellPreparation` flag
   * applyActionCardUse already accepts (actionUse.ts). The third param
   * (closure 1B/1D) is the EXACT SpellCastingContext the player is casting
   * through — passed straight to applyActionCardUse's own matching param.
   * The fourth param (HIGH batch, C4) is the SAME `bypassIncapacitated`
   * flag applyActionCardUse also accepts — "Use Anyway" for a card blocked
   * ONLY by 0HP/Unconscious. All optional so every existing non-spell
   * caller (a plain feature card's [Use]) is unaffected.
   */
  onUse:   (card: ActionCard, bypassSpellPreparation?: boolean, selectedSpellCastingContext?: SpellCastingContext, bypassIncapacitated?: boolean, castMode?: 'ritual') => void;
  /** Omit to hide the star entirely (not offered everywhere a card might render). */
  isFavorite?:       boolean;
  onToggleFavorite?: (card: ActionCard) => void;
  /** Overrule (the desktop's ADR-015): use a card past the stops the person names. Omitted: a blocked card stays N/A. */
  onOverrule?:       (card: ActionCard, overrule: ReadonlySet<CardOverrule>) => void;
}

/**
 * Rules-engine blocker closure (1F): Codex found an unprepared spell's card
 * on the Actions tab and on Favorites showed a hard-disabled "N/A" with no
 * Quick Override — table-first "Cast Anyway" (see TabSpells.tsx's own
 * identical prompt) only existed on the Spells tab. ActionCardRow is the
 * ONE component both of those surfaces already render through (TabActions'
 * own Section, and TabCharacter.tsx's Favorites section) — fixing it here
 * once covers every normal cast surface without a second/third
 * implementation, per the task's own "create/reuse one shared action-use
 * attempt path" requirement.
 *
 * `card.preparationOverridable` (see its own doc comment, types.ts) is true
 * ONLY when preparation is the entire reason a card is blocked — the button
 * stays enabled and labeled "Use" in that case (never "N/A"), and tapping
 * it prompts Cancel/Cast Anyway instead of calling onUse directly. Any
 * OTHER unavailability (no slot, action economy spent, ...) is unaffected:
 * still a hard-disabled "N/A", exactly as before.
 *
 * Rules-engine blocker RE-AUDIT closure (1C) — when the card carries 2+
 * MECHANICALLY DISTINCT casting sources (card.spellCastingContexts), tapping
 * Use shows a "Cast as..." chooser instead of silently picking one; a
 * deliberately-selected prep-blocked source still offers its own Cast
 * Anyway. Single-source spells (the overwhelming majority) and every
 * non-spell card skip this entirely.
 *
 * Rules-engine HIGH-batch closure (C): `card.incapacitatedOverridable` (see
 * its own doc comment, types.ts) is true ONLY when 0HP/Unconscious is the
 * entire remaining reason a card is blocked — same "stays enabled, prompts
 * Cancel/Use Anyway instead of a hard N/A" pattern as preparationOverridable
 * above, and the two compose independently (C7): a spell blocked by BOTH
 * preparation and status resolves the preparation decision first (via
 * castViaContext/the existing prompt below), then finalizeUse checks status
 * on top before actually calling onUse — so either, both, or neither
 * override can apply to one cast without one masking the other.
 */
export function ActionCardRow({ card, entity, onUse, isFavorite, onToggleFavorite, onOverrule }: CardRowProps) {
  const borderColor = CARD_COLORS[card.color];
  const [showText, setShowText] = useState(false);   // tapping the card shows what it does
  const blockedOnlyByPreparation = card.preparationOverridable === true;
  const blockedByIncapacitation = card.incapacitatedOverridable === true;
  const overridable = blockedOnlyByPreparation || blockedByIncapacitation;
  // Rules-completeness batch (ritual casting): a ritual-eligible spell is
  // never hard-disabled by a missing spell slot alone — ritual mode spends
  // none — so the row stays tappable and lets handlePress below offer the
  // ritual path even when card.available is false purely for that reason.
  // Execution (applyActionCardUse) revalidates ritual eligibility fresh
  // regardless, so this is a display-only relaxation, never a legality one.
  const genuinelyUnavailable = !card.available && !overridable && !card.ritualEligible;
  const stops = onOverrule && genuinelyUnavailable ? cardOverrulable(entity, card) : [];
  function pressOverrule() {
    const meaning = stops.map(r => (r.id === 'no_slot' ? 'No slot is spent.' : r.id === 'spent_resource' ? 'What is left is spent, never below none.' : 'The action stays used.')).join(' ');
    Alert.alert(`Overrule: ${card.name}`, `${stops.map(r => r.reason).join('\n')}\n\nUse it anyway? ${meaning}`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Overrule', onPress: () => onOverrule?.(card, new Set(stops.map(r => r.id))) },
    ]);
  }
  const cardContent = useCardContent(entity);

  // Rules-engine HIGH-batch closure (C4): the LAST step before actually
  // calling onUse — after any preparation decision is already resolved,
  // checks whether status (0HP/Unconscious) still needs its own one-off
  // "Use Anyway" on top. card.unavailableReason already carries the exact
  // "At 0 HP"/"Unconscious" text (see generateSpellCard/generateActionCard),
  // so the prompt always reflects the entity's real current state.
  //
  // `castMode` (rules-completeness batch — ritual casting) rides alongside
  // every other already-resolved decision (context, preparation override,
  // incapacitation override) all the way to onUse, exactly like
  // bypassSpellPreparation/context do — never a separate, parallel cast path.
  function finalizeUse(bypassSpellPreparation: boolean, context?: SpellCastingContext, castMode?: 'ritual') {
    if (blockedByIncapacitation) {
      Alert.alert(
        `${card.name}: ${card.unavailableReason ?? 'Incapacitated'}`,
        'Use it anyway as a one-off table ruling? This does not change HP, conditions, or death-save state.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Use Anyway', onPress: () => onUse(card, bypassSpellPreparation, context, true, castMode) },
        ],
      );
      return;
    }
    onUse(card, bypassSpellPreparation, context, undefined, castMode);
  }

  // Rules-completeness batch (ritual casting), one-issue closure: checks the
  // SELECTED context against the ACTUAL cast mode (isContextLegalForCastMode
  // — `ritualLegal` for a ritual attempt, `legal` for a normal one), never a
  // bare `context.legal` unconditionally — that was exactly the bug this
  // closure fixes (a legal Wizard-spellbook ritual was still prompting Cast
  // Anyway because the check never looked at castMode at all).
  // needsPreparationOverride further distinguishes "genuinely blocked by
  // preparation on a source that can cast this way at all" (offer the
  // override) from "this source has no ritual-casting capability
  // whatsoever" (silently decline — Cast Anyway can't fix that, and
  // applyActionCardUse refuses it unconditionally regardless).
  function castViaContext(context: SpellCastingContext, castMode?: 'ritual') {
    if (needsPreparationOverride(context, castMode)) {
      Alert.alert(
        `${card.name} is not prepared.`,
        'Cast it anyway as a one-off? This does not add it to your prepared list.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Cast Anyway', onPress: () => finalizeUse(true, context, castMode) },
        ],
      );
      return;
    }
    if (!isContextLegalForCastMode(context, castMode)) return; // ritual-incapable source — nothing to override, decline silently
    finalizeUse(false, context, castMode);
  }

  // Every decision that used to start directly at handlePress — context
  // choice, preparation override — now runs identically for BOTH a normal
  // cast and a ritual cast, just carrying `castMode` through unchanged.
  // Ritual does NOT bypass preparation on its own (see castMode's own doc
  // comment, actionUse.ts) — an unprepared ritual-eligible spell still
  // prompts the SAME Cast Anyway here, exactly like a normal cast — UNLESS
  // the SELECTED context's own `ritualLegal` says otherwise (a Wizard
  // ritual straight from the spellbook), checked live below rather than
  // via the static, generation-time, normal-legality-only
  // `blockedOnlyByPreparation` flag — the exact mismatch this closure fixes.
  function proceed(castMode?: 'ritual') {
    if (card.spellCastingContexts && card.spellCastingContexts.length > 1) {
      const classDefs = cardContent.classDefs;
      Alert.alert(
        `Cast ${card.name} as...`,
        undefined,
        [
          ...card.spellCastingContexts.map(ctx => ({
            text: formatCastingContextLabel(entity, ctx, classDefs),
            onPress: () => castViaContext(ctx, castMode),
          })),
          { text: 'Cancel', style: 'cancel' as const },
        ],
      );
      return;
    }
    const context = card.spellCastingContext;
    if (context) {
      castViaContext(context, castMode);
      return;
    }
    // No SpellCastingContext at all — a non-spell feature card, for which
    // `preparationOverridable`/ritual casting were never a concept in the
    // first place (see generateActionCard vs generateSpellCard). Unchanged.
    if (blockedOnlyByPreparation) {
      Alert.alert(
        `${card.name} is not prepared.`,
        'Cast it anyway as a one-off? This does not add it to your prepared list.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Cast Anyway', onPress: () => finalizeUse(true, undefined, castMode) },
        ],
      );
      return;
    }
    finalizeUse(false, undefined, castMode);
  }

  // Rules-completeness batch (ritual casting), A3: an explicit peer choice
  // — never a silent default to either mode — offered only when the spell
  // is actually ritual-capable through some source the character has.
  function handlePress() {
    if (card.ritualEligible) {
      Alert.alert(
        `Cast ${card.name} as...`,
        undefined,
        [
          { text: 'Cast Normally', onPress: () => proceed(undefined) },
          { text: 'Cast as Ritual (no slot, +10 min)', onPress: () => proceed('ritual') },
          { text: 'Cancel', style: 'cancel' as const },
        ],
      );
      return;
    }
    proceed(undefined);
  }

  return (
    <View style={[styles.card, { borderLeftColor: borderColor }]}>
      {onToggleFavorite && (
        <Pressable hitSlop={8} onPress={() => onToggleFavorite(card)}>
          <Text style={[styles.star, isFavorite && styles.starActive]}>{isFavorite ? '★' : '☆'}</Text>
        </Pressable>
      )}
      <Pressable style={styles.cardBody} onPress={() => setShowText(s => !s)} accessibilityLabel={`${card.name}: ${showText ? 'hide' : 'show'} what it does`}>
        <Text style={styles.cardName}>{card.name}</Text>
        <Text style={styles.cardL1}>{card.layer1}</Text>
        <Text style={styles.cardL2}>{card.layer2}</Text>
        {card.layer3 ? <Text style={styles.cardL3}>{card.layer3}</Text> : null}
        {card.triggerNote ? <Text style={styles.cardOutcome}>{card.triggerNote}</Text> : null}
        {card.outcomes.map((line, i) => (
          <Text key={i} style={styles.cardOutcome}>{line}</Text>
        ))}
        {!card.available && card.unavailableReason && (
          <Text style={styles.cardUnavail}>{card.unavailableReason}</Text>
        )}
        {showText && <Text style={styles.cardText}>{cardDescription(entity, card) ?? 'Nothing more is recorded for this.'}</Text>}
      </Pressable>
      {stops.length > 0 ? (
        <Pressable style={styles.useBtn} onPress={pressOverrule} accessibilityLabel={`Overrule and use ${card.name}`}>
          <Text style={styles.useBtnTxt}>Overrule</Text>
        </Pressable>
      ) : (
      <Pressable
        style={[styles.useBtn, genuinelyUnavailable && styles.useBtnDisabled]}
        disabled={genuinelyUnavailable}
        onPress={handlePress}
        // its own label: Android reuses this button's view when it replaces the Overrule button and kept "Overrule and use ..."
        accessibilityLabel={`Use ${card.name}`}
      >
        <Text style={[styles.useBtnTxt, genuinelyUnavailable && styles.useBtnTxtDisabled]}>
          {card.available || overridable || card.ritualEligible ? 'Use' : 'N/A'}
        </Text>
      </Pressable>
      )}
    </View>
  );
}

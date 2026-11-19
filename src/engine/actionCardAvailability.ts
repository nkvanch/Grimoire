import { actionSpent, isDead, isIncapacitated, incapacitationReason } from './combatState';
import { hasLegalSpellPayment } from './spellPayment';
import { Entity, FeatureInstance, Feature } from './types';

/**
 * Active features with a `trigger` but no `activation` — Sneak Attack is
 * the headline example (passive:true, no activation at all, so
 * generateActionCard's own gate never produces a card for it). These are
 * surfaced instead by TabActions.tsx's TriggeredFeaturesSection, a plain
 * reference list alongside the existing UniversalActionsSection — never a
 * synthesized fake activation, which would misrepresent something the app
 * doesn't actually dispatch.
 */
export function getTriggeredFeatures(entity: Entity): FeatureInstance[] {
  return entity.features.filter(f =>
    f.isActive && f.trigger && (f.level === null || f.level <= entity.identity.level)
  );
}

// ── Availability ──────────────────────────────────────────────────────────────

const ACTION_ECONOMY_LABEL: Record<string, string> = {
  action: 'action', bonus_action: 'bonus action', reaction: 'reaction',
};

/**
 * Returns whether a feature can currently be used.
 * Checks turn/action-economy usage (A-25), then resource pools and spell
 * slot availability. The turn-economy check only applies when
 * entity.turnState is non-null — see that type's own doc comment for why
 * null means "not actively tracked, don't gate anything."
 */
/**
 * Turn-economy + resource/payment legality only — deliberately has NO
 * status/incapacitation check, so isFeatureAvailable below can apply the
 * 0HP/Unconscious/Dead status gate exactly once, on top of an unambiguous
 * resource verdict, rather than the two concerns tangled together. This is
 * also what a `bypassIncapacitated` Quick Override consults on its own
 * (C6/C10) — status is never itself a "resource," so bypassing it can never
 * accidentally also bypass a missing slot/resource/action-economy failure.
 */
export function resourceAndEconomyLegal(
  feature: Pick<Feature, 'activation'>,
  entity: Entity,
  /**
   * Extra Attack sequence closure (Part D — action type safety): narrowly
   * skips ONLY the "already used this turn" action-economy gate below,
   * without touching anything else this function checks (resource pools,
   * spell slots, activation options). Used for a ritual cast and a
   * validated chained attack — both have a real 'action'/'bonus_action'/
   * 'reaction' actionType that must stay intact for every OTHER purpose
   * (display, classification), so the old approach of rewriting
   * activation.actionType to 'passive' to sneak past this same gate is
   * replaced by this explicit, narrow parameter instead (see
   * applyActionCardUse, actionUse.ts, for the two callers). Defaults to
   * false so every existing caller/behavior is unaffected.
   */
  bypassActionEconomySlot: boolean = false,
): { legal: boolean; reason: string | null } {
  const actionType = feature.activation?.actionType;
  if (!bypassActionEconomySlot && entity.turnState && actionType && actionType in ACTION_ECONOMY_LABEL) {
    const used = actionType === 'action' ? actionSpent(entity.turnState)
      : actionType === 'bonus_action' ? entity.turnState.bonusActionUsed
      : entity.turnState.reactionUsed;
    if (used) {
      return { legal: false, reason: `Already used your ${ACTION_ECONOMY_LABEL[actionType]} this turn.` };
    }
    const also = feature.activation?.alsoCosts;
    if (also && also !== actionType && (also === 'action' ? actionSpent(entity.turnState) : entity.turnState.bonusActionUsed)) {
      return { legal: false, reason: `Needs your ${ACTION_ECONOMY_LABEL[also]} as well, and it is already used this turn.` };
    }
  }

  const options = feature.activation?.options;
  if (options?.length) {
    const legal = options.some(option => resourceAndEconomyLegal({
      ...feature, activation: { ...feature.activation!, options: undefined,
        resourceCost: option.resourceCost ?? feature.activation!.resourceCost },
    }, entity, bypassActionEconomySlot).legal);
    return { legal, reason: legal ? null : 'No legal activation payment remaining.' };
  }
  const cost = feature.activation?.resourceCost;
  if (!cost) return { legal: true, reason: null };

  if (cost.resourceId === 'spell_slots') {
    if (!entity.spellcasting) {
      return { legal: false, reason: 'No spellcasting.' };
    }
    const tier = cost.spellSlotTier ?? 1;
    // Re-audit items 1/2 (A12): the ONE shared resolver — legal-payment
    // logic used to be hand-duplicated here and in applyActionCardUse's
    // actual debit, and they disagreed (this function accepted a higher or
    // pact slot; the debit only ever touched the exact tier). Both now call
    // the same spellPayment.ts functions, so "available" and "what gets
    // spent" can never diverge again.
    if (hasLegalSpellPayment(entity.spellcasting, tier)) {
      return { legal: true, reason: null };
    }
    return { legal: false, reason: `No spell slots of level ${tier}+ remaining.` };
  }

  const resource = entity.resources.custom.find(r => r.id === cost.resourceId);
  if (!resource) {
    return { legal: false, reason: `Resource "${cost.resourceId}" not found.` };
  }
  if (resource.current < cost.quantity) {
    return { legal: false, reason: `${resource.name}: ${resource.current}/${resource.maximum} remaining.` };
  }

  return { legal: true, reason: null };
}

export function isFeatureAvailable(
  feature: Pick<Feature, 'activation'>,
  entity: Entity,
  /**
   * Rules-engine HIGH-batch closure (C4/C6/C10) — table-first, one-off
   * Quick Override for the 0HP/Unconscious status restriction ONLY ("Use
   * Anyway"). Bypasses NOTHING else: a missing spell slot/Pact slot,
   * insufficient resource, or an already-spent action/bonus/reaction still
   * blocks normally (resourceAndEconomyLegal is computed independently,
   * before this flag is even consulted). Never bypasses the hard `isDead`
   * blocker. Defaults to false so every existing caller — including card
   * GENERATION, which must always reflect the TRUE default legality so the
   * UI can offer the override in the first place — is unaffected.
   */
  bypassIncapacitated: boolean = false,
  /**
   * Extra Attack sequence closure (Part D — action type safety): forwarded
   * straight to resourceAndEconomyLegal's own identically-named parameter —
   * see that function's doc comment. Replaces the previous mechanism (both
   * a ritual cast and a validated chained attack rewrote the feature's own
   * activation.actionType to 'passive' before calling this function) with an
   * explicit flag, so a chained attack's real actionType is preserved for
   * every other purpose. Defaults to false — unaffected for every existing
   * caller.
   */
  bypassActionEconomySlot: boolean = false,
): { available: boolean; reason: string | null; incapacitatedOverridable?: boolean } {
  // Dead: hard blocker, checked first, never overridable (C12).
  if (isDead(entity)) {
    return { available: false, reason: 'Dead' };
  }

  const { legal: resourceLegal, reason: resourceReason } = resourceAndEconomyLegal(feature, entity, bypassActionEconomySlot);
  if (!resourceLegal) {
    return { available: false, reason: resourceReason };
  }

  if (isIncapacitated(entity) && !bypassIncapacitated) {
    return {
      available: false,
      reason: incapacitationReason(entity),
      incapacitatedOverridable: true,
    };
  }

  return { available: true, reason: null };
}

import { useCallback } from 'react';
import { TimelineCategory } from '../../../db/timelineRepo';
import { applyDamage, applyHealing } from '../../../engine/combatDamage';
import { applyWildShapeDamage } from '../../../engine/combatWildShape';
import { endConcentration } from '../../../engine/concentration';
import { applyCondition, removeCondition } from '../../../engine/conditions';
import { SpellPaymentOption, commitSpellPayment, restoreSpellSlot } from '../../../engine/spellPayment';
import { Entity, CampaignRules, RulesetId, ContentDB, DurationTracker } from '../../../engine/types';
import { STEP_OPERATIONS } from '../../../store/pinningService';

export function useSheetCombatHandlers({ mutate, rules, entity, getMergedContentDB }: {
  mutate: (updater: (e: Entity) => Entity, label?: string, category?: TimelineCategory, operations?: readonly string[]) => void;
  rules: CampaignRules;
  entity: Entity | undefined;
  getMergedContentDB: (activeRuleset?: RulesetId, bannedIds?: Set<string>) => ContentDB;
}) {
  // ── Handlers (all pure engine calls → mutate) ─────────────────────────────

  const handleDamage = useCallback((amount: number, damageType?: string, isNonmagicalAttack?: boolean) => {
    // While Wild Shaped, damage hits the BEAST's hp pool, not the player's
    // real HP underneath first. See combat.ts's applyWildShapeDamage: the
    // beast-pool absorption step still has no resistance concept and
    // ignores damageType, but any OVERFLOW that carries into real HP once
    // the form reverts (rules-engine blocker fix) DOES resolve the
    // player's own resistance/vulnerability — so damageType is threaded
    // through either way, applyWildShapeDamage itself decides when it's
    // actually consulted. isNonmagicalAttack (rules-engine blocker RE-AUDIT
    // closure 3B) is the same table-first, per-hit fact the DM's Wild Shape
    // damage controls already expose, now threaded from the player's own
    // HpModal (TabCharacter.tsx) — never stored persistently on the entity.
    mutate(e => e.wildShapeState?.active
      ? applyWildShapeDamage(e, amount, rules, damageType, isNonmagicalAttack)
      : applyDamage(e, amount, rules, damageType), `Took ${amount}${damageType ? ` ${damageType}` : ''} damage`, 'combat',
      entity?.wildShapeState?.active ? STEP_OPERATIONS.wildShapeDamage : STEP_OPERATIONS.damage);
  }, [mutate, rules, entity?.wildShapeState?.active]);

  const handleHeal = useCallback((amount: number) => {
    // Per the book rule, healing has no effect on a Wild Shape beast form's
    // hit points — no-op while transformed, rather than incorrectly healing
    // the player's real HP underneath (which isn't the pool being damaged).
    mutate(e => e.wildShapeState?.active ? e : applyHealing(e, amount, rules), `Healed ${amount}`, 'combat', STEP_OPERATIONS.heal);
  }, [mutate, rules]);

  const handleAddCondition = useCallback((condId: string, duration: DurationTracker | null) => {
    // Merged (not official-only CONDITIONS_BY_ID) so a homebrew condition's
    // mechanical features attach the same way an official one's do (e.g.
    // Grappled sets speed to 0 in the pipeline) — audit findings CONTENT-8
    // / KNOWN_CONDITIONS-1.
    const condContent = getMergedContentDB(entity?.rulesetId).conditions.find(c => c.id === condId);
    mutate(e => applyCondition(e, condId, 'manual', rules, condContent?.features, duration), `Added condition: ${condContent?.name ?? condId}`, 'combat', STEP_OPERATIONS.conditions);
  }, [mutate, rules, getMergedContentDB, entity?.rulesetId]);

  const handleRemoveCondition = useCallback((condId: string) => {
    mutate(e => removeCondition(e, condId, rules), `Removed condition: ${getMergedContentDB(entity?.rulesetId).conditions.find(c => c.id === condId)?.name ?? condId}`, 'combat', STEP_OPERATIONS.conditions);
  }, [mutate, rules, getMergedContentDB, entity?.rulesetId]);

  const handleResourceChange = useCallback((resourceId: string, delta: number) => {
    const resourceName = entity?.resources.custom.find(r => r.id === resourceId)?.name ?? resourceId;
    mutate(e => ({
      ...e,
      resources: {
        ...e.resources,
        custom: e.resources.custom.map(r =>
          r.id === resourceId
            ? { ...r, current: Math.max(0, Math.min(r.maximum, r.current + delta)) }
            : r
        ),
      },
    }), `${delta > 0 ? 'Restored' : 'Spent'} ${resourceName}`, 'combat');
  }, [mutate, entity]);

  // Re-audit items 1/2 (A12): delegates to the one shared spendSpellSlot/
  // restoreSpellSlot resolver (src/engine/spellPayment.ts) instead of
  // hand-rolling the same used/total clamp a 4th time — that function
  // already enforces 0 <= used <= total unconditionally and no-ops rather
  // than ever letting a spend become a restoration or vice versa.
  const handleSpendSlot = useCallback((tier: string, kind: SpellPaymentOption['kind'] = 'normal') => {
    mutate(e => {
      if (!e.spellcasting) return e;
      return commitSpellPayment(e, { kind, tier: tier as import('../../../engine/spellPayment').SlotTier });
    }, `Spent level ${tier} spell slot`, 'spells', STEP_OPERATIONS.spellSlots);
  }, [mutate]);

  const handleRestoreSlot = useCallback((tier: string, kind: SpellPaymentOption['kind'] = 'normal') => {
    mutate(e => {
      if (!e.spellcasting) return e;
      const slots = restoreSpellSlot(e.spellcasting, { kind, tier: tier as import('../../../engine/spellPayment').SlotTier });
      if (slots === e.spellcasting) return e;
      return { ...e, spellcasting: slots };
    }, `Restored level ${tier} spell slot`, 'spells', STEP_OPERATIONS.spellSlots);
  }, [mutate]);

  // Manual End Concentration — the ONE handler both the Character and Spells
  // tabs call (same single-entry-point rule as handleEndTurn), so the
  // timeline label/category/undo/sync are identical from either tab. Also
  // removes the spell's linked effects (see endConcentration).
  const handleEndConcentration = useCallback((spellName: string) => {
    mutate(e => endConcentration(e, rules), `Ended concentration on ${spellName}`, 'spells');
  }, [mutate, rules]);
  return {
    handleDamage, handleHeal, handleAddCondition, handleRemoveCondition, handleResourceChange, handleSpendSlot, handleRestoreSlot,
    handleEndConcentration,
  };
}

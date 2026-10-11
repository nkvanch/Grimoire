// ============================================================================
// FILE: src/engine/outcomes.ts
// A feature's outcomes ("on a hit, regain a use of this feature") are consequences that depend on how the roll went, and the app
// does not resolve attack rolls: the table does. So using a card records which outcomes are waiting, the card then offers them as
// buttons, and the player or DM confirms the one that happened; only then do its effects run. Confirming (or dismissing) settles
// the use, so pressing it again changes nothing. A use that is never settled simply waits; a new use of the same feature replaces
// it, and a rest clears it. Nothing is applied just because a card was used.
// ============================================================================
import type { AbilityEffect, ActionCard, CampaignRules, Entity, Feature, OutcomeKey, OutcomeOffer } from './types';
import { applyAbilityEffects } from './combat';
import { DEFAULT_RULES } from '../store/characterStore';

const KEYS: OutcomeKey[] = ['hit', 'miss', 'success', 'failure'];
const LABEL: Record<OutcomeKey, string> = { hit: 'It hit', miss: 'It missed', success: 'The save succeeded', failure: 'The save failed' };

const effectsOf = (f: Feature, k: OutcomeKey): AbilityEffect[] => f.outcomes?.[k]?.effects ?? [];

function describe(effects: AbilityEffect[]): string {
  const parts: string[] = [];
  for (const e of effects) {
    if (e.type === 'restore_resource') parts.push(e.amount === 'full' ? `Restore ${e.resourceId.replace(/_/g, ' ')}` : `Regain ${e.amount} ${e.resourceId.replace(/_/g, ' ')}`);
    else if (e.type === 'apply_condition') parts.push(`Becomes ${e.conditionId.replace(/_/g, ' ')}`);
    else if (e.type === 'remove_condition') parts.push(`Ends ${e.conditionId.replace(/_/g, ' ')}`);
    else if (e.type === 'set_flag') parts.push(e.value ? `Sets ${e.flag.replace(/_/g, ' ')}` : `Clears ${e.flag.replace(/_/g, ' ')}`);
    else if (e.type === 'temp_hp') parts.push(`Temporary hit points ${e.dice}`);
    else if (e.type === 'heal_from_damage_taken') parts.push('Heal from damage taken');
    else if (e.type === 'grant_speed') parts.push(`${e.speedType} speed ${e.amount} ft`);
  }
  return parts.join(', ');
}

/** After a card is used: remember which of its outcomes carry effects, waiting for the table to say which happened. */
export function recordPendingOutcomes(entity: Entity, feature: Feature | undefined): Entity {
  if (!feature) return entity;
  const keys = KEYS.filter(k => effectsOf(feature, k).length > 0);
  const rest = (entity.pendingOutcomes ?? []).filter(p => p.featureId !== feature.id);
  if (keys.length === 0) return rest.length === (entity.pendingOutcomes ?? []).length ? entity : { ...entity, pendingOutcomes: rest };
  return { ...entity, pendingOutcomes: [...rest, { featureId: feature.id, keys }] };
}

/** The outcomes waiting on this card, as buttons: what to press if it happened, and what that does. */
export function outcomeOffersForCard(entity: Entity, card: ActionCard): OutcomeOffer[] {
  const pending = (entity.pendingOutcomes ?? []).find(p => p.featureId === card.featureId);
  const feature = entity.features.find(f => f.id === card.featureId);
  if (!pending || !feature) return [];
  return pending.keys.map(k => ({ featureId: feature.id, key: k, label: LABEL[k], effects: describe(effectsOf(feature, k)) }));
}

/** The table says this outcome happened: run its effects once and settle the use. Nothing waiting means nothing changes. */
export function confirmOutcome(entity: Entity, featureId: string, key: OutcomeKey, rules: CampaignRules = DEFAULT_RULES): Entity {
  const pending = (entity.pendingOutcomes ?? []).find(p => p.featureId === featureId);
  const feature = entity.features.find(f => f.id === featureId);
  if (!pending || !feature || !pending.keys.includes(key)) return entity;
  const settled: Entity = { ...entity, pendingOutcomes: (entity.pendingOutcomes ?? []).filter(p => p.featureId !== featureId) };
  return applyAbilityEffects(settled, effectsOf(feature, key), rules, feature.activation);
}

/** None of the waiting outcomes happened (or they are not wanted): settle the use with no effect. */
export function dismissOutcomes(entity: Entity, featureId: string): Entity {
  if (!(entity.pendingOutcomes ?? []).some(p => p.featureId === featureId)) return entity;
  return { ...entity, pendingOutcomes: (entity.pendingOutcomes ?? []).filter(p => p.featureId !== featureId) };
}

// ============================================================================
// FILE: src/engine/pipeline.ts
// recomputeDerived() is pure and cheap — call it after every mutation. It is the derived stats (derivedStats.ts)
// plus the action cards (actionCards.ts); everything else this module exports comes from derivedStats.ts.
// ============================================================================
import { Entity, CampaignRules } from './types';
import { recomputeStats } from './derivedStats';
import { generateAllActionCards } from './actionCards';
import { CardGenOptions } from './actionCardLayers';

export * from './derivedStats';
export * from './abilityMath';
export * from './collectEffects';
export * from './weaponAttackBonuses';
export * from './skillsAndSaves';

export function recomputeDerived(
  entity: Entity, rules: CampaignRules,
  content: Pick<CardGenOptions, 'classDefs' | 'homebrewSpells' | 'races' | 'items'> = {},
): Entity {
  const withDerived = recomputeStats(entity, rules, content);
  return { ...withDerived, actionCards: generateAllActionCards(withDerived, rules, content) };
}

// ============================================================================
// FILE: src/engine/infusionCapacity.ts
// bonus an active feature gives through a `stat_modifier` on target 'infusion_capacity' (a feat that adds two). A character with
// ============================================================================
import type { Entity } from './types';
import { maxInfusedItems } from './infusionRules';
import { collectAllEffects } from './pipeline';
import { getClassLevels } from './multiclass';
import { INFUSION_CLASS_ID } from './ruleset/dnd5e';

export const INFUSION_CAPACITY_TARGET = 'infusion_capacity';

export function infusionCapacity(entity: Entity): number {
  const artificer = getClassLevels(entity).find(c => String(c.classId) === INFUSION_CLASS_ID);
  const base = artificer ? maxInfusedItems(artificer.level) : 0;
  let bonus = 0;
  for (const ae of collectAllEffects(entity)) {
    const fx = ae.effect;
    if (fx.target === INFUSION_CAPACITY_TARGET && fx.operation === 'add' && typeof fx.value === 'number') bonus += fx.value;
  }
  return Math.max(0, base + bonus);
}

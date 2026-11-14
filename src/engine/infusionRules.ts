import type { Feature } from './types';

export const CHOOSE_DAMAGE_TYPE = '__CHOOSE_DAMAGE_TYPE__';

/** True when applying the feature needs the player to pick a damage type first. */
export const asksForDamageType = (feature: Feature | undefined | null): boolean =>
  !!feature?.effects.some(e => e.target === CHOOSE_DAMAGE_TYPE);

export function maxInfusedItems(artificerLevel: number): number {
  if (artificerLevel >= 18) return 6;
  if (artificerLevel >= 14) return 5;
  if (artificerLevel >= 10) return 4;
  if (artificerLevel >= 6)  return 3;
  if (artificerLevel >= 2)  return 2;
  return 0;
}

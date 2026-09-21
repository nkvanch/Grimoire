// src/content/infusions/index.ts
// null) is additively appended onto an ItemInstance's own features when
// applied — see app/sheet/[id].tsx's handleApplyInfusion, which appends
// rather than replaces (unlike equip hydration). Reuses the exact Effect
// shapes traitCompiler.ts's buildTraitFeature already produces — no new
// engine plumbing needed for the ones that have a real mechanical hook.
//
// Several official infusions have NO engine hook to attach to (confirmed:
// no attack/damage-roll bonus mechanism exists anywhere —
// DerivedStats.attackBonuses is hardcoded empty; no generic saving-throw
// effect path exists; no attack-roll automation exists at all) — those ship
// as feature: null (flavor/description only), same honest-disclosure
// pattern used everywhere else in this app rather than pretending to work.
import { Feature } from '../../engine/types';

export type Infusion = {
  id:          string;
  name:        string;
  description: string;
  minLevel:    number;
  /** Informational only — what kind of item this is meant to go on. */
  itemType:    string;
  /** Additively appended to the item's features when applied; null = flavor-only. */
  feature:     Feature | null;
};

export const ALL_INFUSIONS: Infusion[] = [];

export function getInfusion(id: string): Infusion | null {
  return ALL_INFUSIONS.find(i => i.id === id) ?? null;
}

export function maxInfusedItems(artificerLevel: number): number {
  if (artificerLevel >= 18) return 6;
  if (artificerLevel >= 14) return 5;
  if (artificerLevel >= 10) return 4;
  if (artificerLevel >= 6)  return 3;
  if (artificerLevel >= 2)  return 2;
  return 0;
}

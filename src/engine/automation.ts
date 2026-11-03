// ============================================================================
// FILE: src/engine/automation.ts
// "It says what is automated": whether the app works a feature out, only keeps
// count of it, or leaves it to the table. Read off the feature's own data, so a
// homebrew feature is labelled the same way an SRD one is. Roughly half of each
// class's features are text the player applies (Evasion, Reliable Talent); the
// sheet says so instead of showing them like Rage.
// ============================================================================
import type { Feature } from './types';

export type AutomationLevel =
  /** The app applies it: effects on the sheet, rolled effects, an aura, riders, or a choice it handles. */
  | 'automated'
  /** The app keeps count (uses, a resource pool, an action card) but the player applies what it does. */
  | 'tracked'
  /** Text only: the player reads it and applies it. */
  | 'manual';

export function automationOf(feature: Pick<Feature, 'effects' | 'abilityEffects' | 'aura' | 'riders' | 'choices' | 'grantsChoices' | 'resources' | 'activation'>): AutomationLevel {
  const has = (list: readonly unknown[] | undefined) => Array.isArray(list) && list.length > 0;
  if (has(feature.effects) || has(feature.abilityEffects) || !!feature.aura || has(feature.riders)
    || has(feature.choices) || has(feature.grantsChoices)) return 'automated';
  if (has(feature.resources) || !!feature.activation) return 'tracked';
  return 'manual';
}

export const AUTOMATION_LABEL: Record<AutomationLevel, string> = {
  automated: 'Automated',
  tracked:   'Uses tracked',
  manual:    'Apply yourself',
};

export const AUTOMATION_HINT: Record<AutomationLevel, string> = {
  automated: 'The app works this out on your sheet.',
  tracked:   'The app counts its uses; you apply what it does.',
  manual:    'The app does not work this out. Read it and apply it at the table.',
};

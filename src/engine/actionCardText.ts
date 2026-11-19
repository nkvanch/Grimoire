import { Entity, AttackBonus, ActionCard, FeatureActivation, Feature } from './types';
import { masteryPropertyFor } from './weaponMastery';

/**
 * Doubles the dice COUNT in a dice expression, per the DMG large-creature rule
 * ("twice the weapon's damage dice"). "1d8" -> "2d8", "2d6" -> "4d6",
 * "1d10+2" -> "2d10+2". Flat bonuses and non-dice text are left untouched.
 */
export function doubleDice(dice: string): string {
  return dice.replace(/(\d+)d(\d+)/g, (_, count, sides) => `${parseInt(count, 10) * 2}d${sides}`);
}

export function masteryNote(entity: Entity, itemId: string): string | null {
  const m = masteryPropertyFor(entity, itemId);
  return m ? `Mastery: ${m[0].toUpperCase()}${m.slice(1)}` : null;
}

/** A weapon card's Great Weapon Fighting rule, for the roll, and its note after the card's other line-3 note. */
export function dieRuleOf(attack: AttackBonus | undefined, layer3: string | null): Partial<ActionCard> {
  if (!attack?.damageDieRule) return {};
  const note = attack.damageDieRule === 'reroll_1_2' ? 'Great Weapon Fighting: a 1 or 2 on a damage die is rolled again once'
    : 'Great Weapon Fighting: a 1 or 2 on a damage die counts as 3';
  return { damageDieRule: attack.damageDieRule, layer3: layer3 ? `${layer3} · ${note}` : note };
}

// ── Weapon attack / damage computation ────────────────────────────────────────
// Attack/damage bonuses are computed once in pipeline.ts's recomputeDerived
// (entity.derived.attackBonuses) — see computeWeaponAttackBonuses there. This
// file only looks the result up by item id, it doesn't recompute it (used to,
// independently of TabCharacter.tsx's own copy, and the two had drifted).

/** A weapon's damage as text: dice with a signed bonus ("1d8+3"), or the total when the damage is a flat amount (an unarmed strike's 1 + STR, never below 0). */
export function formatDamage(dice: string, bonus: number): string {
  if (/^\d+$/.test(dice)) return String(Math.max(0, Number(dice) + bonus));
  return `${dice}${bonus !== 0 ? fmtBonus(bonus) : ''}`;
}

/** The start of a description for a one-line summary: cut at a word, with an ellipsis when anything was left out. */
export function summaryOf(description: string, max = 60): string {
  if (description.length <= max) return description;
  const cut = description.slice(0, max);
  return `${cut.slice(0, cut.lastIndexOf(' ') > 0 ? cut.lastIndexOf(' ') : max)}…`;
}

export function fmtBonus(n: number): string {
  return n >= 0 ? `+${n}` : `${n}`;
}

// ── Private helpers ───────────────────────────────────────────────────────────

export function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function actionTypeLabel(actionType: FeatureActivation['actionType']): string {
  switch (actionType) {
    case 'action':       return 'Action';
    case 'bonus_action': return 'Bonus Action';
    case 'reaction':     return 'Reaction';
    case 'free':         return 'Free Action';
    case 'passive':      return 'Passive';
  }
}

export function sourceKindLabel(kind: Feature['source']['kind']): string {
  switch (kind) {
    case 'race':       return 'Racial';
    case 'class':      return 'Class';
    case 'subclass':   return 'Subclass';
    case 'background': return 'Background';
    case 'feat':       return 'Feat';
    case 'item':       return 'Item';
    case 'spell':      return 'Spell';
    case 'condition':  return 'Condition';
    case 'campaign':   return 'Campaign';
    case 'manual':     return 'Manual';
  }
}

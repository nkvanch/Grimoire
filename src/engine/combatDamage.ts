import { logDamage } from './damageLog';
import { DEFAULT_RULES } from './defaults';
import { collectAllEffects } from './collectEffects';
import { deathSavesPersist } from './houseRules';
import { recomputeDerived } from './pipeline';
import { resolveResistance } from './resolver';
import { suspendForDamage } from './suspension';
import { Entity, CampaignRules } from './types';

// ── HP damage with temp HP absorption ────────────────────────────────────────

/**
 * Applies damage to an entity.
 * Temp HP absorbs damage first before it touches current HP.
 * Also fires a concentration check if the entity is concentrating.
 */
export function applyDamage(
  entity:      Entity,
  damage:      number,
  rules:       CampaignRules = DEFAULT_RULES,
  /** Optional — when omitted, behaves exactly as before (no resistance math).
   * Manual player-typed damage often has no declared type, and that's a
   * legitimate choice, not a missing feature. */
  damageType?: string,
): Entity {
  if (damage <= 0) return entity;

  let resolvedDamage = damage;
  if (damageType) {
    const effects = collectAllEffects(entity);
    const response = resolveResistance(damageType, effects);
    if (response === 'immunity') return entity;
    if (response === 'resistance') resolvedDamage = Math.floor(damage / 2);
    else if (response === 'vulnerability') resolvedDamage = damage * 2;
    // Flat per-hit reduction ("reduces slashing damage it takes by 2 from each hit" ): an `add` stat_modifier on target `damage_reduction:<type>`, taken off after
    // resistance/vulnerability, never below 0.
    const flat = effects.reduce((sum, ae) =>
      ae.effect.target === `damage_reduction:${damageType}` && ae.effect.operation === 'add' && typeof ae.effect.value === 'number'
        ? sum + ae.effect.value : sum, 0);
    if (flat > 0) resolvedDamage = Math.max(0, resolvedDamage - flat);
  }

  const { hp } = entity.resources;
  const wasAtZero    = hp.current === 0;
  const tempAbsorbed = Math.min(hp.temp, resolvedDamage);
  const remainingDmg = resolvedDamage - tempAbsorbed;
  const newCurrent   = Math.max(0, hp.current - remainingDmg);

  // Death saves: dropping to 0 for the first time starts a fresh count —
  // unless the deathSavesPersist house rule is on, in which case accumulated
  // failures from a prior dying episode carry over (cleared only by a long
  // rest, see rest.ts). Successes/stable always reset on a fresh drop either
  // way — only failures are ever persisted.
  // Taking damage while ALREADY at 0 HP counts as one automatic failure
  // (book rule) — this only applies to real damage getting through, not
  // damage fully absorbed by temp HP while already at 0.
  //
  // Rules-correctness fix (HIGH batch, B): this branch used to also require
  // `!deathSaves.stable`, so a STABLE creature at 0 HP that took further
  // qualifying damage silently stayed stable and never recorded a failure —
  // wrong (a stable creature takes damage, it stops being stable and starts
  // failing death saves again, PHB p.197). `stable` is now explicitly
  // cleared here instead of gating the whole branch on it; existing
  // failures are preserved and incremented by exactly one, never reset.
  let deathSaves = entity.resources.deathSaves;
  if (newCurrent === 0 && !wasAtZero) {
    deathSaves = {
      ...deathSaves,
      successes: 0,
      failures:  deathSavesPersist(rules) ? deathSaves.failures : 0,
      stable:    false,
    };
  } else if (newCurrent === 0 && wasAtZero && remainingDmg > 0) {
    deathSaves = {
      ...deathSaves,
      stable:   false,
      failures: Math.min(3, deathSaves.failures + 1),
    };
  }

  const updated = logDamage({
    ...entity,
    resources: {
      ...entity.resources,
      hp: {
        ...hp,
        current: newCurrent,
        temp:    hp.temp - tempAbsorbed,
      },
      deathSaves,
    },
  }, resolvedDamage, damageType);
  const suspended = resolvedDamage > 0 ? suspendForDamage(updated, damageType) : updated;

  // Concentration check is the player's responsibility via the UI modal.
  // Do NOT call concentrationCheck here — it would run twice alongside the UI roll.
  return recomputeDerived(suspended, rules);
}

/** Heals an entity, capped at maximum HP. Any healing above 0 HP clears death saves, except failures under the deathSavesPersist house rule
 *  (they carry over until a long rest, as the desktop keeps them). */
export function applyHealing(
  entity:  Entity,
  amount:  number,
  rules:   CampaignRules = DEFAULT_RULES
): Entity {
  if (amount <= 0) return entity;
  const newCurrent = Math.min(
    entity.resources.hp.maximum,
    entity.resources.hp.current + amount
  );
  const updated = {
    ...entity,
    resources: {
      ...entity.resources,
      hp: { ...entity.resources.hp, current: newCurrent },
      deathSaves: newCurrent > 0
        ? { ...entity.resources.deathSaves, successes: 0, failures: deathSavesPersist(rules) ? entity.resources.deathSaves.failures : 0, stable: false }
        : entity.resources.deathSaves,
    },
  };
  return recomputeDerived(updated, rules);
}

/**
 * Records one death saving throw result while an entity is at 0 HP.
 * Success on 3 -> stable (stops rolling; still at 0 HP until healed).
 * Failure on 3 -> dead (UI is responsible for showing this state; the
 * engine doesn't have a separate "dead" flag beyond failures === 3).
 * A natural 20 (isNatural20) instead heals 1 HP immediately and clears
 * both counters, per the book rule — call applyHealing(entity, 1, rules)
 * from the UI in that case instead of this function.
 * No-op if already stable, already dead, or entity isn't at 0 HP.
 */
export function recordDeathSave(
  entity:  Entity,
  outcome: 'success' | 'failure',
  rules:   CampaignRules = DEFAULT_RULES
): Entity {
  const { hp, deathSaves } = entity.resources;
  if (hp.current !== 0) return entity;
  if (deathSaves.stable || deathSaves.failures >= 3) return entity;

  const next = outcome === 'success'
    ? { ...deathSaves, successes: Math.min(3, deathSaves.successes + 1) }
    : { ...deathSaves, failures:  Math.min(3, deathSaves.failures  + 1) };
  const stabilized = { ...next, stable: next.successes >= 3 };

  const updated = {
    ...entity,
    resources: { ...entity.resources, deathSaves: stabilized },
  };
  return recomputeDerived(updated, rules);
}

/**
 * Applies temporary HP.
 * Temp HP does not stack — keep whichever pool is larger.
 */
export function applyTempHP(
  entity:  Entity,
  amount:  number,
  rules:   CampaignRules = DEFAULT_RULES
): Entity {
  if (amount <= entity.resources.hp.temp) return entity; // Current pool is larger
  const updated = {
    ...entity,
    resources: {
      ...entity.resources,
      hp: { ...entity.resources.hp, temp: amount },
    },
  };
  return recomputeDerived(updated, rules);
}

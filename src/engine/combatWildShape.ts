import { findBeastForm } from '../content/runtimeRules';
import { applyDamage } from './combatDamage';
import { logDamage } from './damageLog';
import { DEFAULT_RULES } from './defaults';
import { collectAllEffects } from './collectEffects';
import { recomputeDerived } from './pipeline';
import { resolveResistance } from './resolver';
import { WILD_SHAPE_CLASS_IDS } from './ruleset/dnd5e';
import { Entity, CampaignRules } from './types';

/**
 * Starts Wild Shape: sets wildShapeState, which recomputeDerived (pipeline.ts)
 * reads to swap AC/speed/senses/movement/physical stats to the beast form's
 * while keeping the player's own mental scores and class features — same
 * non-mutating "apply on top" philosophy as DmOverride. The beast's own HP
 * pool is tracked separately in wildShapeState.beastHp; the player's real HP
 * is untouched and resumes exactly where it was on revert.
 * No-op if already transformed or the formId doesn't exist.
 */
export function startWildShape(
  entity: Entity,
  formId: string,
  rules:  CampaignRules = DEFAULT_RULES,
): Entity {
  if (entity.wildShapeState?.active) return entity;
  const form = findBeastForm(formId);
  if (!form) return entity;

  // Duration: half druid level in hours, minimum 1 (book rule). Falls back to
  // character level if this isn't (yet) tracked as a separate class level.
  const druidLevel = (entity.identity.classes ?? []).find(c => WILD_SHAPE_CLASS_IDS.includes(String(c.classId)))?.level;
  const hours = Math.max(1, Math.floor((druidLevel ?? entity.identity.level) / 2));

  const updated: Entity = {
    ...entity,
    wildShapeState: {
      active:     true,
      formId:     form.id,
      beastHp:    form.hp,
      beastHpMax: form.hp,
      expiresAt:  { unit: 'hours', remaining: hours },
    },
  };
  return recomputeDerived(updated, rules);
}

/**
 * Ends Wild Shape, reverting to the player's normal stats. Per the book rule,
 * excess damage the beast form took does NOT carry over to the player's real
 * HP — only the state that was tracked is discarded; the player's own HP was
 * never touched while transformed, so it's simply already correct on revert.
 * Safe to call even if not currently transformed (no-op).
 */
export function endWildShape(
  entity: Entity,
  rules:  CampaignRules = DEFAULT_RULES,
): Entity {
  if (!entity.wildShapeState?.active) return entity;
  const updated: Entity = { ...entity, wildShapeState: null };
  return recomputeDerived(updated, rules);
}

/**
 * Applies damage to a Wild-Shaped entity's BEAST hp pool first, not the
 * player's real HP directly.
 *
 * Rules-engine blocker CLOSURE fix (re-audit): the previous implementation
 * split the RAW incoming damage against the beast pool first and only
 * resolved resistance/immunity/vulnerability on the OVERFLOW portion,
 * AFTER reverting — meaning a resisted/vulnerable hit that killed the form
 * had its type-based discount applied to the wrong slice of the hit (the
 * leftover after the form's own HP, not the whole hit), and temp HP never
 * participated in the beast-pool absorption step at all (only the overflow
 * ever touched it). Example the previous version got wrong: form HP 5,
 * fire-resistant, incoming raw fire 10 — old code: overflow = 10-5 = 5
 * (undiscounted) → reverted, applyDamage resolves resistance on THAT →
 * base loses 2. Correct: resistance applies ONCE to the full raw 10 →
 * effective 5 → 5 >= beastHp(5) → reverts with 0 overflow → base loses 0.
 *
 * Corrected order (defenses → temp HP → form HP → overflow → base HP):
 *   1. Resolve resistance/immunity/vulnerability ONCE against the CURRENTLY
 *      TRANSFORMED entity's active effects (collectAllEffects(entity) while
 *      wildShapeState is still active — never re-resolved afterward).
 *   2. Temp HP absorbs from the resolved damage, same as applyDamage's own
 *      semantics — spent exactly once here, whether or not the hit ends up
 *      overflowing the form.
 *   3. The remaining HP damage splits against the beast pool:
 *        D = resolved HP damage (post-defenses, post-temp-HP), F = beastHp
 *        D <  F: form absorbs it all, remains transformed
 *        D >= F: form absorbs F, reverts; (D - F) is ALREADY-RESOLVED
 *                overflow — routed through applyDamage with NO damageType,
 *                so the reverted (base-form) entity's own defenses never
 *                re-process the same hit a second time. Temp HP was
 *                already spent in step 2 (reflected in the reverted
 *                entity's own hp.temp), so applyDamage's own temp-HP
 *                absorption is a correct, harmless no-op there.
 *   D === F is a revert with zero overflow (RAW: hitting exactly 0 still
 *   ends the transformation) — applyDamage is a safe no-op on damage <= 0.
 *
 * Call this INSTEAD of applyDamage while transformed; the caller (UI) is
 * responsible for checking wildShapeState.active first.
 */
export function applyWildShapeDamage(
  entity: Entity,
  damage: number,
  rules:  CampaignRules = DEFAULT_RULES,
  /** Consulted ONCE, up front, against the transformed entity's own active
   *  effects — never re-consulted after reversion (see above). */
  damageType?: string,
  /**
   * Rules-engine blocker RE-AUDIT closure (3B): table-first, PER-HIT fact —
   * "is this damage from a nonmagical weapon/attack?" — the DM/player
   * answers explicitly at the point damage is entered (a checkbox next to
   * the existing damage-type field), never inferred by the engine (which
   * has no concept of an attack being magical). Only consulted when
   * damageType is bludgeoning/piercing/slashing AND the active BeastForm
   * declares nonmagicalPhysicalResistance (see its own doc comment,
   * types.ts). Defaults to false — "unanswered = not nonmagical, resistance
   * does NOT silently apply" — the same conservative-default philosophy
   * Effect.situational already uses elsewhere in this app, so an omitted
   * caller (every pre-existing call site) never gains a discount it wasn't
   * told about.
   */
  isNonmagicalAttack: boolean = false,
): Entity {
  if (!entity.wildShapeState?.active || damage <= 0) return entity;

  const activeForm = findBeastForm(entity.wildShapeState.formId);
  const nonmagicalBPSApplies = isNonmagicalAttack && !!activeForm?.nonmagicalPhysicalResistance
    && (damageType === 'bludgeoning' || damageType === 'piercing' || damageType === 'slashing');

  let resolvedDamage = damage;
  if (damageType) {
    const response = resolveResistance(damageType, collectAllEffects(entity));
    if (response === 'immunity') return entity;
    // 5e RAW: multiple simultaneous reasons for resistance to the SAME hit
    // still only halve it ONCE — never stacked. nonmagicalBPSApplies is a
    // second, independent reason a hit might be resisted; folded into the
    // SAME single halving as the general resistance check, not a second
    // sequential halving.
    if (response === 'resistance' || nonmagicalBPSApplies) resolvedDamage = Math.floor(damage / 2);
    else if (response === 'vulnerability') resolvedDamage = damage * 2;
  }

  const { hp } = entity.resources;
  const tempAbsorbed = Math.min(hp.temp, resolvedDamage);
  const hpDamage      = resolvedDamage - tempAbsorbed;
  const beastHp = entity.wildShapeState.beastHp;
  // What the form and the temporary HP took is logged here; the overflow that reverts the form is logged by applyDamage below.
  const logged = hpDamage < beastHp ? resolvedDamage : tempAbsorbed + beastHp;
  const loggedEntity = logDamage(entity, logged, damageType);
  const withTempSpent: Entity = tempAbsorbed > 0
    ? { ...loggedEntity, resources: { ...loggedEntity.resources, hp: { ...hp, temp: hp.temp - tempAbsorbed } } }
    : loggedEntity;

  if (hpDamage < beastHp) {
    // Remains transformed — the beast form absorbs the already-resolved
    // (post-defense, post-temp-HP) HP damage.
    const updated: Entity = {
      ...withTempSpent,
      wildShapeState: { ...withTempSpent.wildShapeState!, beastHp: beastHp - hpDamage },
    };
    return recomputeDerived(updated, rules);
  }

  const overflow = hpDamage - beastHp;
  const reverted = endWildShape(withTempSpent, rules);
  // No damageType here — resolvedDamage/tempAbsorbed above already fully
  // resolved this hit exactly once; re-passing damageType would let the
  // reverted (base-form) entity's own resistance/vulnerability re-process
  // the same overflow a second time.
  return applyDamage(reverted, overflow, rules);
}

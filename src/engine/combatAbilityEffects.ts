import { lookupConditionFor } from '../content/conditions/lookup';
import { applyHealing } from './combatDamage';
import { startWildShape } from './combatWildShape';
import { applyCondition, removeCondition } from './conditions';
import { damageTakenSince } from './damageLog';
import { DEFAULT_RULES } from './defaults';
import { recomputeDerived } from './pipeline';
import { addTrackedEffect } from './trackedEffects';
import { Entity, AbilityEffect, CampaignRules, FeatureActivation, Feature } from './types';

// ── Status legality (HIGH batch, C): 0 HP / Unconscious / Dead ──────────────

/**
 * Applies the non-dice AbilityEffects of a used Feature to the entity.
 *
 * BEFORE this existed, tapping "Use" on a card only spent its resource cost
 * (see app/components/sheet/TabActions.tsx) — the actual AbilityEffects were
 * never applied. This meant Rage's `set_flag: rage_active` never fired, so
 * Rage's damage-resistance effects (gated on that same flag in
 * collectAllEffects) silently never activated even though the resource was
 * spent and the card displayed correctly. Discovered while building Wild
 * Shape, which needed the same missing plumbing for its `transform` effect —
 * see docs/ROADMAP_1.0.md Phase 3.4 for the full writeup.
 *
 * Deliberately does NOT handle 'damage'/'heal' here — those stay a manual
 * player decision via the roll modal + HP modal, consistent with the app
 * having no attack-roll/hit resolution anywhere else. Everything else
 * (set_flag, transform) is a pure state change on the player's own entity
 * that has no combat-resolution ambiguity, so it applies immediately.
 *
 * apply_condition/remove_condition now route through the same
 * applyCondition()/removeCondition() engine functions the app's condition
 * pickers already use — the 40+ real content entries authoring these
 * (monster fear/poison/paralyze attacks, several subclass features) used
 * to display correctly but produce zero actual game-state change (audit
 * finding ARCH-2). Condition features are resolved via lookupCondition
 * (official content, then the homebrew conditions the homebrew store
 * registers — this file lives in src/engine/, which deliberately has no
 * dependency on src/store/*, so the store pushes them into
 * content/conditions/index.ts's registry instead).
 *
 * grant_speed and spend_resource (beyond the base activation cost) are
 * still intentionally left for a future pass — not silently claimed as
 * done. grant_speed specifically would need a genuine temporary-effect-
 * tracking mechanism of its own (there's no existing "timed feature grant
 * that isn't a condition" concept to reuse — tickDurations is hardcoded to
 * entity.conditionMonitor.active/.conditions), which is real new
 * architecture, not a contained fix; deferred rather than bolted on as a
 * parallel state system.
 *
 * TABLE-FIRST CORRECTION: apply_condition/remove_condition are gated by
 * `activation` (when the caller passes it — every real call site does).
 * The ARCH-2 fix above made these two effect types apply for real, which
 * was correct for a genuinely self-directed, unconditional ability (Rage-
 * style — target:'self', no save required). It did NOT distinguish that
 * case from a target-contingent one ("target makes a CON save; on failure,
 * becomes Paralyzed" — target:'single'/'area'/'multiple', or gated behind
 * requiresSave): those were applying the condition to the ENTITY USING THE
 * ABILITY, immediately on "Use", regardless of whether a save was ever
 * made or who it was actually meant to affect — e.g. a monster's own
 * Paralyzing Touch would paralyze the monster itself the instant the DM
 * tapped Use. `isSelfAndUnconditional` below is that distinction: only a
 * self-targeting, no-save activation still applies apply_condition/
 * remove_condition immediately. Everything else is left for the human to
 * resolve at the table and apply via the app's existing manual condition
 * picker (QuickPanel/TabCharacter) once the save/hit is actually known —
 * the ability's own description text (always shown on its action card)
 * already states the contingency in prose. Resource spend and action-
 * economy marking (both handled by applyActionCardUse, not here) are
 * unaffected either way — RAW abilities that spend on use regardless of
 * outcome keep doing so.
 */
export function applyAbilityEffects(
  entity:     Entity,
  effects:    AbilityEffect[],
  rules:      CampaignRules = DEFAULT_RULES,
  activation?: FeatureActivation,
): Entity {
  let updated = entity;
  const isSelfAndUnconditional = !activation || (activation.target === 'self' && activation.requiresSave === null);

  for (const effect of effects) {
    if (effect.type === 'set_flag') {
      updated = {
        ...updated,
        conditionMonitor: {
          ...updated.conditionMonitor,
          flags: { ...updated.conditionMonitor.flags, [effect.flag]: effect.value },
        },
      };
    } else if (effect.type === 'transform') {
      updated = startWildShape(updated, effect.formId, rules);
    } else if (effect.type === 'grant_speed' && isSelfAndUnconditional) {
      updated = grantTemporarySpeed(updated, effect, rules);
    } else if (effect.type === 'restore_resource') {
      updated = restoreResource(updated, effect.resourceId, effect.amount);
    } else if (effect.type === 'apply_condition' && isSelfAndUnconditional) {
      const features = lookupConditionFor(effect.conditionId, updated.rulesetId)?.features;
      updated = applyCondition(updated, effect.conditionId, 'ability', rules, features, effect.duration);
    } else if (effect.type === 'remove_condition' && isSelfAndUnconditional) {
      updated = removeCondition(updated, effect.conditionId, rules);
    } else if (effect.type === 'track_effect') {
      updated = addTrackedEffect(updated, { name: effect.name, until: effect.until, records: effect.records, recordUntil: effect.recordUntil, visibility: effect.visibility, note: effect.note });
    } else if (effect.type === 'heal_from_damage_taken') {
      // Deterministic: no roll is involved, so it is applied on use.
      updated = applyHealing(updated, Math.floor(damageTakenSince(updated, effect.turnsBack) * effect.fraction), rules);
    }
    // 'damage' / 'heal': intentionally left to the manual roll+HP-modal flow.
    // 'grant_speed' / 'spend_resource': not yet wired — see the doc comment above.
    // A target-contingent apply_condition/remove_condition (not
    // isSelfAndUnconditional) is intentionally skipped here — see the
    // TABLE-FIRST CORRECTION note above this function.
  }

  return recomputeDerived(updated, rules);
}

/**
 * A speed an ability grants for a while (Wings of the Raven: a fly speed for a minute). It is carried by a self-owned timed entry
 * with the same lifecycle as a condition: a 'rounds' duration ticks down on End Turn, 'until_rest' ends at the next long rest, and
 * 'minutes' / 'hours' stay on the sheet until the player takes them off (the app has no clock to tick them). `walk` adds to the
 * walking Speed; fly / swim / climb give that movement type at the stated range.
 */
function grantTemporarySpeed(
  entity: Entity,
  effect: Extract<AbilityEffect, { type: 'grant_speed' }>,
  rules: CampaignRules,
): Entity {
  const label = `${effect.speedType[0].toUpperCase()}${effect.speedType.slice(1)} speed ${effect.amount} ft`;
  const carrier: Feature = {
    id: `granted_speed_${effect.speedType}`, name: label, description: `A ${effect.speedType} speed of ${effect.amount} feet from an ability, for as long as it lasts.`,
    source: { kind: 'condition', refId: label }, level: null, passive: true, actions: [], choices: [],
    effects: [effect.speedType === 'walk'
      ? { type: 'stat_modifier', target: 'speed', operation: 'add', value: effect.amount, condition: null }
      : { type: 'grant_movement', target: 'movement', operation: 'add', value: null, condition: null, movementType: effect.speedType, movementRange: effect.amount }],
  };
  return applyCondition(entity, label, 'ability', rules, [carrier], effect.duration);
}

/**
 * Restores a resource an ability's abilityEffects declares regained (e.g.
 * Eldritch Master's "regain all spell slots", Vermillion mutagen's "+1
 * Blood Maledict use"). 'spell_slots' resets BOTH .slots and .pactSlots
 * (only 'full' is meaningful there — which tier a partial number would
 * apply to is ambiguous, so a numeric amount against 'spell_slots' is a
 * no-op, left for a future pass same as the other unhandled effect types
 * above). Any other resourceId is looked up in entity.resources.custom.
 */
function restoreResource(entity: Entity, resourceId: string, amount: number | 'full'): Entity {
  if (resourceId === 'spell_slots') {
    if (amount !== 'full' || !entity.spellcasting) return entity;
    const tiers = ['1','2','3','4','5','6','7','8','9'] as const;
    const resetSlots = (slots: typeof entity.spellcasting.slots) => {
      const next = { ...slots };
      for (const t of tiers) if (next[t]) next[t] = { ...next[t], used: 0 };
      return next;
    };
    return {
      ...entity,
      spellcasting: {
        ...entity.spellcasting,
        slots: resetSlots(entity.spellcasting.slots),
        pactSlots: entity.spellcasting.pactSlots ? resetSlots(entity.spellcasting.pactSlots) : undefined,
      },
    };
  }
  const resource = entity.resources.custom.find(r => r.id === resourceId);
  if (!resource) return entity;
  const newCurrent = amount === 'full' ? resource.maximum : Math.min(resource.maximum, resource.current + amount);
  return {
    ...entity,
    resources: {
      ...entity.resources,
      custom: entity.resources.custom.map(r => r.id === resourceId ? { ...r, current: newCurrent } : r),
    },
  };
}

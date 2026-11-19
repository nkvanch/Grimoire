import { officialClasses } from '../content/runtimeRules';
export { parseStartingItem } from './startingItems';
import { Entity, CampaignRules, ClassProgression, SpellSlots, asSubclassId, asClassId, CharClass } from './types';
import { recomputeDerived } from './pipeline';
import { getSpellSlotsForClassLevel, multiclassCasterLevel, MULTICLASS_SPELLCASTER_SLOTS,
         pactSlotTableFor, slotsForLevel, slotsFromCountArray } from '../content/classes/spellSlotTables';
import { getProgressionForClass } from '../content/classes/progressions';
import { WARLOCK_SLOTS } from '../content/classes/spellSlotTables';
import { bonusFeatEveryLevel, featsEnabled } from './houseRules';
import { getClassLevels, syncLegacyIdentity, multiclassProficienciesFor } from './multiclass';
import { initializeEntitlementInputs, revokeEntitlementsFromChoice, revokeResourceSource } from './entitlements';
import { applyGrant, queueChoice, canAutoResolve } from './levelingGrants';
import { applyHP } from './levelingHp';
import { stripResolvedAsiStats } from './levelingAsiFeats';

// ── Subclass selection ───────────────────────────────────────────────────────

/**
 * Resolves a 'subclass' pending choice by actually taking the subclass: sets
 * identity.subclassId, then applies every one of the subclass's OWN
 * ClassProgression entries already reached (its unlock level, and any
 * earlier level for domain-style subclasses that grant something at level
 * 1). Bypasses resolveChoice entirely — same reason applyAsiToEntity/
 * applyFeatToEntity do: the pool is the 'all' sentinel (the picker supplies
 * the real subclass list, not the engine), so resolveChoice's array-walk
 * would just skip it. Future level-ups pick up the subclass's remaining
 * entries via progressions.ts's mergeSubclassIntoProgression, not this
 * function — this only back-fills what's already due right now.
 */
export function applySubclassToEntity(
  entity:              Entity,
  choiceId:            string,
  subclassId:          string,
  subclassProgression: ClassProgression,
  rules:               CampaignRules,
  /**
   * Which class this subclass belongs to. Omit for single-class characters
   * (writes identity.subclassId directly, exactly as before — every
   * existing call site keeps working unedited). Pass it for a multiclassed
   * character so the right identity.classes[] entry is updated, and the
   * subclass's own progression entries are gated against THAT class's own
   * level (not total character level).
   */
  classId?: string,
): Entity {
  const classes = entity.identity.classes;
  // Closure item 3: the class this subclass applies to — explicit `classId`
  // when passed (multiclass callers always pass one), otherwise the entity's
  // OWN primary class when classes[] exists (a single-class caller omits
  // classId, per SubclassPicker.tsx's own comment, but still means "my one
  // class"). Used consistently below so identity.classes[] and the legacy
  // identity.subclassId scalar are never updated inconsistently.
  const targetClassId = classId ?? classes?.[0]?.classId;
  const ownClassLevel = targetClassId && classes
    ? (classes.find(c => c.classId === targetClassId)?.level ?? entity.identity.level)
    : entity.identity.level;

  // SUBCLASS-CHANGE-1: this function used to be purely additive — safe the
  // first time a subclass is picked, but calling it again to CHANGE an
  // already-resolved subclass (see app/creation/subclass.tsx) stacked the
  // new subclass's features/resources on top of the old one's, which were
  // never removed. Strip whatever the PREVIOUS subclass for this specific
  // class granted (by source.refId/sourceId === the old subclass's own id
  // — precise even for a multiclass character with two different
  // subclasses) before applying the new one. A first-time pick has no
  // previous subclass id, so this is a no-op then — existing callers are
  // unaffected. Best-effort only, same disclosed scope as removeFeature:
  // an unresolved pending choice the OLD subclass itself queued (rare —
  // most subclass sub-choices auto-resolve via canAutoResolve below) is
  // not retroactively removed.
  const previousSubclassId = targetClassId && classes
    ? classes.find(c => c.classId === targetClassId)?.subclassId
    : entity.identity.subclassId;
  // Closure pass 3 (item 3/10): resource removal now routes through
  // revokeResourceSource — a resource this subclass grants that ANOTHER
  // still-active source also grants (same resourceId, both registered via
  // a resource_grant entitlement) survives with its current/spent state
  // untouched, instead of the old direct sourceKind/sourceId filter, which
  // always deleted the physical entry outright regardless of any other
  // contributor. revokeResourceSource calls revokeEntitlementsFromSource
  // internally (covering the proficiency/spell-style entitlements too), so
  // no separate call is needed here.
  const strippedEntity: Entity = previousSubclassId
    ? revokeResourceSource({
        ...entity,
        features: entity.features.filter(f => !(f.source.kind === 'subclass' && f.source.refId === previousSubclassId)),
      }, 'subclass', previousSubclassId)
    : entity;

  let updated: Entity = classes && classes.length > 0 && targetClassId
    ? {
        ...strippedEntity,
        identity: {
          ...strippedEntity.identity,
          classes: classes.map(c => c.classId === targetClassId ? { ...c, subclassId: asSubclassId(subclassId) } : c),
        },
      }
    : {
        ...strippedEntity,
        identity: { ...strippedEntity.identity, subclassId },
      };
  if (classes && classes.length > 0 && targetClassId) updated = syncLegacyIdentity(updated);

  for (const entry of subclassProgression.entries) {
    if (entry.level > ownClassLevel) continue;
    for (const grant of entry.grants) {
      // SUBCLASS-CHANGE-1: explicit source so a resource this subclass
      // sourceKind:'subclass' instead of defaulting to 'class' (applyGrant's
      // own fallback when no source is passed) — required for the stripping
      // above to actually find and remove it on a later subclass change.
      // Features are unaffected by this — they already carry their own
      // explicit source on the content literal itself (required for
      // deriveSubclassId to work at all), so applyGrant's fallback never
      // applies to them here.
      updated = applyGrant(updated, grant, entry.level, classId, { kind: 'subclass', id: subclassId });
    }
    for (const choice of entry.choices) {
      if (canAutoResolve(choice)) {
        if (Array.isArray(choice.pool) && choice.pool.length > 0) {
          for (const grant of choice.grants) {
            updated = applyGrant(updated, grant, entry.level, classId);
          }
        }
      } else {
        updated = queueChoice(updated, choice, entry.level, classId, { kind: 'subclass', id: subclassId });
      }
    }
  }
  updated = {
    ...updated,
    choices: updated.choices.map(c =>
      c.id === choiceId ? { ...c, resolved: true, selections: [subclassId] } : c
    ),
  };
  return recomputeDerived(updated, rules);
}

// ── Multiclass level-up ──────────────────────────────────────────────────────

/** Copies `used` counts from `prev` into `next` per tier, so recomputing slot
 * totals never resets a caster's already-spent slots. Same convention the
 * `spell_slots` applyGrant case already uses. */
function preserveUsedSlots(prev: SpellSlots | undefined, next: SpellSlots): SpellSlots {
  const tiers = ['1','2','3','4','5','6','7','8','9'] as const;
  const result = { ...prev } as SpellSlots;   // a member of the map that is not a tier stays
  tiers.forEach(t => {
    const total = next[t]?.total ?? 0;
    const used  = Math.max(0, Math.min(prev?.[t]?.used ?? 0, total));
    result[t] = { ...prev?.[t], total, used };   // spread: a member of the tier this build does not know of stays
  });
  return result;
}

/** Pact magic is one pool whose tier can change; carry its spent count across tiers. */
function preservePactUsedSlots(previous: SpellSlots | undefined, next: SpellSlots): SpellSlots {
  const spent = Object.values(previous ?? {}).reduce((sum, slot) => sum + Math.max(0, slot.used), 0);
  const result = { ...next };
  let remaining = spent;
  for (const tier of Object.keys(next) as (keyof SpellSlots)[]) {
    const used = Math.min(remaining, next[tier].total);
    result[tier] = { ...next[tier], used };
    remaining -= used;
  }
  return result;
}

/**
 * Advances a (potentially multiclassed) character by exactly ONE level in
 * targetClassId — either bumping an existing class in their build, or, if
 * targetClassId isn't in identity.classes yet, taking a brand-new class.
 * This is how "level up your class" and "add a new class" share one code
 * path in play, matching how creation's levelUp(0 -> targetLevel) already
 * unifies "pick class" and "gain levels" for the single-class case.
 *
 * `targetClass` (the CharClass content object, not just its id) is only
 * needed when this call might be taking a BRAND NEW class after character
 * level 1 — its multiclassProficiencies field supplies the reduced PHB
 * multiclass proficiency table. Omit it for "level up an existing class."
 */
export function levelUpClass(
  entity: Entity,
  targetClassId: string,
  progression: ClassProgression,
  rules: CampaignRules,
  targetClass?: CharClass,
  classDefinitions: readonly CharClass[] = officialClasses(),
  /** Table-first resolution: the physically-rolled HP die result, when
   *  rules.hpMode === 'rolled' and the UI collected it (manually entered or
   *  via its own "Roll in App" convenience) before calling this — see
   *  applyHP's own doc comment. undefined (every existing caller) is
   *  unaffected. */
  manualHpRoll?: number,
): Entity {
  const classes = getClassLevels(entity).filter(c => c.level > 0);
  targetClass = targetClass ?? classDefinitions.find(c => c.id === targetClassId);
  const existing = classes.find(c => c.classId === targetClassId);
  const isNewClass = !existing;
  const wasCharacterLevelZero = entity.identity.level === 0;
  const newClassLevel = (existing?.level ?? 0) + 1;
  const isVeryFirstLevel = wasCharacterLevelZero && newClassLevel === 1;
  const characterLevelAfter = entity.identity.level + 1;

  const entry = progression.entries.find(e => e.level === newClassLevel);
  if (!entry) return entity;

  // A second-or-later class taken after the character's very first level
  // gets the REDUCED multiclass proficiency table instead of the class's
  // own full level-1 grant (PHB "Multiclassing Proficiencies"), and gains
  // no new saving-throw proficiencies at all — both per RAW.
  const isReducedMulticlassEntry = isNewClass && !wasCharacterLevelZero;

  let updated = entity;

  // Capture the spellcasting ability before this level's grants apply.
  // entity.spellcasting.ability is a SINGLE scalar — it can only ever agree
  // with one class's casting ability at a time, so for a genuine multiclass
  // caster (Wizard/Cleric, etc.) it's kept pinned to whichever class first
  // initialized spellcasting, rather than being silently reset by a LATER
  // class's own init_spellcasting grant every time that class levels up.
  // This is correct for a single-class caster (the only class there is)
  // and a reasonable, STABLE "primary/headline" value for a multiclass one
  // (shown as the one "Spellcasting" summary stat — TabFeatures.tsx). It is
  // NOT what determines an individual spell's actual casting ability or
  // save DC any more — rules-engine blocker B fix: that's resolved fresh,
  // per spell, from the spell's own granting source (its class/subclass/
  // racial/item entitlement) via resolveSpellAbility (actionCards.ts),
  // which never reads this scalar for a class-sourced spell at all. A
  // Wizard/Cleric multiclass's Cleric spells correctly use WIS via that
  // path even while this headline scalar stays pinned to Wizard's INT.
  const abilityBefore = updated.spellcasting?.ability;

  updated = applyHP(updated, entry.hpDie, rules.hpMode, newClassLevel, rules, progression.hpAbility ?? 'con', isVeryFirstLevel, manualHpRoll);

  if (isVeryFirstLevel && targetClass) {
    updated = applyGrant(updated, { kind: "proficiency", value: { armor: targetClass.armorProfs, weapons: targetClass.weaponProfs, tools: targetClass.toolProfs } }, 1, targetClassId);
    updated = { ...updated, proficiencies: { ...updated.proficiencies, savingThrows: targetClass.savingThrows ?? [] } };
  }

  if (isReducedMulticlassEntry) {
    const mcProf = multiclassProficienciesFor(targetClass);
    if (mcProf) updated = applyGrant(updated, { kind: 'proficiency', value: mcProf }, newClassLevel, targetClassId);
  }

  for (const grant of entry.grants) {
    if (isReducedMulticlassEntry && (grant.kind === 'proficiency' || grant.kind === 'starting_item')) continue; // superseded by the reduced table above
    updated = applyGrant(updated, grant, newClassLevel, targetClassId);
  }

  for (const choice of entry.choices) {
    if (isReducedMulticlassEntry && ['skill', 'tool', 'equipment'].includes(choice.kind)) continue;
    if (canAutoResolve(choice)) {
      if (Array.isArray(choice.pool) && choice.pool.length > 0) {
        for (const grant of choice.grants) updated = applyGrant(updated, grant, newClassLevel, targetClassId);
      }
    } else {
      updated = queueChoice(updated, { ...choice, forClassId: targetClassId }, newClassLevel, targetClassId,
        { kind: 'class', id: targetClassId });
    }
  }

  // Bonus feat house rule — keyed by TOTAL character level (unique per
  // level-up event regardless of which class advanced), not the per-class
  // level, which two different classes could otherwise collide on.
  if (bonusFeatEveryLevel(rules) && featsEnabled(rules)) {
    const bonusId = 'bonus_feat_lvl';
    if (!updated.choices.some(c => c.id === `${bonusId}_${characterLevelAfter}`)) {
      updated = queueChoice(updated, {
        id: bonusId, prompt: `Bonus feat at level ${characterLevelAfter} (house rule).`,
        kind: 'asi', count: 1, pool: 'all', grants: [], required: true, resolved: false,
      }, characterLevelAfter);
    }
  }

  if (abilityBefore && updated.spellcasting && updated.spellcasting.ability !== abilityBefore) {
    updated = { ...updated, spellcasting: { ...updated.spellcasting, ability: abilityBefore } };
  }

  const nextClasses = isNewClass
    ? [...classes, { classId: asClassId(targetClassId), subclassId: null, level: 1 }]
    : classes.map(c => c.classId === targetClassId ? { ...c, level: newClassLevel } : c);
  updated = { ...updated, identity: { ...updated.identity, classes: nextClasses } };
  updated = syncLegacyIdentity(updated);

  if (updated.spellcasting) {
    const finalClasses = getClassLevels(updated);
    const definitions = finalClasses.map(c => {
      const definition = c.classId === targetClassId ? targetClass : classDefinitions.find(d => d.id === c.classId);
      if (!definition && finalClasses.length > 1) throw new Error('Missing class definition: ' + c.classId);
      return { ...c, spellcastingStyle: definition?.spellcastingStyle };
    });
    const oldClasses = getClassLevels(entity).filter(c => c.level > 0);
    // Compatibility with old single-pact saves whose pact pool occupied slots.
    const oldPactOnly = oldClasses.length === 1 && !entity.spellcasting?.pactSlots &&
      (pactSlotTableFor(oldClasses[0].classId, oldClasses[0].subclassId) ||
       classDefinitions.find(d => d.id === oldClasses[0].classId)?.spellcastingStyle === 'pact');
    const oldNormal = oldPactOnly ? undefined : entity.spellcasting?.slots;
    const oldPact = entity.spellcasting?.pactSlots ?? (oldPactOnly ? entity.spellcasting?.slots : undefined);
    const pactClass = definitions.find(c => c.spellcastingStyle === 'pact' || pactSlotTableFor(c.classId, c.subclassId));
    const pactTable = pactClass ? pactSlotTableFor(pactClass.classId, pactClass.subclassId) ?? WARLOCK_SLOTS : null;
    let normalMax: SpellSlots;
    if (finalClasses.length > 1) {
      const casterLevel = multiclassCasterLevel(definitions);
      normalMax = casterLevel > 0 ? slotsForLevel(MULTICLASS_SPELLCASTER_SLOTS, casterLevel) : slotsFromCountArray(null);
    } else if (pactClass) {
      normalMax = slotsFromCountArray(null);
    } else {
      const counts = getSpellSlotsForClassLevel(targetClassId, newClassLevel);
      normalMax = counts && !targetClass?.spellcastingStyle
        ? slotsFromCountArray(counts) : updated.spellcasting.slots;
    }
    updated = { ...updated, spellcasting: { ...updated.spellcasting,
      slots: preserveUsedSlots(oldNormal, normalMax),
      pactSlots: pactClass && pactTable ? preservePactUsedSlots(oldPact, slotsForLevel(pactTable, pactClass.level)) : undefined,
    } };
  }

  return recomputeDerived(updated, rules);
}

// ── levelUp ───────────────────────────────────────────────────────────────────

export function levelUp(
  entity: Entity,
  targetLevel: number,
  progression: ClassProgression,
  rules: CampaignRules,
  classDefinitions: readonly CharClass[] = officialClasses(),
  /** Table-first resolution — see levelUpClass's own doc comment. Only
   *  meaningful (and only ever passed) when going up exactly one level, the
   *  single "Level Up" button's own usage; a multi-level jump (the
   *  progression planner) has no single roll to attribute, so this is
   *  simply threaded to whichever levelUpClass call actually runs — at most
   *  one, in that case. */
  manualHpRoll?: number,
): Entity {
  let updated = entity;
  const cls = classDefinitions.find(c => c.id === progression.classId);
  for (let lvl = entity.identity.level + 1; lvl <= targetLevel; lvl++) {
    updated = levelUpClass(updated, progression.classId, progression, rules, cls, classDefinitions, manualHpRoll);
  }
  return updated;
}

// ── projectToLevel ────────────────────────────────────────────────────────────
// Read-only "what would my character look like at level N" projection for the
// Progression Planner. A thin wrapper over levelUp() — that function already
// loops from the entity's current level up to targetLevel and already leaves
// any choice queueChoice() can't auto-resolve (ASI/feat, subclass, ...) as a
// pending entry in entity.choices rather than resolving it, which is exactly
// the "disclosed, not resolved" behavior a projection needs. The only real
// addition here is forcing hpMode:'max' for this call specifically —
// overriding whatever the real campaign's rules say — because a projection
// showing one possible dice-rolled HP outcome would be actively misleading
// for "what will I typically have"; the deterministic max is the same
// never-show-a-roll-that-won't-reproduce principle the real level-up preview
// already relies on (see LevelUpPreviewModal.tsx's own doc comment), just
// applied to a multi-level jump instead of a single real level-up. Single-
// class only — levelUp() reads entity.identity.level as the class's own
// level, which only holds for a non-multiclassed character; multiclass
// projection is a distinct follow-up, not built here.
export function projectToLevel(
  entity: Entity,
  targetLevel: number,
  progression: ClassProgression,
  rules: CampaignRules,
  classDefinitions: readonly CharClass[] = officialClasses(),
): Entity {
  return levelUp(entity, targetLevel, progression, { ...rules, hpMode: 'max' }, classDefinitions);
}

/**
 * A-61: one planned "+1 level" step in a multiclass projection — which
 * class, its already-resolved ClassProgression (subclass merged in if the
 * class already has one; see MulticlassProgressionPlannerModal's
 * resolveProgression call at add-time), and targetClass metadata only
 * needed the first time a step introduces a brand-new class (drives
 * levelUpClass's reduced-multiclass-proficiency grant).
 */
export type MulticlassPlanStep = {
  classId:      string;
  progression:  ClassProgression;
  targetClass?: CharClass;
};

/**
 * Projects an ORDERED sequence of single-class level-ups across possibly
 * different classes — e.g. Fighter 5/Wizard 2 → +1 Wizard → +1 Fighter →
 * +1 Wizard, matching how a real multiclass character actually levels
 * (one class at a time, player's choice each time), unlike projectToLevel's
 * single-class "jump straight to level N." Each step reuses levelUpClass
 * exactly as real leveling does — always max HP, same as projectToLevel.
 */
export function projectMulticlassSequence(
  entity: Entity,
  steps:  MulticlassPlanStep[],
  rules:  CampaignRules,
  classDefinitions: readonly CharClass[] = officialClasses(),
): Entity {
  const forcedRules: CampaignRules = { ...rules, hpMode: 'max' };
  return steps.reduce(
    (updated, step) => levelUpClass(updated, step.classId, step.progression, forcedRules, step.targetClass, classDefinitions),
    entity,
  );
}

/** Shared creation/live acquisition. Existing classes are not granted twice. */
export function acquireClass(entity: Entity, cls: CharClass, rules: CampaignRules,
  classDefinitions: readonly CharClass[] = officialClasses()): Entity {
  if (getClassLevels(entity).some(c => c.classId === cls.id && c.level > 0)) return entity;
  return levelUpClass(entity, cls.id, getProgressionForClass(cls), rules, cls, classDefinitions);
}

/** Creation-only reset; historical/manual ownership survives reselection. */
export function resetCreationClass(entity: Entity, hitDie: number): Entity {
  // Revert resolved-ASI stat bumps BEFORE dropping the choices that record them.
  const stripped = stripResolvedAsiStats(initializeEntitlementInputs(entity));

  let clean = stripped;
  for (const classId of new Set((stripped.entitlements ?? []).filter(e => e.sourceKind === 'class').map(e => e.sourceId))) {
    clean = revokeResourceSource(clean, 'class', classId);
  }
  for (const subclassId of new Set((stripped.entitlements ?? []).filter(e => e.sourceKind === 'subclass').map(e => e.sourceId))) {
    clean = revokeResourceSource(clean, 'subclass', subclassId);
  }
  for (const choice of stripped.choices.filter(c => c.grantedAt > 0)) {
    clean = revokeEntitlementsFromChoice(clean, choice.id);
  }
  return {
    ...clean,
    identity: { ...clean.identity, classId: "", classes: [], level: 0, subclassId: null },
    features: stripped.features.filter(
      f => f.source.kind !== 'class' && f.source.kind !== 'subclass'
    ),
    choices:   stripped.choices.filter(c => c.grantedAt === 0),
    resources: {
      ...stripped.resources,
      // Only drop resources the PREVIOUS class granted — a racial resource
      // (Dragonborn's Breath Weapon, Half-Orc's Relentless Endurance, etc.)
      // has sourceKind !== 'class' (or undefined, for characters saved
      // before this field existed) and survives a class change untouched.
      custom: clean.resources.custom,
      hp:      { current: 0, maximum: 0, temp: 0 },
      hitDice: { die: hitDie, total: 0, remaining: 0 },
    },
    spellcasting: clean.spellcasting && clean.entitlements?.some(e => e.kind === 'spell_access' || e.kind === 'cantrip_access')
      ? { ...clean.spellcasting, slots: slotsFromCountArray(null), pactSlots: undefined,
          known: [], cantrips: [], prepared: [], concentrating: null }
      : null,
  };
}

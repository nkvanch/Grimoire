import { getSpellSlotsForClassLevel } from '../content/classes/spellSlotTables';
import { initializeEntitlementInputs, grantEntitlements, grantEntitlement, recomputeResourceMaximums } from './entitlements';
import { grantedSpellAbility } from './grantedSpellAbility';
import { generateItemInstanceId } from './itemMechanics';
import { Entity, Grant, EntitlementSourceKind, FeatureInstance, SpellSlots, ResourceGrant, ResourceUpgrade, ProficiencyGrant, EntitlementRecord, ChoiceDefinition, Ability, KnownSpellsGrant } from './types';

// ── applyGrant ────────────────────────────────────────────────────────────────

export function applyGrant(
  entity: Entity, grant: Grant, atLevel: number, classId?: string,
  /** Explicit resource source — only needed by callers granting a resource
   * OUTSIDE class-progression leveling (race/subrace resource grants), where
   * entity.identity.classId can't be trusted to reflect the class actually
   * being applied. See the "resource" case below. Also used (closure pass
   * 2) to tag `proficiency`-kind grants with real entitlement provenance —
   * `choiceId`, when set, ties the resulting entitlement(s) to the specific
   * resolved ChoiceState that produced them (see applyToolChoiceToEntity/
   * applyLanguageChoiceToEntity), so removing just that choice's origin
   * doesn't touch a different grant from the same source. */
  source?: { kind: EntitlementSourceKind; id?: string; choiceId?: string },
): Entity {
  const original = entity;
  entity = initializeEntitlementInputs(entity);
  switch (grant.kind) {

    case "feature": {
      const f = grant.value as FeatureInstance;
      // An upgrade replaces the earlier record with the new definition; members of the earlier record the new one does not set (one this
      // build does not know, written by another app version) are carried over rather than dropped.
      const upgraded = f.upgradeOf ? entity.features.find(x => x.id === f.upgradeOf) : undefined;
      const carried = upgraded ? Object.fromEntries(Object.entries(upgraded).filter(([k]) => !(k in f))) : {};
      let next: Entity = {
        ...entity,
        features: [...(f.upgradeOf ? entity.features.filter(x => x.id !== f.upgradeOf) : entity.features), {
          ...carried,
          ...f,
          source: f.source ?? { kind: "class", refId: classId ?? entity.identity.classId },
          level:  atLevel,
          isActive: true,
        }]
      };

      // Process any grant_spell effects on this feature. This is how racial
      // features like the Skeleton's Doomed Touch ("you know chill touch")
      // actually add the cantrip. It initialises a spellcasting block if the
      // entity has none yet (a non-caster gaining a racial cantrip), using the
      // effect's spellcastingAbility (default CON for racial grants).
      //
      // Closure pass 3 (item 1): also stamps a source-owned entitlement for
      // each granted spell/cantrip, tagged with THIS feature's own resolved
      // source (`next.features`'s last entry, set just above) — this is
      // what makes the grant removable when the feature is (via
      // removeFeature's existing revokeEntitlementsFromSource(..., 'feature'
      // | ..., ...) calls, which already work for ANY entitlement kind
      // tagged to that source, spells included, with no further wiring).
      // The flat spellcasting.known/cantrips arrays stay as the DERIVED
      // output (reconciled every recompute pass, same pattern as
      // proficiencies — see pipeline.ts).
      const spellEffects = (f.effects ?? []).filter(e => e.type === 'grant_spell');
      const grantedFeature = next.features[next.features.length - 1];
      for (const eff of spellEffects) {
        const cantripIds = (eff as any).cantripIds as string[] | undefined;
        const spellIds   = (eff as any).spellIds   as string[] | undefined;
        const ability    = (grantedSpellAbility(next, eff)) ?? 'con';

        if (!next.spellcasting) {
          const emptySlots = Object.fromEntries(
            ['1','2','3','4','5','6','7','8','9'].map(t => [t, { total: 0, used: 0 }])
          ) as SpellSlots;
          next = {
            ...next,
            spellcasting: {
              ability, slots: emptySlots,
              cantrips: [], known: [], prepared: [], concentrating: null,
            },
          };
        }
        next = grantEntitlements(next, [
          ...(cantripIds ?? []).map(key => ({ kind: 'cantrip_access' as const, key, sourceKind: grantedFeature.source.kind, sourceId: grantedFeature.source.refId, ...(eff.minLevel ? { minLevel: eff.minLevel } : {}) })),
          ...(spellIds   ?? []).map(key => ({ kind: 'spell_access'   as const, key, sourceKind: grantedFeature.source.kind, sourceId: grantedFeature.source.refId, ...(eff.minLevel ? { minLevel: eff.minLevel } : {}) })),
        ]);

      }

      // Choices this feature opens (Feature.grantsChoices): queued once, owned by the feature.
      for (const choice of f.grantsChoices ?? []) {
        const queuedId = `${f.id}:${choice.id}_${atLevel}`;
        if (!next.choices.some(c => c.id === queuedId)) next = queueChoice(next, choice, atLevel, f.id, { kind: 'feature', id: f.id });
      }

      // Feature-owned resource pools (Feature.resources). Provenance is this feature's own id, so
      // removeFeature's revokeResourceSource(.., 'feature', id) takes them back out with it.
      for (const r of f.resources ?? []) {
        next = applyGrant(next, { kind: 'resource', value: r }, atLevel, classId, { kind: 'feature', id: f.id });
      }

      return next;
    }

    case "resource": {
      const r = grant.value as ResourceGrant;
      // No explicit source: infer 'class' from classId/entity.identity.classId,
      // same fallback the "feature" case above already uses. Safe for every
      // in-file call site (all run within class-progression leveling), but
      // NOT safe for a caller granting a race/subrace resource — those must
      // pass an explicit `source` (see class-detail.tsx's race/subrace
      // re-grant calls), since entity.identity.classId can be stale there.
      const inferredClassId = classId ?? entity.identity.classId ?? undefined;
      const resolvedSource = source ?? (inferredClassId ? { kind: 'class' as const, id: inferredClassId } : undefined);
      // Closure pass 3 (item 3): a `resource_grant` entitlement is stamped
      // for EVERY grant of this resource id, including a repeat one from a
      // DIFFERENT source — that's what lets revokeResourceSource tell
      // "source A grants R, source B also grants R, remove A -> R survives
      // (B still wants it), remove B -> R disappears" apart from the old
      // behavior, where a second source's grant of an already-existing
      // resource id was a silent, untracked no-op, so removing the FIRST
      // (only tracked) source wiped the entry even though a second source
      // nominally also granted it. The physical resource instance
      // (current/maximum/recharge) is created ONLY on the first grant —
      // current/spent state is never reset by a later "also grants this"
      // registration.
      const withGrantEntitlement = resolvedSource
        ? grantEntitlement(entity, { kind: 'resource_grant', key: r.resourceId, sourceKind: resolvedSource.kind,
            sourceId: resolvedSource.id, choiceId: source?.choiceId })
        : entity;
      if (withGrantEntitlement.resources.custom.some(c => c.id === r.resourceId)) return withGrantEntitlement;
      return {
        ...withGrantEntitlement,
        resources: {
          ...withGrantEntitlement.resources,
          custom: [...withGrantEntitlement.resources.custom, {
            id: r.resourceId, name: r.name,
            current: r.maximum, maximum: r.maximum,
            recharge: r.recharge,
            ...(r.perProficiencyBonus ? { perProficiencyBonus: true } : {}),
            ...(r.perAbilityModifier ? { perAbilityModifier: r.perAbilityModifier } : {}),
            ...(r.perLevel ? { perLevel: r.perLevel } : {}),
            sourceKind: resolvedSource?.kind,
            sourceId:   resolvedSource?.id,
          }]
        }
      };
    }

    case "resource_upgrade": {
      // Closure pass 3 (item 3): used to unconditionally full-refresh
      // `current` to the new maximum, silently discarding whatever had
      // already been spent — an upgrade (e.g. a subclass feature raising a
      // resource's pool size) is not a rest, and shouldn't act like one.
      // Preserves the SPENT amount instead: newCurrent = newMaximum -
      // spent, clamped to [0, newMaximum] so a shrinking maximum (or a
      // pool that was already fully spent) can never go negative or exceed
      // the new cap. sourceKind/sourceId are untouched by the `{...r, ...}`
      // spread, same as before.
      const u = grant.value as ResourceUpgrade;
      const resource = entity.resources.custom.find(r => r.id === u.resourceId);
      if (!resource) return entity;
      const upgradeSource = source
        ? { kind: source.kind, id: source.id, choiceId: source.choiceId }
        : classId
          ? { kind: 'class' as const, id: classId, choiceId: undefined }
          : { kind: 'manual' as const, id: undefined, choiceId: undefined };
      const withoutSameContribution = (entity.entitlements ?? []).filter(e => !(
        e.kind === 'resource_upgrade' && e.key === u.resourceId
        && e.sourceKind === upgradeSource.kind && e.sourceId === upgradeSource.id
        && e.choiceId === upgradeSource.choiceId
      ));
      // the contribution this replaces keeps whatever else is written on it (members this app does not know are kept, not rebuilt)
      const previousContribution = (entity.entitlements ?? []).find(e => (
        e.kind === 'resource_upgrade' && e.key === u.resourceId
        && e.sourceKind === upgradeSource.kind && e.sourceId === upgradeSource.id
        && e.choiceId === upgradeSource.choiceId
      ));
      const otherAmount = withoutSameContribution
        .filter(e => e.kind === 'resource_upgrade' && e.key === u.resourceId)
        .reduce((sum, e) => sum + (e.amount ?? 0), 0);
      const baseMaximum = resource.baseMaximum ?? Math.max(0, resource.maximum - otherAmount);
      const amount = u.newMaximum - (baseMaximum + otherAmount);
      const withBase = {
        ...entity,
        resources: { ...entity.resources, custom: entity.resources.custom.map(r =>
          r.id === u.resourceId ? { ...r, baseMaximum, ...(u.recharge ? { recharge: u.recharge } : {}) } : r) },
        entitlements: withoutSameContribution,
      };
      return recomputeResourceMaximums(grantEntitlement(withBase, {
        ...previousContribution,
        kind: 'resource_upgrade', key: u.resourceId, amount,
        sourceKind: upgradeSource.kind, sourceId: upgradeSource.id, choiceId: upgradeSource.choiceId,
      }));
    }

    case "proficiency": {
      // Merge the granted proficiencies into the entity's proficiency block.
      // The grant value is a ProficiencyGrant: { armor?, weapons?, tools?, languages? }.
      // We deduplicate each list so re-applying on class change is safe.
      const g = grant.value as ProficiencyGrant;
      // Closure pass 2: `proficiency`-kind Grants are only ever authored on
      // CLASS/SUBCLASS progressions (confirmed via a full content grep) —
      // no backing Feature/Effect exists for them, so without an explicit
      // entitlement record here they'd be untraceable the moment they're
      // granted (exactly the reported "class/subclass grants, remove
      // subclass, grant stays" gap). `source` (explicit, passed by
      // race/subrace resource-grant callers) takes priority; class-
      // progression callers pass `classId` instead, so that's the fallback;
      // a caller with neither (shouldn't happen for this grant kind, but
      // conservative) tags 'manual' rather than mis-attributing.
      const entSource: { kind: EntitlementSourceKind; id?: string } = source
        ? { kind: source.kind, id: source.id }
        : classId
          ? { kind: 'class', id: classId }
          : { kind: 'manual', id: undefined };
      const records: EntitlementRecord[] = [
        ...(g.armor     ?? []).map(key => ({ kind: 'armor_proficiency'  as const, key, sourceKind: entSource.kind, sourceId: entSource.id, choiceId: source?.choiceId })),
        ...(g.weapons   ?? []).map(key => ({ kind: 'weapon_proficiency' as const, key, sourceKind: entSource.kind, sourceId: entSource.id, choiceId: source?.choiceId })),
        ...(g.tools     ?? []).map(key => ({ kind: 'tool_proficiency'   as const, key, sourceKind: entSource.kind, sourceId: entSource.id, choiceId: source?.choiceId })),
        ...(g.languages ?? []).map(key => ({ kind: 'language'          as const, key, sourceKind: entSource.kind, sourceId: entSource.id, choiceId: source?.choiceId })),
      ];
      return grantEntitlements(entity, records);
    }

    case "subclass_unlock": {
      // Queue a pending subclass choice so it surfaces in the Features tab's
      // Pending Choices section. Uses the same 'subclass' kind as every
      // authored class choice, so it opens the real SubclassPicker (which
      // already merges official + homebrew subclasses via
      // subclassEntriesForClassMerged, and shows a graceful empty state if
      // none exist yet) instead of falling through to the generic
      // "ask your DM" placeholder.
      // choiceId is namespaced by the OWNING class (not just atLevel) so a
      // multiclass character with two classes unlocking a subclass at the
      // same within-class level (e.g. two homebrew classes both unlocking at
      // their own level 3) don't collide and silently drop the second one.
      const grantClassId = classId ?? entity.identity.classId;
      const choiceId = `subclass_unlock_${grantClassId}_${atLevel}`;
      const alreadyQueued = entity.choices.some(c => c.id === choiceId);
      if (alreadyQueued) return entity;
      const subclassChoice: ChoiceDefinition = {
        id:       choiceId,
        prompt:   `Choose your ${grantClassId} subclass`,
        kind:     'subclass',
        count:    1,
        pool:     [],
        grants:   [],
        required: true,
        resolved: false,
        forClassId: grantClassId,
      };
      return {
        ...entity,
        choices: [...entity.choices, {
          id:          choiceId,
          definition:  subclassChoice,
          grantedAt:   atLevel,
          resolved:    false,
          selections:  [],
        }],
      };
    }

    case "speed": {
      // Adds a permanent bonus to the entity's base speed (stored in resources.speed).
      // Used for class-granted speed increases like Barbarian Fast Movement (+10 ft).
      // The pipeline reads entity.resources.speed as the base and adds/sets on top
      // via stat_modifier effects, so modifying resources.speed here is the right
      // home for permanent class bonuses.
      const speedBonus = grant.value as number;
      return {
        ...entity,
        resources: {
          ...entity.resources,
          speed: entity.resources.speed + speedBonus,
        },
      };
    }

    case "init_spellcasting": {
      // Initialise the spellcasting block for a spellcasting class.
      // If a racial feature (e.g. Skeleton Doomed Touch) already created the
      // block with a default ability (CON), this UPGRADES the ability to the
      // any cantrips/known spells the racial grant already added.
      const sc = grant.value as { ability: Ability };
      if (entity.spellcasting) {
        return {
          ...entity,
          spellcasting: { ...entity.spellcasting, ability: sc.ability },
        };
      }
      const emptySlots = Object.fromEntries(
        ['1','2','3','4','5','6','7','8','9'].map(t => [t, { total: 0, used: 0 }])
      ) as SpellSlots;
      return {
        ...entity,
        spellcasting: {
          ability:       sc.ability,
          slots:         emptySlots,
          cantrips:      [],
          known:         [],
          prepared:      [],
          concentrating: null,
        },
      };
    }

    case "spell_slots": {
      // Set spell slot totals from the table for this class at this level.
      // For homebrew classes the slotsTable may be embedded directly in the
      // grant value; otherwise we look up by classId.
      const slotGrant = grant.value as {
        level:      number;
        slotsTable?: { level: number; slots: number[] }[];
      };
      const slotRow: number[] | null = slotGrant.slotsTable
        ? (slotGrant.slotsTable.find(r => r.level === slotGrant.level)?.slots ?? null)
        : getSpellSlotsForClassLevel(classId ?? entity.identity.classId, slotGrant.level);
      if (!slotRow || !entity.spellcasting) return entity;
      const slots = slotRow;
      const tiers = ['1','2','3','4','5','6','7','8','9'] as const;
      // Always zero ALL tiers before applying the new row. The row represents
      // the COMPLETE slot state at this level — zeroing first is what makes
      // replaces tier-1 slots with tier-2 slots; without zeroing, tier-1
      // would persist alongside the new tier-2 allocation).
      const newSlots = {} as typeof entity.spellcasting.slots;
      tiers.forEach((t, i) => {
        const total = slots[i] ?? 0;
        // spread, so a member of the tier this build does not know of stays
        newSlots[t] = { ...entity.spellcasting!.slots[t], total, used: Math.max(0, Math.min(entity.spellcasting!.slots[t]?.used ?? 0, total)) };
      });
      return {
        ...entity,
        spellcasting: { ...entity.spellcasting, slots: newSlots },
      };
    }

    case "known_spells": {
      // Adds fixed known spells/cantrips to an already-initialized spellcasting
      // block. No-op if spellcasting hasn't been initialized yet — order the
      // 'init_spellcasting' grant earlier in the same level entry's grants array.
      //
      // Closure pass 3 (item 1): same "no backing Feature/Effect at all"
      // gap as the old `proficiency` grant kind (closure pass 2) — this is
      // authored directly on class/subclass progression entries. Stamps
      // source-owned entitlements the same way, with the same source
      // fallback chain (explicit `source` > `classId` > 'manual').
      const ks = grant.value as KnownSpellsGrant;
      if (!entity.spellcasting) return entity;

      const ksSource: { kind: EntitlementSourceKind; id?: string } = source
        ? { kind: source.kind, id: source.id }
        : classId
          ? { kind: 'class', id: classId }
          : { kind: 'manual', id: undefined };
      const withEntitlements = grantEntitlements(entity, [
        ...(ks.cantripIds ?? []).map(key => ({ kind: 'cantrip_access' as const, key, sourceKind: ksSource.kind, sourceId: ksSource.id, choiceId: source?.choiceId })),
        ...(ks.spellIds   ?? []).map(key => ({ kind: 'spell_access'   as const, key, sourceKind: ksSource.kind, sourceId: ksSource.id, choiceId: source?.choiceId })),
      ]);
      return withEntitlements;
    }

    case "starting_item": {
      // Fixed gear granted automatically at level 1 — no player choice, unlike
      // the existing 'equipment' CHOICE kind (which needs a pool of
      // alternatives). Adds a fresh ItemInstance to carried inventory, same
      // shape resolveChoice's equipment handling already produces.
      const itemId = grant.value as string;
      return {
        ...entity,
        inventory: {
          ...entity.inventory,
          carried: [...entity.inventory.carried, { id: generateItemInstanceId(), itemId, quantity: 1, attuned: false, features: [] }],
        },
      };
    }

    default:
      return original;
  }
}

// ── canAutoResolve ────────────────────────────────────────────────────────────

export function canAutoResolve(choice: ChoiceDefinition): boolean {
  if (choice.kind === "asi")  return false;
  if (choice.kind === "feat") return false;
  if (choice.kind === "spell") return false;
  if (Array.isArray(choice.pool)) {
    return choice.pool.length === choice.count;
  }
  return false;
}

// ── queueChoice ───────────────────────────────────────────────────────────────

/**
 * Queues a pending choice. `originId` (typically the granting class's id)
 * namespaces the stored id so two different sources that happen to author
 * the same ChoiceDefinition.id at the same level can never collide and
 * silently overwrite each other's selection in entity.choices — every
 * official class's own skill-choice id is already manually prefixed
 * (e.g. 'rogue_skills_lvl_1'), which is why this hasn't been hit in
 * practice yet, but nothing enforced it, and homebrew content has no such
 * discipline. Omitting originId keeps the exact pre-existing id format
 * ('${choice.id}_${atLevel}') — used deliberately by the bonus-feat house
 * rule (see its own call sites), which is keyed by total character level
 * specifically so it's already shared/global across classes, not
 * per-source.
 */
export function queueChoice(entity: Entity, choice: ChoiceDefinition, atLevel: number, originId?: string,
  source?: { kind: EntitlementSourceKind; id?: string }): Entity {
  const id = originId ? `${originId}:${choice.id}_${atLevel}` : `${choice.id}_${atLevel}`;
  return {
    ...entity,
    choices: [...entity.choices, {
      id,
      definition:  choice,
      grantedAt:   atLevel,
      resolved:    false,
      selections:  [],
      sourceKind: source?.kind,
      sourceId: source?.id,
    }]
  };
}

import { applyStatModifiers } from './derivedStats';
import { collectAllEffects } from './collectEffects';
import { revokeResourceSource, revokeEntitlementsFromChoice, recomputeResourceMaximums } from './entitlements';
import { applyGrant, queueChoice } from './levelingGrants';
import { recomputeDerived } from './pipeline';
import { Entity, CampaignRules, Ability, Feature, ChoiceDefinition, ResourceGrant } from './types';

// ── reconcileConHp ─────────────────────────────────────────────────────────────


// ── reapplyResolvedAsi ─────────────────────────────────────────────────────────

/**
 * Re-applies every RESOLVED ASI selection on top of the entity's CURRENT base
 * stats. Needed because ASI increases live in base stats, and the scores screen
 * overwrites base stats wholesale — without this, re-confirming scores after
 * resolving an ASI silently erased the improvement (and since the choice stayed
 * resolved, it could never be taken again). Feat-based resolutions live in
 * features and are unaffected by a stat overwrite, so they're skipped here.
 *
 * Selections are parsed from the labels applyAsiToEntity stores, e.g.
 * 'con+2' or 'str+1,dex+1'. Each re-applied increase is capped by effective-
 * score headroom, mirroring applyAsiToEntity.
 */
export function reapplyResolvedAsi(entity: Entity, rules: CampaignRules): Entity {
  const asiChoices = entity.choices.filter(
    c => c.definition.kind === 'asi' && c.resolved
  );
  if (asiChoices.length === 0) return entity;

  const maxScore = rules.maxAbilityScore ?? Infinity;
  const effects  = collectAllEffects(entity);
  const newStats = { ...entity.stats };

  let changed = false;
  for (const choice of asiChoices) {
    for (const sel of choice.selections) {
      for (const part of sel.split(',')) {
        const m = part.trim().match(/^(str|dex|con|int|wis|cha)\+(\d+)$/);
        if (!m) continue;                       // 'feat:…', 'no_change', etc.
        const ab  = m[1] as Ability;
        const inc = parseInt(m[2], 10);
        const effective = applyStatModifiers(newStats, effects)[ab];
        const headroom  = Math.max(0, maxScore - effective);
        const applied   = Math.min(inc, headroom);
        if (applied > 0) {
          newStats[ab] += applied;
          changed = true;
        }
      }
    }
  }
  return changed ? { ...entity, stats: newStats } : entity;
}

/**
 * Subtracts every resolved ASI's recorded increases from base stats.
 * Used when class data is cleared (class re-selection): the ASI choices are
 * about to be dropped and re-queued by the new class, so their stat bumps must
 * not survive as ghosts — otherwise resolving the new class's ASI stacks on top
 * (+2 STR becomes +4). Selections are the same parseable labels
 * applyAsiToEntity records ('con+2', 'str+1,dex+1'); feat selections are
 * skipped (feat features are removed separately).
 */
export function stripResolvedAsiStats(entity: Entity): Entity {
  const asiChoices = entity.choices.filter(
    c => c.definition.kind === 'asi' && c.resolved
  );
  if (asiChoices.length === 0) return entity;

  const newStats = { ...entity.stats };
  let changed = false;
  for (const choice of asiChoices) {
    for (const sel of choice.selections) {
      for (const part of sel.split(',')) {
        const m = part.trim().match(/^(str|dex|con|int|wis|cha)\+(\d+)$/);
        if (!m) continue;
        const ab  = m[1] as Ability;
        const dec = parseInt(m[2], 10);
        newStats[ab] = Math.max(1, newStats[ab] - dec);
        changed = true;
      }
    }
  }
  return changed ? { ...entity, stats: newStats } : entity;
}

// ── ASI / Feat resolution ───────────────────────────────────────────────────────

/**
 * Resolves an ASI choice by raising base ability scores (capped at the rules
 * maximum), marking the choice resolved, applying the retroactive CON→HP rule,
 * and recomputing derived stats. Used by both creation and in-play level-up.
 */
export function applyAsiToEntity(
  entity:    Entity,
  choiceId:  string,
  increases: Partial<Record<Ability, number>>,
  rules:     CampaignRules,
): Entity {
  const maxScore = rules.maxAbilityScore ?? Infinity;
  // Cap against EFFECTIVE scores (base + racial/feat effects), not base stats.
  // A Mountain Dwarf with base STR 18 is effectively 20 — no headroom left.
  const effective = applyStatModifiers(entity.stats, collectAllEffects(entity));
  const newStats  = { ...entity.stats };
  const applied: Partial<Record<Ability, number>> = {};
  for (const ab of Object.keys(increases) as Ability[]) {
    const headroom = Math.max(0, maxScore - effective[ab]);
    const inc      = Math.min(increases[ab] ?? 0, headroom);
    if (inc > 0) {
      newStats[ab] = newStats[ab] + inc;
      applied[ab]  = inc;
    }
  }
  const label = (Object.entries(applied) as [Ability, number][])
    .map(([ab, n]) => `${ab}+${n}`)
    .join(',') || 'no_change';

  const updated: Entity = {
    ...entity,
    stats: newStats,
    choices: entity.choices.map(c =>
      c.id === choiceId ? { ...c, resolved: true, selections: [label] } : c
    ),
  };
  return recomputeDerived(updated, rules);
}

/**
 * Resolves an ASI choice by taking a feat instead. Adds the feat's Feature
 * through the standard grant path (so its automated Effects fire normally),
 * marks the choice resolved, applies the retroactive CON→HP rule (feats that
 * raise CON count too), and recomputes. Takes a Feature, not a Feat, so the
 * engine stays free of content imports.
 */
export function applyFeatToEntity(
  entity:      Entity,
  choiceId:    string,
  grantedAt:   number,
  featFeature: Feature,
  featId:      string,
  rules:       CampaignRules,
  /** CHOICE-AUTHORING-1: Feat.pendingChoices — queued (not auto-resolved)
   * alongside the feat's own feature grant, namespaced by featFeature.id so
   * removeFeature() can sweep any still-unresolved ones if the feat is
   * later removed live. */
  pendingChoices?: ChoiceDefinition[],
  /** Feat.resources — pools this feat grants. Tagged sourceKind 'feature' + this feat's feature
   * id, which is exactly what removeFeature's revokeResourceSource(…, 'feature', id) sweeps. */
  resources?: ResourceGrant[],
): Entity {
  let updated = applyGrant(entity, { kind: 'feature', value: featFeature }, grantedAt);
  for (const r of resources ?? []) {
    updated = applyGrant(updated, { kind: 'resource', value: r }, grantedAt, undefined, { kind: 'feature', id: featFeature.id });
  }
  updated = {
    ...updated,
    choices: updated.choices.map(c =>
      c.id === choiceId ? { ...c, resolved: true, selections: [`feat:${featId}`] } : c
    ),
  };
  for (const choice of pendingChoices ?? []) {
    updated = queueChoice(updated, choice, grantedAt, featFeature.id, { kind: 'feature', id: featFeature.id });
  }
  return recomputeDerived(updated, rules);
}

/**
 * Removes a single feature by id — the engine half of live feature
 * add/remove (both players and DMs, mid-session). Deliberately unopinionated
 * about WHICH features can be removed (no special-casing race/class/
 * subclass-sourced ones) — the UI layer decides whether to warn before
 * removing a structural feature, not this primitive.
 *
 * Best-effort only for the linked resource: strips a CustomResource whose
 * sourceId === featureId (the exact feature being removed owns it — true for
 * a manually-added limited-use feature, see traitCompiler.ts's
 * buildTraitFeature). Content-granted resources (race/class/feat/...) have
 * no clean 1:1 Feature→Resource mapping and are deliberately left untouched.
 *
 * No recomputeDerived call — matches applyGrant and every other pure
 * add/remove primitive here; the caller's simulate()/mutate() recomputes.
 */
export function removeFeature(entity: Entity, featureId: string): Entity {
  const removed = entity.features.find(f => f.id === featureId);
  if (!removed) return entity;
  // Closure pass 2 (item 4): also revoke any entitlement this feature
  // directly owns (sourceKind:'feature', e.g. a manually-authored trait's
  // own proficiency grant) and any entitlement produced by resolving ONE OF
  // ITS OWN queued choices (namespaced `${featureId}:...`, see queueChoice's
  // id composition). The resolved ChoiceState record itself is still kept
  // below (character history, per CHOICE-AUTHORING-1) but the grant it
  // produced must not outlive the feature that originated the choice.
  const ownedResolvedChoiceIds = entity.choices
    .filter(c => c.resolved && c.id.startsWith(`${featureId}:`))
    .map(c => c.id);
  let stripped = revokeResourceSource(entity, 'feature', featureId);
  stripped = revokeResourceSource(stripped, 'manual', featureId);
  for (const choiceId of ownedResolvedChoiceIds) stripped = revokeEntitlementsFromChoice(stripped, choiceId);
  return recomputeResourceMaximums({
    ...stripped,
    features: stripped.features.filter(f => f.id !== featureId),
    resources: {
      ...stripped.resources,
      custom: stripped.resources.custom.filter(r => r.sourceId !== featureId
        || (stripped.entitlements ?? []).some(e => e.kind === 'resource_grant' && e.key === r.id)),
    },
    // CHOICE-AUTHORING-1: also best-effort strip any STILL-UNRESOLVED choice
    // namespaced to this exact feature (applyFeatToEntity queues
    // Feat.pendingChoices with originId=featFeature.id — see queueChoice's
    // id composition, `${originId}:${choice.id}_${atLevel}`). An already-
    // RESOLVED choice is left alone — it's part of the character's history,
    // same "don't silently reassign a past pick" rule invalid_expertise_target
    // validation follows.
    choices: stripped.choices.filter(c => c.resolved || !c.id.startsWith(`${featureId}:`)),
  });
}

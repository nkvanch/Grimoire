import { originFeats } from '../content/runtimeRules';
import { removeFeature } from './levelingAsiFeats';
import { applyGrant, queueChoice } from './levelingGrants';
import { recomputeDerived } from './pipeline';
import { splitSelection, lookupSpell, cantripQualifies, checkPrerequisites, heldOptionIds, dependentsOf } from './prerequisites';
import { Entity, CampaignRules, Feature, type Prerequisite } from './types';

export function applyPoolChoiceToEntity(
  entity:            Entity,
  choiceId:           string,
  selectedOptionIds:  string[],
  rules:              CampaignRules,
): Entity {
  const pending = entity.choices.find(c => c.id === choiceId);
  if (!pending || !Array.isArray(pending.definition.pool)) return entity;

  // Prerequisites (level, another option, a known cantrip, mutual exclusion) are enforced here, not only in the picker.
  // A repeatable option may be selected as `optionId::target`: the target is validated and written on the feature.
  const classContext = pending.definition.forClassId ?? entity.identity.classId;
  const takenTargets = new Set<string>();
  for (const c of entity.choices) if (c.resolved) for (const sel of c.selections) takenTargets.add(String(sel));
  const seenIds = new Set<string>();
  for (const sel of selectedOptionIds) {
    const { optionId: optId, target } = splitSelection(sel);
    const option = pending.definition.pool.find(o => o.id === optId);
    if (seenIds.has(sel)) throw new Error(`${option?.label ?? optId} was picked twice${target ? ` for the same target` : ''}.`);
    seenIds.add(sel);
    if (target === undefined && takenTargets.has(sel)) throw new Error(`You already have ${option?.label ?? optId}.`);
    if (target !== undefined) {
      if (!option?.repeatable) throw new Error(`${option?.label ?? optId} cannot be taken more than once.`);
      if (takenTargets.has(sel)) throw new Error(`You already took ${option.label} for that target.`);
      if (option.repeatable.target === 'cantrip') {
        const sp = lookupSpell(target);
        if (!sp || !(entity.spellcasting?.cantrips ?? []).includes(target)) throw new Error('Pick one of your known cantrips.');
        if (!cantripQualifies(sp, option.requires)) throw new Error(`${sp.name ?? target} does not qualify for ${option.label}.`);
      } else {
        if (!originFeats().some(f => f.id === target)) throw new Error('Pick an Origin feat.');
      }
    }
    const check = checkPrerequisites(entity, option?.requires, {
      alsoHeld: selectedOptionIds.map(id => splitSelection(id).optionId).filter(id => id !== optId), classId: classContext,
    });
    if (!check.met) throw new Error(`${option?.label ?? optId} requires: ${check.unmet.join(', ')}.`);
  }

  let updated = entity;
  for (const sel of selectedOptionIds) {
    const { optionId: optId, target } = splitSelection(sel);
    const option = pending.definition.pool.find(o => o.id === optId);
    if (option?.value) {
      let feature = option.value as Feature;
      if (target !== undefined && option.repeatable) {
        const label = option.repeatable.target === 'cantrip' ? (lookupSpell(target)?.name ?? target) : target.replace(/_/g, ' ');
        feature = { ...feature, id: `${feature.id}::${target}`, name: `${feature.name} (${label})`, description: `${feature.description} Taken for: ${label}.` };
      }
      updated = applyGrant(updated, { kind: 'feature', value: feature }, pending.grantedAt);
      // An option taken for an Origin feat (Lessons of the First Ones) also brings that feat's own feature, pools and picks. They are
      // namespaced under the granted feature (`<id>::feat`) so swapping the option takes them back out with it.
      if (target !== undefined && option.repeatable?.target === 'origin_feat') {
        const feat = originFeats().find(f => f.id === target);
        if (feat) {
          const featFeatureId = `${feature.id}::feat`;
          updated = applyGrant(updated, {
            kind: 'feature',
            value: { ...feat.feature, id: featFeatureId, name: `${feat.name} (${option.label})`, source: { kind: 'feat', refId: feat.id }, level: null, isActive: true },
          }, pending.grantedAt);
          for (const r of feat.resources ?? []) {
            updated = applyGrant(updated, { kind: 'resource', value: { ...r, resourceId: `${featFeatureId}_${r.resourceId}` } }, pending.grantedAt, undefined, { kind: 'feat', id: featFeatureId });
          }
          for (const pc of feat.pendingChoices ?? []) {
            updated = queueChoice(updated, pc, pending.grantedAt, featFeatureId, { kind: 'feat', id: featFeatureId });
          }
        }
      }
    }
  }
  updated = {
    ...updated,
    choices: updated.choices.map(c =>
      c.id === choiceId ? { ...c, resolved: true, selections: selectedOptionIds } : c
    ),
  };
  return recomputeDerived(updated, rules);
}

/**
 * Swaps one held option of a replaceable `feature_pool` choice (Fighting Style, Metamagic, Eldritch Invocations,
 * Hunter's Prey, ...) for another from the same pool, as one atomic step: the old option's feature (and anything it
 * opened or granted) is taken out, the new one is granted at the same level, and the choice's selections follow.
 * Refused, with the reason in the error, when the choice is not replaceable, the old option is not held, the new one
 * is already held or not in the pool, the new one's prerequisites are not met once the old one is gone, or another
 * held option needs the old one (an invocation that is a prerequisite of another cannot be replaced).
 */
export function replacePoolOption(
  entity:       Entity,
  choiceId:     string,
  oldOptionId:  string,
  newOptionId:  string,
  rules:        CampaignRules,
): Entity {
  const choice = entity.choices.find(c => c.id === choiceId);
  if (!choice || !choice.resolved || !Array.isArray(choice.definition.pool)) throw new Error('That choice has not been made yet.');
  if (!choice.definition.replace) throw new Error('This choice cannot be swapped.');
  const pool = choice.definition.pool;
  const oldOpt = pool.find(o => o.id === splitSelection(oldOptionId).optionId);
  const newOpt = pool.find(o => o.id === newOptionId);
  if (!oldOpt || !choice.selections.includes(oldOptionId)) throw new Error('You do not hold that option.');
  if (!newOpt || !newOpt.value) throw new Error('That option is not available here.');
  if (oldOptionId === newOptionId) throw new Error('Pick a different option.');

  const held = heldOptionIds(entity);
  const heldFeatureIds = new Set(entity.features.map(f => f.id));
  if (held.has(newOptionId) || heldFeatureIds.has((newOpt.value as Feature).id)) throw new Error(`You already have ${newOpt.label}.`);

  const optionsById: Record<string, { requires?: Prerequisite[]; label: string }> = {};
  for (const c of entity.choices) if (Array.isArray(c.definition.pool)) for (const o of c.definition.pool) optionsById[o.id] = o;
  const dependents = dependentsOf(oldOptionId, [...held], optionsById);
  if (dependents.length > 0) {
    throw new Error(`${oldOpt.label} is a prerequisite of ${dependents.map(id => optionsById[id]?.label ?? id).join(', ')}, so it cannot be replaced.`);
  }

  const classContext = choice.definition.forClassId ?? entity.identity.classId;
  const oldTarget = splitSelection(oldOptionId).target;
  const oldFeatureId = `${(oldOpt.value as Feature).id}${oldTarget !== undefined ? `::${oldTarget}` : ''}`;
  let withoutOld = removeFeature(entity, oldFeatureId);
  // What an Origin-feat-targeted option brought along goes with it.
  if (withoutOld.features.some(f => f.id === `${oldFeatureId}::feat`)) withoutOld = removeFeature(withoutOld, `${oldFeatureId}::feat`);
  // Check against the character as they will be after the swap: the old option no longer counts as held.
  const afterRemoval: Entity = { ...withoutOld, choices: withoutOld.choices.map(c => c.id === choiceId ? { ...c, selections: c.selections.filter(id => id !== oldOptionId) } : c) };
  const check = checkPrerequisites(afterRemoval, newOpt.requires, { classId: classContext });
  if (!check.met) throw new Error(`${newOpt.label} requires: ${check.unmet.join(', ')}.`);

  let updated = applyGrant(afterRemoval, { kind: 'feature', value: newOpt.value }, choice.grantedAt);
  updated = {
    ...updated,
    choices: updated.choices.map(c => c.id === choiceId ? { ...c, selections: [...c.selections.filter(id => id !== oldOptionId), newOptionId] } : c),
  };
  return recomputeDerived(updated, rules);
}

/** Held options of a replaceable choice, with the options each could be swapped for (prerequisites already checked). */
export function replaceableOptions(entity: Entity, choiceId: string): { optionId: string; label: string; blockedBy?: string; candidates: { id: string; label: string; unmet: string[] }[] }[] {
  const choice = entity.choices.find(c => c.id === choiceId);
  if (!choice || !choice.resolved || !choice.definition.replace || !Array.isArray(choice.definition.pool)) return [];
  const pool = choice.definition.pool;
  const held = heldOptionIds(entity);
  const heldFeatureIds = new Set(entity.features.map(f => f.id));
  const optionsById: Record<string, { requires?: Prerequisite[]; label: string }> = {};
  for (const c of entity.choices) if (Array.isArray(c.definition.pool)) for (const o of c.definition.pool) optionsById[o.id] = o;
  const classContext = choice.definition.forClassId ?? entity.identity.classId;

  return choice.selections.map(optionId => {
    const opt = pool.find(o => o.id === splitSelection(optionId).optionId);
    const deps = dependentsOf(splitSelection(optionId).optionId, [...held], optionsById);
    const stripped: Entity = { ...entity, choices: entity.choices.map(c => c.id === choiceId ? { ...c, selections: c.selections.filter(id => id !== optionId) } : c) };
    const candidates = pool
      .filter(o => o.id !== optionId && !held.has(o.id) && !heldFeatureIds.has((o.value as Feature | undefined)?.id ?? ''))
      .map(o => ({ id: o.id, label: o.label, unmet: checkPrerequisites(stripped, o.requires, { classId: classContext }).unmet }));
    return {
      optionId, label: `${opt?.label ?? optionId}${splitSelection(optionId).target ? ` (${splitSelection(optionId).target!.replace(/_/g, ' ')})` : ''}`,
      ...(deps.length ? { blockedBy: `Needed by ${deps.map(id => optionsById[id]?.label ?? id).join(', ')}` } : {}),
      candidates,
    };
  });
}

// ── Infusion selection ───────────────────────────────────────────────────────

export function applyInfusionChoiceToEntity(
  entity:      Entity,
  choiceId:    string,
  infusionIds: string[],
  rules:       CampaignRules,
): Entity {
  const updated: Entity = {
    ...entity,
    knownInfusionIds: [...(entity.knownInfusionIds ?? []), ...infusionIds],
    choices: entity.choices.map(c =>
      c.id === choiceId ? { ...c, resolved: true, selections: infusionIds } : c
    ),
  };
  return recomputeDerived(updated, rules);
}

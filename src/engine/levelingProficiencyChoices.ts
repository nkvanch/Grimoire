import { eligibleExpertiseOptions, eligibleToolOptions, eligibleLanguageOptions } from './choiceEligibility';
import { revokeEntitlementsFromChoice } from './entitlements';
import { applyGrant } from './levelingGrants';
import { recomputeDerived } from './pipeline';
import { ChoiceDefinition, Entity, CampaignRules, SkillName, Feature } from './types';

// ── Expertise / Tool / Language choices ──────────────────────────────────────

/**
 * CHOICE-AUTHORING-1: authoritative pool-restriction check for the three
 * apply*ChoiceToEntity functions below. Previously each of these trusted the
 * caller (in practice, always a picker UI reading choiceEligibility.ts's
 * already-filtered options) to only ever pass pool-legal ids — real for
 * every existing UI path, but not enforced by the one place that's supposed
 * to be authoritative for runtime legality, so a restricted pool ("choose
 * one of smith's tools, brewer's supplies, or mason's tools") was only ever
 * a UI-layer suggestion, not a real constraint. `'all'`/FilterExpression
 * pools impose no extra restriction (the eligibility helpers already narrow
 * those); a literal array pool is checked here.
 */
function checkPoolRestriction(pool: ChoiceDefinition['pool'], ids: string[], label: string): void {
  if (!Array.isArray(pool)) return;
  const legal = new Set(pool.map(o => String(o.value ?? o.id)));
  for (const id of ids) {
    if (!legal.has(id)) throw new Error(`"${id}" is not in this choice's ${label} pool.`);
  }
}

/**
 * Expertise-choice deadlock closure: the nominal `count` a bounded distinct
 * repeated choice asks for (e.g. "choose 2 skills for Expertise") is not
 * always achievable — a character with only 1 trained-but-not-yet-expert
 * skill can never legally supply 2 distinct selections, and requiring an
 * exact match then makes the choice (and creation) impossible to complete.
 * The completion count is capped at however many DISTINCT legal options
 * actually exist right now — never fabricating extra options, never
 * permitting one option to fill two slots. `eligibleCount` must be computed
 * live (from the CURRENT entity state, after any in-progress edit's own old
 * grant has already been stripped — see applyExpertiseChoiceToEntity), not
 * cached at choice-queue time, so proficiency changes are reflected
 * automatically. Exported so a future bounded distinct-option choice kind
 * (tool/language today still validate against the raw nominal count — see
 * this closure's own report for why that wasn't touched this pass) can
 * reuse the exact same one-line rule instead of a second implementation.
 */
export function effectiveRequiredCount(nominalCount: number, eligibleCount: number): number {
  return Math.min(nominalCount, eligibleCount);
}

/**
 * Expertise stale-eligibility closure (Codex re-audit finding): the exact
 * "strip THIS choice's own prior grant, then recompute" step
 * applyExpertiseChoiceToEntity performs internally before computing
 * eligibility — extracted into its own exported function so the creation
 * UI (app/creation/repeated-choice.tsx) can compute the SAME "what's
 * actually legal right now" answer the engine will use, rather than a
 * parallel calculation that can silently diverge from it. This is the
 * root-cause fix for the audit finding: the picker previously computed its
 * own eligibility against the UN-stripped draft and then papered over the
 * gap by merging ALL prior selections back in (mergeStaleSelections) — that
 * conflated "excluded only because THIS choice's own grant is in the way"
 * (legal again once stripped) with "genuinely no longer eligible for an
 * unrelated reason, e.g. an earlier proficiency choice changed since" (NOT
 * legal even after stripping). Only ONE function ever strips this choice's
 * grant now, so the two call sites cannot disagree about what "legal" means.
 *
 * A no-op (same reference, no recompute) when the choice isn't resolved yet
 * or has no grant feature present (nothing to strip).
 */
export function withExpertiseChoiceGrantStripped(entity: Entity, choiceId: string, rules: CampaignRules): Entity {
  const pending = entity.choices.find(c => c.id === choiceId);
  if (!pending?.resolved) return entity;
  const grantFeatureId = `${choiceId}_grant`;
  if (!entity.features.some(f => f.id === grantFeatureId)) return entity;
  return recomputeDerived({ ...entity, features: entity.features.filter(f => f.id !== grantFeatureId) }, rules);
}

/**
 * Tool/Language deadlock/edit closure: the SAME "strip this choice's own
 * prior grant, then recompute" pattern as withExpertiseChoiceGrantStripped
 * above, but for Tool/Language — which grant through the ENTITLEMENT system
 * (applyGrant's 'proficiency' kind, tagged with this choiceId — see
 * applyToolChoiceToEntity/applyLanguageChoiceToEntity) rather than a
 * synthetic Feature, so the strip step is revokeEntitlementsFromChoice, not
 * a feature filter. A no-op (same reference, no recompute) when the choice
 * isn't resolved yet or has no entitlement to strip.
 */
export function withProficiencyChoiceGrantStripped(entity: Entity, choiceId: string, rules: CampaignRules): Entity {
  const pending = entity.choices.find(c => c.id === choiceId);
  if (!pending?.resolved) return entity;
  const stripped = revokeEntitlementsFromChoice(entity, choiceId);
  if (stripped === entity) return entity;
  return recomputeDerived(stripped, rules);
}

/**
 * Resolves (or RE-resolves — see below) an 'expertise' pending choice.
 * Bypasses resolveChoice for the same reason ASI/subclass/infusion/spell do
 * — the legal pool is computed live from the character's own current
 * proficiencies (item 3: "eligible expertise target = character currently
 * proficient AND not already expert AND allowed by source choice"), not a
 * static content-authored array, so only the picker (which reads live
 * entity.skills.skills) can know it.
 *
 * Applies by synthesizing ONE Feature (id `${choiceId}_grant`) whose effects
 * are grant_proficiency/'multiply' per selected skill — the exact mechanism
 * pipeline.ts already uses for expertise (see applyStatModifiers's sibling
 * skill-effect handling, and AsiFeatPicker.tsx's Feat.skillChoice, the only
 * other place in this engine that already builds this effect shape from a
 * player pick). Granting it through applyGrant({kind:'feature',...}) — the
 * same choke point every other feature grant goes through — means the
 * synthetic feature is a normal entity.features entry: it shows up on the
 * Features tab like any other, and (since its `source.kind` is inherited
 * from the SAME class the expertise choice came from) it's swept up by the
 * existing class-change feature-stripping logic exactly like every other
 * class-sourced feature, satisfying item 6 without new removal machinery.
 *
 * Expertise-choice deadlock/edit closure — two behavior changes from before:
 *
 * 1. EFFECTIVE REQUIRED COUNT: `skillIds.length` must equal
 *    effectiveRequiredCount(definition.count, <live eligible distinct
 *    options>), not the raw nominal `count` — so a choice asking for 2 when
 *    only 1 (or 0) skills are actually eligible can still be completed
 *    (with exactly that many selections, or none) instead of permanently
 *    blocking creation. Still never permits one skill to fill two slots
 *    (the dedupe check below is unchanged) and never fabricates an
 *    eligible option that doesn't exist.
 *
 * 2. EDIT-IN-PLACE: previously `if (!pending || pending.resolved) return
 *    entity;` silently no-op'd any attempt to resolve an already-resolved
 *    choice again, which is WHY the only way to change an earlier pick was
 *    to navigate backward out of the choice entirely. Now, if the choice is
 *    already resolved, its OWN prior grant (`${choiceId}_grant`, and only
 *    that exact feature id — never another choice's, another source's, or a
 *    manual override's expertise) is stripped and the entity recomputed
 *    FIRST, so eligibility/legality below are checked against a clean slate
 *    (the choice's own old picks read back as "eligible again," not as
 *    already-expert) before the new selection is applied. A no-op strip
 *    (nothing removed) when this is the FIRST resolution, so the normal
 *    first-time path is unchanged.
 */
export function applyExpertiseChoiceToEntity(
  entity:   Entity,
  choiceId: string,
  skillIds: string[],
  rules:    CampaignRules,
): Entity {
  const pending = entity.choices.find(c => c.id === choiceId);
  if (!pending) return entity;

  // Edit-in-place (Part B): strip ONLY this choice's own prior grant before
  // recomputing eligibility — a no-op (same reference, no recompute) the
  // first time this choice is ever resolved. Shared with the creation UI's
  // OWN eligibility computation (withExpertiseChoiceGrantStripped's own doc
  // comment) so the two can never disagree about what's legal.
  const grantFeatureId = `${choiceId}_grant`;
  const base = withExpertiseChoiceGrantStripped(entity, choiceId, rules);

  const eligibleNow = eligibleExpertiseOptions(base, pending.definition.pool).length;
  const effectiveRequired = effectiveRequiredCount(pending.definition.count, eligibleNow);
  if (skillIds.length !== effectiveRequired) {
    throw new Error(`Expected ${effectiveRequired} expertise selection${effectiveRequired === 1 ? '' : 's'}, got ${skillIds.length}.`);
  }
  if (new Set(skillIds).size !== skillIds.length) {
    throw new Error('Duplicate expertise selections in the same choice.');
  }
  checkPoolRestriction(pending.definition.pool, skillIds, 'restricted skill');
  for (const id of skillIds) {
    const entry = base.skills.skills[id as SkillName];
    if (!entry) throw new Error(`"${id}" isn't a real skill.`);
    if (!entry.trained) throw new Error(`Not proficient in "${id}" — expertise requires existing proficiency.`);
    if (entry.expertise) throw new Error(`Already has expertise in "${id}".`);
  }

  // Part C: zero (or otherwise fewer-than-nominal) eligible options is a
  // legitimately COMPLETE choice with fewer/no grants — never a missing
  // synthetic feature standing in for "not resolved yet".
  if (skillIds.length === 0) {
    const updated = {
      ...base,
      choices: base.choices.map(c => c.id === choiceId ? { ...c, resolved: true, selections: [] } : c),
    };
    return recomputeDerived(updated, rules);
  }

  const grantFeature: Feature = {
    id: grantFeatureId,
    name: pending.definition.prompt || 'Expertise',
    description: `Expertise: ${skillIds.join(', ')}.`,
    source: { kind: 'class', refId: pending.definition.forClassId ?? entity.identity.classId },
    level: pending.grantedAt,
    effects: skillIds.map(skillId => ({
      type: 'grant_proficiency' as const, target: `skill:${skillId}`,
      operation: 'multiply' as const, value: null, condition: null,
    })),
    actions: [], choices: [], passive: true,
  };
  let updated = applyGrant(base, { kind: 'feature', value: grantFeature }, pending.grantedAt, pending.definition.forClassId);
  updated = {
    ...updated,
    choices: updated.choices.map(c => c.id === choiceId ? { ...c, resolved: true, selections: skillIds } : c),
  };
  return recomputeDerived(updated, rules);
}

/**
 * Resolves (or RE-resolves — Tool/Language deadlock/edit closure) a 'tool'
 * pending choice — reuses the existing Grant.kind:'proficiency' mechanism
 * (the same one static content already uses to grant a FIXED tool list)
 * rather than inventing a new mutation path; `entity.proficiencies.tools`
 * already dedupes on merge. Bypasses resolveChoice for the same
 * 'all'-sentinel-pool reason as every other live-picker-driven choice
 * above; a literal-array pool (a restricted "choose one of: X, Y, Z") still
 * routes through here too — checkPoolRestriction enforces it as the
 * authoritative check, not just the picker UI.
 *
 * Mirrors applyExpertiseChoiceToEntity's own deadlock/edit closure exactly
 * (same two behavior changes, same rationale — see that function's doc
 * comment for the full writeup):
 *
 * 1. EFFECTIVE REQUIRED COUNT: `toolIds.length` must equal
 *    effectiveRequiredCount(definition.count, <live eligible distinct
 *    tools>), not the raw nominal `count` — a choice asking for more tools
 *    than exist can still complete instead of permanently blocking
 *    creation.
 * 2. EDIT-IN-PLACE: an already-resolved choice can be resolved again —
 *    withProficiencyChoiceGrantStripped removes ONLY this choice's own
 *    prior entitlement grant first (never another choice's/source's/a
 *    manual override's), so eligibility/legality below are checked against
 *    a clean slate before the new selection is applied.
 */
export function applyToolChoiceToEntity(
  entity:   Entity,
  choiceId: string,
  toolIds:  string[],
  rules:    CampaignRules,
): Entity {
  const pending = entity.choices.find(c => c.id === choiceId);
  if (!pending) return entity;

  const base = withProficiencyChoiceGrantStripped(entity, choiceId, rules);
  const eligibleNow = eligibleToolOptions(base, pending.definition.pool).length;
  const effectiveRequired = effectiveRequiredCount(pending.definition.count, eligibleNow);
  if (toolIds.length !== effectiveRequired) {
    throw new Error(`Expected ${effectiveRequired} tool selection${effectiveRequired === 1 ? '' : 's'}, got ${toolIds.length}.`);
  }
  if (new Set(toolIds).size !== toolIds.length) {
    throw new Error('Duplicate tool selections in the same choice.');
  }
  checkPoolRestriction(pending.definition.pool, toolIds, 'restricted tool');
  for (const id of toolIds) {
    if (base.proficiencies.tools.includes(id)) throw new Error(`Already proficient with "${id}".`);
  }

  if (toolIds.length === 0) {
    const updated = {
      ...base,
      choices: base.choices.map(c => c.id === choiceId ? { ...c, resolved: true, selections: [] } : c),
    };
    return recomputeDerived(updated, rules);
  }

  // Closure pass 2: tag the resulting entitlement(s) with the choice's own
  // explicit provenance (ChoiceState.sourceKind/sourceId, closure pass 2)
  // when set, falling back to classId-inference the same way applyGrant's
  // own default already does — plus choiceId, so removing just THIS
  // choice's origin (via revokeEntitlementsFromChoice) doesn't disturb a
  // different grant from the same source.
  let updated = applyGrant(
    base, { kind: 'proficiency', value: { tools: toolIds } }, pending.grantedAt, pending.definition.forClassId,
    pending.sourceKind
      ? { kind: pending.sourceKind, id: pending.sourceId, choiceId }
      : pending.definition.forClassId
        ? { kind: 'class', id: pending.definition.forClassId, choiceId }
        : { kind: 'manual', choiceId },
  );
  updated = {
    ...updated,
    choices: updated.choices.map(c => c.id === choiceId ? { ...c, resolved: true, selections: toolIds } : c),
  };
  return recomputeDerived(updated, rules);
}

/**
 * Resolves (or RE-resolves — Tool/Language deadlock/edit closure) a
 * 'language' pending choice — same shape as applyToolChoiceToEntity above,
 * targeting entity.proficiencies.languages instead. See that function's
 * doc comment for the full effective-required-count / edit-in-place
 * rationale.
 */
export function applyLanguageChoiceToEntity(
  entity:      Entity,
  choiceId:    string,
  languageIds: string[],
  rules:       CampaignRules,
): Entity {
  const pending = entity.choices.find(c => c.id === choiceId);
  if (!pending) return entity;

  const base = withProficiencyChoiceGrantStripped(entity, choiceId, rules);
  const eligibleNow = eligibleLanguageOptions(base, pending.definition.pool).length;
  const effectiveRequired = effectiveRequiredCount(pending.definition.count, eligibleNow);
  if (languageIds.length !== effectiveRequired) {
    throw new Error(`Expected ${effectiveRequired} language selection${effectiveRequired === 1 ? '' : 's'}, got ${languageIds.length}.`);
  }
  if (new Set(languageIds).size !== languageIds.length) {
    throw new Error('Duplicate language selections in the same choice.');
  }
  checkPoolRestriction(pending.definition.pool, languageIds, 'restricted language');
  for (const id of languageIds) {
    if (base.proficiencies.languages.includes(id)) throw new Error(`Already knows "${id}".`);
  }

  if (languageIds.length === 0) {
    const updated = {
      ...base,
      choices: base.choices.map(c => c.id === choiceId ? { ...c, resolved: true, selections: [] } : c),
    };
    return recomputeDerived(updated, rules);
  }

  let updated = applyGrant(
    base, { kind: 'proficiency', value: { languages: languageIds } }, pending.grantedAt, pending.definition.forClassId,
    pending.sourceKind
      ? { kind: pending.sourceKind, id: pending.sourceId, choiceId }
      : pending.definition.forClassId
        ? { kind: 'class', id: pending.definition.forClassId, choiceId }
        : { kind: 'manual', choiceId },
  );
  updated = {
    ...updated,
    choices: updated.choices.map(c => c.id === choiceId ? { ...c, resolved: true, selections: languageIds } : c),
  };
  return recomputeDerived(updated, rules);
}

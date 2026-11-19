import { applyStatModifiers } from './derivedStats';
import { collectAllEffects } from './collectEffects';
import { revokeResourceSource } from './entitlements';
import { queueChoice, applyGrant } from './levelingGrants';
import { recomputeDerived } from './pipeline';
import { Background, Ability, Entity, CampaignRules, SkillName, Feat, BACKGROUND_CHOICE_PREFIX, Feature } from './types';

/** Computes one flexAsi pick's bonus amount — mirrors app/creation/
 *  background.tsx's own flexAmountFor exactly. 'two_distinct_plus_one' is
 *  always +1 each. 'two_one_or_three_one' depends only on how many picks
 *  were actually made (2 => +2/+1 split, first pick gets +2; 3 => +1/+1/+1)
 *  — background.tsx's own UI never lets flexPicks.length end up
 *  inconsistent with the chosen sub-mode, so the pick count alone is a
 *  reliable, sufficient signal; no separate sub-mode parameter needed. */
function flexAsiAmountFor(mode: NonNullable<Background['flexibleAsi']>['mode'], picks: Ability[], idx: number): number {
  if (mode.kind === 'two_distinct_plus_one') return 1;
  return picks.length === 3 ? 1 : (idx === 0 ? 2 : 1);
}

/**
 * Swaps a character's background live, mid-session — a straight-line port
 * of app/creation/background.tsx's own selectBackground(), so a change
 * made in play behaves identically to picking a background at creation.
 *
 * Skill retrain differs from BOTH existing implementations on purpose:
 * background.tsx's own BG_SKILL_MAP-based untrain has a real, confirmed bug
 * (untrains by a hardcoded 13-official-background table with no check for
 * whether some OTHER active feature also grants the same skill) — fixed
 * here by computing the untrain candidate set from the OLD background's own
 * feature effects, minus any skill still granted by a currently-active
 * NON-background feature's own grant_proficiency effect.
 *
 * That computed set has one structural blind spot no amount of feature-
 * scanning can close: a class-driven skill CHOICE sets
 * entity.skills.skills[X].trained = true directly via resolveChoice, with
 * NO backing Effect at all (see class-detail.tsx's own comment on this) —
 * so if a class choice happens to have trained the same skill the old
 * background's features also grant, this scan has no way to see that and
 * will (correctly by its own logic, wrongly in outcome) suggest untraining
 * it. Deliberately NOT applied silently: `skillRetrainOverrides` lets the
 * caller (a UI-level editable checklist) correct the one case this can't
 * see, defaulting to the computed suggestion for everything else.
 */
export function swapBackground(
  entityBefore: Entity,
  newBackground: Background,
  rules: CampaignRules,
  flexAsiPicks?: Ability[],
  skillRetrainOverrides?: Partial<Record<SkillName, boolean>>,
  /** The Feat named by newBackground.originFeat, resolved by the caller (the engine has no content store). */
  originFeat?: Feat,
): Entity {
  // An earlier Origin feat's spells are sourced to the feat, not the background: take them back out first.
  const entity = revokeBackgroundOriginFeat(entityBefore);
  const oldBgFeatures = entity.features.filter(f => f.source.kind === 'background');
  const otherFeatures = entity.features.filter(f => f.source.kind !== 'background');

  const oldBgSkills = new Set<SkillName>();
  for (const f of oldBgFeatures) {
    for (const e of f.effects) {
      if (e.type === 'grant_proficiency' && e.operation === 'add' && e.target.startsWith('skill:')) {
        oldBgSkills.add(e.target.slice(6) as SkillName);
      }
    }
  }

  const candidateUntrain = new Set<SkillName>();
  for (const skill of oldBgSkills) {
    const grantedElsewhere = otherFeatures.some(f =>
      f.effects.some(e => e.type === 'grant_proficiency' && e.operation === 'add' && e.target === `skill:${skill}`)
    );
    if (!grantedElsewhere) candidateUntrain.add(skill);
  }

  let updatedSkills = { ...entity.skills.skills };
  const untrain = (skill: SkillName) => {
    if (updatedSkills[skill]) {
      updatedSkills = { ...updatedSkills, [skill]: { ...updatedSkills[skill], trained: false, expertise: false } };
    }
  };
  for (const skill of candidateUntrain) {
    if (skillRetrainOverrides?.[skill] === true) continue; // human overrode: keep trained
    untrain(skill);
  }
  // A checklist row can also force-untrain a skill the scan didn't flag
  // (skillRetrainOverrides[skill] === false for a skill outside
  // candidateUntrain) — the UI offers every old-background skill as a row
  // regardless of the computed default, so honor an explicit false too.
  for (const [skill, keep] of Object.entries(skillRetrainOverrides ?? {}) as [SkillName, boolean][]) {
    if (keep === false && !candidateUntrain.has(skill)) untrain(skill);
  }

  // CHOICE-AUTHORING-1: sweep any still-queued choice that originated from
  // the OLD background's own features or its pendingChoices — same
  // "resolved choices are history, unresolved ones get swept" pattern
  // clearRaceFeatures() uses for RACE_CHOICE_PREFIX. Background features
  // never carry their own Feature.choices (that's still vestigial/unused
  // engine-wide), so unlike clearRaceFeatures only the prefix check is
  // needed here — no feature-sourced choice ids to also collect.
  const sweptChoices = entity.choices.filter(c =>
    c.resolved || !c.definition.id.startsWith(BACKGROUND_CHOICE_PREFIX),
  );

  // Closure pass 2: revoke any entitlement tagged to the OLD background id
  // — a no-op today (no current background-originated choice stamps
  // sourceKind:'background' yet, since queueChoice below doesn't pass an
  // explicit source), but keeps this removal path consistent with
  // applySubclassToEntity's own pattern and correct the moment a background
  // choice IS stamped with real provenance.
  let updated: Entity = revokeResourceSource({
    ...entity,
    identity: { ...entity.identity, backgroundId: newBackground.id },
    features: otherFeatures,
    skills: { skills: updatedSkills },
    choices: sweptChoices,
  }, 'background', entity.identity.backgroundId);

  for (const choice of newBackground.pendingChoices ?? []) {
    updated = queueChoice(updated, choice, 0, undefined, { kind: 'background', id: newBackground.id });
  }

  for (const feature of newBackground.features) {
    updated = applyGrant(updated, { kind: 'feature', value: { ...feature, isActive: true } }, 0);
  }
  if (newBackground.originFeat) updated = applyBackgroundOriginFeat(updated, newBackground, originFeat);

  if (newBackground.flexibleAsi && flexAsiPicks && flexAsiPicks.length > 0) {
    // ABILITY-CAP-1: clamp each pick to remaining headroom under the
    // effective cap (rules.maxAbilityScore, default Infinity when
    // uncapped) — same rule applyAsiToEntity() enforces for the plain ASI
    // path. Effective stats read BEFORE this grant, matching how every
    // other ASI-mutation path measures headroom against the character's
    // current score, not a stale pre-session snapshot.
    const maxScore = rules.maxAbilityScore ?? Infinity;
    const effectiveBefore = applyStatModifiers(updated.stats, collectAllEffects(updated));
    const flexFeature: Feature = {
      id: `${newBackground.id}_flexible_asi`,
      name: 'Ability Score Increase',
      description: newBackground.flexibleAsi.prompt,
      source: { kind: 'background', refId: newBackground.id },
      level: null, actions: [], choices: [], passive: true,
      effects: flexAsiPicks.map((ab, idx) => {
        const rawAmount = flexAsiAmountFor(newBackground.flexibleAsi!.mode, flexAsiPicks, idx);
        const headroom  = Math.max(0, maxScore - effectiveBefore[ab]);
        return {
          type: 'stat_modifier' as const, target: ab, operation: 'add' as const,
          value: Math.min(rawAmount, headroom), condition: null,
        };
      }),
    };
    updated = applyGrant(updated, { kind: 'feature', value: { ...flexFeature, isActive: true } }, 0);
  }

  // Generalized skill-training pass, same as background.tsx's own creation-
  // time logic — walks the NEW background's own features for
  // grant_proficiency skill effects and marks them trained. Works for
  // homebrew backgrounds with no BG_DETAIL-equivalent table (this primitive
  // has no such table dependency at all, unlike background.tsx's creation
  // screen, which also has a hardcoded-table fast path this port omits as
  // redundant — the generalized pass alone already covers every background,
  // official or homebrew, per background.tsx's own comment on it).
  for (const feature of newBackground.features) {
    for (const effect of feature.effects) {
      if (effect.type === 'grant_proficiency' && effect.operation === 'add' && effect.target.startsWith('skill:')) {
        const key = effect.target.slice(6) as SkillName;
        if (updated.skills.skills[key]) {
          updated = {
            ...updated,
            skills: { skills: { ...updated.skills.skills, [key]: { ...updated.skills.skills[key], trained: true } } },
          };
        }
      }
    }
  }

  let recomputed = recomputeDerived(updated, rules);
  let finalSkills = recomputed.skills.skills;
  const forceUntrain = new Set<SkillName>([
    ...[...candidateUntrain].filter(skill => skillRetrainOverrides?.[skill] !== true),
    ...(Object.entries(skillRetrainOverrides ?? {}) as [SkillName, boolean][])
      .filter(([, keep]) => keep === false).map(([skill]) => skill),
  ]);
  for (const skill of forceUntrain) {
    if (finalSkills[skill]?.trained || finalSkills[skill]?.expertise) {
      finalSkills = { ...finalSkills, [skill]: { ...finalSkills[skill], trained: false, expertise: false } };
    }
  }
  if (finalSkills !== recomputed.skills.skills) recomputed = { ...recomputed, skills: { skills: finalSkills } };
  return recomputed;
}

// ── Origin feats (2024 backgrounds) ──────────────────────────────────────────
// must GRANT that feat, not merely mention it. Everything the feat brings (its feature, its limited-use
// pools, the picks it asks the player for) is granted with the BACKGROUND as its source, so the existing
// background-change paths — which already strip every background-sourced feature, unresolved choice and
// resource — take the feat back out too. No second removal mechanism.

/** The id of the generated feature that stands for the granted Origin feat on the sheet. The feat id is part
 *  of it so a later change of background can tell which feat to take back out. */
export const originFeatFeatureId = (bgId: string, featId: string) => `${bgId}_origin_${featId}`;

export function applyBackgroundOriginFeat(entity: Entity, bg: Pick<Background, 'id'>, feat: Feat | undefined): Entity {
  if (!feat) return entity;
  const feature: Feature = {
    ...feat.feature,
    id: originFeatFeatureId(bg.id, feat.id),
    name: `${feat.name} (Origin Feat)`,
    source: { kind: 'background', refId: bg.id },
    level: null,
  };
  const source = { kind: 'background' as const, id: bg.id };
  let updated = applyGrant(entity, { kind: 'feature', value: { ...feature, isActive: true } }, 0);
  for (const r of feat.resources ?? []) updated = applyGrant(updated, { kind: 'resource', value: r }, 0, undefined, source);
  for (const choice of feat.pendingChoices ?? []) {
    // The background prefix makes a still-unresolved pick get swept if the background changes again.
    updated = queueChoice(updated, { ...choice, id: `${BACKGROUND_CHOICE_PREFIX}origin_${feat.id}_${choice.id}` }, 0, undefined, source);
  }
  return updated;
}

/**
 * Takes back what an earlier background's Origin feat granted beyond its own feature: spells the feat's
 * picks gave (their entitlements are sourced to the feat id) — the background-sourced pools, features and
 * unresolved picks are already removed by the ordinary background-change path.
 */
export function revokeBackgroundOriginFeat(entity: Entity): Entity {
  let updated = entity;
  for (const f of entity.features) {
    const m = f.source.kind === 'background' ? /_origin_(.+)$/.exec(f.id) : null;
    if (m) updated = revokeResourceSource(updated, 'background', m[1]);
  }
  return updated;
}

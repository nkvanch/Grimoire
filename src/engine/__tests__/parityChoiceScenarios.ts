// Pending choices for the native-parity fixtures: characters built from the SRD packs by the app's own creation path, and the
// resolutions a player would make, recorded as plain operations both engines replay. The strategy is deterministic and only
// emits resolutions the engine accepted, so every recorded operation is legal on the state it was recorded against.
import type { CampaignRules, ChoiceState, Entity } from '../types';
import { DEFAULT_RULES } from '../defaults';
import { applySubclassToEntity } from '../leveling';
import { resolveChoice } from '../levelingResolveChoice';
import { applySpellChoiceToEntity } from '../levelingSpells';
import { applyExpertiseChoiceToEntity, applyToolChoiceToEntity, applyLanguageChoiceToEntity } from '../levelingProficiencyChoices';
import { applyPoolChoiceToEntity } from '../levelingPoolChoices';
import { applyAsiToEntity, applyFeatToEntity } from '../levelingAsiFeats';
import { applyStatModifiers, collectAllEffects } from '../pipeline';
import { createCharacter, spellCandidates } from '../../content/provider/createCharacter';
import type { ContentProvider } from '../../content/provider/contentProvider';
import type { Providers } from './parityLevelScenarios';
import { providerFor } from './parityLevelScenarios';
import { runLevelSteps } from './parityLevelScenarios';

export type ChoiceOp =
  | { op: 'resolve' | 'pool' | 'expertise' | 'tool' | 'language' | 'spell'; choiceId: string; selections: string[] }
  | { op: 'asi'; choiceId: string; increases: Record<string, number> }
  | { op: 'feat'; choiceId: string; featId: string; ability?: string; skills?: Record<string, string> }
  | { op: 'subclass'; choiceId: string; subclassId: string; classId?: string };

export type ChoiceCase = { name: string; entity: Entity; rules: { maxAbilityScore: number }; ops: ChoiceOp[]; skipped: string[] };

const STATS = { str: 15, dex: 14, con: 14, int: 12, wis: 13, cha: 8 };
const rulesOf = (maxAbilityScore: number): CampaignRules => ({ ...DEFAULT_RULES, maxAbilityScore });

/** One operation the way the sheet performs it (AsiFeatPicker for a feat, the pickers' own engine calls for the rest). */
export function runChoiceOp(entity: Entity, op: ChoiceOp, rules: CampaignRules, provider: ContentProvider): Entity {
  switch (op.op) {
    case 'resolve': return resolveChoice(entity, op.choiceId, op.selections, rules);
    case 'pool': return applyPoolChoiceToEntity(entity, op.choiceId, op.selections, rules);
    case 'asi': return applyAsiToEntity(entity, op.choiceId, op.increases, rules);
    case 'expertise': return applyExpertiseChoiceToEntity(entity, op.choiceId, op.selections, rules);
    case 'tool': return applyToolChoiceToEntity(entity, op.choiceId, op.selections, rules);
    case 'language': return applyLanguageChoiceToEntity(entity, op.choiceId, op.selections, rules);
    case 'spell': return applySpellChoiceToEntity(entity, op.choiceId, op.selections, id => provider.getSpell(id, entity.rulesetId)?.level, rules);
    case 'subclass': {
      const sub = provider.getSubclass(op.subclassId);
      if (!sub) throw new Error(`subclass ${op.subclassId} is not in the packs`);
      return applySubclassToEntity(entity, op.choiceId, op.subclassId, sub, rules, op.classId);
    }
    case 'feat': {
      const feat = provider.getFeat(op.featId);
      if (!feat) throw new Error(`feat ${op.featId} is not in the packs`);
      const choice = entity.choices.find(c => c.id === op.choiceId);
      if (!choice) throw new Error('choice not found');
      const maxScore = rules.maxAbilityScore ?? Infinity;
      const effective = applyStatModifiers(entity.stats, collectAllEffects(entity));
      let base = entity;
      if (feat.abilityChoice?.grantsSaveProficiency && op.ability && !base.proficiencies.savingThrows.includes(op.ability as never)) {
        base = { ...base, proficiencies: { ...base.proficiencies, savingThrows: [...base.proficiencies.savingThrows, op.ability as never] } };
      }
      const extra: NonNullable<typeof feat.feature.effects> = [];
      if (feat.abilityChoice && op.ability) {
        const headroom = Math.max(0, maxScore - effective[op.ability as keyof typeof effective]);
        const amount = Math.min(feat.abilityChoice.amount, headroom);
        if (amount > 0) extra.push({ type: 'stat_modifier', target: op.ability, operation: 'add', value: amount, condition: null } as never);
      }
      if (feat.skillChoice) {
        for (const pick of feat.skillChoice.picks) {
          const sk = op.skills?.[pick.id];
          if (!sk) continue;
          extra.push({ type: 'grant_proficiency', target: `skill:${sk}`, operation: pick.mode === 'expertise' ? 'multiply' : 'add', value: null, condition: null } as never);
        }
      }
      const feature = extra.length === 0 ? feat.feature : { ...feat.feature, effects: [...feat.feature.effects, ...extra] };
      return applyFeatToEntity(base, choice.id, choice.grantedAt, feature, feat.id, rules, feat.pendingChoices, feat.resources);
    }
  }
}

const optionValue = (o: { id: string; value?: unknown }): string => String(o.value ?? o.id);

/** Chooses, deterministically, for every pending choice it can; returns the operations in the order they were accepted. */
export function autoChoose(entity: Entity, provider: ContentProvider, rules: CampaignRules): { entity: Entity; ops: ChoiceOp[]; skipped: string[] } {
  const ops: ChoiceOp[] = [];
  const failed = new Set<string>();
  let e = entity;
  let asiCount = 0;
  for (let guard = 0; guard < 300; guard++) {
    const choice = e.choices.find(c => !c.resolved && !failed.has(c.id));
    if (!choice) break;
    const candidates = candidateOps(e, choice, provider, asiCount);
    let accepted = false;
    for (const op of candidates) {
      try {
        const next = runChoiceOp(e, op, rules, provider);
        // a resolution that did nothing is not a resolution
        const after = next.choices.find(c => c.id === choice.id);
        if (!after?.resolved) continue;
        e = next;
        ops.push(op);
        if (choice.definition.kind === 'asi') asiCount++;
        accepted = true;
        break;
      } catch { /* try the next candidate */ }
    }
    if (!accepted) failed.add(choice.id);
  }
  return { entity: e, ops, skipped: [...failed] };
}

function candidateOps(e: Entity, choice: ChoiceState, provider: ContentProvider, asiCount: number): ChoiceOp[] {
  const def = choice.definition;
  const pool = Array.isArray(def.pool) ? def.pool : null;
  const id = choice.id;
  switch (def.kind) {
    case 'skill':
    case 'equipment':
    case 'spellcasting_ability':
      return pool && pool.length >= def.count ? [{ op: 'resolve', choiceId: id, selections: pool.slice(0, def.count).map(o => o.id) }] : [];
    case 'feature_pool': {
      if (!pool) return [];
      const usable = pool.filter(o => !o.repeatable);
      const out: ChoiceOp[] = [];
      for (let start = 0; start + def.count <= usable.length && out.length < 6; start++) {
        out.push({ op: 'pool', choiceId: id, selections: usable.slice(start, start + def.count).map(o => o.id) });
      }
      return out;
    }
    case 'asi': {
      const slot = asiCount % 3;
      if (slot === 0) return [{ op: 'asi', choiceId: id, increases: { con: 2 } }];
      if (slot === 2) return [{ op: 'asi', choiceId: id, increases: { dex: 1, int: 1 } }];
      const taken = new Set(e.features.filter(f => f.source.kind === 'feat').map(f => f.source.refId));
      const feats = provider.feats().filter(f => !taken.has(f.id));
      const out: ChoiceOp[] = [];
      for (const f of feats.slice(0, 4)) {
        const ability = f.abilityChoice ? (f.abilityChoice.options?.[0] ?? 'str') : undefined;
        const skills: Record<string, string> = {};
        const skillNames = ['athletics', 'arcana', 'history', 'nature'];
        (f.skillChoice?.picks ?? []).forEach((p, i) => { skills[p.id] = skillNames[i % skillNames.length]; });
        out.push({ op: 'feat', choiceId: id, featId: f.id, ...(ability ? { ability } : {}), ...(f.skillChoice ? { skills } : {}) });
      }
      out.push({ op: 'asi', choiceId: id, increases: { str: 1, wis: 1 } });
      return out;
    }
    case 'subclass': {
      const owner = def.forClassId ?? e.identity.classId ?? '';
      const subs = provider.subclassesOf(owner);
      const multi = (e.identity.classes?.length ?? 0) > 1;
      return subs.slice(0, 1).map(s => ({ op: 'subclass' as const, choiceId: id, subclassId: s.id, ...(multi ? { classId: owner } : {}) }));
    }
    case 'spell': {
      const candidatesList = spellCandidates(provider, e, id).map(s => s.id).sort();
      return candidatesList.length >= def.count ? [{ op: 'spell', choiceId: id, selections: candidatesList.slice(0, def.count) }] : [];
    }
    case 'expertise': {
      const restrict = pool ? new Set(pool.map(optionValue)) : null;
      const eligible = Object.entries(e.skills.skills)
        .filter(([name, s]) => s.trained && !s.expertise && (!restrict || restrict.has(name)))
        .map(([name]) => name).sort();
      return [{ op: 'expertise', choiceId: id, selections: eligible.slice(0, Math.min(def.count, eligible.length)) }];
    }
    case 'tool': {
      const held = new Set(e.proficiencies.tools);
      const options = pool ? pool.map(optionValue) : ['smiths_tools', 'thieves_tools', 'tinkers_tools', 'navigators_tools', 'herbalism_kit'];
      const free = options.filter(t => !held.has(t));
      return [{ op: 'tool', choiceId: id, selections: free.slice(0, Math.min(def.count, free.length)) }];
    }
    case 'language': {
      const held = new Set(e.proficiencies.languages);
      const options = pool ? pool.map(optionValue) : ['dwarvish', 'elvish', 'giant', 'gnomish', 'goblin', 'halfling', 'orc'];
      const free = options.filter(l => !held.has(l));
      return [{ op: 'language', choiceId: id, selections: free.slice(0, Math.min(def.count, free.length)) }];
    }
    default:
      return [];
  }
}

export function buildChoiceCases(providers: Providers): ChoiceCase[] {
  const out: ChoiceCase[] = [];
  const build = (p: ContentProvider, classId: string, level: number) => createCharacter(p, {
    id: `c-${classId}-${level}`, name: `Test ${classId}`, classId, raceId: p.races()[0].id, backgroundId: p.backgrounds()[0].id, stats: STATS, level,
  }, DEFAULT_RULES);
  const add = (name: string, entity: Entity, provider: ContentProvider, maxAbilityScore = 20) => {
    const chosen = autoChoose(entity, provider, rulesOf(maxAbilityScore));
    out.push({ name, entity, rules: { maxAbilityScore }, ops: chosen.ops, skipped: chosen.skipped });
  };

  for (const [tag, p] of [['5e', providers.p2014], ['5e24', providers.p2024]] as const) {
    for (const cls of p.classes()) {
      add(`choices-${tag}-${cls.id}-L1`, build(p, cls.id, 1), p);
      add(`choices-${tag}-${cls.id}-L8`, build(p, cls.id, 8), p);
    }
  }

  // a multiclass character: the subclass pick names its class
  const p14 = providers.p2014;
  const wiz = build(p14, 'wizard', 3);
  const grown = runLevelSteps(wiz, [{ classId: 'fighter' }, { classId: 'fighter' }, { classId: 'fighter' }, { classId: 'wizard' }], { hpMode: 'fixed', customRules: {} }, providerFor(wiz, providers)).entity;
  add('choices-mc-wizard-fighter', grown, p14);
  // a score cap that leaves no headroom
  add('choices-low-cap-fighter-L8', build(p14, 'fighter', 8), p14, 15);
  return out;
}

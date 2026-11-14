// src/content/featurePoolChoice.ts
// maneuvers, Hunter's Prey) as a draft, and compiling it to the canonical ChoiceDefinition the engine already resolves
// (leveling.ts resolveFeaturePoolChoice / replacePoolOption).
//
// Kept apart from choiceDefinitionCompiler.ts on purpose: the phone's choice editor authors expertise/tool/language only and
// keeps every other choice untouched; this module is what the native builders (and the parity fixtures) use for pools.
//
// Each option is a DraftTrait compiled by the same buildTraitFeature every other builder uses, so a pool option can be
// anything a trait can be: a passive bonus, a limited-use ability that spends an existing pool, an at-will action, and so on.
// What a pool option cannot be is something that needs a resource of its own or a second feature: the engine grants an option
// as one feature, so a "limited use" counter or a spell grant would be silently lost. Those are refused in validation instead.
import type { ChoiceDefinition, ChoiceOption, ChoiceReplacePolicy, DraftTrait, Feature, Prerequisite } from '../engine/types';
import { buildTraitFeature } from './traitCompiler';

export type FeaturePoolOption = { trait: DraftTrait; minLevel: string };

export type FeaturePoolDraft = {
  localId: string;
  kind: 'feature_pool';
  /** Text, parsed and clamped only at compile time (like every other draft field). */
  count: string;
  /** Blank means the default prompt. */
  prompt: string;
  options: FeaturePoolOption[];
  /** '' = held options are permanent. */
  replaceTiming: '' | ChoiceReplacePolicy['timing'];
  /** Blank means the default wording for the timing. */
  replaceRule: string;
};

/** What owns the choice: the feature each option compiles to is attributed to it (and, for a class, the level gate counts its levels). */
export type FeaturePoolOwner = { sourceKind: Feature['source']['kind']; sourceRefId: string; classId?: string };

let counter = 0;
export function newFeaturePoolDraft(): FeaturePoolDraft {
  counter += 1;
  return {
    localId: `pool_${Date.now().toString(36)}_${counter.toString(36)}`,
    kind: 'feature_pool', count: '1', prompt: '', options: [], replaceTiming: '', replaceRule: '',
  };
}

export function defaultPoolPrompt(count: number): string {
  return `Choose ${count === 1 ? 'one' : String(count)} option${count === 1 ? '' : 's'}.`;
}

export function defaultReplaceRule(timing: ChoiceReplacePolicy['timing']): string {
  if (timing === 'level_up') return 'Whenever you gain a level.';
  if (timing === 'rest') return 'Whenever you finish a rest.';
  return 'Whenever you finish a long rest.';
}

export function validateFeaturePoolDraft(draft: FeaturePoolDraft): string[] {
  const errors: string[] = [];
  const count = parseInt(draft.count, 10);
  if (!Number.isFinite(count) || count < 1) errors.push('Count must be a whole number of at least 1.');
  if (draft.options.length === 0) errors.push('Add at least one option.');
  else if (Number.isFinite(count) && count > 0 && draft.options.length < count) {
    errors.push(`Count (${count}) exceeds the number of options (${draft.options.length}).`);
  }
  const seen = new Set<string>();
  draft.options.forEach((o, i) => {
    const name = o.trait.name.trim();
    if (!name) { errors.push(`Option ${i + 1} needs a name.`); return; }
    const key = name.toLowerCase();
    if (seen.has(key)) errors.push(`Two options are named ${name}.`);
    seen.add(key);
    if (o.trait.effectKind === 'resource_ability' || o.trait.effectKind === 'spell_grant') {
      errors.push(`${name}: a pool option cannot be a limited-use ability or grant spells of its own.`);
    } else if (o.trait.limitedUse && !(o.trait.spendsResourceId ?? '').trim()) {
      errors.push(`${name}: a pool option cannot keep its own use counter; spend from an existing pool or leave limited use off.`);
    }
    const min = o.minLevel.trim();
    if (min) {
      const n = /^\d{1,2}$/.test(min) ? parseInt(min, 10) : NaN;
      if (!Number.isFinite(n) || n < 1 || n > 20) errors.push(`${name}: the minimum level must be a whole number from 1 to 20.`);
    }
  });
  return errors;
}

/** idPrefix namespaces the choice id the way the other choice compilers do; `owner` is what the compiled features are attributed to. */
export function featurePoolDraftToDefinition(draft: FeaturePoolDraft, idPrefix: string, owner: FeaturePoolOwner): ChoiceDefinition {
  const count = Math.max(1, parseInt(draft.count, 10) || 1);
  const choiceId = `${idPrefix}${draft.localId}`;
  const usedIds = new Set<string>();
  const pool: ChoiceOption[] = draft.options.map(o => {
    const { feature } = buildTraitFeature(o.trait, { idPrefix: choiceId, sourceKind: owner.sourceKind, sourceRefId: owner.sourceRefId, level: null, usedIds });
    const min = parseInt(o.minLevel, 10);
    const requires: Prerequisite[] | undefined = Number.isFinite(min) && min > 1
      ? [{ kind: 'level', min, ...(owner.classId ? { classId: owner.classId } : {}) }]
      : undefined;
    return { id: feature.id, label: o.trait.name.trim(), value: feature, ...(requires ? { requires } : {}) };
  });
  const def: ChoiceDefinition = {
    id: choiceId,
    prompt: draft.prompt.trim() || defaultPoolPrompt(count),
    kind: 'feature_pool',
    count,
    pool,
    grants: [],
    required: true,
    resolved: false,
  };
  if (draft.replaceTiming) {
    def.replace = { timing: draft.replaceTiming, rule: draft.replaceRule.trim() || defaultReplaceRule(draft.replaceTiming) };
  }
  def.authoredOptions = draft.options.map(o => ({ trait: o.trait, minLevel: o.minLevel }));
  return def;
}

/** The draft a saved pool reopens as: only a pool this editor wrote (it carries `authoredOptions`); any other pool is kept as it was. */
export function definitionToFeaturePoolDraft(def: ChoiceDefinition, idPrefix: string): FeaturePoolDraft | null {
  if (def.kind !== 'feature_pool' || !Array.isArray(def.authoredOptions)) return null;
  return {
    localId: def.id.startsWith(idPrefix) ? def.id.slice(idPrefix.length) : def.id,
    kind: 'feature_pool',
    count: String(def.count),
    prompt: def.prompt,
    options: def.authoredOptions.map(o => ({ trait: o.trait, minLevel: o.minLevel ?? '' })),
    replaceTiming: def.replace?.timing ?? '',
    replaceRule: def.replace?.rule ?? '',
  };
}

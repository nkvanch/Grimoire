// ============================================================================
// FILE: src/content/classes/knownResources.ts
// The resources a homebrew feature can spend from or raise: the pools a class already grants (Ki, Rage, Wild Shape ...) and the
// pools other features in the same build create. Feeds the picker in the trait editor (see traitCompiler BuildTraitOpts for how a
// `local:` reference is resolved when the features are compiled).
// ============================================================================
import type { CharClass, DraftTrait, ResourceGrant } from '../../engine/types';
import { getProgressionForClass } from './progressions';

export type ResourceChoice = { id: string; label: string };

/** Every pool the class grants through its progression, once each, in the order the class gets them. */
export function classResourceChoices(cls: CharClass | null | undefined): ResourceChoice[] {
  if (!cls) return [];
  const found = new Map<string, string>();
  let progression;
  try { progression = getProgressionForClass(cls); } catch { return []; }
  for (const entry of progression.entries) {
    for (const grant of entry.grants ?? []) {
      if (grant.kind !== 'resource') continue;
      const r = grant.value as ResourceGrant;
      if (r.resourceId && !found.has(r.resourceId)) found.set(r.resourceId, r.name || r.resourceId);
    }
  }
  return [...found].map(([id, label]) => ({ id, label }));
}

/** Pools the other traits in this build create (their own limited-use pool), as `local:` references. */
export function localPoolChoices(traits: readonly Pick<DraftTrait, 'localId' | 'name' | 'effectKind' | 'limitedUse' | 'spendsResourceId'>[], exceptLocalId?: string): ResourceChoice[] {
  return traits
    .filter(t => t.localId !== exceptLocalId && t.name.trim()
      && (t.effectKind === 'resource_ability' || t.limitedUse) && !(t.spendsResourceId ?? '').trim())
    .map(t => ({ id: `local:${t.localId}`, label: `${t.name.trim()} (pool from this build)` }));
}

/** Pools made by features that are compiled BEFORE `open` (an earlier level, or earlier in the same level), as `local:` references. */
export function poolChoicesBefore<T extends Pick<DraftTrait, 'localId' | 'name' | 'effectKind' | 'limitedUse' | 'spendsResourceId'> & { level: number }>(
  features: readonly T[], open: { localId: string; level: number } | null,
): ResourceChoice[] {
  if (!open) return [];
  const at = features.findIndex(f => f.localId === open.localId);
  const earlier = features.filter((f, i) => f.localId !== open.localId && (f.level < open.level || (f.level === open.level && at >= 0 && i < at)));
  return localPoolChoices(earlier, open.localId);
}

// ============================================================================
// FILE: src/engine/suspension.ts
// Features that switch off for a short time. A suspension names the feature and the value of the creature's own turn counter
// (see damageLog.ts) at which it ends, so "until the end of your next turn" needs no clock. Expired entries are pruned when a
// turn starts. A suspended feature contributes no effects and its card is unavailable.
// ============================================================================
import type { Entity } from './types';

const turn = (e: Entity): number => e.turnCounter ?? 0;

/** Counter value at which the suspension ends: the end of this turn is the start of the next one, and so on. */
export function untilValue(e: Entity, until: 'end_of_this_turn' | 'end_of_next_turn'): number {
  return turn(e) + (until === 'end_of_this_turn' ? 1 : 2);
}

export function isFeatureSuspended(e: Entity, featureId: string): boolean {
  return (e.suspensions ?? []).some(s => s.featureId === featureId && s.until > turn(e));
}

/** Switches a feature off. A longer existing suspension is kept. */
export function suspendFeature(e: Entity, featureId: string, until: 'end_of_this_turn' | 'end_of_next_turn', reason?: string): Entity {
  const end = untilValue(e, until);
  const rest = (e.suspensions ?? []).filter(s => s.featureId !== featureId);
  const existing = (e.suspensions ?? []).find(s => s.featureId === featureId);
  const keep = existing && existing.until > end ? existing.until : end;
  return { ...e, suspensions: [...rest, { featureId, until: keep, ...(reason ? { reason } : {}) }] };
}

/** Switches a feature back on early. */
export function resumeFeature(e: Entity, featureId: string): Entity {
  if (!(e.suspensions ?? []).some(s => s.featureId === featureId)) return e;
  return { ...e, suspensions: (e.suspensions ?? []).filter(s => s.featureId !== featureId) };
}

/** Called when damage lands: switches off every feature that says this damage type does that. */
export function suspendForDamage(e: Entity, damageType: string | undefined): Entity {
  if (!damageType) return e;
  let out = e;
  for (const f of e.features) {
    if (f.suspendOn && f.suspendOn.damageType === damageType) {
      out = suspendFeature(out, f.id, f.suspendOn.until, `${damageType} damage`);
    }
  }
  return out;
}

/** Drops entries that have ended. */
export function pruneSuspensions(e: Entity): Entity {
  const live = (e.suspensions ?? []).filter(s => s.until > turn(e));
  if (live.length === (e.suspensions ?? []).length) return e;
  if (live.length === 0) { const { suspensions: _s, ...rest } = e; return rest as Entity; }
  return { ...e, suspensions: live };
}

// ============================================================================
// FILE: src/engine/trackedEffects.ts
// Per-target state: effects a character has put on other creatures. Bookkeeping, not simulation: the table says who the target is
// and when it ends, the app remembers which effects are on whom, can add up the damage a marked target takes, and shows an
// effect as "due" once its turn mark passes (it is never removed without a human ending it).
// ============================================================================
import type { Entity, TrackedEffect } from './types';

const turn = (e: Entity): number => e.turnCounter ?? 0;

export type TrackedEffectSpec = {
  name: string; targetName?: string; targetId?: string; featureId?: string;
  until?: 'end_of_this_turn' | 'end_of_next_turn';
  records?: boolean; visibility?: TrackedEffect['visibility']; note?: string;
  /** When recording closes, if that is earlier than `until` (the effect then stays on, holding its total, until it is due). */
  recordUntil?: 'end_of_this_turn' | 'end_of_next_turn';
};

export function addTrackedEffect(e: Entity, spec: TrackedEffectSpec): Entity {
  const list = e.trackedEffects ?? [];
  const n = list.reduce((m, x) => Math.max(m, Number(x.id.split('_').pop()) || 0), 0) + 1;
  const dueTurn = spec.until ? turn(e) + (spec.until === 'end_of_this_turn' ? 1 : 2) : undefined;
  const recordsUntilTurn = spec.records && spec.recordUntil ? turn(e) + (spec.recordUntil === 'end_of_this_turn' ? 1 : 2) : undefined;
  const effect: TrackedEffect = {
    id: `te_${n}`, name: spec.name, targetName: spec.targetName ?? '', visibility: spec.visibility ?? 'party',
    ...(spec.targetId ? { targetId: spec.targetId } : {}), ...(spec.featureId ? { featureId: spec.featureId } : {}),
    ...(dueTurn !== undefined ? { dueTurn } : {}), ...(spec.records ? { records: true, recordedDamage: 0 } : {}),
    ...(recordsUntilTurn !== undefined ? { recordsUntilTurn } : {}),
    ...(spec.note ? { note: spec.note } : {}),
  };
  return { ...e, trackedEffects: [...list, effect] };
}

export function endTrackedEffect(e: Entity, id: string): Entity {
  if (!(e.trackedEffects ?? []).some(x => x.id === id)) return e;
  return { ...e, trackedEffects: (e.trackedEffects ?? []).filter(x => x.id !== id) };
}

/** Names the target of an effect that was created without one. */
export function setTrackedTarget(e: Entity, id: string, targetName: string, targetId?: string): Entity {
  return { ...e, trackedEffects: (e.trackedEffects ?? []).map(x =>
    x.id === id ? { ...x, targetName, ...(targetId ? { targetId } : {}) } : x) };
}

/** Active until the owner's turn counter reaches its mark, then due (still on, waiting for a human to end it). */
export function trackedEffectStatus(e: Entity, x: TrackedEffect): 'active' | 'due' {
  return x.dueTurn !== undefined && turn(e) >= x.dueTurn ? 'due' : 'active';
}

/** True while damage is still being added: it records, and its recording window has not closed. */
export function isRecording(e: Entity, x: TrackedEffect): boolean {
  return !!x.records && !(x.recordsUntilTurn !== undefined && turn(e) >= x.recordsUntilTurn);
}

const sameTarget = (x: TrackedEffect, t: { id?: string; name?: string }): boolean =>
  (!!t.id && x.targetId === t.id) || (!!t.name && !!x.targetName && x.targetName.trim().toLowerCase() === t.name.trim().toLowerCase());

/** Adds damage a target took to every recording effect on it. */
export function recordDamageOnTarget(e: Entity, target: { id?: string; name?: string }, amount: number): Entity {
  if (!(amount > 0) || !(e.trackedEffects ?? []).some(x => isRecording(e, x) && sameTarget(x, target))) return e;
  return { ...e, trackedEffects: (e.trackedEffects ?? []).map(x =>
    isRecording(e, x) && sameTarget(x, target) ? { ...x, recordedDamage: (x.recordedDamage ?? 0) + amount } : x) };
}

/** Records one hit across a whole party or encounter, for the DM applying damage to a combatant. */
export function recordDamageAcross(entities: Entity[], target: { id?: string; name?: string }, amount: number): Entity[] {
  return entities.map(en => recordDamageOnTarget(en, target, amount));
}

/** What a rule like "half of the damage recorded" comes to. */
export function recordedFraction(x: TrackedEffect, fraction: number): number {
  return Math.floor((x.recordedDamage ?? 0) * fraction);
}

/** The effects on a named target (for a target's own card). */
export function effectsOnTarget(entities: Entity[], target: { id?: string; name?: string }): { owner: Entity; effect: TrackedEffect }[] {
  const out: { owner: Entity; effect: TrackedEffect }[] = [];
  for (const en of entities) for (const x of en.trackedEffects ?? []) if (sameTarget(x, target)) out.push({ owner: en, effect: x });
  return out;
}

// ============================================================================
// FILE: src/engine/damageLog.ts
// A short record of the damage a creature took, stamped with its own turn counter, so features that read
// "half the damage you have taken since the start of your previous turn" (Reformation) have something to read.
// The log is bounded and cleared by a long rest. It records what landed after resistance, including damage temporary
// HP soaked up, because that is what "damage you have taken" means at the table.
// ============================================================================
import type { Entity, DamageLogEntry } from './types';

const MAX_ENTRIES = 40;
/** Entries older than this many of the creature's own turns are dropped when a new one is written. */
const KEEP_TURNS = 8;

export const currentTurn = (e: Entity): number => e.turnCounter ?? 0;

/** Adds one entry. A non-positive amount writes nothing. */
export function logDamage(e: Entity, amount: number, type?: string, source?: string): Entity {
  if (!(amount > 0)) return e;
  const turn = currentTurn(e);
  const entry: DamageLogEntry = { turn, amount, ...(type ? { type } : {}), ...(source ? { source } : {}) };
  const kept = (e.damageLog ?? []).filter(x => x.turn >= turn - KEEP_TURNS);
  return { ...e, damageLog: [...kept, entry].slice(-MAX_ENTRIES) };
}

/**
 * Damage taken since the start of the creature's turn `turnsBack` turns ago.
 * 0 is this turn only, 1 is "since the start of your previous turn" (this turn and the one before), and so on.
 */
export function damageTakenSince(e: Entity, turnsBack: number, type?: string): number {
  const from = currentTurn(e) - Math.max(0, turnsBack);
  return (e.damageLog ?? [])
    .filter(x => x.turn >= from && (!type || x.type === type))
    .reduce((sum, x) => sum + x.amount, 0);
}

/** The start of this creature's next turn: advances the counter. */
export function advanceTurnCounter(e: Entity): Entity {
  return { ...e, turnCounter: currentTurn(e) + 1 };
}

/** A long rest forgets the log and the counter. */
export function clearDamageLog(e: Entity): Entity {
  if (!e.damageLog && !e.turnCounter) return e;
  const { damageLog: _d, turnCounter: _t, ...rest } = e;
  return rest as Entity;
}

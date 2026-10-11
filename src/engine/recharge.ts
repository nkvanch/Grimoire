// ============================================================================
// FILE: src/engine/recharge.ts
// How a resource comes back, as the engine can tell. A pool whose recharge the app has no event for ("after a turn without moving",
// "after an hour in a thunderstorm", "12 days", "weekly") is table-resolved: it is shown as reset by hand, with one Reset action,
// and no rest, dawn or turn quietly refills it. Calendar-dependent recharges stay reminders, not a clock (product rule 24).
// ============================================================================
import { parseRechargeThreshold } from './combat';
import { parseDawnRecharge } from './rest';

export type RechargeKind = 'short_rest' | 'long_rest' | 'dawn' | 'start_of_turn' | 'roll' | 'never' | 'by_hand';

export function rechargeKind(recharge: string): RechargeKind {
  const r = recharge.trim().toLowerCase();
  if (r === 'short_rest' || r === 'long_rest' || r === 'start_of_turn' || r === 'never') return r;
  if (parseDawnRecharge(r)) return 'dawn';
  if (parseRechargeThreshold(recharge) !== null) return 'roll';
  return 'by_hand';
}

/** True when nothing in the app refills this pool: the player or DM resets it when the table says its condition was met. */
export const isResetByHand = (recharge: string): boolean => rechargeKind(recharge) === 'by_hand';

/** The words to show next to the pool: the printed condition for a by-hand pool, so the table can see what to wait for. */
export function rechargeLabel(recharge: string): string {
  const r = recharge.trim();
  if (r === 'monthly') return 'monthly, reset by hand';
  if (r === 'yearly') return 'yearly, reset by hand';
  if (isResetByHand(r)) return `${r.replace(/_/g, ' ')}, reset by hand`;
  return r.replace(/_/g, ' ');
}

// ============================================================================
// FILE: src/engine/riders.ts
// Riders: bonus effects a feature attaches to the character's attacks and spells. The card shows which riders could ride it; using
// one spends its cost, clears the flag it consumed and records the use so a once-per-turn limit holds. The extra dice are shown
// for the player to roll (rolls are optional, never mandatory); what the rider does beyond damage is its note, table-resolved.
// ============================================================================
import type { ActionCard, Entity, Rider, RiderOffer } from './types';
import { isFeatureSuspended } from './suspension';

type Kind = 'weapon' | 'cantrip' | 'spell';

/** What kind of thing a card is, for matching riders. Null for cards riders do not ride (an ordinary ability). */
export function cardKind(card: ActionCard): Kind | null {
  if (card.isWeaponAttack || card.sourceKind === 'item') return 'weapon';
  if (card.tabs.includes('spellcasting')) return /^Cantrip/i.test(card.layer1) ? 'cantrip' : 'spell';
  return null;
}

const rides = (r: Rider, kind: Kind): boolean => {
  if (r.on === 'any_damage') return true;
  if (r.on === 'weapon_attack') return kind === 'weapon';
  if (r.on === 'cantrip') return kind === 'cantrip';
  if (r.on === 'spell') return kind === 'spell' || kind === 'cantrip';
  return kind === 'spell' || kind === 'cantrip';          // spell_attack
};

const turn = (e: Entity): number => e.turnCounter ?? 0;
const key = (featureId: string, riderId: string) => `${featureId}:${riderId}`;

function legality(e: Entity, featureId: string, r: Rider): { available: boolean; reason: string | null } {
  if (r.requires && e.conditionMonitor.flags[r.requires] !== true) return { available: false, reason: 'Not active right now.' };
  if (r.limit === 'once_per_turn' && e.riderUse?.[key(featureId, r.id)] === turn(e)) return { available: false, reason: 'Already used this turn.' };
  if (r.cost) {
    const pool = e.resources.custom.find(p => p.id === r.cost!.resourceId);
    if (!pool || pool.current < r.cost.quantity) return { available: false, reason: 'No uses left.' };
  }
  return { available: true, reason: null };
}

/** The riders that could ride this card, with whether each can be used right now. */
export function ridersForCard(e: Entity, card: ActionCard): RiderOffer[] {
  const kind = cardKind(card);
  if (!kind) return [];
  const out: RiderOffer[] = [];
  for (const f of e.features) {
    if (!f.isActive || !f.riders?.length || isFeatureSuspended(e, f.id)) continue;
    for (const r of f.riders) {
      if (!rides(r, kind)) continue;
      out.push({ riderId: r.id, featureId: f.id, name: r.name, damage: r.damage, note: r.note, cost: r.cost, ...legality(e, f.id, r) });
    }
  }
  return out;
}

/** Uses a rider: spends its cost, clears the flag it consumed and records the use. Unavailable riders change nothing. */
export function applyRider(e: Entity, featureId: string, riderId: string): Entity {
  const f = e.features.find(x => x.id === featureId);
  const r = f?.riders?.find(x => x.id === riderId);
  if (!f || !r || !legality(e, featureId, r).available) return e;
  let out: Entity = { ...e, riderUse: { ...(e.riderUse ?? {}), [key(featureId, riderId)]: turn(e) } };
  if (r.cost) {
    out = { ...out, resources: { ...out.resources, custom: out.resources.custom.map(p =>
      p.id === r.cost!.resourceId ? { ...p, current: Math.max(0, p.current - r.cost!.quantity) } : p) } };
  }
  if (r.clears) {
    out = { ...out, conditionMonitor: { ...out.conditionMonitor, flags: { ...out.conditionMonitor.flags, [r.clears]: false } } };
  }
  return out;
}

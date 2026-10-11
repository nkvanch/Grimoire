// ============================================================================
// FILE: src/engine/auras.ts
// Auras that benefit allies. Range is not modelled: the table decides who is inside an aura, a player marks "I am within the aura of
// X" on their own sheet, and the app applies the aura's mechanical effect while it is marked. The effect is copied onto the receiving
// sheet with the source's numbers already worked out (an aura that adds the Paladin's Charisma modifier carries that number), and is
// refreshed from the source whenever the party's sheets are available.
// ============================================================================
import type { Effect, Entity, Feature, ReceivedAura } from './types';
import { modifier, effectiveAbilityScores } from './pipeline';
import { isFeatureSuspended } from './suspension';

export type AuraOffer = {
  sourceEntityId: string;
  sourceName:     string;
  featureId:      string;
  label:          string;
  range?:         string;
  affects:        'allies' | 'allies_and_self' | 'enemies';
  /** What the receiver gets, with the source's numbers resolved. */
  effects:        Effect[];
};

/** A copy of the aura's effects with the source's ability modifier and proficiency bonus folded into the numbers. */
export function resolveAuraEffects(source: Entity, feature: Feature): Effect[] {
  const scores = effectiveAbilityScores(source);
  return (feature.aura?.effects ?? []).map(eff => {
    const flat = typeof eff.value === 'number' ? eff.value : 0;
    const abilityBonus = eff.addAbilityModifier ? Math.max(eff.addAbilityModifier ? modifier(scores[eff.addAbilityModifier]) : 0, 0) : 0;
    const pb = eff.addProficiencyBonus ? source.derived.proficiencyBonus : 0;
    if (!eff.addAbilityModifier && !eff.addProficiencyBonus) return { ...eff };
    const { addAbilityModifier: _a, addProficiencyBonus: _p, ...rest } = eff;
    return { ...rest, value: flat + abilityBonus + pb };
  });
}

/** The auras party members offer, for the sheet to list. Your own aura is only listed for you when it says it includes you. */
export function aurasOffered(me: Entity, party: Entity[]): AuraOffer[] {
  const out: AuraOffer[] = [];
  for (const other of party) {
    for (const f of other.features) {
      if (!f.isActive || !f.aura || isFeatureSuspended(other, f.id)) continue;
      const own = other.id === me.id;
      if (own && f.aura.affects !== 'allies_and_self') continue;
      if (!own && f.aura.affects === 'enemies') continue;
      out.push({
        sourceEntityId: other.id, sourceName: other.identity.name, featureId: f.id, label: f.aura.label ?? f.name,
        range: f.aura.range, affects: f.aura.affects, effects: resolveAuraEffects(other, f),
      });
    }
  }
  return out;
}

const same = (a: ReceivedAura, sourceEntityId: string, featureId: string) => a.sourceEntityId === sourceEntityId && a.featureId === featureId;

/** Marks the character as inside (or no longer inside) an aura. */
export function setInAura(me: Entity, offer: AuraOffer, inside: boolean): Entity {
  const rest = (me.receivedAuras ?? []).filter(a => !same(a, offer.sourceEntityId, offer.featureId));
  const next: ReceivedAura[] = inside
    ? [...rest, { sourceEntityId: offer.sourceEntityId, sourceName: offer.sourceName, featureId: offer.featureId, label: offer.label, effects: offer.effects }]
    : rest;
  return { ...me, receivedAuras: next };
}

export const isInAura = (me: Entity, sourceEntityId: string, featureId: string): boolean =>
  (me.receivedAuras ?? []).some(a => same(a, sourceEntityId, featureId));

/** Re-reads the marked auras from the party's current sheets, so a changed source number carries over. An aura whose source is gone is dropped. */
export function refreshReceivedAuras(me: Entity, party: Entity[]): Entity {
  if (!(me.receivedAuras ?? []).length) return me;
  const offers = aurasOffered(me, party);
  const kept: ReceivedAura[] = [];
  for (const a of me.receivedAuras ?? []) {
    const fresh = offers.find(o => o.sourceEntityId === a.sourceEntityId && o.featureId === a.featureId);
    if (fresh) kept.push({ ...a, label: fresh.label, sourceName: fresh.sourceName, effects: fresh.effects });
  }
  return { ...me, receivedAuras: kept };
}


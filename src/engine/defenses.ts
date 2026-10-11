// ============================================================================
// FILE: src/engine/defenses.ts
// What a creature is currently resistant, immune or vulnerable to, for the DM's party card and a damage preview. Read from the same
// active effects the damage rules use, so it can never disagree with what applyDamage does (flagged effects such as a Rage
// resistance only appear while their flag is on, and a Wild Shape form's defenses appear while it is active).
// ============================================================================
import type { Entity } from './types';
import { collectAllEffects } from './pipeline';

export type DefenseSummary = {
  resistances:        string[];
  immunities:         string[];
  vulnerabilities:    string[];
  conditionImmunities: string[];
  /** Flat reduction per hit by damage type ("reduces slashing damage by 2"). */
  flatReductions:     { type: string; amount: number }[];
  critsNegated:       boolean;
};

const uniq = (xs: string[]) => [...new Set(xs)].sort();

export function defenseSummary(e: Entity): DefenseSummary {
  const effects = collectAllEffects(e).map(a => a.effect);
  const dmg = (op: string, type: string) => effects.filter(x => x.operation === op && x.type === type).map(x => x.target);
  const reductions = effects
    .filter(x => x.target.startsWith('damage_reduction:') && x.operation === 'add' && typeof x.value === 'number')
    .map(x => ({ type: x.target.slice('damage_reduction:'.length), amount: x.value as number }));
  const immunities = uniq(dmg('immunity', 'grant_immunity').filter(t => t !== 'critical_hits_against' && t !== 'sleep_magic'));
  return {
    resistances:         uniq(dmg('resistance', 'grant_resistance')).filter(t => !immunities.includes(t)),
    immunities,
    vulnerabilities:     uniq(dmg('vulnerability', 'grant_resistance')),
    conditionImmunities: uniq(effects.filter(x => x.type === 'condition_immunity').map(x => x.target)),
    flatReductions:      reductions,
    critsNegated:        e.derived.critsNegated === true,
  };
}

/** What a hit of this type does to a creature with these defenses, in plain terms, for a preview line. */
export function outcomeFor(d: Pick<DefenseSummary, 'resistances' | 'immunities' | 'vulnerabilities' | 'flatReductions'>, amount: number, damageType?: string): { dealt: number; note: string | null } {
  if (amount <= 0) return { dealt: 0, note: null };
  const t = damageType?.trim().toLowerCase();
  if (!t) return { dealt: amount, note: null };
  if (d.immunities.includes(t)) return { dealt: 0, note: `Immune to ${t}` };
  let dealt = amount;
  let note: string | null = null;
  if (d.resistances.includes(t)) { dealt = Math.floor(amount / 2); note = `Resistant to ${t} (halved)`; }
  else if (d.vulnerabilities.includes(t)) { dealt = amount * 2; note = `Vulnerable to ${t} (doubled)`; }
  const flat = d.flatReductions.filter(r => r.type === t).reduce((s, r) => s + r.amount, 0);
  if (flat > 0) { dealt = Math.max(0, dealt - flat); note = `${note ? `${note}, ` : ''}${flat} less per hit`; }
  return { dealt, note };
}

export const damageOutcome = (e: Entity, amount: number, damageType?: string) => outcomeFor(defenseSummary(e), amount, damageType);

/** The plain values a preview needs, so it works from an entity or from what a player's device reported. */
export type DamageTarget = {
  hp:        { current: number; maximum: number; temp: number };
  deathSaves: { successes: number; failures: number; stable: boolean };
  defenses:  Pick<DefenseSummary, 'resistances' | 'immunities' | 'vulnerabilities' | 'flatReductions'>;
  wildShape?: { beastHp: number; beastHpMax: number } | null;
};

export type DamagePreview = {
  dealt: number; note: string | null; hpAfter: number; tempAfter: number; state: 'ok' | 'down' | 'dead_risk' | 'dead'; line: string;
};

/** HP the creature would be left with, with the death-state words the DM needs, before the damage is applied. */
export const damagePreview = (e: Entity, amount: number, damageType?: string): DamagePreview => previewFor({
  hp: e.resources.hp, deathSaves: e.resources.deathSaves, defenses: defenseSummary(e),
  wildShape: e.wildShapeState?.active ? { beastHp: e.wildShapeState.beastHp, beastHpMax: e.wildShapeState.beastHpMax } : null,
}, amount, damageType);

export function previewFor(target: DamageTarget, amount: number, damageType?: string): DamagePreview {
  const { dealt, note } = outcomeFor(target.defenses, amount, damageType);
  const { hp, deathSaves } = target;
  // A Wild Shape form takes the damage first: it is the pool at risk, and what is left over carries to the real body.
  const ws = target.wildShape ?? null;
  if (ws) {
    const soakWs = Math.min(hp.temp, dealt);
    const throughWs = dealt - soakWs;
    const label = [`${dealt} damage`, note].filter(Boolean).join(' (') + (note ? ')' : '');
    if (throughWs >= ws.beastHp) {
      const carry = throughWs - ws.beastHp;
      return {
        dealt, note, hpAfter: Math.max(0, hp.current - carry), tempAfter: hp.temp - soakWs, state: carry >= hp.current ? 'down' : 'ok',
        line: `${label}: the form drops${carry > 0 ? `, ${carry} carries over to the character` : ''}`,
      };
    }
    return { dealt, note, hpAfter: hp.current, tempAfter: hp.temp - soakWs, state: 'ok', line: `${label}: the form is left at ${ws.beastHp - throughWs}/${ws.beastHpMax} HP` };
  }
  const soak = Math.min(hp.temp, dealt);
  const through = dealt - soak;
  const hpAfter = Math.max(0, hp.current - through);
  const tempAfter = hp.temp - soak;
  // Instant death: the damage that gets through leaves the creature at 0 with at least its maximum HP left over.
  const overflow = through - hp.current;
  const instantDeath = hp.current > 0 && overflow >= hp.maximum;
  const alreadyDown = hp.current === 0;
  const failuresAfter = alreadyDown && through > 0 ? deathSaves.failures + 1 : deathSaves.failures;
  const state: 'ok' | 'down' | 'dead_risk' | 'dead' =
    instantDeath || failuresAfter >= 3 ? 'dead' : hpAfter === 0 ? (alreadyDown ? 'dead_risk' : 'down') : 'ok';
  const parts = [`${dealt} damage`, note ?? ''].filter(Boolean).join(' (') + (note ? ')' : '');
  const result =
    state === 'dead' ? (instantDeath ? 'dies outright' : 'dies (third death save failure)')
    : state === 'down' ? 'drops to 0 HP'
    : state === 'dead_risk' ? `takes a death save failure (${failuresAfter}/3)`
    : `${hpAfter}/${hp.maximum} HP${tempAfter > 0 ? `, ${tempAfter} temp` : ''}`;
  return { dealt, note, hpAfter, tempAfter, state, line: `${parts}: ${result}` };
}

// ============================================================================
// FILE: src/session/liveAwareness.ts
// The DM's awareness helpers over what players' devices report (CharacterVitals): a preview of what a hit would do before the
// request is sent, and a hidden check against passive scores that never has to be asked for out loud.
// ============================================================================
import type { CharacterSummary, CharacterVitals, ReportedCharacter } from './types';
import { previewFor, DamagePreview } from '../engine/defenses';

/** What this much damage of this type would do to the character, from the summary and vitals it reported. */
export function vitalsPreview(summary: CharacterSummary, vitals: CharacterVitals | undefined, amount: number, damageType?: string): DamagePreview {
  const d = vitals?.defenses;
  return previewFor({
    hp: { current: summary.hp, maximum: summary.maxHp, temp: vitals?.tempHp ?? 0 },
    deathSaves: vitals?.deathSaves ?? { successes: 0, failures: 0, stable: false },
    defenses: {
      resistances: d?.resistances ?? [], immunities: d?.immunities ?? [], vulnerabilities: d?.vulnerabilities ?? [], flatReductions: [],
    },
  }, amount, damageType);
}

export type PassiveKind = 'perception' | 'investigation' | 'insight';

export type HiddenCheckRow = { participantId: string; name: string; passive: number | null; meets: boolean | null; margin: number | null };

/** Each reported character's passive score against a value. A character whose device has not reported passives is listed as unknown. */
export function hiddenCheckFromVitals(characters: ReportedCharacter[], kind: PassiveKind, value: number): HiddenCheckRow[] {
  return characters
    .filter(c => c.summary.hp > 0 || (c.vitals?.deathSaves.failures ?? 0) < 3)
    .map(c => {
      const p = c.vitals?.passives?.[kind];
      return {
        participantId: c.participantId, name: c.summary.name,
        passive: p ?? null, meets: p === undefined ? null : p >= value, margin: p === undefined ? null : p - value,
      };
    })
    .sort((a, b) => (b.passive ?? -1) - (a.passive ?? -1) || a.name.localeCompare(b.name));
}

export function hiddenCheckLine(rows: HiddenCheckRow[], kind: PassiveKind, value: number): string {
  if (rows.length === 0) return 'No characters reported yet.';
  const label = kind[0].toUpperCase() + kind.slice(1);
  const known = rows.filter(r => r.meets !== null);
  const who = known.filter(r => r.meets).map(r => r.name);
  const unknown = rows.length - known.length;
  const tail = unknown > 0 ? ` (${unknown} not reporting passives)` : '';
  if (known.length === 0) return `No passive scores reported yet.`;
  if (who.length === 0) return `Nobody's passive ${label} reaches ${value}.${tail}`;
  if (who.length === known.length) return `Everyone's passive ${label} reaches ${value}.${tail}`;
  return `Passive ${label} ${value} or more: ${who.join(', ')}.${tail}`;
}

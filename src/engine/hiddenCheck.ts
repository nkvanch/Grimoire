// ============================================================================
// FILE: src/engine/hiddenCheck.ts
// A hidden check against the party's passive scores: "does anyone notice a creature hiding with a Stealth total of 17?",
// "does the party's passive Investigation beat the trap's DC 15?". The DM gets the answer without asking the players for
// their passive scores, which is the point of it: it never tips the table off.
// ============================================================================
import type { Entity } from './types';

export type PassiveKind = 'perception' | 'investigation' | 'insight';

export type HiddenCheckRow = {
  entityId: string;
  name:     string;
  passive:  number;
  /** Meets or beats the value (so notices a hidden creature, or passes a DC). */
  meets:    boolean;
  /** How far over (+) or under (-) the value they are. */
  margin:   number;
};

export function passiveOf(e: Entity, kind: PassiveKind): number {
  const d = e.derived;
  return kind === 'investigation' ? d.passiveInvestigation : kind === 'insight' ? d.passiveInsight : d.passivePerception;
}

/** Each party member's passive score against the value, highest passive first. Characters only, and not the dead. */
export function hiddenCheck(party: Entity[], kind: PassiveKind, value: number): HiddenCheckRow[] {
  return party
    .filter(e => e.kind === 'character' && e.resources.deathSaves.failures < 3)
    .map(e => {
      const passive = passiveOf(e, kind);
      return { entityId: e.id, name: e.identity.name || 'Unnamed', passive, meets: passive >= value, margin: passive - value };
    })
    .sort((a, b) => b.passive - a.passive || a.name.localeCompare(b.name));
}

/** One line for the DM: who would notice, or that nobody does. */
export function hiddenCheckSummary(rows: HiddenCheckRow[], kind: PassiveKind, value: number): string {
  if (rows.length === 0) return 'No party members to check.';
  const who = rows.filter(r => r.meets).map(r => r.name);
  const label = kind === 'perception' ? 'Perception' : kind === 'investigation' ? 'Investigation' : 'Insight';
  if (who.length === 0) return `Nobody's passive ${label} reaches ${value}.`;
  if (who.length === rows.length) return `Everyone's passive ${label} reaches ${value}.`;
  return `Passive ${label} ${value} or more: ${who.join(', ')}.`;
}

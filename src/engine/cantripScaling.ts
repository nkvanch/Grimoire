// ============================================================================
// FILE: src/engine/cantripScaling.ts
// A cantrip's damage (or beam count) grows with the CHARACTER level, not the class level and not a slot: Fire Bolt is 1d10, 2d10
// at 5th, 3d10 at 11th, 4d10 at 17th. A spell record can say so explicitly in `cantripScaling`; the SRD records predate that
// field and print the ladder as one standard sentence, so the same tiers are derived from that sentence by one function, here.
// Pure: it reads a spell and a level.
// ============================================================================
import type { Spell, CantripScalingTier } from './types';

const WORD_COUNT: Record<string, number> = { two: 2, three: 3, four: 4, five: 5 };

/**
 * The tiers a spell's own text prints: "... increases by 1d10 at 5th level (2d10), 11th level (3d10), and 17th level (4d10)"
 * (2014) or "... when you reach levels 5 (2d10), 11 (3d10), and 17 (4d10)" (2024), and the beam ladder "two beams at 5th level,
 * three beams at 11th level, and four beams at 17th level". Empty when the text prints neither.
 */
export function deriveCantripScaling(spell: Pick<Spell, 'level' | 'description'>): CantripScalingTier[] {
  if (spell.level !== 0) return [];
  const text = spell.description.replace(/\s+/g, ' ');
  // Any levels and any amounts the sentence prints, a modifier on the dice included: "3rd level (1d12+2), 9th level (2d12+4)".
  const sentence = text.split(/(?<=\.) /).find(s => /\b(increases?|more than one beam|additional beam|beams)\b/i.test(s) && /\d+(?:st|nd|rd|th)?(?: level)?\s*\(\d+d\d+(?:[+-]\d+)?\)|beams? at \d+/i.test(s));
  if (!sentence) return [];
  const tiers: CantripScalingTier[] = [];
  for (const m of sentence.matchAll(/(\d{1,2})(?:st|nd|rd|th)?(?: level)?\s*\((\d+d\d+(?:[+-]\d+)?)\)/g)) tiers.push({ level: Number(m[1]), dice: m[2] });
  if (tiers.length) return tiers.sort((a, b) => a.level - b.level);
  for (const m of sentence.matchAll(/\b(two|three|four|five)\s+beams? at (\d{1,2})(?:st|nd|rd|th)? level/gi)) {
    tiers.push({ level: Number(m[2]), count: WORD_COUNT[m[1].toLowerCase()] });
  }
  return tiers.sort((a, b) => a.level - b.level);
}

/** The tier in force at a character level: the highest tier at or below it, or null while the base spell applies. */
export function cantripTierAt(spell: Spell, characterLevel: number): CantripScalingTier | null {
  if (spell.level !== 0) return null;
  const tiers = spell.cantripScaling && spell.cantripScaling.length > 0 ? spell.cantripScaling : deriveCantripScaling(spell);
  // Upgrades accumulate: the dice come from the latest tier at or below the level that set dice, the count from the latest that set a
  // count, so a beams-only upgrade at 9th level does not undo the dice upgrade at 3rd.
  const reached = tiers.filter(t => t.level <= characterLevel).sort((a, b) => a.level - b.level);
  if (reached.length === 0) return null;
  let dice: string | undefined;
  let count: number | undefined;
  for (const t of reached) { if (t.dice) dice = t.dice; if (t.count) count = t.count; }
  return { level: reached[reached.length - 1].level, ...(dice ? { dice } : {}), ...(count ? { count } : {}) };
}

/** One row of the spell builder's list of upgrades, as typed: a character level, the dice from that level, and/or a count (beams). */
export type CantripTierDraft = { level: string; dice: string; count: string };

/**
 * The tiers a spell builder's rows describe. Any character level from 1 to 20 counts, and any dice ("2d10", "3d6+2") or beam count;
 * a row with neither is no tier, and a later row for the same level replaces an earlier one. Sorted by level.
 */
export function tiersFromDraft(rows: CantripTierDraft[]): CantripScalingTier[] {
  const byLevel = new Map<number, CantripScalingTier>();
  for (const r of rows) {
    const level = parseInt(r.level, 10);
    if (!Number.isFinite(level) || level < 1 || level > 20) continue;
    const dice = r.dice.trim().toLowerCase().split(' ').join('');
    const count = parseInt(r.count, 10);
    const okDice = /^[0-9]+d[0-9]+([+-][0-9]+)?$/.test(dice);
    const okCount = Number.isFinite(count) && count >= 1;
    if (!okDice && !okCount) continue;
    byLevel.set(level, { level, ...(okDice ? { dice } : {}), ...(okCount ? { count } : {}) });
  }
  return Array.from(byLevel.values()).sort((a, b) => a.level - b.level);
}

/** The builder's rows for a saved spell. */
export function draftFromTiers(tiers: CantripScalingTier[] | undefined): CantripTierDraft[] {
  return (tiers ?? []).map(t => ({ level: String(t.level), dice: t.dice ?? '', count: t.count ? String(t.count) : '' }));
}

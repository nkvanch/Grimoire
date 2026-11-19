// ── 12. Dice roller ──────────────────────────────────────────────────────────

/**
 * A single resolved dice roll.
 * Supports standard notation: "2d6+3", "1d20", "4d6kh3" (keep highest 3).
 */
export type DiceRoll = {
  id:         string;
  expression: string;    // original expression e.g. "2d6+3"
  rolls:      number[];  // individual die results before modifier
  modifier:   number;    // flat modifier
  total:      number;    // sum of rolls + modifier
  label:      string | null;   // "Attack roll", "Damage", "Ability score" etc.
  timestamp:  number;
};

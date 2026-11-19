// ── Helpers ──────────────────────────────────────────────────────────────────

/** Standard 5e ability score → modifier formula. */
export const modifier = (score: number): number => Math.floor((score - 10) / 2);

/** Standard 5e proficiency bonus formula. Shared with audit.ts so the two can't drift. */
export const proficiencyBonus = (level: number): number => Math.ceil(1 + level / 4);

/** The "8" every 5e save DC starts from (spell save, ki save, ability-based DC). */
export const AC_DC_BASE = 8;

/** Standard 5e DC formula: 8 + proficiency + ability modifier. */
export const abilityDC = (prof: number, mod: number): number => AC_DC_BASE + prof + mod;

import { LeveledLosslessDraftChoice } from '../../../engine/homebrewNestedSerializers';
import { Ability, DraftTrait } from '../../../engine/types';
import { newDraftTrait } from '../TraitEditor';

// ── Constants ─────────────────────────────────────────────────────────────────

export const HIT_DICE = [4, 6, 8, 10, 12] as const;

export const ABILITIES: Ability[] = ['str', 'dex', 'con', 'int', 'wis', 'cha'];
export const ABILITY_LABELS: Record<Ability, string> = {
  str: 'STR', dex: 'DEX', con: 'CON', int: 'INT', wis: 'WIS', cha: 'CHA',
};

export const ARMOR_PROFS = ['light', 'medium', 'heavy', 'shield'] as const;
export const WEAPON_PROFS = ['simple', 'martial'] as const;

export const SPELL_ABILITIES: Ability[] = ['str', 'dex', 'con', 'int', 'wis', 'cha'];
export const SPELL_STYLES = [
  { key: 'full', label: 'Full Caster', sub: 'Wizard/Cleric slots' },
  { key: 'half', label: 'Half Caster', sub: 'Paladin/Ranger slots' },
  { key: 'pact', label: 'Pact Magic',  sub: 'Warlock-style slots' },
] as const;
/**
 * Rules-engine blocker closure (2C — homebrew class preparation policy):
 * production spell-card generation now reads CharClass.spellPreparationPolicy
 * for real legality/DC — see actionCards.ts's isSpellPreparationLegal/
 * resolveSpellCastingContexts — so a homebrew caster needs a way to author
 * it. Slot Table (SPELL_STYLES above) can't stand in for this: it's a
 * completely separate axis (Sorcerer and Wizard are both 'full' Slot Table
 * but opposite preparation policies), so this is a genuinely new field, not
 * a relabeled existing one.
 */
export const SPELL_PREP_POLICIES = [
  { key: 'known', label: 'Known Spells', sub: "Fixed list, always castable — Sorcerer/Bard/Warlock-style" },
  { key: 'spellbook_prepared', label: 'Spellbook + Prepared', sub: 'Owns a spellbook, prepares a subset daily — Wizard-style' },
  { key: 'full_list_prepared', label: 'Full-List Prepared', sub: 'Prepares directly from the whole class list daily — Cleric/Druid-style' },
] as const;

export const DEFAULT_ASI_LEVELS = [4, 8, 12, 16, 19];

export function toId(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
}

export type LevelFeature = DraftTrait & { level: number };
export type LevelChoice = LeveledLosslessDraftChoice;

/**
 * Classes saved before class features gained real effect kinds have
 * levelFeatures entries shaped as just {level, name, description} — fill in
 * DraftTrait's other fields (effectKind defaulting to 'none', a fresh
 * localId if missing) so editing an old homebrew class in the builder
 * doesn't hand the trait editor an incomplete object.
 */
export function normalizeLevelFeature(f: Partial<DraftTrait> & { level: number; name: string; description?: string }): LevelFeature {
  const base = newDraftTrait(f.name);
  return { ...base, ...f, localId: f.localId ?? base.localId, effectKind: f.effectKind ?? 'none' };
}

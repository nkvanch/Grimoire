// ============================================================================
// FILE: src/content/spellChoiceFilter.ts
// What a `kind: 'spell'` choice offers. Without a `spellFilter` it is the original rule: the character's own
// class list, cantrips for a cantrip choice, otherwise level 1 up to the highest level they can cast. With a
// SpellPickFilter the choice can draw on other classes' lists (Magical Secrets, Blessed Warrior, Pact of the
// Tome), name exact levels (Mystic Arcanum) and ignore the slot cap. Pure, so the picker and the tests share it.
// ============================================================================
import { ChoiceDefinition, SpellPickFilter, SpellList } from '../engine/types';
import { isSpellInClassPool, filterSpellsForClass, type SpellListSource } from './spellLists';

type PoolSpell = { id: string; level: number; school: string; ritual: boolean; classes?: string[] };

export const isCantripChoiceDef = (def: Pick<ChoiceDefinition, 'id'>): boolean => def.id.includes('cantrip');

/** True when the choice carries its own pool rules, so it is resolved on its own and never folded into the class's cantrip/spell groups. */
export const hasOwnSpellPool = (def: Pick<ChoiceDefinition, 'spellFilter'>): boolean => !!def.spellFilter;

export function spellMatchesChoice(
  spell: PoolSpell,
  def: Pick<ChoiceDefinition, 'id' | 'spellFilter'>,
  ctx: { ownClassId: string | null | undefined; maxCastableLevel: number; extraSpellIds?: readonly string[] },
): boolean {
  const f: SpellPickFilter | undefined = def.spellFilter;
  const cantrip = isCantripChoiceDef(def);

  if (f?.levels) {
    if (!f.levels.includes(spell.level)) return false;
  } else if (cantrip) {
    if (spell.level !== 0) return false;
  } else {
    if (spell.level === 0) { if (!f?.includeCantrips) return false; }
    else if (!f?.ignoreSlotCap && spell.level > ctx.maxCastableLevel) return false;
  }

  if (f?.schools && !f.schools.includes(spell.school)) return false;
  if (f?.ritualOnly && !spell.ritual) return false;

  if (!f?.lists) return isSpellInClassPool(spell, ctx.ownClassId ?? '') || !!ctx.extraSpellIds?.includes(spell.id);
  if (f.lists === 'any') return true;
  // An explicit list means explicit membership: an untagged spell is not on every class's list here.
  return f.lists.some(id => (spell.classes ?? []).includes(id));
}

export function candidateSpellsForChoice<T extends PoolSpell>(
  all: readonly T[],
  def: Pick<ChoiceDefinition, 'id' | 'spellFilter'>,
  ctx: { ownClassId: string | null | undefined; maxCastableLevel: number; extraSpellIds?: readonly string[] },
): T[] {
  return all.filter(s => spellMatchesChoice(s, def, ctx));
}

/**
 * The spells a spell-choice picker offers: a choice with its own pool rules offers what its filter names; any other draws on the
 * class's list (or the spell list the player opted into, or the class's chosen source), plus the spells effects add to it, at the
 * levels the choice and the character's slots allow, minus what the character already has. SpellChoicePicker shows exactly this.
 */
export function spellPickerPool<T extends PoolSpell>(a: {
  allSpells: readonly T[];
  def: Pick<ChoiceDefinition, 'id' | 'spellFilter'>;
  classId: string;
  maxCastableLevel: number;
  known: ReadonlySet<string>;
  activeSpellListId: string | null | undefined;
  spellLists: SpellList[];
  classSource?: SpellListSource | null;
  extraSpellIds: readonly string[];
}): T[] {
  const { allSpells, def, classId, maxCastableLevel, known, extraSpellIds } = a;
  if (hasOwnSpellPool(def)) {
    return candidateSpellsForChoice(allSpells, def, { ownClassId: classId, maxCastableLevel, extraSpellIds }).filter(s => !known.has(s.id));
  }
  const base = filterSpellsForClass([...allSpells], classId, a.activeSpellListId, a.spellLists, a.classSource);
  let pool = base;
  if (extraSpellIds.length > 0) {
    const have = new Set(base.map(s => s.id));
    pool = [...base, ...allSpells.filter(s => extraSpellIds.includes(s.id) && !have.has(s.id))];
  }
  const cantrip = isCantripChoiceDef(def);
  return pool.filter(s => {
    if (known.has(s.id)) return false;
    if (cantrip) return s.level === 0;
    return s.level !== 0 && s.level <= maxCastableLevel;
  });
}

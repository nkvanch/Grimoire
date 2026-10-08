// ============================================================================
// FILE: src/engine/spellModifiers.ts
// Typed modifications to a spell the character already has, authored as ordinary stat_modifier
// effects on a target that names the spell:
//
//   spell_range:<spellId>          operation 'set', value = feet      "Eldritch Blast's range becomes 300 ft"
//   spell_damage_bonus:<spellId>   operation 'add', value and/or      "add your Charisma modifier to the
//                                  addAbilityModifier                  damage of Eldritch Blast"
//   spell_list:<classId>           operation 'add', value = spell ids "the following spells are added to the warlock spell list for you"
//   spell_damage_type:<spellId>    operation 'set', value = a type    "Eldritch Blast deals fire damage instead of force"
//   spell_damage_die:<spellId>     operation 'set', value = die size  "its damage die is changed to 1d12"
//
// Deliberately only these typed typed modifications, not a formula language: the proposal this comes
// from asks for typed changes (range, extra damage, ...) rather than arbitrary expressions. They are
// read when an action card is built, so the card shows the real range and per-hit damage. Spell
// resolution itself stays with the player, as everywhere else in the app.
// ============================================================================
import { Entity } from './types';
import { collectAllEffects, effectiveAbilityScores, modifier } from './pipeline';

/** The longest `set` range (in feet) any active effect gives this spell, or null for no override. */
export function spellRangeOverride(entity: Entity, spellId: string): number | null {
  const target = `spell_range:${spellId}`;
  const values = collectAllEffects(entity)
    .filter(ae => ae.effect.target === target && ae.effect.operation === 'set' && typeof ae.effect.value === 'number')
    .map(ae => ae.effect.value as number);
  return values.length ? Math.max(...values) : null;
}

/** Total flat damage added per hit of this spell by active effects (0 when none). */
export function spellDamageBonus(entity: Entity, spellId: string): number {
  const target = `spell_damage_bonus:${spellId}`;
  const matching = collectAllEffects(entity).filter(ae => ae.effect.target === target && ae.effect.operation === 'add');
  if (matching.length === 0) return 0;
  const scores = effectiveAbilityScores(entity);
  return matching.reduce((sum, ae) => {
    const flat = typeof ae.effect.value === 'number' ? ae.effect.value : 0;
    const ability = ae.effect.addAbilityModifier ? modifier(scores[ae.effect.addAbilityModifier]) : 0;
    return sum + flat + ability;
  }, 0);
}

/** The damage type an active effect makes this spell deal instead of its printed one, or null. */
export function spellDamageTypeOverride(entity: Entity, spellId: string): string | null {
  const target = `spell_damage_type:${spellId}`;
  const hit = collectAllEffects(entity).find(ae => ae.effect.target === target && ae.effect.operation === 'set' && typeof ae.effect.value === 'string');
  return hit ? (hit.effect.value as string) : null;
}

/** The die size (12 for d12) an active effect swaps in for this spell's printed damage die, or null. The largest wins. */
export function spellDamageDieOverride(entity: Entity, spellId: string): number | null {
  const target = `spell_damage_die:${spellId}`;
  const values = collectAllEffects(entity)
    .filter(ae => ae.effect.target === target && ae.effect.operation === 'set' && typeof ae.effect.value === 'number')
    .map(ae => ae.effect.value as number);
  return values.length ? Math.max(...values) : null;
}

/** Spell ids that active effects add to a class's spell list for this character (an expanded list, such as a patron's), possibly empty. */
export function extraClassSpellIds(entity: Entity, classId: string): string[] {
  const target = `spell_list:${classId}`;
  const ids = new Set<string>();
  for (const ae of collectAllEffects(entity)) {
    if (ae.effect.target !== target || ae.effect.operation !== 'add' || !Array.isArray(ae.effect.value)) continue;
    for (const id of ae.effect.value) ids.add(id);
  }
  return [...ids];
}

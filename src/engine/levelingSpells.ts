import { getSpellSlotsForClassLevel } from '../content/classes/spellSlotTables';
import { officialClasses } from '../content/runtimeRules';
import { spellRepo } from '../content/spellRepo';
import { effectiveAbilityScores } from './derivedStats';
import { modifier } from './abilityMath';
import { grantEntitlements, revokeSpellEntitlementFromChoice, grantEntitlement, initializeEntitlementInputs } from './entitlements';
import { getClassLevels } from './multiclass';
import { recomputeDerived } from './pipeline';
import { extraClassSpellIds } from './spellModifiers';
import { Entity, CampaignRules, EntitlementSourceKind, CharClass } from './types';

// ── Spell selection on level-up ──────────────────────────────────────────────

/**
 * Resolves a 'spell' pending choice (a known-spell caster gaining new
 * spells/cantrips known at level-up, or a Wizard adding to their
 * spellbook) — bypasses resolveChoice for the same reason ASI/subclass/
 * infusion do: the pool is the 'all' sentinel (the picker supplies the
 * real, class-filtered spell list, not the engine). Routes each selected
 * id into `cantrips` or `known` by looking up its own `level` (0 = cantrip)
 * via the caller-supplied lookup, so one picker component serves both a
 * pure cantrip-count choice and a pure leveled-spell-count choice without
 * the engine needing to know which in advance.
 */
export function applySpellChoiceToEntity(
  entity:       Entity,
  choiceId:     string,
  spellIds:     string[],
  getSpellLevel: (id: string) => number | undefined,
  rules:        CampaignRules,
): Entity {
  if (!entity.spellcasting) return entity;
  const newCantrips: string[] = [];
  const newKnown:     string[] = [];
  for (const id of spellIds) {
    if (getSpellLevel(id) === 0) newCantrips.push(id);
    else newKnown.push(id);
  }
  // Closure pass 3 (item 1): the class/subclass/race grants the OPPORTUNITY
  // to learn a spell (this queued choice); the player picks which one. That
  // opportunity is source-owned the same way a resolved tool/language/skill
  // choice is (closure pass 2) — losing the class/subclass that granted the
  // choice should be able to remove the resulting known spell too, without
  // touching a DIFFERENT source's grant of the same spell. Falls back to
  // 'manual' when the choice carries no explicit provenance (e.g. an
  // in-play "+Learn Spell" ad-hoc pick with no queued ChoiceState source).
  const pending = entity.choices.find(c => c.id === choiceId);
  const spellSource: { kind: EntitlementSourceKind; id?: string } = pending?.sourceKind
    ? { kind: pending.sourceKind, id: pending.sourceId }
    : { kind: 'manual', id: undefined };
  let updated: Entity = grantEntitlements(entity, [
    ...newCantrips.map(key => ({ kind: 'cantrip_access' as const, key, sourceKind: spellSource.kind, sourceId: spellSource.id, choiceId })),
    ...newKnown.map(key    => ({ kind: 'spell_access'   as const, key, sourceKind: spellSource.kind, sourceId: spellSource.id, choiceId })),
  ]);
  updated = {
    ...updated,
    choices: updated.choices.map(c =>
      c.id === choiceId ? { ...c, resolved: true, selections: spellIds } : c
    ),
  };
  return recomputeDerived(updated, rules);
}

/**
 * Swaps one chosen cantrip (or spell) of a resolved spell choice for another that the same choice could have offered
 * (Blessed Warrior and Druidic Warrior: "whenever you gain a Paladin/Ranger level, you can replace one of these
 * cantrips with another"). Needs `choice.definition.replace`; the new spell must pass the choice's own filter and not
 * be known already. The app does not track level-ups, so honoring the timing is the player's (the rule is shown).
 */
export function replaceSpellChoiceSelection(
  entity: Entity, choiceId: string, oldSpellId: string, newSpellId: string, rules: CampaignRules,
): Entity {
  const choice = entity.choices.find(c => c.id === choiceId);
  if (!choice || !choice.resolved || choice.definition.kind !== 'spell') throw new Error('That choice has not been made yet.');
  if (!choice.definition.replace) throw new Error('This choice cannot be swapped.');
  if (!choice.selections.includes(oldSpellId)) throw new Error('You do not hold that spell from this choice.');
  if (oldSpellId === newSpellId) throw new Error('Pick a different spell.');
  const sc = entity.spellcasting;
  if (!sc) throw new Error('This character does not cast spells.');
  if (sc.cantrips.includes(newSpellId) || sc.known.includes(newSpellId) || sc.prepared.includes(newSpellId)) throw new Error('You already know that spell.');
   
  const { spellMatchesChoice } = require('../content/spellChoiceFilter') as typeof import('../content/spellChoiceFilter');
  const next = spellRepo.getIndex().find(sp => sp.id === newSpellId);
  const ownClassId = choice.definition.forClassId ?? entity.identity.classId;
  if (!next || !spellMatchesChoice(next, choice.definition, { ownClassId, maxCastableLevel: 9, extraSpellIds: extraClassSpellIds(entity, ownClassId ?? '') })) throw new Error('That spell is not one this choice could have offered.');

  const source: { kind: EntitlementSourceKind; id?: string } = choice.sourceKind ? { kind: choice.sourceKind, id: choice.sourceId } : { kind: 'manual' };
  let updated = revokeSpellEntitlementFromChoice(entity, choiceId, oldSpellId);
  updated = grantEntitlement(updated, { kind: next.level === 0 ? 'cantrip_access' : 'spell_access', key: newSpellId, sourceKind: source.kind, sourceId: source.id, choiceId });
  updated = { ...updated, choices: updated.choices.map(c => c.id === choiceId ? { ...c, selections: c.selections.map(id => id === oldSpellId ? newSpellId : id) } : c) };
  return recomputeDerived(updated, rules);
}

/**
 * The character stops knowing a spell it holds in its own lists (cantrips, known, prepared), after creation: every grant of it is
 * taken back and a spell choice that picked it no longer records it, so a later recompute or grant never brings it back. Ending
 * concentration on it is left to its own flow. A spell a feature grants by itself is not in those lists and is untouched.
 */
export function forgetSpell(entity: Entity, spellId: string, rules: CampaignRules): Entity {
  const sc = entity.spellcasting;
  if (!sc || ![...sc.cantrips, ...sc.known, ...sc.prepared].includes(spellId)) return entity;
  const base = initializeEntitlementInputs(entity);
  const drop = (ids: string[]) => ids.filter(id => id !== spellId);
  const bsc = base.spellcasting!;
  return recomputeDerived({
    ...base,
    entitlements: (base.entitlements ?? []).filter(e => !(e.key === spellId && (e.kind === 'spell_access' || e.kind === 'cantrip_access'))),
    spellcasting: { ...bsc, cantrips: drop(bsc.cantrips), known: drop(bsc.known), prepared: drop(bsc.prepared) },
    choices: base.choices.map(c => (c.definition.kind === 'spell' && c.selections.includes(spellId) ? { ...c, selections: drop(c.selections) } : c)),
  }, rules);
}

/**
 * How many spells a preparing class (Cleric, Druid, Paladin, Wizard) may prepare, and how many of that class's spells are
 * prepared now: the class's own table where it has one (2024), otherwise the 2014 rule, its casting ability modifier plus its
 * level (half of it for a half caster), at least 1. null for a class that does not prepare. The app warns past it, never blocks.
 */
/** A half caster (Paladin): its slot table never goes past 5th-level slots, or the class says so itself. */
function isHalfCaster(def: CharClass): boolean {
  if (def.spellcastingStyle) return def.spellcastingStyle === 'half';
  const top = getSpellSlotsForClassLevel(def.id, 20);
  return !!top && top.some(n => n > 0) && top.slice(5).every(n => !n);
}

export function preparedSpellCount(entity: Entity, classId: string, classDefs: readonly CharClass[] = officialClasses()): { prepared: number; limit: number } | null {
  const def = classDefs.find(c => c.id === classId);
  const policy = def?.spellPreparationPolicy;
  if (!def || (policy !== 'full_list_prepared' && policy !== 'spellbook_prepared')) return null;
  const level = getClassLevels(entity).find(c => c.classId === classId)?.level ?? 0;
  if (level <= 0) return null;
  const ability = def.spellcastingAbility ?? entity.spellcasting?.ability ?? 'int';
  const limit = def.preparedSpellsByLevel?.[level - 1]
    ?? Math.max(1, modifier(effectiveAbilityScores(entity)[ability]) + (isHalfCaster(def) ? Math.floor(level / 2) : level));
  const ownSpells = new Set((entity.entitlements ?? []).filter(e => e.kind === 'spell_access' && e.sourceKind === 'class' && e.sourceId === classId).map(e => e.key));
  const single = getClassLevels(entity).length <= 1;   // one class: everything prepared is its; several: only what it granted
  const prepared = (entity.spellcasting?.prepared ?? []).filter(id => single || ownSpells.has(id)).length;
  return { prepared, limit };
}

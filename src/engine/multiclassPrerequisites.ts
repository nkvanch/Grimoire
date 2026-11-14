// ============================================================================
// FILE: src/engine/multiclassPrerequisites.ts
// The abilities a class asks for when a character has it with another class (SRD multiclassing: 13 in the key ability of the class left and
// the class entered). Same rule as the desktop app (ADR-014, core/ruleset/dnd5e/MulticlassPrerequisites and core/rules/MulticlassRules):
// a class record's own `multiclassPrerequisites` comes first (a homebrew class's "Abilities needed"), then the SRD table; a class neither
// names asks for nothing. Checked for every class involved, against the character's effective scores. Level-up revision 3 holds a new class
// to it (dnd5eOperations.ts); a character pinned at revision 2 was never held to it and is not now.
// ============================================================================
import type { Ability, CampaignRules, CharClass, Entity, MulticlassPrerequisites } from './types';
import { getClassLevels } from './multiclass';
import { effectiveAbilityScores } from './pipeline';
import { MULTICLASS_PREREQUISITE_REVISION } from './ruleset/dnd5eOperations';

const all = (...abilities: Ability[]): MulticlassPrerequisites => [abilities.map(ability => ({ ability, minimum: 13 }))];
const SRD: Record<string, MulticlassPrerequisites> = {
  barbarian: all('str'), bard: all('cha'), cleric: all('wis'), druid: all('wis'),
  fighter: [[{ ability: 'str', minimum: 13 }], [{ ability: 'dex', minimum: 13 }]],
  monk: all('dex', 'wis'), paladin: all('str', 'cha'), ranger: all('dex', 'wis'), rogue: all('dex'),
  sorcerer: all('cha'), warlock: all('cha'), wizard: all('int'),
};
const NAME: Record<Ability, string> = { str: 'Strength', dex: 'Dexterity', con: 'Constitution', int: 'Intelligence', wis: 'Wisdom', cha: 'Charisma' };

/** What `classId` asks for: its record's own requirement, else the SRD's (a 2024 class as its 2014 namesake), else nothing. */
export function multiclassRequirementOf(classId: string, record?: Pick<CharClass, 'multiclassPrerequisites'>): MulticlassPrerequisites | null {
  const own = (record?.multiclassPrerequisites ?? []).filter(option => Array.isArray(option) && option.length > 0);
  if (own.length) return own;
  return SRD[classId.replace(/_2024$/, '')] ?? null;
}

/** The requirement in words: "Strength 13 or Dexterity 13", "Dexterity 13 and Wisdom 13". */
export const describeRequirement = (need: MulticlassPrerequisites): string =>
  need.map(option => option.map(n => `${NAME[n.ability] ?? n.ability} ${n.minimum ?? 13}`).join(' and ')).join(' or ');

export type MulticlassLack = { classId: string; message: string };

/** What the character lacks to have its classes and `addingClassId` together; empty when it has one class or meets every requirement. */
export function multiclassLacks(entity: Entity, addingClassId: string | null, classes: readonly CharClass[]): MulticlassLack[] {
  const held = getClassLevels(entity).filter(c => c.level > 0).map(c => String(c.classId));
  const ids = addingClassId && !held.includes(addingClassId) ? [...held, addingClassId] : held;
  if (ids.length < 2) return [];
  const scores = effectiveAbilityScores(entity);
  const out: MulticlassLack[] = [];
  for (const classId of ids) {
    const record = classes.find(c => c.id === classId);
    const need = multiclassRequirementOf(classId, record);
    if (!need || need.some(option => option.every(n => (scores[n.ability] ?? 10) >= (n.minimum ?? 13)))) continue;
    out.push({ classId, message: `${record?.name ?? classId} needs ${describeRequirement(need)}` });
  }
  return out;
}

/** Whether a new class is held to the requirement: the table's rule is on (it is unless a profile turns it off) and the character's
 *  level-up revision is 3 or later (unpinned characters are at the current one). */
export function multiclassRequirementApplies(rules: Pick<CampaignRules, 'multiclassPrerequisites'>, pinnedLevelUpRevision: number | undefined): boolean {
  return rules.multiclassPrerequisites !== false && (pinnedLevelUpRevision === undefined || pinnedLevelUpRevision >= MULTICLASS_PREREQUISITE_REVISION);
}

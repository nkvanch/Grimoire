// ============================================================================
// FILE: src/engine/ruleset/dnd5eOperations.ts
// The executable operations of D&D 5e and their revisions: the same ids, revisions and reads as the desktop app's
// core/ruleset/dnd5e/Dnd5eOperations.cpp, so a lock written by either app is read the same way by the other.
//
// What an operation reads: the kinds of content whose pinned revision it needs exact. "item.equipped" and "item.carried" narrow the character's
// roots to what is worn, or to everything carried; what content names is followed only to a kind read without a qualifier.
//
// Revisions (both apps): revision 2 of level_up and character_creation queues the SRD spell choices a pack leaves out; revision 3 of level_up checks
// the multiclass ability requirements, and revision 3 of character_creation begins a character from no hit points. Every revision below the current
// one stays runnable.
//
// Every operation is at the desktop's current revision. level_up also still runs revision 2, which is revision 3 without the multiclass ability
// requirements (engine/multiclassPrerequisites.ts reads the pinned revision), so a character pinned at 2 is not held to a rule it never had.
// ============================================================================
import { operationRegistry, OperationInfo, OperationRegistry } from '../pinning/lock';

const FEATURE_SOURCES = 'race subrace class subclass background feat';
const EFFECTS = `${FEATURE_SOURCES} item.equipped`;
const FEATURES_AND_SPELLS = `${FEATURE_SOURCES} spell`;

/** The revisions the two apps share for the operations that have been revised. */
export const SPELL_GAP_FILL_REVISION = 2;
export const HIT_POINT_START_REVISION = 3;
export const MULTICLASS_PREREQUISITE_REVISION = 3;

const ROWS: [id: string, description: string, reads: string, revision?: number][] = [
  ['dnd5e.ability_modifier', "an ability score's modifier", ''],
  ['dnd5e.proficiency_bonus', 'the proficiency bonus for a level', ''],
  ['dnd5e.hit_point_gain', 'the hit points a level gives', ''],
  ['dnd5e.derived_stats', 'armor class, saves, skills, speed and the other derived statistics', EFFECTS],
  ['dnd5e.damage_modifiers', 'resistance, immunity and vulnerability stacking', EFFECTS],
  ['dnd5e.apply_damage', 'damage, temporary hit points and dropping to zero', EFFECTS],
  ['dnd5e.apply_healing', 'healing, and what it does to death saves', ''],
  ['dnd5e.temp_hp', 'temporary hit points', ''],
  ['dnd5e.wild_shape_damage', 'damage taken in a beast form', EFFECTS],
  ['dnd5e.death_saves', 'recording and setting death saves', ''],
  ['dnd5e.short_rest', 'a short rest and spending hit dice', FEATURE_SOURCES],
  ['dnd5e.long_rest', 'a long rest', FEATURE_SOURCES],
  ['dnd5e.dawn_recharge', 'resources that recharge at dawn or at the end of a turn', FEATURE_SOURCES],
  ['dnd5e.level_up', 'taking a class level and what it grants', FEATURES_AND_SPELLS, MULTICLASS_PREREQUISITE_REVISION],
  ['dnd5e.choice_resolution', 'making the choices a class, species or background offers', FEATURES_AND_SPELLS],
  ['dnd5e.ability_score_improvement', 'ability score improvements and feats', FEATURE_SOURCES],
  ['dnd5e.spell_slots', 'spending and restoring spell slots', ''],
  ['dnd5e.spell_access', 'which spells a character may cast or prepare', FEATURES_AND_SPELLS],
  ['dnd5e.equipment', 'equipping, attunement and the loadouts', `${FEATURE_SOURCES} item.carried`],
  ['dnd5e.conditions', 'conditions, durations and exhaustion', ''],
  ['dnd5e.weapon_mastery', 'weapon mastery', 'race class subclass feat item.carried'],
  ['dnd5e.wild_shape', 'starting and ending a beast form', 'race class subclass feat'],
  ['dnd5e.companion', 'an animal companion', 'class subclass feat'],
  ['dnd5e.free_edit', "a player's and a DM's manual overrides", ''],
  ['dnd5e.background_swap', 'changing a background and what it granted', 'background feat'],
  ['dnd5e.point_buy', 'point-buy costs and limits', ''],
  ['dnd5e.character_creation', 'making a new character', '', HIT_POINT_START_REVISION],
];

export const DND5E_OPERATIONS: OperationRegistry = operationRegistry(ROWS.map(([id, description, reads, revision = 1]): OperationInfo => ({
  id, description, current: revision,
  // only the current revision: this app has one implementation of each operation, so it cannot run an older one exactly (the desktop app keeps
  // older ones behind rule switches), except level_up 2, which is 3 with the multiclass requirement switched off; each runnable revision is
  // verified by a probe (__tests__/operationVerification.test.ts)
  available: id === 'dnd5e.level_up' ? [SPELL_GAP_FILL_REVISION, revision] : [revision],
  // a player's and a DM's manual overrides are done by hand: no revision can make them unavailable, so a character can always be played
  automatic: id !== 'dnd5e.free_edit',
  reads: reads.split(' ').filter(Boolean),
})));

/** The revision of each D&D ruleset's own rules (the desktop app's RulesetDeclaration revision). */
export const RULESET_REVISION: Record<string, string> = { 'dnd5e-2014': '1', 'dnd5e-2024': '1' };

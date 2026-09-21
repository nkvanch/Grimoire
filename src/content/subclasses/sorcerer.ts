// ============================================================================
// FILE: src/content/subclasses/sorcerer.ts
//
// Bonus spells known: like the Paladin/Ranger gap, the "learn an extra spell
// Mislead, and others) aren't in this codebase's spell library yet, and
// partial per-level wiring would repeat the same inconsistent patchwork
// already avoided twice before. Left disclosed and unwired.
//
// Magic: The Gathering-flavored setting, not an official WotC subclass like
// the other 8 here — included per the standing "author everything in the
// folder" scope decision, but its non-official origin is called out
// ============================================================================
import { ClassProgression, } from '../../engine/types';

export type SubclassProgression = ClassProgression & { name: string };

export const draconicBloodlineProgression: SubclassProgression = {
  classId: 'sorcerer', name: 'Draconic Bloodline', srd: true,
  entries: [
    { level: 1, hpDie: 6, choices: [], grants: [{ kind: 'feature', value: { id: 'dragon_ancestor', name: 'Dragon Ancestor', description: 'Choose a type of dragon. Speak, read, and write Draconic. Advantage on Charisma checks with dragons.', source: { kind: 'subclass', refId: 'draconic_bloodline' }, level: 1, effects: [], actions: [], choices: [], passive: true } }, { kind: 'feature', value: { id: 'draconic_resilience', name: 'Draconic Resilience', description: 'HP maximum increases by 1 per sorcerer level. When not wearing armor, AC = 13 + DEX modifier.', source: { kind: 'subclass', refId: 'draconic_bloodline' }, level: 1, effects: [{ type: 'base_ac_formula', target: 'ac', operation: 'set', value: 13, condition: null }], actions: [], choices: [], passive: true } }] },
    { level: 6, hpDie: 6, choices: [], grants: [{ kind: 'feature', value: { id: 'elemental_affinity', name: 'Elemental Affinity', description: 'When you cast a spell of the damage type associated with your draconic ancestry, add your CHA modifier to one damage roll. Spend 1 sorcery point to gain resistance to that damage type for 1 hour.', source: { kind: 'subclass', refId: 'draconic_bloodline' }, level: 6, effects: [], actions: [], choices: [], passive: true } }] },
    { level: 14, hpDie: 6, choices: [], grants: [{ kind: 'feature', value: { id: 'dragon_wings', name: 'Dragon Wings', description: 'Sprout wings as a bonus action. Gain a flying speed equal to your current speed. Disappear as a bonus action.', source: { kind: 'subclass', refId: 'draconic_bloodline' }, level: 14, effects: [], actions: [], choices: [], passive: false, activation: { actionType: 'bonus_action', resourceCost: null, range: 'self', target: 'self', requiresSave: null } } }] },
    { level: 18, hpDie: 6, choices: [], grants: [{ kind: 'feature', value: { id: 'draconic_presence', name: 'Draconic Presence', description: 'Spend 5 sorcery points as an action to exude awe or fear in a 60-foot radius for 1 minute (WIS save). Frightened or charmed until the aura ends or a save is made.', source: { kind: 'subclass', refId: 'draconic_bloodline' }, level: 18, effects: [], actions: [], choices: [], passive: false, activation: { actionType: 'action', resourceCost: { resourceId: 'sorcery_points', quantity: 5 }, range: '60 feet', target: 'area', requiresSave: { ability: 'wis', dc: 'spell_save_dc' } } } }] },
  ],
};

export const SORCERER_SUBCLASSES: SubclassProgression[] = [
  draconicBloodlineProgression,
];

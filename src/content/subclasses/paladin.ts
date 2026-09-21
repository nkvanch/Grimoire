// ============================================================================
// FILE: src/content/subclasses/paladin.ts
//
// Oath spells: like the pre-existing Devotion/Ancients, none of the new
// subclasses below grant oath spells via a known_spells Grant (the
// Cleric/Druid domainSpells()/circleSpells() pattern). About a third of the
// real oath spell lists (Armor of Agathys, Sanctuary, Guiding Bolt, Sleep,
// Alarm, Commune, and others) aren't in this codebase's spell library yet,
// so wiring the ones that ARE present would produce a subclass-by-subclass
// patchwork of some oath levels granting spells and others silently not.
// Staying consistent with the two subclasses that already shipped without
// oath spells was judged better than a half-wired addition — flagging this
// as a real, disclosed, pre-existing gap across ALL Paladin subclasses.
// ============================================================================
import { ClassProgression } from '../../engine/types';

export type SubclassProgression = ClassProgression & { name: string };

export const devotionProgression: SubclassProgression = {
  classId: 'paladin', name: 'Oath of Devotion', srd: true,
  entries: [
    { level: 3, hpDie: 10, choices: [], grants: [
      { kind: 'feature', value: { id: 'sacred_weapon', name: 'Channel Divinity: Sacred Weapon', description: 'As an action, imbue one weapon with positive energy. For 1 minute, add your CHA modifier to attack rolls. The weapon emits bright light in a 20-foot radius. The CHA-to-attack bonus isn\'t auto-calculated — the engine has no attack-roll-bonus formula hook — apply manually.', source: { kind: 'subclass', refId: 'devotion' }, level: 3, effects: [], actions: [], choices: [], passive: false,
        activation: { actionType: 'action', resourceCost: { resourceId: 'channel_divinity_paladin', quantity: 1 }, range: 'self', target: 'self', requiresSave: null },
        abilityEffects: [],
      } },
      { kind: 'feature', value: { id: 'turn_the_unholy', name: 'Channel Divinity: Turn the Unholy', description: 'As an action, present your holy symbol. Fiends and undead within 30 feet must make a WIS save or be turned for 1 minute. Turning isn\'t a tracked status — the engine has no "turned" condition — resolve manually.', source: { kind: 'subclass', refId: 'devotion' }, level: 3, effects: [], actions: [], choices: [], passive: false,
        activation: { actionType: 'action', resourceCost: { resourceId: 'channel_divinity_paladin', quantity: 1 }, range: '30 feet', target: 'area', requiresSave: null },
        abilityEffects: [],
      } },
    ] },
    { level: 7, hpDie: 10, choices: [], grants: [{ kind: 'feature', value: { id: 'aura_of_devotion', name: 'Aura of Devotion', description: 'You and friendly creatures within 10 feet (30 feet at L18) can\'t be charmed while you are conscious.', source: { kind: 'subclass', refId: 'devotion' }, level: 7, effects: [], actions: [], choices: [], passive: true } }] },
    { level: 15, hpDie: 10, choices: [], grants: [{ kind: 'feature', value: { id: 'purity_of_spirit', name: 'Purity of Spirit', description: 'You are always under the effects of a Protection from Evil and Good spell.', source: { kind: 'subclass', refId: 'devotion' }, level: 15, effects: [], actions: [], choices: [], passive: true } }] },
    { level: 20, hpDie: 10, choices: [], grants: [{ kind: 'feature', value: { id: 'holy_nimbus', name: 'Holy Nimbus', description: 'As an action, emanate an aura of sunlight for 1 minute. Bright light in a 30-foot radius. Enemies in the light take 10 radiant per turn. CHA bonus to saves against fiend/undead spells. Once per long rest.', source: { kind: 'subclass', refId: 'devotion' }, level: 20, effects: [], actions: [], choices: [], passive: false, activation: { actionType: 'action', resourceCost: { resourceId: 'holy_nimbus_pool', quantity: 1 }, range: '30 feet', target: 'area', requiresSave: null } } }, { kind: 'resource', value: { resourceId: 'holy_nimbus_pool', name: 'Holy Nimbus', maximum: 1, recharge: 'long_rest' } }] },
  ],
};

export const PALADIN_SUBCLASSES: SubclassProgression[] = [
  devotionProgression,
];

// ============================================================================
// FILE: src/content/subclasses/rogue.ts
// ============================================================================
import { ClassProgression, } from '../../engine/types';
import { THIRD_CASTER_SLOTS } from '../classes/spellSlotTables';
import { ALL_TOOLS } from '../tools';

export type SubclassProgression = ClassProgression & { name: string };

// ── Thief ─────────────────────────────────────────────────────────────────────

export const thiefProgression: SubclassProgression = {
  classId: 'rogue',
  name: 'Thief',
  srd: true,
  entries: [
    {
      level: 3, hpDie: 8, choices: [],
      grants: [
        { kind: 'feature', value: { id: 'fast_hands', name: 'Fast Hands', description: 'Use the bonus action granted by Cunning Action to make a Sleight of Hand check, use thieves\' tools, or take the Use an Object action.', source: { kind: 'subclass', refId: 'thief' }, level: 3, effects: [], actions: [], choices: [], passive: true } },
        { kind: 'feature', value: { id: 'second_story_work', name: 'Second-Story Work', description: 'Climbing costs no extra movement. When you make a running jump, add your DEX modifier to the distance covered.', source: { kind: 'subclass', refId: 'thief' }, level: 3, effects: [], actions: [], choices: [], passive: true } },
      ],
    },
    {
      level: 9, hpDie: 8, choices: [],
      grants: [
        { kind: 'feature', value: { id: 'supreme_sneak', name: 'Supreme Sneak', description: 'Advantage on Stealth checks if you move no more than half your speed on the same turn.', source: { kind: 'subclass', refId: 'thief' }, level: 9, actions: [], choices: [], passive: true, effects: [{ type: 'stat_modifier', target: 'Stealth checks when you move no more than half your speed', operation: 'advantage', value: null, condition: null }] } },
      ],
    },
    {
      level: 13, hpDie: 8, choices: [],
      grants: [
        { kind: 'feature', value: { id: 'use_magic_device', name: 'Use Magic Device', description: 'You can ignore all class, race, and level requirements on the use of magic items.', source: { kind: 'subclass', refId: 'thief' }, level: 13, effects: [], actions: [], choices: [], passive: true } },
      ],
    },
    {
      level: 17, hpDie: 8, choices: [],
      grants: [
        { kind: 'feature', value: { id: 'thiefs_reflexes', name: 'Thief\'s Reflexes', description: 'Take two turns during the first round of combat. Take the first turn at normal initiative and the second at initiative minus 10.', source: { kind: 'subclass', refId: 'thief' }, level: 17, effects: [], actions: [], choices: [], passive: true } },
      ],
    },
  ],
};

export const ROGUE_SUBCLASSES: SubclassProgression[] = [
  thiefProgression,
];

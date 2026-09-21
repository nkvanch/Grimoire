// ============================================================================
// FILE: src/content/subclasses/fighter.ts
// ============================================================================
import { ClassProgression, } from '../../engine/types';
import { THIRD_CASTER_SLOTS } from '../classes/spellSlotTables';
import { ALL_TOOLS } from '../tools';

export type SubclassProgression = ClassProgression & { name: string };

// ── Champion ──────────────────────────────────────────────────────────────────

export const championProgression: SubclassProgression = {
  classId: 'fighter',
  name: 'Champion',
  srd: true,
  entries: [
    {
      level: 3, hpDie: 10, choices: [],
      grants: [
        { kind: 'feature', value: { id: 'improved_critical', name: 'Improved Critical', description: 'Your weapon attacks score a critical hit on a roll of 19 or 20.', source: { kind: 'subclass', refId: 'champion' }, level: 3, effects: [], actions: [], choices: [], passive: true } },
      ],
    },
    {
      level: 7, hpDie: 10, choices: [],
      grants: [
        { kind: 'feature', value: { id: 'remarkable_athlete', name: 'Remarkable Athlete', description: 'Add half your proficiency bonus (rounded up) to any STR, DEX, or CON check that doesn\'t already use your proficiency bonus. Your running long jump distance increases by your STR modifier.', source: { kind: 'subclass', refId: 'champion' }, level: 7, effects: [], actions: [], choices: [], passive: true } },
      ],
    },
    {
      level: 10, hpDie: 10, choices: [],
      grants: [
        { kind: 'feature', value: { id: 'additional_fighting_style', name: 'Additional Fighting Style', description: 'You can choose a second option from the Fighting Style class feature.', source: { kind: 'subclass', refId: 'champion' }, level: 10, effects: [], actions: [], choices: [], passive: true } },
      ],
    },
    {
      level: 15, hpDie: 10, choices: [],
      grants: [
        { kind: 'feature', value: { id: 'superior_critical', name: 'Superior Critical', description: 'Your weapon attacks score a critical hit on a roll of 18–20.', source: { kind: 'subclass', refId: 'champion' }, level: 15, effects: [], actions: [], choices: [], passive: true } },
      ],
    },
    {
      level: 18, hpDie: 10, choices: [],
      grants: [
        { kind: 'feature', value: { id: 'survivor', name: 'Survivor', description: 'At the start of each of your turns, you regain HP equal to 5 + your CON modifier if you have no more than half your HP remaining and you aren\'t at 0 HP.', source: { kind: 'subclass', refId: 'champion' }, level: 18, effects: [], actions: [], choices: [], passive: true } },
      ],
    },
  ],
};

export const FIGHTER_SUBCLASSES: SubclassProgression[] = [
  championProgression,
];

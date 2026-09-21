// ============================================================================
// FILE: src/content/subclasses/druid.ts
// Stars, Wildfire, the Shepherd, plus Circle of the Primeval — a deferred
// ============================================================================
import { ClassProgression, } from '../../engine/types';

export type SubclassProgression = ClassProgression & { name: string };

export const circleOfTheLandProgression: SubclassProgression = {
  classId: 'druid', name: 'Circle of the Land', srd: true,
  entries: [
    { level: 2, hpDie: 8, choices: [], grants: [{ kind: 'feature', value: { id: 'bonus_cantrip', name: 'Bonus Cantrip', description: 'Learn one additional druid cantrip of your choice.', source: { kind: 'subclass', refId: 'circle_land' }, level: 2, effects: [], actions: [], choices: [], passive: true } }, { kind: 'feature', value: { id: 'natural_recovery', name: 'Natural Recovery', description: 'Once between long rests, regain expended spell slots during a short rest. Total levels ≤ half druid level (rounded up). No slots above 5th.', source: { kind: 'subclass', refId: 'circle_land' }, level: 2, effects: [], actions: [], choices: [], passive: false, activation: { actionType: 'free', resourceCost: { resourceId: 'natural_recovery_pool', quantity: 1 }, range: 'self', target: 'self', requiresSave: null } } }, { kind: 'resource', value: { resourceId: 'natural_recovery_pool', name: 'Natural Recovery', maximum: 1, recharge: 'long_rest' } }] },
    { level: 6, hpDie: 8, choices: [], grants: [{ kind: 'feature', value: { id: 'lands_stride', name: "Land's Stride", description: 'Moving through nonmagical difficult terrain costs no extra movement. Pass through nonmagical plants without being slowed or damaged. Advantage on saves against plants created by magic.', source: { kind: 'subclass', refId: 'circle_land' }, level: 6, effects: [], actions: [], choices: [], passive: true } }] },
    { level: 10, hpDie: 8, choices: [], grants: [{ kind: 'feature', value: { id: 'natures_ward', name: "Nature's Ward", description: 'Immune to poison and disease. Immune to charm and fear from elementals and fey.', source: { kind: 'subclass', refId: 'circle_land' }, level: 10, effects: [{ type: 'condition_immunity', target: 'poison', operation: 'immunity', value: null, condition: null }, { type: 'condition_immunity', target: 'disease', operation: 'immunity', value: null, condition: null }], actions: [], choices: [], passive: true } }] },
    { level: 14, hpDie: 8, choices: [], grants: [{ kind: 'feature', value: { id: 'natures_sanctuary', name: "Nature's Sanctuary", description: 'Beasts and plants must make a WIS save when attacking you or be compelled to choose a different target.', source: { kind: 'subclass', refId: 'circle_land' }, level: 14, effects: [], actions: [], choices: [], passive: true } }] },
  ],
};

export const DRUID_SUBCLASSES: SubclassProgression[] = [
  circleOfTheLandProgression,
];

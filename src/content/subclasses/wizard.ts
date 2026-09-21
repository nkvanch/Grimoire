// ============================================================================
// FILE: src/content/subclasses/wizard.ts
// ============================================================================
import { ClassProgression, } from '../../engine/types';

export type SubclassProgression = ClassProgression & { name: string };

// ── School of Evocation ───────────────────────────────────────────────────────

export const evocationProgression: SubclassProgression = {
  classId: 'wizard',
  name: 'School of Evocation',
  srd: true,
  entries: [
    {
      level: 2, hpDie: 6, choices: [],
      grants: [
        { kind: 'feature', value: { id: 'evocation_savant', name: 'Evocation Savant', description: 'The gold and time you must spend to copy an evocation spell into your spellbook is halved.', source: { kind: 'subclass', refId: 'evocation' }, level: 2, effects: [], actions: [], choices: [], passive: true } },
        { kind: 'feature', value: { id: 'sculpt_spells', name: 'Sculpt Spells', description: 'When you cast an evocation spell that affects other creatures you can see, you can choose a number of them equal to 1 + the spell\'s level. Those creatures automatically succeed on their saving throws, and take no damage if they succeed.', source: { kind: 'subclass', refId: 'evocation' }, level: 2, effects: [], actions: [], choices: [], passive: true } },
      ],
    },
    {
      level: 6, hpDie: 6, choices: [],
      grants: [
        { kind: 'feature', value: { id: 'potent_cantrip', name: 'Potent Cantrip', description: 'Your damaging cantrips affect even creatures that avoid the brunt of the effect. On a successful save, a creature takes half the cantrip\'s damage.', source: { kind: 'subclass', refId: 'evocation' }, level: 6, effects: [], actions: [], choices: [], passive: true } },
      ],
    },
    {
      level: 10, hpDie: 6, choices: [],
      grants: [
        { kind: 'feature', value: { id: 'empowered_evocation', name: 'Empowered Evocation', description: 'Add your INT modifier to one damage roll of any wizard evocation spell you cast.', source: { kind: 'subclass', refId: 'evocation' }, level: 10, effects: [], actions: [], choices: [], passive: true } },
      ],
    },
    {
      level: 14, hpDie: 6, choices: [],
      grants: [
        { kind: 'feature', value: { id: 'overchannel', name: 'Overchannel', description: 'When you cast a wizard spell of 1st through 5th level that deals damage, maximize the damage. You can do so without ill effect once. A 2nd use before a long rest causes 2d12 necrotic per spell level, increasing by 1d12 for each subsequent use.', source: { kind: 'subclass', refId: 'evocation' }, level: 14, effects: [], actions: [], choices: [], passive: false, activation: { actionType: 'free', resourceCost: null, range: 'self', target: 'self', requiresSave: null } } },
      ],
    },
  ],
};

export const WIZARD_SUBCLASSES: SubclassProgression[] = [
  evocationProgression,
];

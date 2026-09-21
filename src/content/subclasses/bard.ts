// ============================================================================
// FILE: src/content/subclasses/bard.ts
// earlier drafts mechanically distinct from the official versions above
// (different sub-feature names and, for Spirits, a different Spirit Tales
// usable by Bard, Warlock, or Wizard in the real rules — modeled here as
// Bard-only, since porting the same content across three classes wasn't
// judged worth the added complexity for two UA subclasses.
// ============================================================================
import { ClassProgression, } from '../../engine/types';

export type SubclassProgression = ClassProgression & { name: string };

export const loreCollegeProgression: SubclassProgression = {
  classId: 'bard', name: 'College of Lore', srd: true,
  entries: [
    { level: 3, hpDie: 8,
      choices: [{ id: 'lore_bonus_proficiencies_3', prompt: 'Choose any 3 skills.', kind: 'skill', count: 3, pool: 'all', grants: [], required: true, resolved: false }],
      grants: [
        { kind: 'feature', value: { id: 'cutting_words', name: 'Cutting Words', description: 'Use your reaction and a Bardic Inspiration die to subtract from an attack roll, ability check, or damage roll of a creature within 60 feet that you can hear.', source: { kind: 'subclass', refId: 'lore' }, level: 3, effects: [], actions: [], choices: [], passive: false, activation: { actionType: 'reaction', resourceCost: { resourceId: 'bardic_inspiration_pool', quantity: 1 }, range: '60 feet', target: 'single', requiresSave: null } } },
        { kind: 'feature', value: { id: 'bonus_proficiencies_lore', name: 'Bonus Proficiencies', description: 'Gain proficiency in three skills of your choice.', source: { kind: 'subclass', refId: 'lore' }, level: 3, effects: [], actions: [], choices: [], passive: true } },
      ] },
    { level: 6, hpDie: 8, choices: [], grants: [{ kind: 'feature', value: { id: 'additional_magical_secrets', name: 'Additional Magical Secrets', description: 'Learn two spells of your choice from any class. They count as bard spells but don\'t count against known spells.', source: { kind: 'subclass', refId: 'lore' }, level: 6, effects: [], actions: [], choices: [], passive: true } }] },
    { level: 14, hpDie: 8, choices: [], grants: [{ kind: 'feature', value: { id: 'peerless_skill', name: 'Peerless Skill', description: 'When you make an ability check, spend one use of Bardic Inspiration to roll the die and add the result.', source: { kind: 'subclass', refId: 'lore' }, level: 14, effects: [], actions: [], choices: [], passive: false, activation: { actionType: 'free', resourceCost: { resourceId: 'bardic_inspiration_pool', quantity: 1 }, range: 'self', target: 'self', requiresSave: null } } }] },
  ],
};

export const BARD_SUBCLASSES: SubclassProgression[] = [
  loreCollegeProgression,
];

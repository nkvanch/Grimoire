// ============================================================================
// FILE: src/content/beastforms/wildShape2014.ts
// The 2014 Druid's Wild Shape as one feature with a form picker, instead of one feature per beast. What the picker offers is
// decided when the card is shown (engine/wildShapeForms.ts), from the character's Druid level and Circle.
// ============================================================================
import type { Feature } from '../../engine/types';

export const WILD_SHAPE_2014_ID = 'wild_shape';

/** The three single-form features this one replaced; a character saved with them is migrated on load (engine/multiclass.ts). */
export const WILD_SHAPE_2014_LEGACY_IDS = ['wild_shape_wolf', 'wild_shape_giant_spider', 'wild_shape_brown_bear'];

export const WILD_SHAPE_2014: Feature = {
  id: WILD_SHAPE_2014_ID, name: 'Wild Shape',
  description: 'Use your action to magically assume the shape of a beast you have seen before. You can stay in the shape for a number of hours equal to half your druid level, then you revert (earlier if you drop to 0 hit points, die or fall unconscious, or use a bonus action to leave it). You keep your alignment, personality, Intelligence, Wisdom and Charisma, and your class features and proficiencies; the beast\'s other statistics replace yours. The forms you can choose depend on your druid level: Challenge Rating 1/4 or lower with no flying or swimming speed at 2nd level, 1/2 or lower with no flying speed at 4th, and Challenge Rating 1 or lower at 8th. Some features raise these limits or let you change shape as a bonus action; flying and swimming are still limited by level.',
  source: { kind: 'class', refId: 'druid' }, level: 2, effects: [], actions: [], choices: [], passive: false, tags: ['transformation'],
  activation: { actionType: 'action', resourceCost: { resourceId: 'wild_shape_pool', quantity: 1 }, range: 'self', target: 'self', requiresSave: null, beastFormPicker: true },
};

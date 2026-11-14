// ============================================================================
// FILE: src/engine/ruleset/dnd5e.ts
// The D&D 5e ruleset's references to particular classes, features and spells: the one place in the engine that may name
// content (contract ARCH-006: entries belong in packs, not engine branches; ARCH-008: ruleset differences are narrow
// strategies). An engine rule that depends on one class or feature reads the name from here, so the dependency is declared
// once and visible. src/engine/__tests__/enginePurity.test.ts fails if another engine file names one of these.
// ============================================================================

/** Wild Shape: the classes whose level sets its duration, and the 2014 Druid whose level sets its form limits. */
export const WILD_SHAPE_CLASS_IDS: readonly string[] = ['druid', 'druid_2024'];
export const WILD_SHAPE_2014_CLASS_ID = 'druid';

/** Martial Arts: the feature that grants it, the class whose level scales its die, and the die by that level (highest first). */
export const MARTIAL_ARTS = {
  '2014': { featureId: 'martial_arts', classId: 'monk', dice: [[17, '1d10'], [11, '1d8'], [5, '1d6'], [1, '1d4']] as const },
  '2024': { featureId: 'monk_2024_martial_arts', classId: 'monk_2024', dice: [[17, '1d12'], [11, '1d10'], [5, '1d8'], [1, '1d6']] as const },
};
/** The feature whose holder has a ki save DC (Wisdom-based, separate from a spell save DC). */
export const KI_SAVE_FEATURE_ID = 'martial_arts';

/** The class whose level sets how many items can be infused at once. */
export const INFUSION_CLASS_ID = 'artificer';

/** Features that give advantage on Constitution saves to keep concentration. */
export const CONCENTRATION_ADVANTAGE_FEATURE_IDS: readonly string[] = ['feat_war_caster'];

/** Attunement: the base number of items, features that set a higher number (the first held wins), and features that add to it. */
export const ATTUNEMENT = {
  base: 3,
  setBy: [['magic_item_master', 6], ['magic_item_savant', 5], ['magic_item_adept', 4]] as const,
  addBy: [['feat_mystic_conflux', 1]] as const,
};

/** Features that make a character count as Large for weapons that care about size. */
export const COUNTS_AS_LARGE_FEATURE_IDS: readonly string[] = ['skeleton_giant_remains'];

/** The resource a monster spends on legendary actions. */
export const LEGENDARY_ACTIONS_RESOURCE_ID = 'legendary_actions';

/** Words that sort a spell's action card when the spell does not say what it is: checked in this order, name or description. */
export const SPELL_CARD_KEYWORDS = {
  healingName: ['heal', 'cure', 'restoration'],
  controlDescription: ['paralyz', 'charm', 'frighten', 'banish', 'sleep', 'incapacitat', 'restrain', 'stun'],
  damageDescription: ['damage'],
  damageName: ['bolt', 'blast', 'fire', 'lightning', 'frost', 'thunder'],
  buffName: ['bless', 'haste', 'shield', 'stoneskin', 'mage armor', 'invisib'],
  buffDescription: ['bonus', 'advantage'],
};

// ============================================================================
// FILE: src/content/subclasses/warlock.ts
// Undying
//
// Expanded spell lists: every patron below widens which spells you may pick
// when you learn a warlock spell (not an auto-granted bonus spell like
// Cleric domains or Paladin oaths) — there's no choice-filtering mechanism
// in the engine for "expand the selectable pool," so these stay descriptive
// for all patrons, old and new alike, regardless of spell-library coverage.
//
// Product Identity names (per this codebase's existing renaming of the
// former to plain "Black Tentacles" in spellBlackTentacles, see
// spells/level4.ts) — kept out of this file's original-wording descriptions
// for the same reason, even where source material used them.
// ============================================================================
import { ClassProgression } from '../../engine/types';

export type SubclassProgression = ClassProgression & { name: string };

export const fiendProgression: SubclassProgression = {
  classId: 'warlock', name: 'The Fiend', srd: true,
  entries: [
    { level: 1, hpDie: 8, choices: [], grants: [{ kind: 'feature', value: { id: 'dark_ones_blessing', name: "Dark One's Blessing", description: 'When you reduce a hostile creature to 0 HP, gain temporary HP equal to your CHA modifier + warlock level (min 1).', source: { kind: 'subclass', refId: 'fiend' }, level: 1, effects: [], actions: [], choices: [], passive: true } }] },
    { level: 6, hpDie: 8, choices: [], grants: [
      { kind: 'feature', value: { id: 'dark_ones_own_luck', name: "Dark One's Own Luck", description: 'Spend 1 use to add 1d10 to an ability check or saving throw.', source: { kind: 'subclass', refId: 'fiend' }, level: 6, effects: [], actions: [], choices: [], passive: false,
        activation: { actionType: 'free', resourceCost: { resourceId: 'dark_ones_own_luck_pool', quantity: 1 }, range: 'self', target: 'self', requiresSave: null },
        abilityEffects: [],
      } },
      { kind: 'resource', value: { resourceId: 'dark_ones_own_luck_pool', name: "Dark One's Own Luck", maximum: 1, recharge: 'short_rest' } },
    ] },
    { level: 10, hpDie: 8, choices: [], grants: [{ kind: 'feature', value: { id: 'fiendish_resilience', name: 'Fiendish Resilience', description: 'After a short or long rest, choose one damage type. Gain resistance to that type until you choose another. Which type is chosen isn\'t fixed ahead of time, so no resistance Effect is pre-applied here — track the current choice manually.', source: { kind: 'subclass', refId: 'fiend' }, level: 10, effects: [], actions: [], choices: [], passive: true } }] },
    { level: 14, hpDie: 8, choices: [], grants: [
      { kind: 'feature', value: { id: 'hurl_through_hell', name: 'Hurl Through Hell', description: 'When you hit a creature with an attack, banish it through lower planes until end of your next turn; it takes 10d10 psychic damage on return (no save). Modeled here as an immediate damage rider rather than an end-of-next-turn delayed effect — the engine has no delayed-trigger system — a disclosed simplification.', source: { kind: 'subclass', refId: 'fiend' }, level: 14, effects: [], actions: [], choices: [], passive: false,
        activation: { actionType: 'free', resourceCost: { resourceId: 'hurl_through_hell_pool', quantity: 1 }, range: '5 feet', target: 'single', requiresSave: null },
        abilityEffects: [{ type: 'damage', dice: '10d10', damageType: 'psychic' }],
      } },
      { kind: 'resource', value: { resourceId: 'hurl_through_hell_pool', name: 'Hurl Through Hell', maximum: 1, recharge: 'long_rest' } },
    ] },
  ],
};

export const WARLOCK_SUBCLASSES: SubclassProgression[] = [
  fiendProgression,
];

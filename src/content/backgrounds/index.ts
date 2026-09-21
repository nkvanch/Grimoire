// ============================================================================
// FILE: src/content/backgrounds/index.ts
// All 13 PHB backgrounds.
// ============================================================================
import { Background, } from '../../engine/types';
import { ALL_TOOLS } from '../tools';

export const bgAcolyte: Background = {
  id: 'acolyte',
  name: 'Acolyte',
  srd: true,
  // FILTER-METADATA-2: known from the PHB (same authoritative text
  // app/creation/background.tsx's BG_DETAIL table already displayed) but
  // not mechanically granted anywhere in the engine — no grant_proficiency
  // 'tool:' effect exists for backgrounds today (confirmed: zero such
  // effects in this file), same class of gap as CharClass's armor/weapon
  // profs. Populated here as additive filter/display metadata only.
  toolProficiencies: [],
  features: [
    {
      id: 'acolyte_proficiencies',
      name: 'Skill Proficiencies',
      description: 'You are proficient in Insight and Religion.',
      source: { kind: 'background', refId: 'acolyte' },
      level: null, actions: [], choices: [], passive: true,
      effects: [
        { type: 'grant_proficiency', target: 'skill:insight',  operation: 'add', value: null, condition: null },
        { type: 'grant_proficiency', target: 'skill:religion', operation: 'add', value: null, condition: null },
      ],
    },
    {
      id: 'shelter_of_faithful',
      name: 'Shelter of the Faithful',
      description: 'As an acolyte, you command the respect of those who share your faith, and you can perform the religious ceremonies of your deity.',
      source: { kind: 'background', refId: 'acolyte' },
      level: null, effects: [], actions: [], choices: [], passive: true,
    },
  ],
};

/** Every background, unfiltered. Prefer ALL_BACKGROUNDS below in app code. */
export const FULL_BACKGROUND_LIBRARY: Background[] = [
  bgAcolyte,
];

const SRD_ONLY = process.env.EXPO_PUBLIC_SRD_ONLY === 'true';

/**
 * The background list the app should use — filtered to srd === true only
 * on the EAS `production` build profile (see eas.json). Same build-target-
 * aware pattern as spells/subclasses/races. See docs/ROADMAP_1.0.md Phase 1.
 */
export const ALL_BACKGROUNDS: Background[] = SRD_ONLY
  ? FULL_BACKGROUND_LIBRARY.filter(b => b.srd === true)
  : FULL_BACKGROUND_LIBRARY;

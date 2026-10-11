// ============================================================================
// FILE: src/content/beastforms/index.ts
// A small curated set of SRD-legal low/mid-CR beasts for Wild Shape.
// v1 scope per docs/ROADMAP_1.0.md: no builder, no homebrew forms — a
// hand-picked list covering low-level Circle of the Land/Moon play. All of
// these are in the SRD 5.1 monster list, so there's no legal issue with the
// stat blocks themselves (unlike spell names, monster stat blocks in the SRD
// are fair game to reproduce under CC-BY-4.0, with attribution on the About
// screen — see ROADMAP_1.0.md Step 1.5).
//
// The beasts are generated from the SRD 5.1 text (scripts/gen-beastforms-2014.js). The four elementals below are still hand-written
// and are marked as such.
// ============================================================================
import { BeastForm } from '../../engine/types';
import { BEAST_FORMS_2024 } from './beastforms2024Data';
import { BEAST_FORMS_2014 } from './beastforms2014Data';

// The 2014 Beast forms are generated from the SRD 5.1 stat blocks (beastforms2014Data.ts). These three keep their names for the
// code and tests that referred to them when they were the only hand-written forms.
const byId = (id: string): BeastForm => BEAST_FORMS_2014.find(f => f.id === id)!;
export const formWolf: BeastForm = byId('wolf');
export const formGiantSpider: BeastForm = byId('giant_spider');
export const formBrownBear: BeastForm = byId('brown_bear');

// Elemental forms, for the features that let a Druid take one (Elemental Wild Shape).
// Same "written from memory, verify before shipping" caveat as the rest of
// this file — CR 5 SRD elementals, not cross-checked against the live text.
export const formAirElemental: BeastForm = {
  id: 'air_elemental', name: 'Air Elemental', challengeRating: 5, creatureType: 'elemental', size: 'Large',
  stats: { str: 14, dex: 20, con: 14, int: 6, wis: 10, cha: 6 },
  ac: 15, hp: 90, speed: 0, flySpeed: 90,
  traits: [
    'Air Form — can move through a space as narrow as 1 inch without squeezing',
    'Whirlwind (action, 1/turn) — creatures in its space take bludgeoning damage and may be flung 20 feet away; not automated, resolve manually',
  ],
  attacks: [
    { name: 'Slam', effect: { type: 'damage', dice: '2d8+5', damageType: 'bludgeoning' } },
  ],
  // Rules-engine blocker RE-AUDIT closure (2A/2B, corrected): the real SRD/MM
  // Air Elemental stat block lists BOTH "Damage Immunities: poison" AND
  // (separately) "Condition Immunities: ... poisoned ...". This engine's
  // Round 3 comment claimed only the CONDITION was real and that the
  // DAMAGE immunity didn't exist — that was a genuine mistake, not a
  // deliberate correct call; every SRD 5.1 elemental (Air/Earth/Fire/Water)
  // carries the same "Damage Immunities: poison" line (Fire's block adds
  // fire on top of it), independent of the shared "poisoned" condition
  // immunity every elemental also has. damageImmunities only models damage
  // TYPES; condition immunity has no representation in this engine and
  // remains out of scope. The shared elemental resistance to bludgeoning/
  // piercing/slashing from NONMAGICAL attacks is real and RAW-significant
  // but qualified — see nonmagicalPhysicalResistance's own doc comment
  // (types.ts) for why it's a separate flag, resolved per-hit, not folded
  // into damageResistances (which means "always, unconditionally").
  damageResistances: ['lightning', 'thunder'],
  damageImmunities: ['poison'],
  nonmagicalPhysicalResistance: true,
};

export const formEarthElemental: BeastForm = {
  id: 'earth_elemental', name: 'Earth Elemental', challengeRating: 5, creatureType: 'elemental', size: 'Large',
  stats: { str: 20, dex: 8, con: 20, int: 5, wis: 10, cha: 5 },
  ac: 17, hp: 126, speed: 30,
  traits: [
    'Burrow speed 30 ft — no dedicated burrowSpeed field in the engine, tracked as a trait note',
    'Earth Glide — can burrow through nonmagical, unworked earth and stone without disturbing it',
    'Siege Monster — deals double damage to objects and structures',
  ],
  attacks: [
    { name: 'Slam', effect: { type: 'damage', dice: '2d8+5', damageType: 'bludgeoning' } },
  ],
  // Poison damage immunity: same correction as Air Elemental above — the
  // real SRD/MM stat block gives Earth Elemental its own "Damage
  // Immunities: poison" line, distinct from the shared "poisoned" condition
  // immunity. Nonmagical B/P/S: see nonmagicalPhysicalResistance's own doc
  // comment.
  damageVulnerabilities: ['thunder'],
  damageImmunities: ['poison'],
  nonmagicalPhysicalResistance: true,
};

export const formFireElemental: BeastForm = {
  id: 'fire_elemental', name: 'Fire Elemental', challengeRating: 5, creatureType: 'elemental', size: 'Large',
  stats: { str: 10, dex: 17, con: 16, int: 6, wis: 10, cha: 7 },
  ac: 13, hp: 102, speed: 50,
  traits: [
    'Fire Form — a creature that touches it or hits it with a melee attack while within 5 feet takes fire damage; not automated, resolve manually',
    'Illumination — sheds bright light in a 30-foot radius and dim light for an additional 30 feet',
    'Water Susceptibility — takes damage and disadvantage on attacks when submerged or splashed with water',
  ],
  attacks: [
    { name: 'Touch', effect: { type: 'damage', dice: '2d6+3', damageType: 'fire' } },
  ],
  // Fire Elemental's Damage Immunities entry is fire + poison — every SRD
  // elemental (Air/Earth/Fire/Water) has poison damage immunity; Fire's is
  // the only one that ALSO adds fire on top of it, unchanged by this
  // closure; re-verified, not duplicated.
  // Water Susceptibility above is a conditional (submerged/splashed) rider,
  // not an unconditional vulnerability — deliberately NOT represented as
  // damageVulnerabilities, which would incorrectly apply it to every hit.
  damageImmunities: ['fire', 'poison'],
  nonmagicalPhysicalResistance: true,
};

export const formWaterElemental: BeastForm = {
  id: 'water_elemental', name: 'Water Elemental', challengeRating: 5, creatureType: 'elemental', size: 'Large',
  stats: { str: 18, dex: 14, con: 18, int: 5, wis: 10, cha: 8 },
  ac: 14, hp: 114, speed: 30, swimSpeed: 90,
  traits: [
    'Water Form — can enter a hostile creature\'s space and stop there',
    'Freeze — if it takes cold damage, it partially freezes and its speed is reduced by 20 feet until the end of its next turn',
  ],
  attacks: [
    { name: 'Slam', effect: { type: 'damage', dice: '2d8+4', damageType: 'bludgeoning' } },
  ],
  // Poison damage immunity: same correction as Air Elemental above — the
  // real SRD/MM stat block gives Water Elemental its own "Damage
  // Immunities: poison" line, distinct from the shared "poisoned" condition
  // immunity. Nonmagical B/P/S: see nonmagicalPhysicalResistance's own doc
  // comment.
  damageResistances: ['acid', 'fire'],
  damageImmunities: ['poison'],
  nonmagicalPhysicalResistance: true,
};

export const ALL_BEAST_FORMS: BeastForm[] = [
  // Every SRD 5.1 Beast of Challenge Rating 6 or lower (swarms excluded), for the 2014 Druid's Wild Shape picker.
  ...BEAST_FORMS_2014,
  formAirElemental,
  formEarthElemental,
  formFireElemental,
  formWaterElemental,
  // The SRD 5.2.1 Beasts of Challenge Rating 1 or lower, for the 2024 Druid's Known Forms (ids end in _2024).
  ...BEAST_FORMS_2024,
];

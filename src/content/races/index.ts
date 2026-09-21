// ============================================================================
// FILE: src/content/races/index.ts
// All PHB races expressed as Feature/Effect arrays.
// ============================================================================
import { Race, AncestryOption, RACE_CHOICE_PREFIX, ChoiceOption, Feature, } from '../../engine/types';

/** "Elf Weapon Training" — proficiency with longsword/shortsword/shortbow/
 * longbow, granted by most non-Drow elf subraces (High Elf, Wood Elf, and
 * several sourcebook variants below all share this exact trait verbatim). */
function elfWeaponTraining(refId: string): Feature {
  return {
    id: `${refId}_weapon_training`, name: 'Elf Weapon Training',
    description: 'You have proficiency with the longsword, shortsword, shortbow, and longbow.',
    source: { kind: 'race', refId }, level: null, actions: [], choices: [], passive: true,
    effects: [
      { type: 'grant_proficiency', target: 'weapon:longsword', operation: 'add', value: null, condition: null },
      { type: 'grant_proficiency', target: 'weapon:shortsword', operation: 'add', value: null, condition: null },
      { type: 'grant_proficiency', target: 'weapon:shortbow', operation: 'add', value: null, condition: null },
      { type: 'grant_proficiency', target: 'weapon:longbow', operation: 'add', value: null, condition: null },
    ],
  };
}

const ALL_SKILL_OPTIONS: ChoiceOption[] = [
  'athletics', 'acrobatics', 'sleight_of_hand', 'stealth', 'arcana', 'history',
  'investigation', 'nature', 'religion', 'animal_handling', 'insight', 'medicine',
  'perception', 'survival', 'deception', 'intimidation', 'performance', 'persuasion',
].map(s => ({ id: s, label: s, value: s }));

export const raceHuman: Race = {
  id: 'human',
  name: 'Human',
  srd: true,
  // CHOICE-EXPANSION-2: "one extra language of your choice" is a genuine
  // player choice, not a fixed grant (unlike e.g. Dwarvish for a Dwarf) —
  // migrated from the purely-descriptive human_extra_language Feature below
  // (kept for its flavor text/display) into a real, resolvable choice.
  pendingChoices: [
    {
      id: `${RACE_CHOICE_PREFIX}human_extra_language`,
      prompt: 'Choose one extra language.',
      kind: 'language', count: 1, pool: 'all',
      grants: [], required: true, resolved: false,
    },
  ],
  features: [
    {
      id: 'human_asi',
      name: 'Ability Score Increase',
      description: 'Your ability scores each increase by 1.',
      source: { kind: 'race', refId: 'human' },
      level: null, actions: [], choices: [], passive: true,
      effects: [
        { type: 'stat_modifier', target: 'str', operation: 'add', value: 1, condition: null },
        { type: 'stat_modifier', target: 'dex', operation: 'add', value: 1, condition: null },
        { type: 'stat_modifier', target: 'con', operation: 'add', value: 1, condition: null },
        { type: 'stat_modifier', target: 'int', operation: 'add', value: 1, condition: null },
        { type: 'stat_modifier', target: 'wis', operation: 'add', value: 1, condition: null },
        { type: 'stat_modifier', target: 'cha', operation: 'add', value: 1, condition: null },
      ],
    },
    {
      id: 'human_extra_language',
      name: 'Languages',
      description: 'You can speak, read, and write Common and one extra language of your choice.',
      source: { kind: 'race', refId: 'human' },
      level: null, effects: [], actions: [], choices: [], passive: true,
    },
  ],
  // PHB optional Variant Human rule — an alternate, not mandatory, so plain
  // Human stays fully selectable (subracesOptional).
  subracesOptional: true,
  subraces: [
    {
      id: 'variant_human', name: 'Variant Human', parentId: 'human', srd: true,
      replacesBaseFeatureIds: ['human_asi'],
      flexibleAsi: {
        prompt: 'Two different ability scores of your choice each increase by 1.',
        mode: { kind: 'two_distinct_plus_one' },
      },
      pendingChoices: [
        {
          id: `${RACE_CHOICE_PREFIX}variant_human_skill`,
          prompt: 'Choose one skill to gain proficiency in.',
          kind: 'skill', count: 1, pool: ALL_SKILL_OPTIONS,
          grants: [], required: true, resolved: false,
        },
      ],
      features: [
        {
          id: 'variant_human_feat_note', name: 'Feat',
          description: 'You gain one feat of your choice. Take it on the Feats screen during creation (enable the "Feat at 1st level" campaign rule if it isn\'t already, so that screen is reachable).',
          source: { kind: 'race', refId: 'variant_human' },
          level: null, effects: [], actions: [], choices: [], passive: true,
        },
      ],
    },
  ],
};

export const raceElf: Race = {
  id: 'elf',
  name: 'Elf',
  srd: true,
  features: [
    {
      id: 'elf_asi',
      name: 'Ability Score Increase',
      description: 'Your Dexterity score increases by 2 and your Intelligence score increases by 1.',
      source: { kind: 'race', refId: 'elf' },
      level: null, actions: [], choices: [], passive: true,
      effects: [
        { type: 'stat_modifier', target: 'dex', operation: 'add', value: 2, condition: null },
        { type: 'stat_modifier', target: 'int', operation: 'add', value: 1, condition: null },
      ],
    },
    {
      id: 'elf_darkvision',
      name: 'Darkvision',
      description: 'You can see in dim light within 60 feet as if it were bright light, and in darkness as if it were dim light.',
      source: { kind: 'race', refId: 'elf' },
      level: null, effects: [{ type: 'grant_sense', target: 'sense', operation: 'add', value: null, condition: null, senseType: 'darkvision', senseRange: 60 }], actions: [], choices: [], passive: true,
    },
    {
      id: 'elf_fey_ancestry',
      name: 'Fey Ancestry',
      description: 'You have advantage on saving throws against being charmed, and magic can\'t put you to sleep.',
      source: { kind: 'race', refId: 'elf' },
      level: null, actions: [], choices: [], passive: true,
      effects: [
        { type: 'grant_immunity', target: 'sleep_magic', operation: 'immunity', value: null, condition: null },
      ],
    },
    {
      id: 'elf_keen_senses',
      name: 'Keen Senses',
      description: 'You have proficiency in the Perception skill.',
      source: { kind: 'race', refId: 'elf' },
      level: null, actions: [], choices: [], passive: true,
      effects: [
        { type: 'grant_proficiency', target: 'skill:perception', operation: 'add', value: null, condition: null },
      ],
    },
    {
      id: 'elf_trance',
      name: 'Trance',
      description: 'Elves don\'t need to sleep. Instead, they meditate deeply for 4 hours a day.',
      source: { kind: 'race', refId: 'elf' },
      level: null, effects: [], actions: [], choices: [], passive: true,
    },
  ],
  subraces: [
    {
      id: 'high_elf', name: 'High Elf', parentId: 'elf', srd: true,
      // CHOICE-EXPANSION-2: real choice, migrated alongside the flavor Feature below.
      pendingChoices: [
        {
          id: `${RACE_CHOICE_PREFIX}high_elf_extra_language`,
          prompt: 'Choose one additional language.',
          kind: 'language', count: 1, pool: 'all',
          grants: [], required: true, resolved: false,
        },
      ],
      features: [
        {
          id: 'high_elf_asi',
          name: 'Ability Score Increase',
          description: 'Your Intelligence score increases by 1.',
          source: { kind: 'race', refId: 'high_elf' },
          level: null, actions: [], choices: [], passive: true,
          effects: [{ type: 'stat_modifier', target: 'int', operation: 'add', value: 1, condition: null }],
        },
        {
          id: 'high_elf_cantrip',
          name: 'Cantrip',
          description: 'You know one cantrip of your choice from the wizard spell list. Intelligence is your spellcasting ability for it.',
          source: { kind: 'race', refId: 'high_elf' },
          level: null, effects: [], actions: [], choices: [], passive: true,
        },
        elfWeaponTraining('high_elf'),
        {
          id: 'high_elf_extra_language', name: 'Extra Language',
          description: 'You can read, speak, and write one additional language of your choice.',
          source: { kind: 'race', refId: 'high_elf' }, level: null, effects: [], actions: [], choices: [], passive: true,
        },
      ],
    },
    {
      id: 'wood_elf', name: 'Wood Elf', parentId: 'elf', srd: true,
      features: [
        {
          id: 'wood_elf_asi',
          name: 'Ability Score Increase',
          description: 'Your Wisdom score increases by 1.',
          source: { kind: 'race', refId: 'wood_elf' },
          level: null, actions: [], choices: [], passive: true,
          effects: [{ type: 'stat_modifier', target: 'wis', operation: 'add', value: 1, condition: null }],
        },
        {
          id: 'wood_elf_speed',
          name: 'Fleet of Foot',
          description: 'Your base walking speed increases to 35 feet.',
          source: { kind: 'race', refId: 'wood_elf' },
          level: null, actions: [], choices: [], passive: true,
          effects: [{ type: 'stat_modifier', target: 'speed', operation: 'set', value: 35, condition: null }],
        },
        {
          id: 'mask_of_the_wild',
          name: 'Mask of the Wild',
          description: 'You can attempt to hide even when you are only lightly obscured by foliage, heavy rain, falling snow, mist, and other natural phenomena.',
          source: { kind: 'race', refId: 'wood_elf' },
          level: null, effects: [], actions: [], choices: [], passive: true,
        },
        elfWeaponTraining('wood_elf'),
      ],
    },
    {
      id: 'drow', name: 'Dark Elf (Drow)', parentId: 'elf', srd: true,
      features: [
        {
          id: 'drow_asi',
          name: 'Ability Score Increase',
          description: 'Your Charisma score increases by 1.',
          source: { kind: 'race', refId: 'drow' },
          level: null, actions: [], choices: [], passive: true,
          effects: [{ type: 'stat_modifier', target: 'cha', operation: 'add', value: 1, condition: null }],
        },
        {
          id: 'drow_superior_darkvision',
          name: 'Superior Darkvision',
          description: 'Your darkvision has a range of 120 feet, instead of 60.',
          source: { kind: 'race', refId: 'drow' },
          level: null, actions: [], choices: [], passive: true,
          // Aggregated with base Elf's 60-ft darkvision by keeping the
          // longest range per sense type (see pipeline.ts's senses dedup) —
          // this 120ft entry naturally wins without needing to remove or
          // override the base race's grant_sense effect.
          effects: [{ type: 'grant_sense', target: 'sense', operation: 'add', value: null, condition: null, senseType: 'darkvision', senseRange: 120 }],
        },
        {
          id: 'sunlight_sensitivity',
          name: 'Sunlight Sensitivity',
          description: 'You have disadvantage on attack rolls and Perception checks that rely on sight when you, the target, or whatever you are trying to perceive is in direct sunlight.',
          source: { kind: 'race', refId: 'drow' },
          level: null, effects: [], actions: [], choices: [], passive: true,
        },
        {
          id: 'drow_magic',
          name: 'Drow Magic',
          description: 'You know the Dancing Lights cantrip. Charisma is your spellcasting ability for it. At 3rd level you can cast Faerie Fire once with this trait, and at 5th level Darkness once, each recharging on a long rest — this app doesn\'t yet support level-gated racial features, so only the 1st-level cantrip is granted for real; the two spells are reference-only.',
          source: { kind: 'race', refId: 'drow' },
          level: null, actions: [], choices: [], passive: true,
          effects: [
            { type: 'grant_spell', target: 'spell', operation: 'add', value: null, condition: null, cantripIds: ['dancing_lights'], spellcastingAbility: 'cha' },
          ],
        },
        {
          id: 'drow_weapon_training',
          name: 'Drow Weapon Training',
          description: 'You have proficiency with rapiers, shortswords, and hand crossbows.',
          source: { kind: 'race', refId: 'drow' },
          level: null, actions: [], choices: [], passive: true,
          effects: [
            { type: 'grant_proficiency', target: 'weapon:rapier', operation: 'add', value: null, condition: null },
            { type: 'grant_proficiency', target: 'weapon:shortsword', operation: 'add', value: null, condition: null },
            { type: 'grant_proficiency', target: 'weapon:hand_crossbow', operation: 'add', value: null, condition: null },
          ],
        },
      ],
    },
  ],
};

export const raceDwarf: Race = {
  id: 'dwarf',
  name: 'Dwarf',
  srd: true,
  // CHOICE-EXPANSION-2: restricted to exactly the 3 named tools per RAW —
  // never broadened to 'all' artisan's tools. Migrated alongside the flavor
  // dwarf_tool_proficiency Feature below.
  pendingChoices: [
    {
      id: `${RACE_CHOICE_PREFIX}dwarf_tool_proficiency`,
      prompt: 'Choose one: smith\'s tools, brewer\'s supplies, or mason\'s tools.',
      kind: 'tool', count: 1,
      pool: [
        { id: 'smiths_tools', label: 'Smith\'s Tools', value: 'smiths_tools' },
        { id: 'brewers_supplies', label: 'Brewer\'s Supplies', value: 'brewers_supplies' },
        { id: 'masons_tools', label: 'Mason\'s Tools', value: 'masons_tools' },
      ],
      grants: [], required: true, resolved: false,
    },
  ],
  features: [
    {
      id: 'dwarf_asi',
      name: 'Ability Score Increase',
      description: 'Your Constitution score increases by 2.',
      source: { kind: 'race', refId: 'dwarf' },
      level: null, actions: [], choices: [], passive: true,
      effects: [
        { type: 'stat_modifier', target: 'con', operation: 'add', value: 2, condition: null },
      ],
    },
    {
      id: 'dwarf_speed',
      name: 'Speed',
      description: 'Your base walking speed is 25 feet. Your speed is not reduced by wearing heavy armor.',
      source: { kind: 'race', refId: 'dwarf' },
      level: null, actions: [], choices: [], passive: true,
      effects: [
        { type: 'stat_modifier', target: 'speed', operation: 'set', value: 25, condition: null },
      ],
    },
    {
      id: 'dwarf_darkvision',
      name: 'Darkvision',
      description: 'You can see in dim light within 60 feet as if it were bright light, and in darkness as if it were dim light.',
      source: { kind: 'race', refId: 'dwarf' },
      level: null, effects: [{ type: 'grant_sense', target: 'sense', operation: 'add', value: null, condition: null, senseType: 'darkvision', senseRange: 60 }], actions: [], choices: [], passive: true,
    },
    {
      id: 'dwarf_resilience',
      name: 'Dwarven Resilience',
      description: 'You have advantage on saving throws against poison, and you have resistance against poison damage.',
      source: { kind: 'race', refId: 'dwarf' },
      level: null, actions: [], choices: [], passive: true,
      effects: [
        { type: 'grant_resistance', target: 'poison', operation: 'resistance', value: null, condition: null },
      ],
    },
    {
      id: 'dwarf_stonecunning',
      name: 'Stonecunning',
      description: 'Whenever you make a History check related to the origin of stonework, you are considered proficient in the History skill and add double your proficiency bonus.',
      source: { kind: 'race', refId: 'dwarf' },
      level: null, effects: [], actions: [], choices: [], passive: true,
    },
    {
      id: 'dwarf_tool_proficiency',
      name: 'Tool Proficiency',
      description: 'You gain proficiency with the artisan\'s tools of your choice: smith\'s tools, brewer\'s supplies, or mason\'s tools. (No tool-choice-of-N resolution screen exists yet — same gap as feat choices — so this isn\'t applied mechanically.)',
      source: { kind: 'race', refId: 'dwarf' },
      level: null, effects: [], actions: [], choices: [], passive: true,
    },
    {
      id: 'dwarf_combat_training',
      name: 'Dwarven Combat Training',
      description: 'You have proficiency with the battleaxe, handaxe, light hammer, and warhammer.',
      source: { kind: 'race', refId: 'dwarf' },
      level: null, actions: [], choices: [], passive: true,
      effects: [
        { type: 'grant_proficiency', target: 'weapon:battleaxe', operation: 'add', value: null, condition: null },
        { type: 'grant_proficiency', target: 'weapon:handaxe', operation: 'add', value: null, condition: null },
        { type: 'grant_proficiency', target: 'weapon:light_hammer', operation: 'add', value: null, condition: null },
        { type: 'grant_proficiency', target: 'weapon:warhammer', operation: 'add', value: null, condition: null },
      ],
    },
  ],
  subraces: [
    {
      id: 'hill_dwarf', name: 'Hill Dwarf', parentId: 'dwarf', srd: true,
      features: [
        {
          id: 'hill_dwarf_asi',
          name: 'Ability Score Increase',
          description: 'Your Wisdom score increases by 1.',
          source: { kind: 'race', refId: 'hill_dwarf' },
          level: null, actions: [], choices: [], passive: true,
          effects: [{ type: 'stat_modifier', target: 'wis', operation: 'add', value: 1, condition: null }],
        },
        {
          id: 'dwarven_toughness',
          name: 'Dwarven Toughness',
          description: 'Your hit point maximum increases by 1, and it increases by 1 every time you gain a level.',
          source: { kind: 'race', refId: 'hill_dwarf' },
          level: null, effects: [], actions: [], choices: [], passive: true,
        },
      ],
    },
    {
      id: 'mountain_dwarf', name: 'Mountain Dwarf', parentId: 'dwarf', srd: true,
      features: [
        {
          id: 'mountain_dwarf_asi',
          name: 'Ability Score Increase',
          description: 'Your Strength score increases by 2.',
          source: { kind: 'race', refId: 'mountain_dwarf' },
          level: null, actions: [], choices: [], passive: true,
          effects: [{ type: 'stat_modifier', target: 'str', operation: 'add', value: 2, condition: null }],
        },
        {
          id: 'dwarven_armor_training',
          name: 'Dwarven Armor Training',
          description: 'You have proficiency with light and medium armor.',
          source: { kind: 'race', refId: 'mountain_dwarf' },
          level: null, actions: [], choices: [], passive: true,
          effects: [
            { type: 'grant_proficiency', target: 'armor:light', operation: 'add', value: null, condition: null },
            { type: 'grant_proficiency', target: 'armor:medium', operation: 'add', value: null, condition: null },
          ],
        },
      ],
    },
  ],
};

export const raceHalfling: Race = {
  id: 'halfling',
  name: 'Halfling',
  srd: true,
  features: [
    {
      id: 'halfling_asi',
      name: 'Ability Score Increase',
      description: 'Your Dexterity score increases by 2.',
      source: { kind: 'race', refId: 'halfling' },
      level: null, actions: [], choices: [], passive: true,
      effects: [
        { type: 'stat_modifier', target: 'dex', operation: 'add', value: 2, condition: null },
      ],
    },
    {
      id: 'halfling_speed',
      name: 'Speed',
      description: 'Your base walking speed is 25 feet.',
      source: { kind: 'race', refId: 'halfling' },
      level: null, actions: [], choices: [], passive: true,
      effects: [
        { type: 'stat_modifier', target: 'speed', operation: 'set', value: 25, condition: null },
      ],
    },
    {
      id: 'halfling_lucky',
      name: 'Lucky',
      description: 'When you roll a 1 on the d20 for an attack roll, ability check, or saving throw, you can reroll the die and must use the new roll.',
      source: { kind: 'race', refId: 'halfling' },
      level: null, effects: [], actions: [], choices: [], passive: true,
    },
    {
      id: 'halfling_brave',
      name: 'Brave',
      description: 'You have advantage on saving throws against being frightened.',
      source: { kind: 'race', refId: 'halfling' },
      level: null, effects: [], actions: [], choices: [], passive: true,
    },
    {
      id: 'halfling_nimbleness',
      name: 'Halfling Nimbleness',
      description: 'You can move through the space of any creature that is of a size larger than yours.',
      source: { kind: 'race', refId: 'halfling' },
      level: null, effects: [], actions: [], choices: [], passive: true,
    },
  ],
  subraces: [
    {
      id: 'lightfoot_halfling', name: 'Lightfoot Halfling', parentId: 'halfling', srd: true,
      features: [
        {
          id: 'lightfoot_asi',
          name: 'Ability Score Increase',
          description: 'Your Charisma score increases by 1.',
          source: { kind: 'race', refId: 'lightfoot_halfling' },
          level: null, actions: [], choices: [], passive: true,
          effects: [{ type: 'stat_modifier', target: 'cha', operation: 'add', value: 1, condition: null }],
        },
        {
          id: 'naturally_stealthy',
          name: 'Naturally Stealthy',
          description: 'You can attempt to hide even when you are obscured only by a creature that is at least one size larger than you.',
          source: { kind: 'race', refId: 'lightfoot_halfling' },
          level: null, effects: [], actions: [], choices: [], passive: true,
        },
      ],
    },
    {
      id: 'stout_halfling', name: 'Stout Halfling', parentId: 'halfling', srd: true,
      features: [
        {
          id: 'stout_asi',
          name: 'Ability Score Increase',
          description: 'Your Constitution score increases by 1.',
          source: { kind: 'race', refId: 'stout_halfling' },
          level: null, actions: [], choices: [], passive: true,
          effects: [{ type: 'stat_modifier', target: 'con', operation: 'add', value: 1, condition: null }],
        },
        {
          id: 'stout_resilience',
          name: 'Stout Resilience',
          description: 'You have advantage on saving throws against poison, and you have resistance against poison damage.',
          source: { kind: 'race', refId: 'stout_halfling' },
          level: null, actions: [], choices: [], passive: true,
          effects: [{ type: 'grant_resistance', target: 'poison', operation: 'resistance', value: null, condition: null }],
        },
      ],
    },
  ],
};

function draconicAncestryOption(
  id: string, name: string, damageType: string,
  shape: '5 by 30 ft. line' | '15 ft. cone', saveAbility: 'DEX' | 'CON',
): AncestryOption {
  return {
    id, name, blurb: `${damageType[0].toUpperCase()}${damageType.slice(1)} damage, ${shape} breath weapon, ${saveAbility} save.`,
    feature: {
      id: `dragonborn_breath_${id}`,
      name: 'Breath Weapon',
      description: `You can use your action to exhale ${damageType} energy in a ${shape} (${saveAbility} save, DC = 8 + proficiency bonus + Constitution modifier). Each creature in the area takes 2d6 ${damageType} damage on a failed save, half as much on a success — this increases to 3d6 at 6th level, 4d6 at 11th, and 5d6 at 16th. You also have resistance to ${damageType} damage. Once used, the breath weapon can't be used again until you finish a short or long rest.`,
      source: { kind: 'race', refId: 'dragonborn' },
      level: null, actions: [], choices: [], passive: false,
      effects: [
        { type: 'grant_resistance', target: damageType, operation: 'resistance', value: null, condition: null },
      ],
      activation: {
        actionType: 'action',
        resourceCost: { resourceId: 'dragonborn_breath_pool', quantity: 1 },
        range: shape,
        target: 'area',
        requiresSave: null,
      },
      abilityEffects: [
        { type: 'damage', dice: '2d6', damageType, saveOnSuccess: 'half' },
      ],
    },
  };
}

export const raceDragonborn: Race = {
  id: 'dragonborn',
  name: 'Dragonborn',
  srd: true,
  // PHB Dragonborn is already a complete race — Draconblood/Ravenite below
  // Dwarf/Halfling/Gnome, where every subrace is itself required).
  subracesOptional: true,
  resources: [
    { resourceId: 'dragonborn_breath_pool', name: 'Breath Weapon', maximum: 1, recharge: 'short_rest' },
  ],
  ancestryChoice: {
    prompt: 'Choose a type of dragon. This determines the damage type and shape of your Breath Weapon, and the type of damage you resist.',
    options: [
      draconicAncestryOption('black', 'Black', 'acid', '5 by 30 ft. line', 'DEX'),
      draconicAncestryOption('blue', 'Blue', 'lightning', '5 by 30 ft. line', 'DEX'),
      draconicAncestryOption('brass', 'Brass', 'fire', '5 by 30 ft. line', 'DEX'),
      draconicAncestryOption('bronze', 'Bronze', 'lightning', '5 by 30 ft. line', 'DEX'),
      draconicAncestryOption('copper', 'Copper', 'acid', '5 by 30 ft. line', 'DEX'),
      draconicAncestryOption('gold', 'Gold', 'fire', '15 ft. cone', 'DEX'),
      draconicAncestryOption('green', 'Green', 'poison', '15 ft. cone', 'CON'),
      draconicAncestryOption('red', 'Red', 'fire', '15 ft. cone', 'DEX'),
      draconicAncestryOption('silver', 'Silver', 'cold', '15 ft. cone', 'CON'),
      draconicAncestryOption('white', 'White', 'cold', '15 ft. cone', 'CON'),
    ],
  },
  features: [
    {
      id: 'dragonborn_asi',
      name: 'Ability Score Increase',
      description: 'Your Strength score increases by 2 and your Charisma score increases by 1.',
      source: { kind: 'race', refId: 'dragonborn' },
      level: null, actions: [], choices: [], passive: true,
      effects: [
        { type: 'stat_modifier', target: 'str', operation: 'add', value: 2, condition: null },
        { type: 'stat_modifier', target: 'cha', operation: 'add', value: 1, condition: null },
      ],
    },
  ],
  // Ability Score Increase (and, per the book, "Damage Resistance", which in
  // this app's model lives inside the ancestryChoice Feature rather than a
  // separate base-race Feature; the ancestryChoice's resistance/breath
  // weapon are unaffected and still chosen normally alongside either
  // subrace).
  subraces: [
  ],
};

export const raceGnome: Race = {
  id: 'gnome',
  name: 'Gnome',
  srd: true,
  features: [
    {
      id: 'gnome_asi',
      name: 'Ability Score Increase',
      description: 'Your Intelligence score increases by 2.',
      source: { kind: 'race', refId: 'gnome' },
      level: null, actions: [], choices: [], passive: true,
      effects: [
        { type: 'stat_modifier', target: 'int', operation: 'add', value: 2, condition: null },
      ],
    },
    {
      id: 'gnome_speed',
      name: 'Speed',
      description: 'Your base walking speed is 25 feet.',
      source: { kind: 'race', refId: 'gnome' },
      level: null, actions: [], choices: [], passive: true,
      effects: [
        { type: 'stat_modifier', target: 'speed', operation: 'set', value: 25, condition: null },
      ],
    },
    {
      id: 'gnome_darkvision',
      name: 'Darkvision',
      description: 'You can see in dim light within 60 feet as if it were bright light, and in darkness as if it were dim light.',
      source: { kind: 'race', refId: 'gnome' },
      level: null, effects: [{ type: 'grant_sense', target: 'sense', operation: 'add', value: null, condition: null, senseType: 'darkvision', senseRange: 60 }], actions: [], choices: [], passive: true,
    },
    {
      id: 'gnome_cunning',
      name: 'Gnome Cunning',
      description: 'You have advantage on all Intelligence, Wisdom, and Charisma saving throws against magic.',
      source: { kind: 'race', refId: 'gnome' },
      level: null, effects: [], actions: [], choices: [], passive: true,
    },
  ],
  subraces: [
    {
      id: 'forest_gnome', name: 'Forest Gnome', parentId: 'gnome', srd: true,
      features: [
        {
          id: 'forest_gnome_asi', name: 'Ability Score Increase',
          description: 'Your Dexterity score increases by 1.',
          source: { kind: 'race', refId: 'forest_gnome' }, level: null, actions: [], choices: [], passive: true,
          effects: [{ type: 'stat_modifier', target: 'dex', operation: 'add', value: 1, condition: null }],
        },
        {
          id: 'natural_illusionist', name: 'Natural Illusionist',
          description: 'You know the Minor Illusion cantrip. Intelligence is your spellcasting ability for it.',
          source: { kind: 'race', refId: 'forest_gnome' }, level: null, actions: [], choices: [], passive: true,
          effects: [
            { type: 'grant_spell', target: 'spell', operation: 'add', value: null, condition: null, cantripIds: ['minor_illusion'], spellcastingAbility: 'int' },
          ],
        },
        {
          id: 'speak_with_small_beasts', name: 'Speak with Small Beasts',
          description: 'Through sound and gestures, you can communicate simple ideas with Small or smaller beasts.',
          source: { kind: 'race', refId: 'forest_gnome' }, level: null, effects: [], actions: [], choices: [], passive: true,
        },
      ],
    },
    {
      id: 'rock_gnome', name: 'Rock Gnome', parentId: 'gnome', srd: true,
      features: [
        {
          id: 'rock_gnome_asi', name: 'Ability Score Increase',
          description: 'Your Constitution score increases by 1.',
          source: { kind: 'race', refId: 'rock_gnome' }, level: null, actions: [], choices: [], passive: true,
          effects: [{ type: 'stat_modifier', target: 'con', operation: 'add', value: 1, condition: null }],
        },
        {
          id: 'artificers_lore', name: "Artificer's Lore",
          description: 'Whenever you make an Intelligence (History) check related to magical, alchemical, or technological items, you can add twice your proficiency bonus, instead of any other proficiency bonus you normally apply.',
          source: { kind: 'race', refId: 'rock_gnome' }, level: null, effects: [], actions: [], choices: [], passive: true,
        },
        {
          id: 'gnome_tinker', name: 'Tinker',
          description: "You have proficiency with tinker's tools. Using them, you can spend 1 hour and 10 gp of materials to construct a Tiny clockwork device (AC 5, 1 hp) — a clockwork toy, a fire starter, or a music box — that stops functioning after 24 hours unless you spend 1 hour maintaining it, or when you dismantle it to reclaim the materials. You can have up to three devices active at once.",
          source: { kind: 'race', refId: 'rock_gnome' }, level: null, actions: [], choices: [], passive: true,
          effects: [
            { type: 'grant_proficiency', target: 'tool:tinkers_tools', operation: 'add', value: null, condition: null },
          ],
        },
      ],
    },
  ],
};

export const raceHalfElf: Race = {
  id: 'half_elf',
  name: 'Half-Elf',
  srd: true,
  flexibleAsi: {
    prompt: 'Two other ability scores of your choice each increase by 1.',
    mode: { kind: 'two_distinct_plus_one', exclude: ['cha'] },
  },
  // Half-Elf Versatility was previously hardcoded as "2 skills of your
  // choice" only — RAW is actually a choice among 7 different traits,
  // reflecting which elf lineage (or none) the half-elf favors. Reuses the
  // ancestryChoice mechanism (a "pick 1 of N, get a Feature or queued
  ancestryChoice: {
    prompt: 'Choose your Half-Elf Versatility trait.',
    options: [
      {
        id: 'skill_versatility', name: 'Skill Versatility', blurb: 'Proficiency in two skills of your choice.',
        pendingChoice: {
          id: `${RACE_CHOICE_PREFIX}half_elf_skills`,
          prompt: 'Choose two skills to gain proficiency in.',
          kind: 'skill', count: 2, pool: ALL_SKILL_OPTIONS,
          grants: [], required: true, resolved: false,
        },
      },
      { id: 'elf_weapon_training_heritage', name: 'Elf Weapon Training (High/Wood Elf Heritage)', blurb: 'Proficiency with longsword, shortsword, shortbow, longbow.', feature: elfWeaponTraining('half_elf') },
      {
        id: 'cantrip_heritage', name: 'Cantrip (High Elf Heritage)', blurb: 'One cantrip of your choice from the wizard spell list.',
        feature: {
          id: 'half_elf_cantrip_heritage', name: 'Cantrip',
          description: 'You know one cantrip of your choice from the wizard spell list. Intelligence is your spellcasting ability for it.',
          source: { kind: 'race', refId: 'half_elf' }, level: null, effects: [], actions: [], choices: [], passive: true,
        },
      },
      {
        id: 'fleet_of_foot_heritage', name: 'Fleet of Foot (Wood Elf Heritage)', blurb: 'Base walking speed increases to 35 feet.',
        feature: {
          id: 'half_elf_fleet_of_foot', name: 'Fleet of Foot',
          description: 'Your base walking speed increases to 35 feet.',
          source: { kind: 'race', refId: 'half_elf' }, level: null, actions: [], choices: [], passive: true,
          effects: [{ type: 'stat_modifier', target: 'speed', operation: 'set', value: 35, condition: null }],
        },
      },
      {
        id: 'mask_of_the_wild_heritage', name: 'Mask of the Wild (Wood Elf Heritage)', blurb: 'Hide even when only lightly obscured by natural phenomena.',
        feature: {
          id: 'half_elf_mask_of_the_wild', name: 'Mask of the Wild',
          description: 'You can attempt to hide even when you are only lightly obscured by foliage, heavy rain, falling snow, mist, and other natural phenomena.',
          source: { kind: 'race', refId: 'half_elf' }, level: null, effects: [], actions: [], choices: [], passive: true,
        },
      },
      {
        id: 'drow_magic_heritage', name: 'Drow Magic (Dark Elf Heritage)', blurb: 'Know Dancing Lights; 3rd/5th level bonus spells are reference-only.',
        feature: {
          id: 'half_elf_drow_magic', name: 'Drow Magic',
          description: 'You know the Dancing Lights cantrip. Charisma is your spellcasting ability for it. At 3rd level you can cast Faerie Fire once, and at 5th level Darkness once, each recharging on a long rest — this app doesn\'t yet support level-gated racial features, so only the cantrip is granted for real.',
          source: { kind: 'race', refId: 'half_elf' }, level: null, actions: [], choices: [], passive: true,
          effects: [{ type: 'grant_spell', target: 'spell', operation: 'add', value: null, condition: null, cantripIds: ['dancing_lights'], spellcastingAbility: 'cha' }],
        },
      },
      {
        id: 'swim_speed_heritage', name: 'Swim Speed (Aquatic Elf Heritage)', blurb: 'Real 30ft swimming speed.',
        feature: {
          id: 'half_elf_swim_speed', name: 'Swim Speed',
          description: 'You have a swimming speed of 30 feet.',
          source: { kind: 'race', refId: 'half_elf' }, level: null, actions: [], choices: [], passive: true,
          effects: [{ type: 'grant_movement', target: 'movement', operation: 'add', value: null, condition: null, movementType: 'swim', movementRange: 30 }],
        },
      },
    ],
  },
  features: [
    {
      id: 'half_elf_asi',
      name: 'Ability Score Increase',
      description: 'Your Charisma score increases by 2, and two other ability scores of your choice each increase by 1.',
      source: { kind: 'race', refId: 'half_elf' },
      level: null, actions: [], choices: [], passive: true,
      effects: [
        { type: 'stat_modifier', target: 'cha', operation: 'add', value: 2, condition: null },
      ],
    },
    {
      id: 'half_elf_darkvision',
      name: 'Darkvision',
      description: 'You can see in dim light within 60 feet as if it were bright light, and in darkness as if it were dim light.',
      source: { kind: 'race', refId: 'half_elf' },
      level: null, effects: [{ type: 'grant_sense', target: 'sense', operation: 'add', value: null, condition: null, senseType: 'darkvision', senseRange: 60 }], actions: [], choices: [], passive: true,
    },
    {
      id: 'half_elf_fey_ancestry',
      name: 'Fey Ancestry',
      description: 'You have advantage on saving throws against being charmed, and magic can\'t put you to sleep.',
      source: { kind: 'race', refId: 'half_elf' },
      level: null, effects: [], actions: [], choices: [], passive: true,
    },
  ],
  // ASI AND Half-Elf Versatility (the empty ancestryChoice below suppresses
  // the base race's Versatility picker, since these have fixed traits
  // instead — see Subrace.ancestryChoice's override semantics).
  subracesOptional: true,
  subraces: [
  ],
};

export const raceHalfOrc: Race = {
  id: 'half_orc',
  name: 'Half-Orc',
  srd: true,
  resources: [
    { resourceId: 'relentless_endurance_pool', name: 'Relentless Endurance', maximum: 1, recharge: 'long_rest' },
  ],
  features: [
    {
      id: 'half_orc_asi',
      name: 'Ability Score Increase',
      description: 'Your Strength score increases by 2 and your Constitution score increases by 1.',
      source: { kind: 'race', refId: 'half_orc' },
      level: null, actions: [], choices: [], passive: true,
      effects: [
        { type: 'stat_modifier', target: 'str', operation: 'add', value: 2, condition: null },
        { type: 'stat_modifier', target: 'con', operation: 'add', value: 1, condition: null },
      ],
    },
    {
      id: 'half_orc_darkvision',
      name: 'Darkvision',
      description: 'You can see in dim light within 60 feet as if it were bright light, and in darkness as if it were dim light.',
      source: { kind: 'race', refId: 'half_orc' },
      level: null, effects: [{ type: 'grant_sense', target: 'sense', operation: 'add', value: null, condition: null, senseType: 'darkvision', senseRange: 60 }], actions: [], choices: [], passive: true,
    },
    {
      id: 'half_orc_menacing',
      name: 'Menacing',
      description: 'You gain proficiency in the Intimidation skill.',
      source: { kind: 'race', refId: 'half_orc' },
      level: null, actions: [], choices: [], passive: true,
      effects: [
        { type: 'grant_proficiency', target: 'skill:intimidation', operation: 'add', value: null, condition: null },
      ],
    },
    {
      id: 'half_orc_relentless_endurance',
      name: 'Relentless Endurance',
      description: 'When you are reduced to 0 hit points but not killed outright, you can drop to 1 hit point instead. Once you use this trait, you can\'t use it again until you finish a long rest.',
      source: { kind: 'race', refId: 'half_orc' },
      level: null, effects: [], actions: [], choices: [], passive: false,
      activation: { actionType: 'free', resourceCost: { resourceId: 'relentless_endurance_pool', quantity: 1 }, range: 'self', target: 'self', requiresSave: null },
    },
    {
      id: 'half_orc_savage_attacks',
      name: 'Savage Attacks',
      description: 'When you score a critical hit with a melee weapon attack, you can roll one of the weapon\'s damage dice one additional time and add it to the extra damage of the critical hit.',
      source: { kind: 'race', refId: 'half_orc' },
      level: null, effects: [], actions: [], choices: [], passive: true,
    },
  ],
  // trait except Age/Alignment/Size/Speed per the source text (Darkvision
  // is re-listed there too, at the same 60ft value — redeclared here for
  // completeness even though the practical effect is identical).
  subracesOptional: true,
  subraces: [
  ],
};

export const raceTiefling: Race = {
  id: 'tiefling',
  name: 'Tiefling',
  srd: true,
  features: [
    {
      id: 'tiefling_asi',
      name: 'Ability Score Increase',
      description: 'Your Intelligence score increases by 1 and your Charisma score increases by 2.',
      source: { kind: 'race', refId: 'tiefling' },
      level: null, actions: [], choices: [], passive: true,
      effects: [
        { type: 'stat_modifier', target: 'int', operation: 'add', value: 1, condition: null },
        { type: 'stat_modifier', target: 'cha', operation: 'add', value: 2, condition: null },
      ],
    },
    {
      id: 'tiefling_darkvision',
      name: 'Darkvision',
      description: 'You can see in dim light within 60 feet as if it were bright light, and in darkness as if it were dim light.',
      source: { kind: 'race', refId: 'tiefling' },
      level: null, effects: [{ type: 'grant_sense', target: 'sense', operation: 'add', value: null, condition: null, senseType: 'darkvision', senseRange: 60 }], actions: [], choices: [], passive: true,
    },
    {
      id: 'tiefling_hellish_resistance',
      name: 'Hellish Resistance',
      description: 'You have resistance to fire damage.',
      source: { kind: 'race', refId: 'tiefling' },
      level: null, actions: [], choices: [], passive: true,
      effects: [
        { type: 'grant_resistance', target: 'fire', operation: 'resistance', value: null, condition: null },
      ],
    },
    {
      id: 'tiefling_infernal_legacy',
      name: 'Infernal Legacy',
      description: 'You know the Thaumaturgy cantrip. Charisma is your spellcasting ability for it. At 3rd level, you can cast Hellish Rebuke once as a 2nd-level spell, and at 5th level Darkness once, each recharging on a long rest — this app doesn\'t yet support level-gated racial features, so only the 1st-level cantrip is granted for real.',
      source: { kind: 'race', refId: 'tiefling' },
      level: null, actions: [], choices: [], passive: true,
      effects: [
        { type: 'grant_spell', target: 'spell', operation: 'add', value: null, condition: null, cantripIds: ['thaumaturgy'], spellcastingAbility: 'cha' },
      ],
    },
  ],
  // This is the PHB default "Bloodline of Asmodeus" — the 7 MTOF bloodlines
  // below are optional alternatives, each replacing both the base ASI and
  // Infernal Legacy (not selecting one of these subraces just keeps the
  // Asmodeus baseline above, same subracesOptional pattern as Dragonborn).
  subracesOptional: true,
  subraces: [
  ],
};

/**
 * Every playable race, unfiltered. Prefer ALL_RACES below in app code.
 * (raceSkeleton is intentionally not included here — see its own comment.)
 */
export const FULL_RACE_LIBRARY: Race[] = [
  raceHuman,
  raceElf,
  raceDwarf,
  raceHalfling,
  raceDragonborn,
  raceGnome,
  raceHalfElf,
  raceHalfOrc,
  raceTiefling,
];

const SRD_ONLY = process.env.EXPO_PUBLIC_SRD_ONLY === 'true';

/**
 * The race list the app should use — filtered to srd === true only on the
 * EAS `production` build profile (see eas.json). Personal/dev/preview
 * builds see every race unfiltered, same build-target-aware pattern as
 * spells (Step 1.3) and subclasses. See docs/ROADMAP_1.0.md Phase 1.
 */
export const ALL_RACES: Race[] = SRD_ONLY
  ? FULL_RACE_LIBRARY.filter(r => r.srd === true)
  : FULL_RACE_LIBRARY;

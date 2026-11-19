// ============================================================================
// FILE: src/content/classes/index.ts
// All 12 PHB classes with full level 1-20 progressions.
// ============================================================================
import { CLASSES_2024, PROGRESSIONS_2024 } from '../classes2024';
import { WILD_SHAPE_2014 } from '../beastforms/wildShape2014';
import { ClassProgression, LevelEntry, ChoiceDefinition, ChoiceOption } from '../../engine/types';
import { fighterProgression } from './fighter';
import { ALL_TOOLS } from '../tools';
import { fightingStyleChoice, favoredEnemyChoice, favoredTerrainChoice, invocationChoice, metamagicChoice, mysticArcanumGrants, pactBoonChoice, PALADIN_STYLES, RANGER_STYLES } from './srd51Options';

// ── Shared helpers ────────────────────────────────────────────────────────────

function asiChoice(id: string): ChoiceDefinition {
  return {
    id,
    prompt: 'Choose an Ability Score Increase (+2 to one or +1 to two) or a Feat.',
    kind: 'asi',
    count: 1,
    pool: 'all',
    grants: [],
    required: true,
    resolved: false,
  };
}

/**
 * The gear a class starts with that is no choice (the last line of its Equipment list in the SRD: a wizard's spellbook, a
 * rogue's leather armor, two daggers and thieves' tools), as 'starting_item' grants. One id per item, repeated for several
 * of the same, as the equipment choices write them.
 */
const startingItems = (...itemIds: string[]): { kind: 'starting_item'; value: string }[] => itemIds.map(value => ({ kind: 'starting_item', value }));

/**
 * Builds a level-1 starting-equipment choice. Each option's `value` is an array
 * of item IDs that get added to inventory.carried when the choice is resolved
 * (see resolveChoice in leveling.ts). An option may also carry `itemFilter`
 * (STARTING-EQUIPMENT-1/CHOICE-EXPANSION-3: same mechanism fighter.ts's
 * fighter_equip_b already uses) for a "fixed items PLUS N picks matching a
 * constraint" option, e.g. "any simple weapon" — real player choice among
 * every simple weapon in the catalog, not a single hardcoded example. Setting
 * equipmentStyle: 'exact_options' whenever any option uses this is required
 * for app/creation/equipment.tsx to resolve it via the constrained-picker
 * path instead of the legacy fixed-pool path.
 */
function equipmentChoice(
  id: string,
  prompt: string,
  options: { id: string; label: string; items: string[]; itemFilter?: ChoiceOption['itemFilter'] }[],
): ChoiceDefinition {
  const hasFilter = options.some(o => o.itemFilter);
  return {
    id, prompt, kind: 'equipment', count: 1,
    pool: options.map(o => ({ id: o.id, label: o.label, value: o.items, itemFilter: o.itemFilter })),
    grants: [], required: true, resolved: false,
    ...(hasFilter ? { equipmentStyle: 'exact_options' as const, equipmentGroup: 'Weapons' } : {}),
  };
}

/** Stub entries for levels that have no special grants (just HP). */
function stubEntries(
  levels: number[],
  hpDie: LevelEntry['hpDie'],
): LevelEntry[] {
  return levels.map(level => ({ level, hpDie, choices: [], grants: [] }));
}

/**
 * A known-spell caster gaining N new spells (or cantrips, if `id` contains
 * 'cantrip') known at level-up — resolved by SpellChoicePicker via
 * applySpellChoiceToEntity (not resolveChoice; pool is the 'all' sentinel,
 * same reason ASI/subclass/infusion/feature_pool choices are).
 */
function spellChoice(id: string, count: number, prompt: string): ChoiceDefinition {
  return {
    id, prompt, kind: 'spell', count, pool: 'all',
    grants: [], required: true, resolved: false,
  };
}

/**
 * CHOICE-EXPANSION-1: a real interactive Expertise choice — resolved by a
 * RepeatedChoicePicker via applyExpertiseChoiceToEntity (not resolveChoice;
 * pool is the 'all' sentinel, same reason ASI/subclass/infusion/spell are).
 * The eligible pool (skills the character is already trained in and not
 * yet expert in) is computed live by the picker, not authored here.
 */
function expertiseChoice(id: string, count: number, prompt: string): ChoiceDefinition {
  return {
    id, prompt, kind: 'expertise', count, pool: 'all',
    grants: [], required: true, resolved: false,
  };
}

/** CHOICE-EXPANSION-2: pool of every canonical tool in one or more
 * categories — reused wherever official content restricts a tool choice to
 * "N musical instruments"/"one artisan's tools" rather than any tool. */
function toolCategoryPool(...categories: string[]): ChoiceOption[] {
  return ALL_TOOLS.filter(t => categories.includes(t.category)).map(t => ({ id: t.id, label: t.name, value: t.id }));
}

function toolChoice(id: string, count: number, prompt: string, pool: ChoiceDefinition['pool'] = 'all'): ChoiceDefinition {
  return { id, prompt, kind: 'tool', count, pool, grants: [], required: true, resolved: false };
}

// ── Rogue ─────────────────────────────────────────────────────────────────────

const rogueSkillChoice: ChoiceDefinition = {
  id: 'rogue_skills_lvl_1',
  prompt: 'Choose 4 skills from: Acrobatics, Athletics, Deception, Insight, Intimidation, Investigation, Perception, Performance, Persuasion, Sleight of Hand, Stealth.',
  kind: 'skill', count: 4,
  pool: [
    { id: 'acrobatics',     label: 'Acrobatics',     value: 'acrobatics' },
    { id: 'athletics',      label: 'Athletics',       value: 'athletics' },
    { id: 'deception',      label: 'Deception',       value: 'deception' },
    { id: 'insight',        label: 'Insight',         value: 'insight' },
    { id: 'intimidation',   label: 'Intimidation',    value: 'intimidation' },
    { id: 'investigation',  label: 'Investigation',   value: 'investigation' },
    { id: 'perception',     label: 'Perception',      value: 'perception' },
    { id: 'performance',    label: 'Performance',     value: 'performance' },
    { id: 'persuasion',     label: 'Persuasion',      value: 'persuasion' },
    { id: 'sleight_of_hand', label: 'Sleight of Hand', value: 'sleight_of_hand' },
    { id: 'stealth',        label: 'Stealth',         value: 'stealth' },
  ],
  grants: [], required: true, resolved: false,
};

export const rogueProgression: ClassProgression = {
  classId: 'rogue',
  srd: true,
  entries: [
    {
      level: 1, hpDie: 8, choices: [
        rogueSkillChoice,
        expertiseChoice('rogue_expertise_1', 2, 'Choose two of your skill proficiencies to gain Expertise (double proficiency bonus).'),
        equipmentChoice('rogue_equip_a', 'Choose a weapon: (a) a rapier or (b) a shortsword', [
          { id: 'rapier',     label: 'Rapier',     items: ['rapier'] },
          { id: 'shortsword', label: 'Shortsword', items: ['shortsword'] },
        ]),
        equipmentChoice('rogue_equip_b', 'Choose: (a) a shortbow and quiver of 20 arrows or (b) a shortsword', [
          { id: 'shortbow',   label: 'Shortbow & 20 arrows', items: ['shortbow', 'arrows_20'] },
          { id: 'shortsword', label: 'Shortsword',           items: ['shortsword'] },
        ]),
        equipmentChoice('rogue_equip_c', "Choose a pack: (a) burglar's, (b) dungeoneer's, or (c) explorer's", [
          { id: 'burglar',    label: "Burglar's Pack",    items: ['burglars_pack'] },
          { id: 'dungeoneer', label: "Dungeoneer's Pack", items: ['dungeoneers_pack'] },
          { id: 'explorer',   label: "Explorer's Pack",   items: ['explorers_pack'] },
        ]),
      ],
      grants: [
        ...startingItems('leather_armor', 'dagger', 'dagger', 'thieves_tools'),
        { kind: 'feature', value: { id: 'sneak_attack', name: 'Sneak Attack', description: 'Once per turn, you can deal an extra 1d6 damage to one creature you hit with an attack if you have advantage on the attack roll. The attack must use a finesse or a ranged weapon. You don\'t need advantage if another enemy of the target is within 5 feet of it, that enemy isn\'t incapacitated, and you don\'t have disadvantage on the attack roll. The extra damage grows as you gain rogue levels: 2d6 at 3rd level and 1d6 more every two levels after, to 10d6 at 19th.', source: { kind: 'class', refId: 'rogue' }, level: 1, effects: [], actions: [], choices: [], passive: true,
      // A-58: trigger-only features (no activation, no card) — the ONLY way
      // to surface them anywhere in the app is TriggeredFeaturesSection
      // (TabActions.tsx), which reads Feature.trigger and had literally zero
      // real content setting it until this pass, despite being shipped and
      // tested. Sneak Attack was that section's own original motivating
      // example.
      trigger: "Once per turn, when you hit with a weapon attack and have advantage, or an ally is within 5 ft of the target and you don't have disadvantage." } },
        { kind: 'feature', value: { id: 'thieves_cant', name: "Thieves' Cant", description: 'You know thieves\' cant, a secret mix of dialect, jargon and code that lets you hide messages in seemingly normal conversation. Only another creature that knows thieves\' cant understands such messages, and conveying one takes four times longer than saying the same idea plainly. You also understand a set of secret signs and symbols used to convey short, simple messages, such as whether an area is dangerous or the territory of a thieves\' guild, whether loot is nearby, or whether the people in an area are easy marks or will provide a safe house for thieves on the run.', source: { kind: 'class', refId: 'rogue' }, level: 1, effects: [], actions: [], choices: [], passive: true } },
        { kind: 'feature', value: { id: 'expertise_rogue_1', name: 'Expertise', description: 'Choose two of your skill proficiencies to double your proficiency bonus.', source: { kind: 'class', refId: 'rogue' }, level: 1, effects: [], actions: [], choices: [], passive: true } },
      ],
    },
    {
      level: 2, hpDie: 8, choices: [],
      grants: [
        { kind: 'feature', value: { id: 'cunning_action', name: 'Cunning Action', description: 'You can take a bonus action to Dash, Disengage, or Hide.', source: { kind: 'class', refId: 'rogue' }, level: 2, effects: [], actions: [], choices: [], passive: true } },
      ],
    },
    { level: 3, hpDie: 8, choices: [{ id: 'rogue_archetype', prompt: 'Choose a Roguish Archetype.', kind: 'subclass', count: 1, pool: 'all', grants: [], required: true, resolved: false }], grants: [{ kind: 'feature', value: { id: 'rogue_archetype_feature', name: 'Roguish Archetype', description: 'At 3rd level you choose an archetype that you emulate in the exercise of your rogue abilities (the SRD offers the Thief). It grants features at 3rd, 9th, 13th and 17th level.', source: { kind: 'class', refId: 'rogue' }, level: 3, effects: [], actions: [], choices: [], passive: true } }] },
    { level: 4, hpDie: 8, choices: [asiChoice('rogue_asi_4')], grants: [] },
    { level: 5, hpDie: 8, choices: [], grants: [{ kind: 'feature', value: { id: 'uncanny_dodge', name: 'Uncanny Dodge', description: 'When an attacker you can see hits you, use your reaction to halve the damage.', source: { kind: 'class', refId: 'rogue' }, level: 5, effects: [], actions: [], choices: [], passive: false, activation: { actionType: 'reaction', resourceCost: null, range: 'self', target: 'self', requiresSave: null } } }] },
    { level: 6, hpDie: 8, choices: [expertiseChoice('rogue_expertise_6', 2, 'Choose two more skill proficiencies to gain Expertise.')], grants: [{ kind: 'feature', value: { id: 'expertise_rogue_6', name: 'Expertise', description: 'Choose two more skill proficiencies to double your proficiency bonus.', source: { kind: 'class', refId: 'rogue' }, level: 6, effects: [], actions: [], choices: [], passive: true } }] },
    { level: 7, hpDie: 8, choices: [], grants: [{ kind: 'feature', value: { id: 'evasion_rogue', name: 'Evasion', description: 'When subjected to an effect requiring a Dex save, take no damage on success and half on failure.', source: { kind: 'class', refId: 'rogue' }, level: 7, effects: [], actions: [], choices: [], passive: true,
      trigger: 'When you must make a Dexterity saving throw against an effect that deals damage.' } }] },
    { level: 8, hpDie: 8, choices: [asiChoice('rogue_asi_8')], grants: [] },
    ...stubEntries([9], 8),
    { level: 10, hpDie: 8, choices: [asiChoice('rogue_asi_10')], grants: [] },
    {
      level: 11, hpDie: 8, choices: [], grants: [
        { kind: 'feature', value: { id: 'reliable_talent', name: 'Reliable Talent', description: "Whenever you make an ability check that lets you add your proficiency bonus, treat a d20 roll of 9 or lower as a 10 instead. No engine hook for roll manipulation — apply this manually at the table.", source: { kind: 'class', refId: 'rogue' }, level: 11, effects: [], actions: [], choices: [], passive: true } },
      ],
    },
    { level: 12, hpDie: 8, choices: [asiChoice('rogue_asi_12')], grants: [] },
    ...stubEntries([13], 8),
    {
      level: 14, hpDie: 8, choices: [], grants: [
        { kind: 'feature', value: { id: 'blindsense', name: 'Blindsense', description: "If you are able to hear, you are aware of the location of any hidden or invisible creature within 10 feet of you. No engine sense-range hook narrow enough to model this (it's weaker than full blindsight) — track manually.", source: { kind: 'class', refId: 'rogue' }, level: 14, effects: [], actions: [], choices: [], passive: true } },
      ],
    },
    {
      level: 15, hpDie: 8, choices: [], grants: [
        { kind: 'feature', value: { id: 'slippery_mind', name: 'Slippery Mind', description: 'You gain proficiency in Wisdom saving throws. No engine grant kind exists for adding a saving-throw proficiency mid-game (only at character creation) — mark this proficiency manually on the Abilities tab for now.', source: { kind: 'class', refId: 'rogue' }, level: 15, effects: [], actions: [], choices: [], passive: true } },
      ],
    },
    { level: 16, hpDie: 8, choices: [asiChoice('rogue_asi_16')], grants: [] },
    ...stubEntries([17], 8),
    {
      level: 18, hpDie: 8, choices: [], grants: [
        { kind: 'feature', value: { id: 'elusive', name: 'Elusive', description: "No attack roll has advantage against you while you aren't incapacitated. No engine hook for negating incoming advantage — apply this manually when rolling attacks against you.", source: { kind: 'class', refId: 'rogue' }, level: 18, effects: [], actions: [], choices: [], passive: true } },
      ],
    },
    { level: 19, hpDie: 8, choices: [asiChoice('rogue_asi_19')], grants: [] },
    { level: 20, hpDie: 8, choices: [], grants: [{ kind: 'feature', value: { id: 'stroke_of_luck', name: 'Stroke of Luck', description: 'If your attack misses, turn it into a hit. If you fail a check, treat the d20 roll as a 20.', source: { kind: 'class', refId: 'rogue' }, level: 20, effects: [], actions: [], choices: [], passive: false, activation: { actionType: 'free', resourceCost: { resourceId: 'stroke_of_luck_pool', quantity: 1 }, range: 'self', target: 'self', requiresSave: null } } }, { kind: 'resource', value: { resourceId: 'stroke_of_luck_pool', name: 'Stroke of Luck', maximum: 1, recharge: 'short_rest' } }] },
  ],
};

// ── Wizard ────────────────────────────────────────────────────────────────────

const wizardSkillChoice: ChoiceDefinition = {
  id: 'wizard_skills_lvl_1',
  prompt: 'Choose 2 skills from: Arcana, History, Insight, Investigation, Medicine, Religion.',
  kind: 'skill', count: 2,
  pool: [
    { id: 'arcana',        label: 'Arcana',        value: 'arcana' },
    { id: 'history',       label: 'History',       value: 'history' },
    { id: 'insight',       label: 'Insight',       value: 'insight' },
    { id: 'investigation', label: 'Investigation', value: 'investigation' },
    { id: 'medicine',      label: 'Medicine',      value: 'medicine' },
    { id: 'religion',      label: 'Religion',      value: 'religion' },
  ],
  grants: [], required: true, resolved: false,
};

export const wizardProgression: ClassProgression = {
  classId: 'wizard',
  srd: true,
  entries: [
    {
      level: 1, hpDie: 6, choices: [
        wizardSkillChoice,
        equipmentChoice('wizard_equip_a', 'Choose a weapon: (a) a quarterstaff or (b) a dagger', [
          { id: 'quarterstaff', label: 'Quarterstaff', items: ['quarterstaff'] },
          { id: 'dagger',       label: 'Dagger',       items: ['dagger'] },
        ]),
        equipmentChoice('wizard_equip_b', 'Choose a focus: (a) a component pouch or (b) an arcane focus', [
          { id: 'pouch', label: 'Component Pouch', items: ['component_pouch'] },
          { id: 'focus', label: 'Arcane Focus',    items: ['arcane_focus_orb'] },
        ]),
        equipmentChoice('wizard_equip_c', "Choose a pack: (a) scholar's or (b) explorer's", [
          { id: 'scholar',  label: "Scholar's Pack",  items: ['scholars_pack'] },
          { id: 'explorer', label: "Explorer's Pack", items: ['explorers_pack'] },
        ]),
        // Bug fix (architecture review U14): Wizard's level-1 entry had no
        // cantrip ChoiceDefinition at all, unlike every other known-spell
        // caster (Bard/Sorcerer/Warlock all pair a cantrips choice with
        // their spells-known choice at level 1) — app/creation/spells.tsx's
        // spellChoices.length > 0 branch takes over rendering entirely once
        // ANY spell-kind choice exists, so Wizards were never shown a
        // cantrip picker at creation or on revisit.
        spellChoice('wizard_cantrips_1', 3, 'Choose 3 wizard cantrips.'),
        spellChoice('wizard_spellbook_1', 6, 'Choose 6 1st-level wizard spells for your spellbook.'),
      ],
      grants: [
        ...startingItems('spellbook'),
        { kind: 'feature', value: { id: 'wizard_spellcasting', name: 'Spellcasting', description: 'You cast wizard spells using Intelligence: your spell save DC is 8 + your proficiency bonus + your Intelligence modifier, and your spell attack modifier is your proficiency bonus + your Intelligence modifier. Your spellbook holds the wizard spells you know: six 1st-level spells to start, and two more each time you gain a wizard level. After a long rest you prepare a number of spells from your spellbook equal to your Intelligence modifier + wizard level (minimum one); casting one expends a slot of its level or higher. You can cast a spell from your spellbook as a ritual if it has the ritual tag, without preparing it. You can use an arcane focus as a spellcasting focus.', source: { kind: 'class', refId: 'wizard' }, level: 1, effects: [], actions: [], choices: [], passive: true } },
        { kind: 'feature', value: { id: 'arcane_recovery', name: 'Arcane Recovery', description: 'Once per day when you finish a short rest, you can choose expended spell slots to recover. The slots can have a combined level equal to or less than half your wizard level (rounded up), and none of them can be 6th level or higher.', source: { kind: 'class', refId: 'wizard' }, level: 1, effects: [], actions: [], choices: [], passive: false, activation: { actionType: 'free', resourceCost: { resourceId: 'arcane_recovery_pool', quantity: 1 }, range: 'self', target: 'self', requiresSave: null } } },
        { kind: 'resource', value: { resourceId: 'arcane_recovery_pool', name: 'Arcane Recovery', maximum: 1, recharge: 'long_rest' } },
        { kind: 'init_spellcasting', value: { ability: 'int' } },
        { kind: 'spell_slots', value: { level: 1 } },
      ],
    },
    { level: 2, hpDie: 6, choices: [{ id: 'wizard_tradition_choice', prompt: 'Choose an Arcane Tradition.', kind: 'subclass', count: 1, pool: 'all', grants: [], required: true, resolved: false }, spellChoice('wizard_spellbook_2', 2, 'Choose 2 spells to add to your spellbook.')], grants: [{ kind: 'feature', value: { id: 'wizard_tradition', name: 'Arcane Tradition', description: 'At 2nd level you choose an arcane tradition that shapes your practice of magic (the SRD offers the School of Evocation). It grants features at 2nd, 6th, 10th and 14th level.', source: { kind: 'class', refId: 'wizard' }, level: 2, effects: [], actions: [], choices: [], passive: true } }] },
    ...Array.from({ length: 17 }, (_, i) => {
      const level = 3 + i;
      const asiLevels: Record<number, string> = { 4: 'wizard_asi_4', 8: 'wizard_asi_8', 12: 'wizard_asi_12', 16: 'wizard_asi_16', 19: 'wizard_asi_19' };
      const asi = asiLevels[level];
      return {
        level, hpDie: 6 as const,
        choices: [
          ...(asi ? [asiChoice(asi)] : []),
          ...(level === 4 || level === 10 ? [spellChoice(`wizard_cantrips_${level}`, 1, 'Choose 1 more wizard cantrip.')] : []),
          spellChoice(`wizard_spellbook_${level}`, 2, 'Choose 2 spells to add to your spellbook.'),
        ] as ChoiceDefinition[],
        grants: [],
      };
    }),
    { level: 20, hpDie: 6, choices: [spellChoice('wizard_spellbook_20', 2, 'Choose 2 spells to add to your spellbook.')], grants: [{ kind: 'feature', value: { id: 'signature_spells', name: 'Signature Spells', description: 'Choose two 3rd-level wizard spells in your spellbook as your signature spells. You always have them prepared, they don\'t count against the number of spells you have prepared, and you can cast each of them once at 3rd level without expending a spell slot, regaining that use when you finish a short or long rest. To cast either at a higher level, you expend a spell slot as normal.', source: { kind: 'class', refId: 'wizard' }, level: 20, effects: [], actions: [], choices: [], passive: true } }] },
  ],
};

// ── Cleric ────────────────────────────────────────────────────────────────────

const clericSkillChoice: ChoiceDefinition = {
  id: 'cleric_skills_lvl_1',
  prompt: 'Choose 2 skills from: History, Insight, Medicine, Persuasion, Religion.',
  kind: 'skill', count: 2,
  pool: [
    { id: 'history',    label: 'History',    value: 'history' },
    { id: 'insight',    label: 'Insight',    value: 'insight' },
    { id: 'medicine',   label: 'Medicine',   value: 'medicine' },
    { id: 'persuasion', label: 'Persuasion', value: 'persuasion' },
    { id: 'religion',   label: 'Religion',   value: 'religion' },
  ],
  grants: [], required: true, resolved: false,
};

export const clericProgression: ClassProgression = {
  classId: 'cleric',
  srd: true,
  entries: [
    {
      level: 1, hpDie: 8, choices: [
        clericSkillChoice,
        spellChoice('cleric_cantrips_1', 3, 'Choose 3 cleric cantrips.'),
        equipmentChoice('cleric_equip_a', 'Choose a weapon: (a) a mace or (b) a warhammer', [
          { id: 'mace',      label: 'Mace',      items: ['mace'] },
          { id: 'warhammer', label: 'Warhammer (if proficient)', items: ['warhammer'] },
        ]),
        equipmentChoice('cleric_equip_b', 'Choose armor: (a) scale mail, (b) leather armor, or (c) chain mail', [
          { id: 'scale',   label: 'Scale Mail',                items: ['scale_mail'] },
          { id: 'leather', label: 'Leather Armor',             items: ['leather_armor'] },
          { id: 'chain',   label: 'Chain Mail (if proficient)', items: ['chain_mail'] },
        ]),
        equipmentChoice('cleric_equip_c', 'Choose: (a) a light crossbow and 20 bolts or (b) a simple weapon', [
          { id: 'crossbow', label: 'Light Crossbow & 20 bolts', items: ['light_crossbow', 'bolts_20'] },
          { id: 'simple',   label: 'A simple weapon', items: [], itemFilter: { constraint: { category: 'weapon', weaponClass: 'simple' }, quantity: 1 } },
        ]),
        equipmentChoice('cleric_equip_d', "Choose a pack: (a) priest's or (b) explorer's", [
          { id: 'priest',   label: "Priest's Pack",   items: ['priests_pack'] },
          { id: 'explorer', label: "Explorer's Pack", items: ['explorers_pack'] },
        ]),
        { id: 'divine_domain_choice', prompt: 'Choose a Divine Domain.', kind: 'subclass', count: 1, pool: 'all', grants: [], required: true, resolved: false },
      ],
      grants: [
        ...startingItems('shield', 'holy_symbol'),
        { kind: 'feature', value: { id: 'cleric_spellcasting', name: 'Spellcasting', description: 'You cast cleric spells using Wisdom: your spell save DC is 8 + your proficiency bonus + your Wisdom modifier, and your spell attack modifier is your proficiency bonus + your Wisdom modifier. After a long rest you prepare a number of spells from the whole cleric spell list equal to your Wisdom modifier + cleric level (minimum one); casting one expends a slot of its level or higher. You can cast a prepared spell with the ritual tag as a ritual. You can use a holy symbol as a spellcasting focus.', source: { kind: 'class', refId: 'cleric' }, level: 1, effects: [], actions: [], choices: [], passive: true } },
        { kind: 'feature', value: { id: 'divine_domain', name: 'Divine Domain', description: 'At 1st level you choose a domain related to your deity (the SRD offers the Life Domain). Its domain spells are always prepared and don\'t count against the number of spells you prepare, and it grants features at 1st, 2nd, 6th, 8th and 17th level.', source: { kind: 'class', refId: 'cleric' }, level: 1, effects: [], actions: [], choices: [], passive: true } },
        { kind: 'init_spellcasting', value: { ability: 'wis' } },
        { kind: 'spell_slots', value: { level: 1 } },
      ],
    },
    { level: 2, hpDie: 8, choices: [], grants: [{ kind: 'feature', value: { id: 'channel_divinity', name: 'Channel Divinity: Turn Undead', description: 'You gain the ability to channel divine energy directly from your deity. The baseline every Cleric gets is Turn Undead — present each undead within 30 feet with your holy symbol, forcing a WIS save or fleeing you for 1 minute. Domain-specific Channel Divinity options are separate, individually-authored features.', source: { kind: 'class', refId: 'cleric' }, level: 2, effects: [], actions: [], choices: [], passive: false, activation: { actionType: 'action', resourceCost: { resourceId: 'channel_divinity_pool', quantity: 1 }, range: '30 feet', target: 'area', requiresSave: { ability: 'wis', dc: 'spell_save_dc' } } } }, { kind: 'resource', value: { resourceId: 'channel_divinity_pool', name: 'Channel Divinity', maximum: 1, recharge: 'short_rest' } }] },
    { level: 3, hpDie: 8, choices: [], grants: [] },
    { level: 4, hpDie: 8, choices: [asiChoice('cleric_asi_4'), spellChoice('cleric_cantrips_4', 1, 'Choose 1 more cleric cantrip.')], grants: [] },
    { level: 5, hpDie: 8, choices: [], grants: [{ kind: 'feature', value: { id: 'destroy_undead', name: 'Destroy Undead', description: 'When an undead of Challenge Rating 1/2 or lower fails its saving throw against your Turn Undead, the creature is instantly destroyed. The threshold rises as you level: CR 1 at 8th level, CR 2 at 11th, CR 3 at 14th and CR 4 at 17th.', source: { kind: 'class', refId: 'cleric' }, level: 5, effects: [], actions: [], choices: [], passive: true } }] },
    { level: 6, hpDie: 8, choices: [], grants: [{ kind: 'resource_upgrade', value: { resourceId: 'channel_divinity_pool', newMaximum: 2 } }] },
    { level: 7, hpDie: 8, choices: [], grants: [] },
    {
      level: 8, hpDie: 8, choices: [asiChoice('cleric_asi_8')], grants: [
        { kind: 'feature', value: { id: 'destroy_undead_cr1', name: 'Destroy Undead (CR 1)', description: 'Your Destroy Undead now instantly destroys an undead of Challenge Rating 1 or lower that fails its save against your Channel Divinity: Turn Undead.', source: { kind: 'class', refId: 'cleric' }, level: 8, effects: [], actions: [], choices: [], passive: true } },
      ],
    },
    ...stubEntries([9], 8),
    {
      level: 10, hpDie: 8, choices: [spellChoice('cleric_cantrips_10', 1, 'Choose 1 more cleric cantrip.')], grants: [
        { kind: 'feature', value: { id: 'divine_intervention', name: 'Divine Intervention', description: "You can call on your deity to intervene on your behalf. Describe the assistance sought and roll percentile dice; on a result at or below your cleric level, your deity intervenes (the DM chooses the nature of the effect, or picks a cleric spell of 9th level or lower). No engine hook for a percentile DM-adjudicated effect — the roll itself is manual. Recharge is simplified to long rest here (RAW is 7 days on a success, otherwise a long rest).", source: { kind: 'class', refId: 'cleric' }, level: 10, effects: [], actions: [], choices: [], passive: false, activation: { actionType: 'action', resourceCost: { resourceId: 'divine_intervention_pool', quantity: 1 }, range: 'self', target: 'self', requiresSave: null } } },
        { kind: 'resource', value: { resourceId: 'divine_intervention_pool', name: 'Divine Intervention', maximum: 1, recharge: 'long_rest' } },
      ],
    },
    {
      level: 11, hpDie: 8, choices: [], grants: [
        { kind: 'feature', value: { id: 'destroy_undead_cr2', name: 'Destroy Undead (CR 2)', description: 'Your Destroy Undead threshold rises to Challenge Rating 2.', source: { kind: 'class', refId: 'cleric' }, level: 11, effects: [], actions: [], choices: [], passive: true } },
      ],
    },
    { level: 12, hpDie: 8, choices: [asiChoice('cleric_asi_12')], grants: [] },
    ...stubEntries([13], 8),
    {
      level: 14, hpDie: 8, choices: [], grants: [
        { kind: 'feature', value: { id: 'destroy_undead_cr3', name: 'Destroy Undead (CR 3)', description: 'Your Destroy Undead threshold rises to Challenge Rating 3.', source: { kind: 'class', refId: 'cleric' }, level: 14, effects: [], actions: [], choices: [], passive: true } },
      ],
    },
    ...stubEntries([15], 8),
    { level: 16, hpDie: 8, choices: [asiChoice('cleric_asi_16')], grants: [] },
    {
      level: 17, hpDie: 8, choices: [], grants: [
        { kind: 'feature', value: { id: 'destroy_undead_cr4', name: 'Destroy Undead (CR 4)', description: 'Your Destroy Undead threshold rises to Challenge Rating 4.', source: { kind: 'class', refId: 'cleric' }, level: 17, effects: [], actions: [], choices: [], passive: true } },
      ],
    },
    { level: 18, hpDie: 8, choices: [], grants: [{ kind: 'resource_upgrade', value: { resourceId: 'channel_divinity_pool', newMaximum: 3 } }] },
    { level: 19, hpDie: 8, choices: [asiChoice('cleric_asi_19')], grants: [] },
    { level: 20, hpDie: 8, choices: [], grants: [{ kind: 'feature', value: { id: 'divine_intervention', name: 'Divine Intervention Improvement', description: 'Your call for divine intervention succeeds automatically.', source: { kind: 'class', refId: 'cleric' }, level: 20, effects: [], actions: [], choices: [], passive: true } }] },
  ],
};

// ── Barbarian ─────────────────────────────────────────────────────────────────

const barbarianSkillChoice: ChoiceDefinition = {
  id: 'barbarian_skills_lvl_1',
  prompt: 'Choose 2 skills from: Animal Handling, Athletics, Intimidation, Nature, Perception, Survival.',
  kind: 'skill', count: 2,
  pool: [
    { id: 'animal_handling', label: 'Animal Handling', value: 'animal_handling' },
    { id: 'athletics',       label: 'Athletics',       value: 'athletics' },
    { id: 'intimidation',    label: 'Intimidation',    value: 'intimidation' },
    { id: 'nature',          label: 'Nature',          value: 'nature' },
    { id: 'perception',      label: 'Perception',      value: 'perception' },
    { id: 'survival',        label: 'Survival',        value: 'survival' },
  ],
  grants: [], required: true, resolved: false,
};

export const barbarianProgression: ClassProgression = {
  classId: 'barbarian',
  srd: true,
  entries: [
    {
      level: 1, hpDie: 12, choices: [
        barbarianSkillChoice,
        equipmentChoice('barbarian_equip_a', 'Choose: (a) a greataxe or (b) any martial melee weapon', [
          { id: 'greataxe', label: 'Greataxe', items: ['greataxe'] },
          { id: 'martial',  label: 'A martial melee weapon', items: [], itemFilter: { constraint: { category: 'weapon', weaponClass: 'martial', weaponRange: 'melee' }, quantity: 1 } },
        ]),
        equipmentChoice('barbarian_equip_b', 'Choose: (a) two handaxes or (b) any simple weapon', [
          { id: 'handaxes', label: 'Two Handaxes', items: ['handaxe', 'handaxe'] },
          { id: 'simple',   label: 'A simple weapon', items: [], itemFilter: { constraint: { category: 'weapon', weaponClass: 'simple' }, quantity: 1 } },
        ]),
      ],
      grants: [
        ...startingItems('explorers_pack', 'javelin', 'javelin', 'javelin', 'javelin'),
        {
          kind: 'feature',
          value: {
            id: 'rage',
            name: 'Rage',
            description: 'On your turn, you can enter a rage as a bonus action. While raging, and only if you aren\'t wearing heavy armor, you have advantage on Strength checks and Strength saving throws; you gain a bonus to the damage of melee weapon attacks that use Strength (+2, rising to +3 at 9th level and +4 at 16th); and you have resistance to bludgeoning, piercing and slashing damage. You can\'t cast spells or concentrate on them while raging. A rage lasts 1 minute. It ends early if you are knocked unconscious or if your turn ends and you haven\'t attacked a hostile creature or taken damage since your last turn, and you can end it as a bonus action. You can rage twice per long rest (3 times at 3rd level, 4 at 6th, 5 at 12th, 6 at 17th, and without limit at 20th).',
            source: { kind: 'class', refId: 'barbarian' },
            level: 1, actions: [], choices: [], passive: false,
            effects: [
              { type: 'grant_resistance', target: 'bludgeoning', operation: 'resistance', value: null, condition: 'rage_active' },
              { type: 'grant_resistance', target: 'piercing', operation: 'resistance', value: null, condition: 'rage_active' },
              { type: 'grant_resistance', target: 'slashing', operation: 'resistance', value: null, condition: 'rage_active' },
            ],
            activation: { actionType: 'bonus_action', resourceCost: { resourceId: 'rage_pool', quantity: 1 }, range: 'self', target: 'self', requiresSave: null },
            abilityEffects: [{ type: 'set_flag', flag: 'rage_active', value: true }],
          },
        },
        { kind: 'resource', value: { resourceId: 'rage_pool', name: 'Rage', maximum: 2, recharge: 'long_rest' } },
        { kind: 'feature', value: { id: 'unarmored_defense_barbarian', name: 'Unarmored Defense', description: 'While not wearing armor, your AC equals 10 + your Dexterity modifier + your Constitution modifier.', source: { kind: 'class', refId: 'barbarian' }, level: 1, effects: [{ type: 'base_ac_formula', target: 'ac', operation: 'set', value: 10, condition: null, formulaAbilities: ['dex', 'con'] }], actions: [], choices: [], passive: true } },
      ],
    },
    { level: 2, hpDie: 12, choices: [], grants: [{ kind: 'feature', value: { id: 'reckless_attack', name: 'Reckless Attack', description: 'You can throw aside all concern for defense to attack with fierce desperation: advantage on STR-based melee attack rolls this turn, but attacks against you have advantage until your next turn.', source: { kind: 'class', refId: 'barbarian' }, level: 2, effects: [], actions: [], choices: [], passive: false, activation: { actionType: 'free', resourceCost: null, range: 'self', target: 'self', requiresSave: null } } }, { kind: 'feature', value: { id: 'danger_sense', name: 'Danger Sense', description: 'You have advantage on Dexterity saving throws against effects that you can see, such as traps and spells. You don\'t gain this benefit while you are blinded, deafened or incapacitated.', source: { kind: 'class', refId: 'barbarian' }, level: 2, effects: [], actions: [], choices: [], passive: true } }] },
    { level: 3, hpDie: 12, choices: [{ id: 'primal_path_choice', prompt: 'Choose a Primal Path.', kind: 'subclass', count: 1, pool: 'all', grants: [], required: true, resolved: false }], grants: [{ kind: 'feature', value: { id: 'primal_path', name: 'Primal Path', description: 'At 3rd level you choose a path that shapes the nature of your rage (the SRD offers the Path of the Berserker). It grants features at 3rd, 6th, 10th and 14th level.', source: { kind: 'class', refId: 'barbarian' }, level: 3, effects: [], actions: [], choices: [], passive: true } }, { kind: 'resource_upgrade', value: { resourceId: 'rage_pool', newMaximum: 3 } }] },
    { level: 4, hpDie: 12, choices: [asiChoice('barbarian_asi_4')], grants: [] },
    { level: 5, hpDie: 12, choices: [], grants: [{ kind: 'feature', value: { id: 'extra_attack_barbarian', name: 'Extra Attack', description: 'You can attack twice when you take the Attack action.', source: { kind: 'class', refId: 'barbarian' }, level: 5, effects: [{ type: 'stat_modifier', target: 'extra_attack', operation: 'set', value: 1, condition: null }], actions: [], choices: [], passive: true } }, { kind: 'feature', value: { id: 'fast_movement', name: 'Fast Movement', description: 'Your speed increases by 10 feet while you aren\'t wearing heavy armor.', source: { kind: 'class', refId: 'barbarian' }, level: 5, effects: [{ type: 'stat_modifier', target: 'speed', operation: 'add', value: 10, condition: null }], actions: [], choices: [], passive: true } }] },
    { level: 6, hpDie: 12, choices: [], grants: [{ kind: 'resource_upgrade', value: { resourceId: 'rage_pool', newMaximum: 4 } }] },
    { level: 7, hpDie: 12, choices: [], grants: [{ kind: 'feature', value: { id: 'feral_instinct', name: 'Feral Instinct', description: 'You have advantage on initiative rolls.', source: { kind: 'class', refId: 'barbarian' }, level: 7, effects: [{ type: 'stat_modifier', target: 'initiative', operation: 'advantage', value: null, condition: null }], actions: [], choices: [], passive: true } }] },
    { level: 8, hpDie: 12, choices: [asiChoice('barbarian_asi_8')], grants: [] },
    { level: 9, hpDie: 12, choices: [], grants: [{ kind: 'feature', value: { id: 'brutal_critical', name: 'Brutal Critical', description: 'You can roll one additional weapon damage die when determining extra damage for a critical hit.', source: { kind: 'class', refId: 'barbarian' }, level: 9, effects: [], actions: [], choices: [], passive: true,
      trigger: 'When you score a critical hit with a melee weapon attack.' } }] },
    ...stubEntries([10], 12),
    { level: 11, hpDie: 12, choices: [], grants: [{ kind: 'feature', value: { id: 'relentless_rage', name: 'Relentless Rage', description: 'If you drop to 0 hit points while you\'re raging and don\'t die outright, you can make a DC 10 Constitution saving throw. If you succeed, you drop to 1 hit point instead. Each time you use this feature after the first, the DC increases by 5. When you finish a short or long rest, the DC resets to 10.', source: { kind: 'class', refId: 'barbarian' }, level: 11, effects: [], actions: [], choices: [], passive: true,
      trigger: 'When damage would drop you to 0 HP while raging and you\'re not already at 0 HP — make a DC 10 Constitution save (DC rises by 5 each time you use this since your last short/long rest) to drop to 1 HP instead.' } }] },
    { level: 12, hpDie: 12, choices: [asiChoice('barbarian_asi_12')], grants: [{ kind: 'resource_upgrade', value: { resourceId: 'rage_pool', newMaximum: 5 } }] },
    {
      level: 13, hpDie: 12, choices: [], grants: [
        { kind: 'feature', value: { id: 'brutal_critical_2', name: 'Brutal Critical (2 dice)', description: 'You can roll two additional weapon damage dice when determining extra damage for a critical hit.', source: { kind: 'class', refId: 'barbarian' }, level: 13, effects: [], actions: [], choices: [], passive: true,
      trigger: 'When you score a critical hit with a melee weapon attack.' } },
      ],
    },
    ...stubEntries([14], 12),
    { level: 15, hpDie: 12, choices: [], grants: [{ kind: 'feature', value: { id: 'persistent_rage', name: 'Persistent Rage', description: 'Your rage is so fierce that it ends early only if you fall unconscious or if you choose to end it.', source: { kind: 'class', refId: 'barbarian' }, level: 15, effects: [], actions: [], choices: [], passive: true } }] },
    { level: 16, hpDie: 12, choices: [asiChoice('barbarian_asi_16')], grants: [] },
    {
      level: 17, hpDie: 12, choices: [], grants: [
        { kind: 'resource_upgrade', value: { resourceId: 'rage_pool', newMaximum: 6 } },
        { kind: 'feature', value: { id: 'brutal_critical_3', name: 'Brutal Critical (3 dice)', description: 'You can roll three additional weapon damage dice when determining extra damage for a critical hit.', source: { kind: 'class', refId: 'barbarian' }, level: 17, effects: [], actions: [], choices: [], passive: true,
      trigger: 'When you score a critical hit with a melee weapon attack.' } },
      ],
    },
    { level: 18, hpDie: 12, choices: [], grants: [{ kind: 'feature', value: { id: 'indomitable_might', name: 'Indomitable Might', description: 'If your total for a Strength check is less than your Strength score, use your Strength score.', source: { kind: 'class', refId: 'barbarian' }, level: 18, effects: [], actions: [], choices: [], passive: true,
      trigger: 'When your Strength check total would be less than your Strength score.' } }] },
    { level: 19, hpDie: 12, choices: [asiChoice('barbarian_asi_19')], grants: [] },
    { level: 20, hpDie: 12, choices: [], grants: [{ kind: 'feature', value: { id: 'primal_champion', name: 'Primal Champion', description: 'Your Strength and Constitution scores increase by 4. Your maximum for those scores is now 24.', source: { kind: 'class', refId: 'barbarian' }, level: 20, effects: [{ type: 'stat_modifier', target: 'str', operation: 'add', value: 4, condition: null }, { type: 'stat_modifier', target: 'con', operation: 'add', value: 4, condition: null }], actions: [], choices: [], passive: true } }, { kind: 'resource_upgrade', value: { resourceId: 'rage_pool', newMaximum: 999 } }] },
  ],
};

// ── Ranger ────────────────────────────────────────────────────────────────────

const rangerSkillChoice: ChoiceDefinition = {
  id: 'ranger_skills_lvl_1',
  prompt: 'Choose 3 skills from: Animal Handling, Athletics, Insight, Investigation, Nature, Perception, Stealth, Survival.',
  kind: 'skill', count: 3,
  pool: [
    { id: 'animal_handling', label: 'Animal Handling', value: 'animal_handling' },
    { id: 'athletics',       label: 'Athletics',       value: 'athletics' },
    { id: 'insight',         label: 'Insight',         value: 'insight' },
    { id: 'investigation',   label: 'Investigation',   value: 'investigation' },
    { id: 'nature',          label: 'Nature',          value: 'nature' },
    { id: 'perception',      label: 'Perception',      value: 'perception' },
    { id: 'stealth',         label: 'Stealth',         value: 'stealth' },
    { id: 'survival',        label: 'Survival',        value: 'survival' },
  ],
  grants: [], required: true, resolved: false,
};

export const rangerProgression: ClassProgression = {
  classId: 'ranger',
  srd: true,
  entries: [
    {
      level: 1, hpDie: 10, choices: [favoredEnemyChoice('ranger_favored_enemy_1', 1), favoredTerrainChoice('ranger_favored_terrain_1'), 
        rangerSkillChoice,
        equipmentChoice('ranger_equip_a', 'Choose armor: (a) scale mail or (b) leather armor', [
          { id: 'scale',   label: 'Scale Mail',    items: ['scale_mail'] },
          { id: 'leather', label: 'Leather Armor', items: ['leather_armor'] },
        ]),
        equipmentChoice('ranger_equip_b', 'Choose: (a) two shortswords or (b) two simple melee weapons', [
          { id: 'shortswords', label: 'Two Shortswords',         items: ['shortsword', 'shortsword'] },
          { id: 'simple',      label: 'Two simple melee weapons (Spears)', items: ['spear', 'spear'] },
        ]),
        equipmentChoice('ranger_equip_c', "Choose a pack: (a) dungeoneer's or (b) explorer's", [
          { id: 'dungeoneer', label: "Dungeoneer's Pack", items: ['dungeoneers_pack'] },
          { id: 'explorer',   label: "Explorer's Pack",   items: ['explorers_pack'] },
        ]),
      ],
      grants: [
        ...startingItems('longbow', 'arrows_20'),
        { kind: 'feature', value: { id: 'favored_enemy', name: 'Favored Enemy', description: 'You have significant experience studying, tracking, hunting and even talking to a certain type of enemy. Choose a type of favored enemy (the pick waits with your class choices): aberrations, beasts, celestials, constructs, dragons, elementals, fey, fiends, giants, monstrosities, oozes, plants or undead, or two races of humanoid such as gnolls and orcs. You have advantage on Wisdom (Survival) checks to track your favored enemies, as well as on Intelligence checks to recall information about them. You also learn one language spoken by your favored enemies, if they speak one. You choose another favored enemy at 6th and 14th level.', source: { kind: 'class', refId: 'ranger' }, level: 1, effects: [], actions: [], choices: [], passive: true } },
        { kind: 'feature', value: { id: 'natural_explorer', name: 'Natural Explorer', description: 'Choose a type of favored terrain (the pick waits with your class choices): arctic, coast, desert, forest, grassland, mountain, swamp or the Underdark. When you make an Intelligence or Wisdom check related to your favored terrain, your proficiency bonus is doubled if you are using a skill that you\'re proficient in. While traveling for an hour or more in your favored terrain: difficult terrain doesn\'t slow your group\'s travel; your group can\'t become lost except by magical means; you remain alert to danger even while foraging, navigating or tracking; if you are traveling alone, you can move stealthily at a normal pace; when you forage, you find twice as much food as you normally would; and while tracking other creatures, you also learn their exact number, their sizes and how long ago they passed through the area. You choose another favored terrain at 6th and 10th level.', source: { kind: 'class', refId: 'ranger' }, level: 1, effects: [], actions: [], choices: [], passive: true } },
      ],
    },
    { level: 2, hpDie: 10, choices: [fightingStyleChoice('ranger_fighting_style', { kind: 'class', refId: 'ranger' }, RANGER_STYLES), spellChoice('ranger_spells_2', 2, 'Choose 2 ranger spells known.')], grants: [{ kind: 'feature', value: { id: 'fighting_style_ranger', name: 'Fighting Style', description: 'You adopt a particular style of fighting as your specialty: choose one of Archery, Defense, Dueling or Two-Weapon Fighting (the pick waits with your class choices).', source: { kind: 'class', refId: 'ranger' }, level: 2, effects: [], actions: [], choices: [], passive: true } }, { kind: 'init_spellcasting', value: { ability: 'wis' } }, { kind: 'spell_slots', value: { level: 2 } }] },
    { level: 3, hpDie: 10, choices: [{ id: 'ranger_conclave_choice', prompt: 'Choose a Ranger Conclave.', kind: 'subclass', count: 1, pool: 'all', grants: [], required: true, resolved: false }, spellChoice('ranger_spells_3', 1, 'Choose 1 more ranger spell known.')], grants: [{ kind: 'feature', value: { id: 'ranger_conclave', name: 'Ranger Conclave', description: 'At 3rd level you choose a conclave to emulate (the SRD offers the Hunter). It grants features at 3rd, 7th, 11th and 15th level.', source: { kind: 'class', refId: 'ranger' }, level: 3, effects: [], actions: [], choices: [], passive: true } }, { kind: 'feature', value: { id: 'primeval_awareness', name: 'Primeval Awareness', description: 'You can use your action and expend one ranger spell slot to focus your awareness, sensing whether certain kinds of creatures (per your DM: aberrations, celestials, dragons, elementals, fey, fiends, undead) are present within 1 mile (6 miles in your favored terrain).', source: { kind: 'class', refId: 'ranger' }, level: 3, effects: [], actions: [], choices: [], passive: false, activation: { actionType: 'action', resourceCost: { resourceId: 'spell_slots', quantity: 1, spellSlotTier: 1 }, range: 'self', target: 'self', requiresSave: null } } }] },
    { level: 4, hpDie: 10, choices: [asiChoice('ranger_asi_4')], grants: [] },
    { level: 5, hpDie: 10, choices: [spellChoice('ranger_spells_5', 1, 'Choose 1 more ranger spell known.')], grants: [{ kind: 'feature', value: { id: 'extra_attack_ranger', name: 'Extra Attack', description: 'You can attack twice when you take the Attack action.', source: { kind: 'class', refId: 'ranger' }, level: 5, effects: [{ type: 'stat_modifier', target: 'extra_attack', operation: 'set', value: 1, condition: null }], actions: [], choices: [], passive: true } }] },
    {
      level: 6, hpDie: 10, choices: [favoredEnemyChoice('ranger_favored_enemy_6', 2), favoredTerrainChoice('ranger_favored_terrain_6')], grants: [
        { kind: 'feature', value: { id: 'favored_enemy_2', name: 'Favored Enemy (2nd)', description: 'Choose a second favored enemy and a second favored terrain (both picks wait with your class choices).', source: { kind: 'class', refId: 'ranger' }, level: 6, effects: [], actions: [], choices: [], passive: true } },
      ],
    },
    { level: 7, hpDie: 10, choices: [spellChoice('ranger_spells_7', 1, 'Choose 1 more ranger spell known.')], grants: [] },
    {
      level: 8, hpDie: 10, choices: [asiChoice('ranger_asi_8')], grants: [
        { kind: 'feature', value: { id: 'lands_stride', name: "Land's Stride", description: 'Moving through nonmagical difficult terrain costs you no extra movement, and you can pass through nonmagical plants without being slowed by them and without taking damage from them if they have thorns, spines, or a similar hazard. You also have advantage on saving throws against plants that are magically created or manipulated to impede movement.', source: { kind: 'class', refId: 'ranger' }, level: 8, effects: [], actions: [], choices: [], passive: true } },
      ],
    },
    { level: 9, hpDie: 10, choices: [spellChoice('ranger_spells_9', 1, 'Choose 1 more ranger spell known.')], grants: [] },
    {
      level: 10, hpDie: 10, choices: [favoredTerrainChoice('ranger_favored_terrain_10')], grants: [
        { kind: 'feature', value: { id: 'natural_explorer_3', name: 'Natural Explorer (3rd terrain)', description: 'Choose a third favored terrain (the pick waits with your class choices).', source: { kind: 'class', refId: 'ranger' }, level: 10, effects: [], actions: [], choices: [], passive: true } },
        { kind: 'feature', value: { id: 'hide_in_plain_sight', name: 'Hide in Plain Sight', description: 'You can spend 1 minute creating camouflage from natural materials and, once camouflaged, gain a +10 bonus to Dexterity (Stealth) checks as long as you remain there without moving or attacking. No engine hook for a conditional situational Stealth bonus — apply manually.', source: { kind: 'class', refId: 'ranger' }, level: 10, effects: [], actions: [], choices: [], passive: false, activation: { actionType: 'other', resourceCost: null, range: 'self', target: 'self', requiresSave: null } } },
      ],
    },
    { level: 11, hpDie: 10, choices: [spellChoice('ranger_spells_11', 1, 'Choose 1 more ranger spell known.')], grants: [] },
    { level: 12, hpDie: 10, choices: [asiChoice('ranger_asi_12')], grants: [] },
    { level: 13, hpDie: 10, choices: [spellChoice('ranger_spells_13', 1, 'Choose 1 more ranger spell known.')], grants: [] },
    {
      level: 14, hpDie: 10, choices: [favoredEnemyChoice('ranger_favored_enemy_14', 3)], grants: [
        { kind: 'feature', value: { id: 'favored_enemy_3', name: 'Favored Enemy (3rd)', description: 'Choose a third favored enemy (the pick waits with your class choices).', source: { kind: 'class', refId: 'ranger' }, level: 14, effects: [], actions: [], choices: [], passive: true } },
        { kind: 'feature', value: { id: 'vanish', name: 'Vanish', description: "You can use the Hide action as a bonus action on your turn, and you can't be tracked by nonmagical means unless you choose to leave a trail.", source: { kind: 'class', refId: 'ranger' }, level: 14, effects: [], actions: [], choices: [], passive: true } },
      ],
    },
    { level: 15, hpDie: 10, choices: [spellChoice('ranger_spells_15', 1, 'Choose 1 more ranger spell known.')], grants: [] },
    { level: 16, hpDie: 10, choices: [asiChoice('ranger_asi_16')], grants: [] },
    { level: 17, hpDie: 10, choices: [spellChoice('ranger_spells_17', 1, 'Choose 1 more ranger spell known.')], grants: [] },
    {
      level: 18, hpDie: 10, choices: [], grants: [
        { kind: 'feature', value: { id: 'feral_senses', name: 'Feral Senses', description: "You gain preternatural senses that help you fight creatures you can't see. When you attack a creature you can't see, your inability to see it doesn't impose disadvantage on your attack rolls against it. You are also aware of the location of any invisible creature within 30 feet of you, provided the creature isn't hidden from you and you aren't blinded or deafened.", source: { kind: 'class', refId: 'ranger' }, level: 18, effects: [], actions: [], choices: [], passive: true } },
      ],
    },
    { level: 19, hpDie: 10, choices: [asiChoice('ranger_asi_19'), spellChoice('ranger_spells_19', 1, 'Choose 1 more ranger spell known.')], grants: [] },
    { level: 20, hpDie: 10, choices: [], grants: [{ kind: 'feature', value: { id: 'foe_slayer', name: 'Foe Slayer', description: 'You become an unparalleled hunter of your enemies. Once on each of your turns, you can add your Wisdom modifier to the attack roll or the damage roll of an attack you make against one of your favored enemies.', source: { kind: 'class', refId: 'ranger' }, level: 20, effects: [], actions: [], choices: [], passive: true,
      trigger: 'Once on each of your turns, when you attack one of your favored enemies.' } }] },
  ],
};

// ── Paladin ───────────────────────────────────────────────────────────────────

const paladinSkillChoice: ChoiceDefinition = {
  id: 'paladin_skills_lvl_1',
  prompt: 'Choose 2 skills from: Athletics, Insight, Intimidation, Medicine, Persuasion, Religion.',
  kind: 'skill', count: 2,
  pool: [
    { id: 'athletics',    label: 'Athletics',    value: 'athletics' },
    { id: 'insight',      label: 'Insight',      value: 'insight' },
    { id: 'intimidation', label: 'Intimidation', value: 'intimidation' },
    { id: 'medicine',     label: 'Medicine',     value: 'medicine' },
    { id: 'persuasion',   label: 'Persuasion',   value: 'persuasion' },
    { id: 'religion',     label: 'Religion',     value: 'religion' },
  ],
  grants: [], required: true, resolved: false,
};

export const paladinProgression: ClassProgression = {
  classId: 'paladin',
  srd: true,
  entries: [
    {
      level: 1, hpDie: 10, choices: [
        paladinSkillChoice,
        equipmentChoice('paladin_equip_a', 'Choose: (a) a martial weapon and a shield or (b) two martial weapons', [
          { id: 'weapon_shield', label: 'Martial weapon + Shield (Longsword + Shield)', items: ['longsword', 'shield'] },
          { id: 'two_martial',   label: 'Two martial weapons (Longsword + Battleaxe)',  items: ['longsword', 'battleaxe'] },
        ]),
        equipmentChoice('paladin_equip_b', 'Choose: (a) five javelins or (b) any simple melee weapon', [
          { id: 'javelins', label: 'Five Javelins', items: ['javelin', 'javelin', 'javelin', 'javelin', 'javelin'] },
          { id: 'simple',   label: 'A simple melee weapon', items: [], itemFilter: { constraint: { category: 'weapon', weaponClass: 'simple', weaponRange: 'melee' }, quantity: 1 } },
        ]),
        equipmentChoice('paladin_equip_c', "Choose a pack: (a) priest's or (b) explorer's", [
          { id: 'priest',   label: "Priest's Pack",   items: ['priests_pack'] },
          { id: 'explorer', label: "Explorer's Pack", items: ['explorers_pack'] },
        ]),
      ],
      grants: [
        ...startingItems('chain_mail', 'holy_symbol'),
        { kind: 'feature', value: { id: 'divine_sense', name: 'Divine Sense', description: 'The presence of strong evil registers on your senses like a noxious odor — as an action, detect the location of any celestial/fiend/undead within 60 feet not behind total cover. Uses per long rest = 1 + CHA modifier (simplified to a flat 1 here — no ability-mod-scaled resource pool exists in the engine).', source: { kind: 'class', refId: 'paladin' }, level: 1, effects: [], actions: [], choices: [], passive: false, activation: { actionType: 'action', resourceCost: { resourceId: 'divine_sense_pool', quantity: 1 }, range: '60 feet', target: 'area', requiresSave: null } } },
        { kind: 'resource', value: { resourceId: 'divine_sense_pool', name: 'Divine Sense (scales with Charisma modifier)', maximum: 1, recharge: 'long_rest' } },
        // resourceCost quantity is a symbolic "spend at least 1" — the real
        // rule lets you spend any number of points up to the pool per use
        // (1 point = 1 HP healed); the engine's resourceCost model only
        // supports a fixed per-use quantity, so the actual amount healed is
        // tracked manually against the pool shown on the character sheet.
        { kind: 'feature', value: { id: 'lay_on_hands', name: 'Lay on Hands', description: 'Your blessed touch can heal wounds. You have a pool of healing power equal to 5× your paladin level — spend it 1 point per HP healed on a touched creature (or 5 points to cure one disease/neutralize one poison instead).', source: { kind: 'class', refId: 'paladin' }, level: 1, effects: [], actions: [], choices: [], passive: false, activation: { actionType: 'action', resourceCost: { resourceId: 'lay_on_hands_pool', quantity: 1 }, range: 'touch', target: 'single', requiresSave: null } } },
        { kind: 'resource', value: { resourceId: 'lay_on_hands_pool', name: 'Lay on Hands HP', maximum: 5, recharge: 'long_rest' } },
      ],
    },
    { level: 2, hpDie: 10, choices: [fightingStyleChoice('paladin_fighting_style', { kind: 'class', refId: 'paladin' }, PALADIN_STYLES)], grants: [{ kind: 'feature', value: { id: 'fighting_style_paladin', name: 'Fighting Style', description: 'You adopt a particular style of fighting as your specialty: choose one of Defense, Dueling, Great Weapon Fighting or Protection (the pick waits with your class choices).', source: { kind: 'class', refId: 'paladin' }, level: 2, effects: [], actions: [], choices: [], passive: true } }, { kind: 'feature', value: { id: 'divine_smite', name: 'Divine Smite', description: 'When you hit a creature with a melee weapon attack, you can expend one spell slot to deal extra radiant damage — 2d8 for a 1st-level slot, +1d8 per slot level above 1st (max 5d8), +1d8 more against undead/fiends.', source: { kind: 'class', refId: 'paladin' }, level: 2, effects: [], actions: [], choices: [], passive: false, activation: { actionType: 'free', resourceCost: { resourceId: 'spell_slots', quantity: 1, spellSlotTier: 1 }, range: 'self', target: 'single', requiresSave: null,
      // A-57: which slot tier to expend is a real player choice, not just
      // flavor — each tier spends a DIFFERENT resource and deals different
      // damage. Previously hardcoded to always spend a 1st-level slot
      // regardless of what the player actually had available or wanted.
      options: [
        { id: 'tier1', label: '1st-level slot', resourceCost: { resourceId: 'spell_slots', quantity: 1, spellSlotTier: 1 }, description: '+2d8 radiant damage (+1d8 more vs. undead or fiends)' },
        { id: 'tier2', label: '2nd-level slot', resourceCost: { resourceId: 'spell_slots', quantity: 1, spellSlotTier: 2 }, description: '+3d8 radiant damage (+1d8 more vs. undead or fiends)' },
        { id: 'tier3', label: '3rd-level slot', resourceCost: { resourceId: 'spell_slots', quantity: 1, spellSlotTier: 3 }, description: '+4d8 radiant damage (+1d8 more vs. undead or fiends)' },
        { id: 'tier4', label: '4th-level slot', resourceCost: { resourceId: 'spell_slots', quantity: 1, spellSlotTier: 4 }, description: '+5d8 radiant damage — the maximum (+1d8 more vs. undead or fiends)' },
        { id: 'tier5', label: '5th-level slot', resourceCost: { resourceId: 'spell_slots', quantity: 1, spellSlotTier: 5 }, description: '+5d8 radiant damage — same as a 4th-level slot, no further gain (+1d8 more vs. undead or fiends)' },
      ],
    } } }, { kind: 'init_spellcasting', value: { ability: 'cha' } }, { kind: 'spell_slots', value: { level: 2 } }, { kind: 'resource_upgrade', value: { resourceId: 'lay_on_hands_pool', newMaximum: 10 } }] },
    { level: 3, hpDie: 10, choices: [{ id: 'sacred_oath_choice', prompt: 'Choose a Sacred Oath.', kind: 'subclass', count: 1, pool: 'all', grants: [], required: true, resolved: false }], grants: [{ kind: 'feature', value: { id: 'divine_health', name: 'Divine Health', description: 'The divine magic flowing through you makes you immune to disease.', source: { kind: 'class', refId: 'paladin' }, level: 3, effects: [{ type: 'condition_immunity', target: 'disease', operation: 'immunity', value: null, condition: null }], actions: [], choices: [], passive: true } }, { kind: 'feature', value: { id: 'sacred_oath', name: 'Sacred Oath', description: 'At 3rd level you swear the oath that binds you as a paladin forever (the SRD offers the Oath of Devotion). Your oath\'s spells are always prepared and don\'t count against the number of spells you prepare; it grants Channel Divinity options (one use per short or long rest) and features at 3rd, 7th, 15th and 20th level.', source: { kind: 'class', refId: 'paladin' }, level: 3, effects: [], actions: [], choices: [], passive: true } }, { kind: 'resource', value: { resourceId: 'channel_divinity_paladin', name: 'Channel Divinity', maximum: 1, recharge: 'short_rest' } }, { kind: 'resource_upgrade', value: { resourceId: 'lay_on_hands_pool', newMaximum: 15 } }] },
    { level: 4, hpDie: 10, choices: [asiChoice('paladin_asi_4')], grants: [{ kind: 'resource_upgrade', value: { resourceId: 'lay_on_hands_pool', newMaximum: 20 } }] },
    { level: 5, hpDie: 10, choices: [], grants: [{ kind: 'feature', value: { id: 'extra_attack_paladin', name: 'Extra Attack', description: 'You can attack twice when you take the Attack action.', source: { kind: 'class', refId: 'paladin' }, level: 5, effects: [{ type: 'stat_modifier', target: 'extra_attack', operation: 'set', value: 1, condition: null }], actions: [], choices: [], passive: true } }, { kind: 'resource_upgrade', value: { resourceId: 'lay_on_hands_pool', newMaximum: 25 } }] },
    { level: 6, hpDie: 10, choices: [], grants: [{ kind: 'feature', value: { id: 'aura_of_protection', name: 'Aura of Protection', description: 'You and friendly creatures within 10 feet of you add your Charisma modifier to saving throws.', source: { kind: 'class', refId: 'paladin' }, level: 6, effects: [], actions: [], choices: [], passive: true } }, { kind: 'resource_upgrade', value: { resourceId: 'lay_on_hands_pool', newMaximum: 30 } }] },
    { level: 7,  hpDie: 10, choices: [], grants: [{ kind: 'resource_upgrade', value: { resourceId: 'lay_on_hands_pool', newMaximum: 35 } }] },
    { level: 8,  hpDie: 10, choices: [asiChoice('paladin_asi_8')],  grants: [{ kind: 'resource_upgrade', value: { resourceId: 'lay_on_hands_pool', newMaximum: 40 } }] },
    { level: 9,  hpDie: 10, choices: [], grants: [{ kind: 'resource_upgrade', value: { resourceId: 'lay_on_hands_pool', newMaximum: 45 } }] },
    {
      level: 10, hpDie: 10, choices: [], grants: [
        { kind: 'resource_upgrade', value: { resourceId: 'lay_on_hands_pool', newMaximum: 50 } },
        { kind: 'feature', value: { id: 'aura_of_courage', name: 'Aura of Courage', description: 'You and friendly creatures within 10 feet of you can’t be frightened while you are conscious. No engine hook for granting an ongoing condition immunity to nearby allies (only self-targeted immunities are modeled) — apply manually.', source: { kind: 'class', refId: 'paladin' }, level: 10, effects: [], actions: [], choices: [], passive: true } },
      ],
    },
    {
      level: 11, hpDie: 10, choices: [], grants: [
        { kind: 'resource_upgrade', value: { resourceId: 'lay_on_hands_pool', newMaximum: 55 } },
        { kind: 'feature', value: { id: 'improved_divine_smite', name: 'Improved Divine Smite', description: 'Whenever you hit a creature with a melee weapon, the creature takes an extra 1d8 radiant damage — this happens even without expending a spell slot for Divine Smite.', source: { kind: 'class', refId: 'paladin' }, level: 11, effects: [], actions: [], choices: [], passive: true,
      trigger: 'Whenever you hit a creature with a melee weapon attack.' } },
      ],
    },
    { level: 12, hpDie: 10, choices: [asiChoice('paladin_asi_12')], grants: [{ kind: 'resource_upgrade', value: { resourceId: 'lay_on_hands_pool', newMaximum: 60 } }] },
    { level: 13, hpDie: 10, choices: [], grants: [{ kind: 'resource_upgrade', value: { resourceId: 'lay_on_hands_pool', newMaximum: 65 } }] },
    {
      level: 14, hpDie: 10, choices: [], grants: [
        { kind: 'resource_upgrade', value: { resourceId: 'lay_on_hands_pool', newMaximum: 70 } },
        { kind: 'feature', value: { id: 'cleansing_touch', name: 'Cleansing Touch', description: 'You can use your action to end one spell on yourself or on one willing creature you touch, a number of times equal to your Charisma modifier (minimum once) per long rest (simplified to a flat 1 here — no ability-mod-scaled resource pool exists in the engine).', source: { kind: 'class', refId: 'paladin' }, level: 14, effects: [], actions: [], choices: [], passive: false, activation: { actionType: 'action', resourceCost: { resourceId: 'cleansing_touch_pool', quantity: 1 }, range: 'touch', target: 'single', requiresSave: null } } },
        { kind: 'resource', value: { resourceId: 'cleansing_touch_pool', name: 'Cleansing Touch (scales with Charisma modifier)', maximum: 1, recharge: 'long_rest' } },
      ],
    },
    { level: 15, hpDie: 10, choices: [], grants: [{ kind: 'resource_upgrade', value: { resourceId: 'lay_on_hands_pool', newMaximum: 75 } }] },
    { level: 16, hpDie: 10, choices: [asiChoice('paladin_asi_16')], grants: [{ kind: 'resource_upgrade', value: { resourceId: 'lay_on_hands_pool', newMaximum: 80 } }] },
    { level: 17, hpDie: 10, choices: [], grants: [{ kind: 'resource_upgrade', value: { resourceId: 'lay_on_hands_pool', newMaximum: 85 } }] },
    {
      level: 18, hpDie: 10, choices: [], grants: [
        { kind: 'resource_upgrade', value: { resourceId: 'lay_on_hands_pool', newMaximum: 90 } },
        { kind: 'feature', value: { id: 'aura_improvements', name: 'Aura Improvements', description: 'The range of your Aura of Protection and Aura of Courage increases to 30 feet.', source: { kind: 'class', refId: 'paladin' }, level: 18, effects: [], actions: [], choices: [], passive: true } },
      ],
    },
    { level: 19, hpDie: 10, choices: [asiChoice('paladin_asi_19')], grants: [{ kind: 'resource_upgrade', value: { resourceId: 'lay_on_hands_pool', newMaximum: 95 } }] },
    { level: 20, hpDie: 10, choices: [], grants: [{ kind: 'feature', value: { id: 'sacred_oath_20', name: 'Sacred Oath Feature', description: 'You gain a feature from your Sacred Oath.', source: { kind: 'class', refId: 'paladin' }, level: 20, effects: [], actions: [], choices: [], passive: true } }] },
  ],
};

// ── Druid ─────────────────────────────────────────────────────────────────────

const druidSkillChoice: ChoiceDefinition = {
  id: 'druid_skills_lvl_1',
  prompt: 'Choose 2 skills from: Arcana, Animal Handling, Insight, Medicine, Nature, Perception, Religion, Survival.',
  kind: 'skill', count: 2,
  pool: [
    { id: 'arcana',          label: 'Arcana',          value: 'arcana' },
    { id: 'animal_handling', label: 'Animal Handling', value: 'animal_handling' },
    { id: 'insight',         label: 'Insight',         value: 'insight' },
    { id: 'medicine',        label: 'Medicine',        value: 'medicine' },
    { id: 'nature',          label: 'Nature',          value: 'nature' },
    { id: 'perception',      label: 'Perception',      value: 'perception' },
    { id: 'religion',        label: 'Religion',        value: 'religion' },
    { id: 'survival',        label: 'Survival',        value: 'survival' },
  ],
  grants: [], required: true, resolved: false,
};

export const druidProgression: ClassProgression = {
  classId: 'druid',
  srd: true,
  entries: [
    {
      level: 1, hpDie: 8, choices: [
        druidSkillChoice,
        spellChoice('druid_cantrips_1', 2, 'Choose 2 druid cantrips.'),
        equipmentChoice('druid_equip_a', 'Choose: (a) a wooden shield or (b) any simple weapon', [
          { id: 'shield', label: 'Wooden Shield', items: ['shield'] },
          { id: 'simple', label: 'A simple weapon', items: [], itemFilter: { constraint: { category: 'weapon', weaponClass: 'simple' }, quantity: 1 } },
        ]),
        equipmentChoice('druid_equip_b', 'Choose: (a) a scimitar or (b) any simple melee weapon', [
          { id: 'scimitar', label: 'Scimitar', items: ['scimitar'] },
          { id: 'simple',   label: 'A simple melee weapon', items: [], itemFilter: { constraint: { category: 'weapon', weaponClass: 'simple', weaponRange: 'melee' }, quantity: 1 } },
        ]),
      ],
      grants: [
        ...startingItems('leather_armor', 'explorers_pack', 'druidic_focus'),
        { kind: 'feature', value: { id: 'druid_spellcasting', name: 'Spellcasting', description: 'You cast druid spells using Wisdom: your spell save DC is 8 + your proficiency bonus + your Wisdom modifier, and your spell attack modifier is your proficiency bonus + your Wisdom modifier. After a long rest you prepare a number of spells from the whole druid spell list equal to your Wisdom modifier + druid level (minimum one); casting one expends a slot of its level or higher. You can cast a prepared spell with the ritual tag as a ritual. You can use a druidic focus as a spellcasting focus.', source: { kind: 'class', refId: 'druid' }, level: 1, effects: [], actions: [], choices: [], passive: true } },
        { kind: 'feature', value: { id: 'druidic', name: 'Druidic', description: 'You know Druidic, the secret language of druids. You can speak it and use it to leave hidden messages. You and others who know this language automatically spot such a message. Others spot its presence with a successful DC 15 Wisdom (Perception) check but can\'t decipher it without magic.', source: { kind: 'class', refId: 'druid' }, level: 1, effects: [], actions: [], choices: [], passive: true } },
        { kind: 'init_spellcasting', value: { ability: 'wis' } },
        { kind: 'spell_slots', value: { level: 1 } },
      ],
    },
    { level: 2, hpDie: 8, choices: [{ id: 'druid_circle_choice', prompt: 'Choose a Druid Circle.', kind: 'subclass', count: 1, pool: 'all', grants: [], required: true, resolved: false }], grants: [
      { kind: 'feature', value: WILD_SHAPE_2014 },
      { kind: 'feature', value: { id: 'druid_circle', name: 'Druid Circle', description: 'At 2nd level you choose to identify with a circle of druids (the SRD offers the Circle of the Land). It grants features at 2nd, 6th, 10th and 14th level.', source: { kind: 'class', refId: 'druid' }, level: 2, effects: [], actions: [], choices: [], passive: true } },
      { kind: 'resource', value: { resourceId: 'wild_shape_pool', name: 'Wild Shape', maximum: 2, recharge: 'short_rest' } },
    ] },
    { level: 3, hpDie: 8, choices: [], grants: [] },
    {
      level: 4, hpDie: 8, choices: [asiChoice('druid_asi_4'), spellChoice('druid_cantrips_4', 1, 'Choose 1 more druid cantrip.')], grants: [
        { kind: 'feature', value: { id: 'wild_shape_swim', name: 'Wild Shape: Swim Speed Allowed', description: 'Your Wild Shape restriction eases: you can now transform into a beast with a swimming speed, up to Challenge Rating 1/2. The Wild Shape card lists the forms you can take.', source: { kind: 'class', refId: 'druid' }, level: 4, effects: [], actions: [], choices: [], passive: true } },
      ],
    },
    ...stubEntries([5,6,7], 8),
    {
      level: 8, hpDie: 8, choices: [asiChoice('druid_asi_8')], grants: [
        { kind: 'feature', value: { id: 'wild_shape_fly', name: 'Wild Shape: Fly Speed Allowed', description: 'Your Wild Shape restriction eases again: you can now transform into a beast with a flying speed, up to Challenge Rating 1. The Wild Shape card lists the forms you can take.', source: { kind: 'class', refId: 'druid' }, level: 8, effects: [], actions: [], choices: [], passive: true } },
      ],
    },
    ...stubEntries([9], 8),
    { level: 10, hpDie: 8, choices: [spellChoice('druid_cantrips_10', 1, 'Choose 1 more druid cantrip.')], grants: [] },
    ...stubEntries([11], 8),
    { level: 12, hpDie: 8, choices: [asiChoice('druid_asi_12')], grants: [] },
    ...stubEntries([13,14,15], 8),
    { level: 16, hpDie: 8, choices: [asiChoice('druid_asi_16')], grants: [] },
    ...stubEntries([17], 8),
    {
      level: 18, hpDie: 8, choices: [], grants: [
        { kind: 'feature', value: { id: 'timeless_body_druid', name: 'Timeless Body', description: "For every 10 years that pass, your body ages only 1 year. You no longer need to eat or drink.", source: { kind: 'class', refId: 'druid' }, level: 18, effects: [], actions: [], choices: [], passive: true } },
        { kind: 'feature', value: { id: 'beast_spells', name: 'Beast Spells', description: 'You can cast many of your druid spells in any shape you assume using Wild Shape. You can perform the somatic and verbal components of a druid spell while in a beast shape, but you aren\'t able to provide material components.', source: { kind: 'class', refId: 'druid' }, level: 18, effects: [], actions: [], choices: [], passive: true } },
      ],
    },
    { level: 19, hpDie: 8, choices: [asiChoice('druid_asi_19')], grants: [] },
    {
      level: 20, hpDie: 8, choices: [], grants: [
        { kind: 'feature', value: { id: 'archdruid', name: 'Archdruid', description: 'You can use your Wild Shape an unlimited number of times. In addition, you can ignore the verbal and somatic components of your druid spells, as well as any material components that lack a cost and aren\'t consumed by a spell, both in your normal shape and in your beast shape from Wild Shape.', source: { kind: 'class', refId: 'druid' }, level: 20, effects: [], actions: [], choices: [], passive: true } },
        { kind: 'resource_upgrade', value: { resourceId: 'wild_shape_pool', newMaximum: 999 } },
      ],
    },
  ],
};

// ── Bard ──────────────────────────────────────────────────────────────────────

export const bardProgression: ClassProgression = {
  classId: 'bard',
  srd: true,
  entries: [
    {
      level: 1, hpDie: 8,
      choices: [
        {
          id: 'bard_skills_lvl_1',
          prompt: 'Choose any 3 skills.',
          kind: 'skill', count: 3, pool: 'all',
          grants: [], required: true, resolved: false,
        },
        equipmentChoice('bard_equip_a', 'Choose a weapon: (a) a rapier, (b) a longsword, or (c) any simple weapon', [
          { id: 'rapier',    label: 'Rapier', items: ['rapier'] },
          { id: 'longsword', label: 'Longsword', items: ['longsword'] },
          { id: 'simple',    label: 'A simple weapon', items: [], itemFilter: { constraint: { category: 'weapon', weaponClass: 'simple' }, quantity: 1 } },
        ]),
        equipmentChoice('bard_equip_b', "Choose a pack: (a) diplomat's or (b) entertainer's", [
          { id: 'diplomat',    label: "Diplomat's Pack",    items: ['diplomats_pack'] },
          { id: 'entertainer', label: "Entertainer's Pack", items: ['entertainers_pack'] },
        ]),
        // CHOICE-EXPANSION-3: "any musical instrument" deliberately NOT
        // migrated to itemFilter like the "any simple weapon" choices above —
        // ItemFilterConstraint's category union (weapon/armor/shield/
        // ammunition/tool/focus/gear) has no musical-instrument-specific
        // value, and the general Item catalog entries this filters against
        // don't carry the ToolCategory tag (artisan/gaming_set/
        // musical_instrument/other) the separate ALL_TOOLS registry uses —
        // these are two distinct, unbridged content models. Real player
        // choice among instruments already exists via the Tool/Language/
        // Expertise ChoiceDefinition system (see toolCategoryPool() usage
        // elsewhere in this file for "any artisan's tools"-style choices),
        // but that system grants a PROFICIENCY, not a carried inventory
        // item — not a safe drop-in replacement for starting equipment.
        // Left flattened to one example per the "don't infer uncertain
        // rules" rule; a real fix needs new metadata bridging, not content
        // authoring.
        equipmentChoice('bard_equip_c', 'Choose an instrument: (a) a lute or (b) any musical instrument', [
          { id: 'lute',  label: 'Lute', items: ['lute'] },
          { id: 'other', label: 'Any musical instrument (Lute)', items: ['lute'] },
        ]),
        spellChoice('bard_cantrips_1', 2, 'Choose 2 bard cantrips.'),
        spellChoice('bard_spells_1', 4, 'Choose 4 bard spells known.'),
        // CHOICE-EXPANSION-2: RAW "three musical instruments of your choice"
        // proficiency was previously not modeled at all — no grant, no
        // choice, not even flavor text.
        toolChoice('bard_instruments_lvl_1', 3, 'Choose three musical instruments.', toolCategoryPool('musical_instrument')),
      ],
      grants: [
        ...startingItems('leather_armor', 'dagger'),
        { kind: 'feature', value: { id: 'bard_spellcasting', name: 'Spellcasting', description: 'You cast bard spells using Charisma: your spell save DC is 8 + your proficiency bonus + your Charisma modifier, and your spell attack modifier is your proficiency bonus + your Charisma modifier. You know the number of bard cantrips and spells your class table shows; casting a spell expends a slot of its level or higher. When you gain a bard level, you can replace one bard spell you know with another of a level you have slots for. You can cast a bard spell you know as a ritual if it has the ritual tag. You can use a musical instrument as a spellcasting focus.', source: { kind: 'class', refId: 'bard' }, level: 1, effects: [], actions: [], choices: [], passive: true } },
        { kind: 'feature', value: { id: 'bardic_inspiration', name: 'Bardic Inspiration', description: 'As a bonus action, you can give one creature other than yourself within 60 feet that can hear you a Bardic Inspiration die, a d6. Once within the next 10 minutes, it can roll the die and add the number to one ability check, attack roll or saving throw it makes, after seeing the d20 roll but before the DM says whether it succeeds. A creature can have only one Bardic Inspiration die at a time. You can use this a number of times equal to your Charisma modifier (minimum once), regaining all uses when you finish a long rest. The die becomes a d8 at 5th level, a d10 at 10th and a d12 at 15th.', source: { kind: 'class', refId: 'bard' }, level: 1, effects: [], actions: [], choices: [], passive: false, activation: { actionType: 'bonus_action', resourceCost: { resourceId: 'bardic_inspiration_pool', quantity: 1 }, range: '60 feet', target: 'single', requiresSave: null } } },
        { kind: 'resource', value: { resourceId: 'bardic_inspiration_pool', name: 'Bardic Inspiration', maximum: 3, recharge: 'long_rest' } },
        { kind: 'init_spellcasting', value: { ability: 'cha' } },
        { kind: 'spell_slots', value: { level: 1 } },
      ],
    },
    { level: 2, hpDie: 8, choices: [spellChoice('bard_spells_2', 1, 'Choose 1 more bard spell known.')], grants: [{ kind: 'feature', value: { id: 'jack_of_all_trades', name: 'Jack of All Trades', description: 'You can add half your proficiency bonus to any ability check that doesn\'t use your proficiency bonus.', source: { kind: 'class', refId: 'bard' }, level: 2, effects: [], actions: [], choices: [], passive: true } }, { kind: 'feature', value: { id: 'song_of_rest', name: 'Song of Rest', description: 'If you or any friendly creatures who can hear your performance regain hit points at the end of a short rest by spending one or more Hit Dice, each of those creatures regains an extra 1d6 hit points. The die becomes a d8 at 9th level, a d10 at 13th and a d12 at 17th.', source: { kind: 'class', refId: 'bard' }, level: 2, effects: [], actions: [], choices: [], passive: true } }] },
    { level: 3, hpDie: 8, choices: [{ id: 'bard_college_choice', prompt: 'Choose a Bard College.', kind: 'subclass', count: 1, pool: 'all', grants: [], required: true, resolved: false }, spellChoice('bard_spells_3', 1, 'Choose 1 more bard spell known.'), expertiseChoice('bard_expertise_3', 2, 'Choose two of your skill proficiencies to gain Expertise (double proficiency bonus).')], grants: [{ kind: 'feature', value: { id: 'bard_college', name: 'Bard College', description: 'At 3rd level you delve into the advanced techniques of a bard college of your choice (the SRD offers the College of Lore). It grants features at 3rd, 6th and 14th level.', source: { kind: 'class', refId: 'bard' }, level: 3, effects: [], actions: [], choices: [], passive: true } }, { kind: 'feature', value: { id: 'expertise_bard', name: 'Expertise', description: 'Choose two of your skill proficiencies to double your proficiency bonus.', source: { kind: 'class', refId: 'bard' }, level: 3, effects: [], actions: [], choices: [], passive: true } }] },
    { level: 4, hpDie: 8, choices: [asiChoice('bard_asi_4'), spellChoice('bard_cantrips_4', 1, 'Choose 1 more bard cantrip.'), spellChoice('bard_spells_4', 1, 'Choose 1 more bard spell known.')], grants: [] },
    {
      level: 5, hpDie: 8, choices: [spellChoice('bard_spells_5', 1, 'Choose 1 more bard spell known.')], grants: [
        { kind: 'feature', value: { id: 'font_of_inspiration', name: 'Font of Inspiration', description: 'You regain all of your expended uses of Bardic Inspiration when you finish a short or long rest. Your Bardic Inspiration die also improves to a d8.', source: { kind: 'class', refId: 'bard' }, level: 5, effects: [], actions: [], choices: [], passive: true } },
      ],
    },
    { level: 6, hpDie: 8, choices: [spellChoice('bard_spells_6', 1, 'Choose 1 more bard spell known.')], grants: [{ kind: 'feature', value: { id: 'countercharm', name: 'Countercharm', description: "Use your action to disrupt mind-influencing effects: until the end of your next turn, you and any ally within 30 feet who can hear you has advantage on saves against being frightened or charmed.", source: { kind: 'class', refId: 'bard' }, level: 6, effects: [], actions: [], choices: [], passive: false, activation: { actionType: 'action', resourceCost: null, range: '30 feet', target: 'area', requiresSave: null } } }] },
    { level: 7, hpDie: 8, choices: [spellChoice('bard_spells_7', 1, 'Choose 1 more bard spell known.')], grants: [] },
    { level: 8, hpDie: 8, choices: [asiChoice('bard_asi_8'), spellChoice('bard_spells_8', 1, 'Choose 1 more bard spell known.')], grants: [] },
    {
      level: 9, hpDie: 8, choices: [spellChoice('bard_spells_9', 1, 'Choose 1 more bard spell known.')], grants: [
        { kind: 'feature', value: { id: 'song_of_rest_d8', name: 'Song of Rest (d8)', description: 'The extra healing your Song of Rest provides during a short rest increases to a d8.', source: { kind: 'class', refId: 'bard' }, level: 9, effects: [], actions: [], choices: [], passive: true } },
      ],
    },
    {
      level: 10, hpDie: 8,
      choices: [
        spellChoice('bard_cantrips_10', 1, 'Choose 1 more bard cantrip.'),
        spellChoice('bard_spells_10', 2, 'Choose 2 more spells known — including your Magical Secrets picks, this app draws them from your own bard spell list rather than any class’s (a disclosed simplification).'),
        expertiseChoice('bard_expertise_10', 2, 'Choose two more skill proficiencies to gain Expertise.'),
      ],
      grants: [
        { kind: 'feature', value: { id: 'bardic_inspiration_d10', name: 'Bardic Inspiration (d10)', description: 'Your Bardic Inspiration die improves to a d10.', source: { kind: 'class', refId: 'bard' }, level: 10, effects: [], actions: [], choices: [], passive: true } },
        { kind: 'feature', value: { id: 'expertise_bard_10', name: 'Expertise', description: 'Choose two more skill proficiencies to double your proficiency bonus.', source: { kind: 'class', refId: 'bard' }, level: 10, effects: [], actions: [], choices: [], passive: true } },
        { kind: 'feature', value: { id: 'magical_secrets_10', name: 'Magical Secrets', description: "Two of the spells known you choose this level can be of any level you can cast, learned as if they were on the bard spell list — normally any class's list, simplified here to draw from the spell-choice picker at this level.", source: { kind: 'class', refId: 'bard' }, level: 10, effects: [], actions: [], choices: [], passive: true } },
      ],
    },
    { level: 11, hpDie: 8, choices: [spellChoice('bard_spells_11', 1, 'Choose 1 more bard spell known.')], grants: [] },
    { level: 12, hpDie: 8, choices: [asiChoice('bard_asi_12')], grants: [] },
    {
      level: 13, hpDie: 8, choices: [spellChoice('bard_spells_13', 1, 'Choose 1 more bard spell known.')], grants: [
        { kind: 'feature', value: { id: 'song_of_rest_d10', name: 'Song of Rest (d10)', description: 'The extra healing your Song of Rest provides during a short rest increases to a d10.', source: { kind: 'class', refId: 'bard' }, level: 13, effects: [], actions: [], choices: [], passive: true } },
      ],
    },
    {
      level: 14, hpDie: 8,
      choices: [spellChoice('bard_spells_14', 2, 'Choose 2 more spells known, including your Magical Secrets picks (see level 10’s note).')],
      grants: [
        { kind: 'feature', value: { id: 'magical_secrets_14', name: 'Magical Secrets', description: 'You learn two more spells as at 10th level.', source: { kind: 'class', refId: 'bard' }, level: 14, effects: [], actions: [], choices: [], passive: true } },
      ],
    },
    {
      level: 15, hpDie: 8, choices: [spellChoice('bard_spells_15', 1, 'Choose 1 more bard spell known.')], grants: [
        { kind: 'feature', value: { id: 'bardic_inspiration_d12', name: 'Bardic Inspiration (d12)', description: 'Your Bardic Inspiration die improves to a d12.', source: { kind: 'class', refId: 'bard' }, level: 15, effects: [], actions: [], choices: [], passive: true } },
      ],
    },
    { level: 16, hpDie: 8, choices: [asiChoice('bard_asi_16')], grants: [] },
    {
      level: 17, hpDie: 8, choices: [spellChoice('bard_spells_17', 1, 'Choose 1 more bard spell known.')], grants: [
        { kind: 'feature', value: { id: 'song_of_rest_d12', name: 'Song of Rest (d12)', description: 'The extra healing your Song of Rest provides during a short rest increases to a d12.', source: { kind: 'class', refId: 'bard' }, level: 17, effects: [], actions: [], choices: [], passive: true } },
      ],
    },
    {
      level: 18, hpDie: 8,
      choices: [spellChoice('bard_spells_18', 2, 'Choose 2 more spells known, including your Magical Secrets picks (see level 10’s note).')],
      grants: [
        { kind: 'feature', value: { id: 'magical_secrets_18', name: 'Magical Secrets', description: 'You learn two more spells as at 10th level.', source: { kind: 'class', refId: 'bard' }, level: 18, effects: [], actions: [], choices: [], passive: true } },
      ],
    },
    { level: 19, hpDie: 8, choices: [asiChoice('bard_asi_19')], grants: [] },
    { level: 20, hpDie: 8, choices: [], grants: [{ kind: 'feature', value: { id: 'superior_inspiration', name: 'Superior Inspiration', description: 'When you roll initiative and have no uses of Bardic Inspiration left, you regain one use.', source: { kind: 'class', refId: 'bard' }, level: 20, effects: [], actions: [], choices: [], passive: true } }] },
  ],
};

// ── Monk ──────────────────────────────────────────────────────────────────────

const monkSkillChoice: ChoiceDefinition = {
  id: 'monk_skills_lvl_1',
  prompt: 'Choose 2 skills from: Acrobatics, Athletics, History, Insight, Religion, Stealth.',
  kind: 'skill', count: 2,
  pool: [
    { id: 'acrobatics', label: 'Acrobatics', value: 'acrobatics' },
    { id: 'athletics',  label: 'Athletics',  value: 'athletics' },
    { id: 'history',    label: 'History',    value: 'history' },
    { id: 'insight',    label: 'Insight',    value: 'insight' },
    { id: 'religion',   label: 'Religion',   value: 'religion' },
    { id: 'stealth',    label: 'Stealth',    value: 'stealth' },
  ],
  grants: [], required: true, resolved: false,
};

export const monkProgression: ClassProgression = {
  classId: 'monk',
  srd: true,
  entries: [
    {
      level: 1, hpDie: 8, choices: [
        monkSkillChoice,
        equipmentChoice('monk_equip_a', 'Choose: (a) a shortsword or (b) any simple weapon', [
          { id: 'shortsword', label: 'Shortsword', items: ['shortsword'] },
          { id: 'simple',     label: 'A simple weapon', items: [], itemFilter: { constraint: { category: 'weapon', weaponClass: 'simple' }, quantity: 1 } },
        ]),
        equipmentChoice('monk_equip_b', "Choose a pack: (a) dungeoneer's or (b) explorer's", [
          { id: 'dungeoneer', label: "Dungeoneer's Pack", items: ['dungeoneers_pack'] },
          { id: 'explorer',   label: "Explorer's Pack",   items: ['explorers_pack'] },
        ]),
        // CHOICE-EXPANSION-2: RAW "one type of artisan's tools or one
        // musical instrument, your choice" was previously not modeled at
        // all — the legal pool spans BOTH categories, which toolCategoryPool
        // already supports (it just unions whichever categories are passed).
        toolChoice('monk_tool_lvl_1', 1, 'Choose one artisan\'s tools or one musical instrument.', toolCategoryPool('artisan', 'musical_instrument')),
      ],
      grants: [
        ...startingItems(...Array(10).fill('dart')),
        { kind: 'feature', value: { id: 'unarmored_defense_monk', name: 'Unarmored Defense', description: 'While you are wearing no armor and not wielding a shield, your AC equals 10 + your Dexterity modifier + your Wisdom modifier.', source: { kind: 'class', refId: 'monk' }, level: 1, effects: [{ type: 'base_ac_formula', target: 'ac', operation: 'set', value: 10, condition: null, formulaAbilities: ['dex', 'wis'] }], actions: [], choices: [], passive: true } },
        { kind: 'feature', value: { id: 'martial_arts', name: 'Martial Arts', description: 'While you are unarmed or wielding only monk weapons (shortswords and any simple melee weapons that don\'t have the two-handed or heavy property) and you aren\'t wearing armor or wielding a shield: you can use Dexterity instead of Strength for the attack and damage rolls of your unarmed strikes and monk weapons; you can roll a d4 in place of their normal damage (d6 at 5th level, d8 at 11th, d10 at 17th); and when you use the Attack action with an unarmed strike or a monk weapon on your turn, you can make one unarmed strike as a bonus action.', source: { kind: 'class', refId: 'monk' }, level: 1, effects: [], actions: [], choices: [], passive: true } },
      ],
    },
    { level: 2, hpDie: 8, choices: [], grants: [{ kind: 'feature', value: { id: 'ki', name: 'Ki', description: 'You have a number of ki points equal to your monk level, regained when you finish a short or long rest. Your ki save DC is 8 + your proficiency bonus + your Wisdom modifier. You start knowing three ki features: Flurry of Blows (right after you take the Attack action, spend 1 ki point to make two unarmed strikes as a bonus action), Patient Defense (spend 1 ki point to take the Dodge action as a bonus action) and Step of the Wind (spend 1 ki point to take the Disengage or Dash action as a bonus action; your jump distance is doubled for the turn).', source: { kind: 'class', refId: 'monk' }, level: 2, effects: [], actions: [], choices: [], passive: true } }, { kind: 'resource', value: { resourceId: 'ki_pool', name: 'Ki Points', maximum: 2, recharge: 'short_rest' } }, { kind: 'feature', value: { id: 'unarmored_movement', name: 'Unarmored Movement', description: 'Your speed increases by 10 feet while you are not wearing armor or wielding a shield.', source: { kind: 'class', refId: 'monk' }, level: 2, effects: [{ type: 'stat_modifier', target: 'speed', operation: 'add', value: 10, condition: null }], actions: [], choices: [], passive: true } }] },
    { level: 3, hpDie: 8, choices: [{ id: 'monastic_tradition_choice', prompt: 'Choose a Monastic Tradition.', kind: 'subclass', count: 1, pool: 'all', grants: [], required: true, resolved: false }], grants: [{ kind: 'feature', value: { id: 'monastic_tradition', name: 'Monastic Tradition', description: 'At 3rd level you commit yourself to a monastic tradition (the SRD offers the Way of the Open Hand). It grants features at 3rd, 6th, 11th and 17th level.', source: { kind: 'class', refId: 'monk' }, level: 3, effects: [], actions: [], choices: [], passive: true } }, { kind: 'feature', value: { id: 'deflect_missiles', name: 'Deflect Missiles', description: 'When you are hit by a ranged weapon attack, you can use your reaction to reduce the damage by 1d10 + your Dexterity modifier + your monk level. If you reduce it to 0, you can catch the missile if it is small enough to hold in one hand and you have a hand free. If you catch it, you can spend 1 ki point to make a ranged attack with it as part of the same reaction, with proficiency, as a monk weapon, at a range of 20/60 feet.', source: { kind: 'class', refId: 'monk' }, level: 3, effects: [], actions: [], choices: [], passive: false, activation: { actionType: 'reaction', resourceCost: null, range: 'self', target: 'self', requiresSave: null } } }, { kind: 'resource_upgrade', value: { resourceId: 'ki_pool', newMaximum: 3 } }] },
    { level: 4, hpDie: 8, choices: [asiChoice('monk_asi_4')], grants: [{ kind: 'feature', value: { id: 'slow_fall', name: 'Slow Fall', description: 'You can use your reaction when you fall to reduce any falling damage you take by an amount equal to five times your monk level.', source: { kind: 'class', refId: 'monk' }, level: 4, effects: [], actions: [], choices: [], passive: false, activation: { actionType: 'reaction', resourceCost: null, range: 'self', target: 'self', requiresSave: null } } }, { kind: 'resource_upgrade', value: { resourceId: 'ki_pool', newMaximum: 4 } }] },
    { level: 5, hpDie: 8, choices: [], grants: [{ kind: 'feature', value: { id: 'extra_attack_monk', name: 'Extra Attack', description: 'You can attack twice when you take the Attack action.', source: { kind: 'class', refId: 'monk' }, level: 5, effects: [{ type: 'stat_modifier', target: 'extra_attack', operation: 'set', value: 1, condition: null }], actions: [], choices: [], passive: true } }, { kind: 'feature', value: { id: 'stunning_strike', name: 'Stunning Strike', description: 'When you hit another creature with a melee weapon attack, you can spend 1 ki point to attempt a stunning strike. The target must succeed on a Constitution saving throw against your ki save DC or be stunned until the end of your next turn.', source: { kind: 'class', refId: 'monk' }, level: 5, effects: [], actions: [], choices: [], passive: false, activation: { actionType: 'free', resourceCost: { resourceId: 'ki_pool', quantity: 1 }, range: 'self', target: 'single', requiresSave: { ability: 'con', dc: 'ki_save_dc' } } } }, { kind: 'resource_upgrade', value: { resourceId: 'ki_pool', newMaximum: 5 } }] },
    {
      level: 6, hpDie: 8, choices: [], grants: [
        { kind: 'resource_upgrade', value: { resourceId: 'ki_pool', newMaximum: 6 } },
        { kind: 'feature', value: { id: 'ki_empowered_strikes', name: 'Ki-Empowered Strikes', description: 'Your unarmed strikes count as magical for the purpose of overcoming resistance and immunity to nonmagical attacks and damage.', source: { kind: 'class', refId: 'monk' }, level: 6, effects: [], actions: [], choices: [], passive: true } },
      ],
    },
    {
      level: 7, hpDie: 8, choices: [], grants: [
        { kind: 'resource_upgrade', value: { resourceId: 'ki_pool', newMaximum: 7 } },
        { kind: 'feature', value: { id: 'evasion_monk', name: 'Evasion', description: 'When subjected to an effect requiring a Dexterity save, take no damage on success and half on failure.', source: { kind: 'class', refId: 'monk' }, level: 7, effects: [], actions: [], choices: [], passive: true } },
        { kind: 'feature', value: { id: 'stillness_of_mind', name: 'Stillness of Mind', description: 'You can use your action to end one effect on yourself that is causing you to be charmed or frightened.', source: { kind: 'class', refId: 'monk' }, level: 7, effects: [], actions: [], choices: [], passive: false, activation: { actionType: 'action', resourceCost: null, range: 'self', target: 'self', requiresSave: null } } },
      ],
    },
    { level: 8, hpDie: 8, choices: [asiChoice('monk_asi_8')], grants: [{ kind: 'resource_upgrade', value: { resourceId: 'ki_pool', newMaximum: 8 } }] },
    {
      level: 9, hpDie: 8, choices: [], grants: [
        { kind: 'resource_upgrade', value: { resourceId: 'ki_pool', newMaximum: 9 } },
        { kind: 'feature', value: { id: 'unarmored_movement_2', name: 'Unarmored Movement Improvement', description: 'You can move along vertical surfaces and across liquids on your turn without falling during the move. No engine hook for bypassing normal movement/gravity rules — apply manually.', source: { kind: 'class', refId: 'monk' }, level: 9, effects: [], actions: [], choices: [], passive: true } },
      ],
    },
    {
      level: 10, hpDie: 8, choices: [], grants: [
        { kind: 'resource_upgrade', value: { resourceId: 'ki_pool', newMaximum: 10 } },
        { kind: 'feature', value: { id: 'purity_of_body', name: 'Purity of Body', description: 'Your mastery of ki makes you immune to disease and poison.', source: { kind: 'class', refId: 'monk' }, level: 10, effects: [{ type: 'condition_immunity', target: 'disease', operation: 'immunity', value: null, condition: null }, { type: 'grant_immunity', target: 'poison', operation: 'immunity', value: null, condition: null }], actions: [], choices: [], passive: true } },
      ],
    },
    { level: 11, hpDie: 8, choices: [], grants: [{ kind: 'resource_upgrade', value: { resourceId: 'ki_pool', newMaximum: 11 } }] },
    { level: 12, hpDie: 8, choices: [asiChoice('monk_asi_12')], grants: [{ kind: 'resource_upgrade', value: { resourceId: 'ki_pool', newMaximum: 12 } }] },
    {
      level: 13, hpDie: 8, choices: [], grants: [
        { kind: 'resource_upgrade', value: { resourceId: 'ki_pool', newMaximum: 13 } },
        { kind: 'feature', value: { id: 'tongue_of_sun_and_moon', name: 'Tongue of the Sun and Moon', description: "You understand the words of any spoken language you hear, and any creature that can understand a language can understand what you say. No engine hook for an unlimited language grant (grant_proficiency only handles skills and tools) — treat as universal comprehension manually.", source: { kind: 'class', refId: 'monk' }, level: 13, effects: [], actions: [], choices: [], passive: true } },
      ],
    },
    {
      level: 14, hpDie: 8, choices: [], grants: [
        { kind: 'resource_upgrade', value: { resourceId: 'ki_pool', newMaximum: 14 } },
        { kind: 'feature', value: { id: 'diamond_soul', name: 'Diamond Soul', description: 'You gain proficiency in all saving throws. Additionally, whenever you make a saving throw and fail, you can spend 1 ki point to reroll it and take the second result. No engine grant kind for adding all-saving-throw proficiency mid-game (only at character creation) — mark it manually on the Abilities tab.', source: { kind: 'class', refId: 'monk' }, level: 14, effects: [], actions: [], choices: [], passive: true } },
      ],
    },
    {
      level: 15, hpDie: 8, choices: [], grants: [
        { kind: 'resource_upgrade', value: { resourceId: 'ki_pool', newMaximum: 15 } },
        { kind: 'feature', value: { id: 'timeless_body_monk', name: 'Timeless Body', description: "Your ki sustains you so that you suffer none of the frailty of old age, and you can't be aged magically. You still die of old age, however. In addition, you no longer need food or water.", source: { kind: 'class', refId: 'monk' }, level: 15, effects: [], actions: [], choices: [], passive: true } },
      ],
    },
    { level: 16, hpDie: 8, choices: [asiChoice('monk_asi_16')], grants: [{ kind: 'resource_upgrade', value: { resourceId: 'ki_pool', newMaximum: 16 } }] },
    { level: 17, hpDie: 8, choices: [], grants: [{ kind: 'resource_upgrade', value: { resourceId: 'ki_pool', newMaximum: 17 } }] },
    {
      level: 18, hpDie: 8, choices: [], grants: [
        { kind: 'resource_upgrade', value: { resourceId: 'ki_pool', newMaximum: 18 } },
        { kind: 'feature', value: { id: 'empty_body', name: 'Empty Body: Invisibility', description: 'You can spend 4 ki points to become invisible for 1 minute, with resistance to all damage but force.', source: { kind: 'class', refId: 'monk' }, level: 18, effects: [], actions: [], choices: [], passive: false, activation: { actionType: 'action', resourceCost: { resourceId: 'ki_pool', quantity: 4 }, range: 'self', target: 'self', requiresSave: null } } },
        // Astral Projection isn't in the spell content pack — same disclosed
        // simplification as shadow_arts_darkvision below; this stays a
        // trackable ki-spending card with no coded transformation effect.
        { kind: 'feature', value: { id: 'empty_body_astral', name: 'Empty Body: Astral Projection', description: 'You can spend 8 ki points to cast Astral Projection on yourself without expending its material components.', source: { kind: 'class', refId: 'monk' }, level: 18, effects: [], actions: [], choices: [], passive: false, activation: { actionType: 'action', resourceCost: { resourceId: 'ki_pool', quantity: 8 }, range: 'self', target: 'self', requiresSave: null } } },
      ],
    },
    { level: 19, hpDie: 8, choices: [asiChoice('monk_asi_19')], grants: [{ kind: 'resource_upgrade', value: { resourceId: 'ki_pool', newMaximum: 19 } }] },
    {
      level: 20, hpDie: 8, choices: [], grants: [
        { kind: 'resource_upgrade', value: { resourceId: 'ki_pool', newMaximum: 20 } },
        { kind: 'feature', value: { id: 'perfect_self', name: 'Perfect Self', description: 'When you roll initiative and have no ki points remaining, you regain 4 ki points.', source: { kind: 'class', refId: 'monk' }, level: 20, effects: [], actions: [], choices: [], passive: true } },
      ],
    },
  ],
};

// ── Sorcerer ──────────────────────────────────────────────────────────────────

const sorcererSkillChoice: ChoiceDefinition = {
  id: 'sorcerer_skills_lvl_1',
  prompt: 'Choose 2 skills from: Arcana, Deception, Insight, Intimidation, Persuasion, Religion.',
  kind: 'skill', count: 2,
  pool: [
    { id: 'arcana',       label: 'Arcana',       value: 'arcana' },
    { id: 'deception',    label: 'Deception',    value: 'deception' },
    { id: 'insight',      label: 'Insight',      value: 'insight' },
    { id: 'intimidation', label: 'Intimidation', value: 'intimidation' },
    { id: 'persuasion',   label: 'Persuasion',   value: 'persuasion' },
    { id: 'religion',     label: 'Religion',     value: 'religion' },
  ],
  grants: [], required: true, resolved: false,
};

export const sorcererProgression: ClassProgression = {
  classId: 'sorcerer',
  srd: true,
  entries: [
    {
      level: 1, hpDie: 6, choices: [
        sorcererSkillChoice,
        equipmentChoice('sorcerer_equip_a', 'Choose: (a) a light crossbow and 20 bolts or (b) any simple weapon', [
          { id: 'crossbow', label: 'Light Crossbow & 20 bolts', items: ['light_crossbow', 'bolts_20'] },
          { id: 'simple',   label: 'A simple weapon', items: [], itemFilter: { constraint: { category: 'weapon', weaponClass: 'simple' }, quantity: 1 } },
        ]),
        equipmentChoice('sorcerer_equip_b', 'Choose a focus: (a) a component pouch or (b) an arcane focus', [
          { id: 'pouch', label: 'Component Pouch', items: ['component_pouch'] },
          { id: 'focus', label: 'Arcane Focus',    items: ['arcane_focus_orb'] },
        ]),
        equipmentChoice('sorcerer_equip_c', "Choose a pack: (a) dungeoneer's or (b) explorer's", [
          { id: 'dungeoneer', label: "Dungeoneer's Pack", items: ['dungeoneers_pack'] },
          { id: 'explorer',   label: "Explorer's Pack",   items: ['explorers_pack'] },
        ]),
        { id: 'sorcerous_origin_choice', prompt: 'Choose a Sorcerous Origin.', kind: 'subclass', count: 1, pool: 'all', grants: [], required: true, resolved: false },
        spellChoice('sorcerer_cantrips_1', 4, 'Choose 4 sorcerer cantrips.'),
        spellChoice('sorcerer_spells_1', 2, 'Choose 2 sorcerer spells known.'),
      ],
      grants: [
        ...startingItems('dagger', 'dagger'),
        { kind: 'feature', value: { id: 'sorcerer_spellcasting', name: 'Spellcasting', description: 'You cast sorcerer spells using Charisma: your spell save DC is 8 + your proficiency bonus + your Charisma modifier, and your spell attack modifier is your proficiency bonus + your Charisma modifier. You know the number of sorcerer cantrips and spells your class table shows; casting a spell expends a slot of its level or higher. When you gain a sorcerer level, you can replace one sorcerer spell you know with another of a level you have slots for. You can use an arcane focus as a spellcasting focus.', source: { kind: 'class', refId: 'sorcerer' }, level: 1, effects: [], actions: [], choices: [], passive: true } },
        { kind: 'feature', value: { id: 'sorcerous_origin', name: 'Sorcerous Origin', description: 'At 1st level you choose a sorcerous origin, the source of your innate magical power (the SRD offers the Draconic Bloodline). It grants features at 1st, 6th, 14th and 18th level.', source: { kind: 'class', refId: 'sorcerer' }, level: 1, effects: [], actions: [], choices: [], passive: true } },
        { kind: 'init_spellcasting', value: { ability: 'cha' } },
        { kind: 'spell_slots', value: { level: 1 } },
      ],
    },
    { level: 2, hpDie: 6, choices: [spellChoice('sorcerer_spells_2', 1, 'Choose 1 more sorcerer spell known.')], grants: [{ kind: 'feature', value: { id: 'font_of_magic', name: 'Font of Magic', description: 'You have sorcery points equal to your sorcerer level, regained when you finish a long rest. As a bonus action, you can expend a spell slot to gain sorcery points equal to the slot\'s level, or spend sorcery points to create a spell slot: 2 points for a 1st-level slot, 3 for 2nd, 5 for 3rd, 6 for 4th and 7 for 5th (no higher than 5th). A slot you create vanishes when you finish a long rest.', source: { kind: 'class', refId: 'sorcerer' }, level: 2, effects: [], actions: [], choices: [], passive: true } }, { kind: 'resource', value: { resourceId: 'sorcery_points', name: 'Sorcery Points', maximum: 2, recharge: 'long_rest' } }] },
    { level: 3, hpDie: 6, choices: [metamagicChoice('sorcerer_metamagic_3', 2), spellChoice('sorcerer_spells_3', 1, 'Choose 1 more sorcerer spell known.')], grants: [{ kind: 'feature', value: { id: 'metamagic', name: 'Metamagic', description: 'You gain the ability to twist your spells to suit your needs: you learn two Metamagic options (the pick waits with your class choices), and another at 10th and 17th level. You can use only one Metamagic option on a spell when you cast it, unless an option says otherwise.', source: { kind: 'class', refId: 'sorcerer' }, level: 3, effects: [], actions: [], choices: [], passive: true } }, { kind: 'resource_upgrade', value: { resourceId: 'sorcery_points', newMaximum: 3 } }] },
    { level: 4, hpDie: 6, choices: [asiChoice('sorcerer_asi_4'), spellChoice('sorcerer_cantrips_4', 1, 'Choose 1 more sorcerer cantrip.'), spellChoice('sorcerer_spells_4', 1, 'Choose 1 more sorcerer spell known.')], grants: [{ kind: 'resource_upgrade', value: { resourceId: 'sorcery_points', newMaximum: 4 } }] },
    ...Array.from({ length: 5 }, (_, i) => ({
      level: 5 + i, hpDie: 6 as const,
      choices: [
        ...(i === 3 ? [asiChoice('sorcerer_asi_8')] : []),
        spellChoice(`sorcerer_spells_${5 + i}`, 1, 'Choose 1 more sorcerer spell known.'),
      ] as ChoiceDefinition[],
      grants: [{ kind: 'resource_upgrade' as const, value: { resourceId: 'sorcery_points', newMaximum: 5 + i } }],
    })),
    {
      level: 10, hpDie: 6,
      choices: [metamagicChoice('sorcerer_metamagic_10', 1), 
        spellChoice('sorcerer_cantrips_10', 1, 'Choose 1 more sorcerer cantrip.'),
        spellChoice('sorcerer_spells_10', 1, 'Choose 1 more sorcerer spell known.'),
      ],
      grants: [
        { kind: 'resource_upgrade', value: { resourceId: 'sorcery_points', newMaximum: 10 } },
        { kind: 'feature', value: { id: 'metamagic_10', name: 'Metamagic (3rd option)', description: 'You learn a third Metamagic option (the pick waits with your class choices).', source: { kind: 'class', refId: 'sorcerer' }, level: 10, effects: [], actions: [], choices: [], passive: true } },
      ],
    },
    {
      level: 11, hpDie: 6, choices: [spellChoice('sorcerer_spells_11', 1, 'Choose 1 more sorcerer spell known.')],
      grants: [{ kind: 'resource_upgrade', value: { resourceId: 'sorcery_points', newMaximum: 11 } }],
    },
    { level: 12, hpDie: 6, choices: [asiChoice('sorcerer_asi_12')], grants: [{ kind: 'resource_upgrade', value: { resourceId: 'sorcery_points', newMaximum: 12 } }] },
    {
      level: 13, hpDie: 6, choices: [spellChoice('sorcerer_spells_13', 1, 'Choose 1 more sorcerer spell known.')],
      grants: [{ kind: 'resource_upgrade', value: { resourceId: 'sorcery_points', newMaximum: 13 } }],
    },
    { level: 14, hpDie: 6, choices: [], grants: [{ kind: 'resource_upgrade', value: { resourceId: 'sorcery_points', newMaximum: 14 } }] },
    {
      level: 15, hpDie: 6, choices: [spellChoice('sorcerer_spells_15', 1, 'Choose 1 more sorcerer spell known.')],
      grants: [{ kind: 'resource_upgrade', value: { resourceId: 'sorcery_points', newMaximum: 15 } }],
    },
    { level: 16, hpDie: 6, choices: [asiChoice('sorcerer_asi_16')], grants: [{ kind: 'resource_upgrade', value: { resourceId: 'sorcery_points', newMaximum: 16 } }] },
    {
      level: 17, hpDie: 6, choices: [metamagicChoice('sorcerer_metamagic_17', 1), spellChoice('sorcerer_spells_17', 1, 'Choose 1 more sorcerer spell known.')],
      grants: [
        { kind: 'resource_upgrade', value: { resourceId: 'sorcery_points', newMaximum: 17 } },
        { kind: 'feature', value: { id: 'metamagic_17', name: 'Metamagic (4th option)', description: 'You learn a fourth Metamagic option (the pick waits with your class choices).', source: { kind: 'class', refId: 'sorcerer' }, level: 17, effects: [], actions: [], choices: [], passive: true } },
      ],
    },
    { level: 18, hpDie: 6, choices: [], grants: [{ kind: 'resource_upgrade', value: { resourceId: 'sorcery_points', newMaximum: 18 } }] },
    { level: 19, hpDie: 6, choices: [asiChoice('sorcerer_asi_19')], grants: [{ kind: 'resource_upgrade', value: { resourceId: 'sorcery_points', newMaximum: 19 } }] },
    {
      level: 20, hpDie: 6, choices: [], grants: [
        { kind: 'resource_upgrade', value: { resourceId: 'sorcery_points', newMaximum: 20 } },
        { kind: 'feature', value: { id: 'sorcerous_restoration', name: 'Sorcerous Restoration', description: 'You regain 4 expended sorcery points whenever you finish a short rest.', source: { kind: 'class', refId: 'sorcerer' }, level: 20, effects: [], actions: [], choices: [], passive: true } },
      ],
    },
  ],
};

// ── Warlock ───────────────────────────────────────────────────────────────────

const warlockSkillChoice: ChoiceDefinition = {
  id: 'warlock_skills_lvl_1',
  prompt: 'Choose 2 skills from: Arcana, Deception, History, Intimidation, Investigation, Nature, Religion.',
  kind: 'skill', count: 2,
  pool: [
    { id: 'arcana',        label: 'Arcana',        value: 'arcana' },
    { id: 'deception',     label: 'Deception',     value: 'deception' },
    { id: 'history',       label: 'History',       value: 'history' },
    { id: 'intimidation',  label: 'Intimidation',  value: 'intimidation' },
    { id: 'investigation', label: 'Investigation', value: 'investigation' },
    { id: 'nature',        label: 'Nature',        value: 'nature' },
    { id: 'religion',      label: 'Religion',      value: 'religion' },
  ],
  grants: [], required: true, resolved: false,
};

export const warlockProgression: ClassProgression = {
  classId: 'warlock',
  srd: true,
  entries: [
    {
      level: 1, hpDie: 8, choices: [
        warlockSkillChoice,
        equipmentChoice('warlock_equip_a', 'Choose: (a) a light crossbow and 20 bolts or (b) any simple weapon', [
          { id: 'crossbow', label: 'Light Crossbow & 20 bolts', items: ['light_crossbow', 'bolts_20'] },
          { id: 'simple',   label: 'A simple weapon', items: [], itemFilter: { constraint: { category: 'weapon', weaponClass: 'simple' }, quantity: 1 } },
        ]),
        equipmentChoice('warlock_equip_b', 'Choose a focus: (a) a component pouch or (b) an arcane focus', [
          { id: 'pouch', label: 'Component Pouch', items: ['component_pouch'] },
          { id: 'focus', label: 'Arcane Focus',    items: ['arcane_focus_orb'] },
        ]),
        equipmentChoice('warlock_equip_c', "Choose a pack: (a) scholar's or (b) dungeoneer's", [
          { id: 'scholar',    label: "Scholar's Pack",    items: ['scholars_pack'] },
          { id: 'dungeoneer', label: "Dungeoneer's Pack", items: ['dungeoneers_pack'] },
        ]),
        { id: 'otherworldly_patron_choice', prompt: 'Choose an Otherworldly Patron.', kind: 'subclass', count: 1, pool: 'all', grants: [], required: true, resolved: false },
        spellChoice('warlock_cantrips_1', 2, 'Choose 2 warlock cantrips.'),
        spellChoice('warlock_spells_1', 2, 'Choose 2 warlock spells known.'),
      ],
      grants: [
        ...startingItems('leather_armor', 'dagger', 'dagger'),
        { kind: 'feature', value: { id: 'otherworldly_patron', name: 'Otherworldly Patron', description: 'At 1st level you make a pact with a being from beyond the world (the SRD offers the Fiend). Your patron adds spells to the warlock spell list for you and grants features at 1st, 6th, 10th and 14th level.', source: { kind: 'class', refId: 'warlock' }, level: 1, effects: [], actions: [], choices: [], passive: true } },
        { kind: 'feature', value: { id: 'warlock_spellcasting', name: 'Pact Magic', description: 'You cast warlock spells using Charisma: your spell save DC is 8 + your proficiency bonus + your Charisma modifier, and your spell attack modifier is your proficiency bonus + your Charisma modifier. All your spell slots are the same level, shown in your class table, and you regain them when you finish a short or long rest. You know the number of warlock cantrips and spells your class table shows; when you gain a warlock level, you can replace one warlock spell you know with another of a level you can cast. You can use an arcane focus as a spellcasting focus.', source: { kind: 'class', refId: 'warlock' }, level: 1, effects: [], actions: [], choices: [], passive: true } },
        { kind: 'init_spellcasting', value: { ability: 'cha' } },
        { kind: 'spell_slots', value: { level: 1 } },
      ],
    },
    { level: 2, hpDie: 8, choices: [invocationChoice('warlock_invocations_2', 2), spellChoice('warlock_spells_2', 1, 'Choose 1 more warlock spell known.')], grants: [{ kind: 'feature', value: { id: 'eldritch_invocations', name: 'Eldritch Invocations', description: 'Eldritch invocations are fragments of forbidden lore that stay with you. You pick two now, and you know three at 5th level, four at 7th, five at 9th, six at 12th, seven at 15th and eight at 18th. Some ask for a warlock level, a pact or a cantrip first. Each time you gain a warlock level, you may trade one you know for another you qualify for. (The picks wait with your class choices.)', source: { kind: 'class', refId: 'warlock' }, level: 2, effects: [], actions: [], choices: [], passive: true } }] },
    { level: 3, hpDie: 8, choices: [pactBoonChoice('warlock_pact_boon'), spellChoice('warlock_spells_3', 1, 'Choose 1 more warlock spell known.')], grants: [{ kind: 'feature', value: { id: 'pact_boon', name: 'Pact Boon', description: 'At 3rd level your patron gives you one of three gifts: Pact of the Chain, Pact of the Blade or Pact of the Tome (the pick waits with your class choices).', source: { kind: 'class', refId: 'warlock' }, level: 3, effects: [], actions: [], choices: [], passive: true } }] },
    { level: 4, hpDie: 8, choices: [asiChoice('warlock_asi_4'), spellChoice('warlock_cantrips_4', 1, 'Choose 1 more warlock cantrip.'), spellChoice('warlock_spells_4', 1, 'Choose 1 more warlock spell known.')], grants: [] },
    { level: 5, hpDie: 8, choices: [invocationChoice('warlock_invocations_5', 1), spellChoice('warlock_spells_5', 1, 'Choose 1 more warlock spell known.')], grants: [] },
    { level: 6, hpDie: 8, choices: [spellChoice('warlock_spells_6', 1, 'Choose 1 more warlock spell known.')], grants: [] },
    { level: 7, hpDie: 8, choices: [invocationChoice('warlock_invocations_7', 1), spellChoice('warlock_spells_7', 1, 'Choose 1 more warlock spell known.')], grants: [] },
    { level: 8, hpDie: 8, choices: [asiChoice('warlock_asi_8'), spellChoice('warlock_spells_8', 1, 'Choose 1 more warlock spell known.')], grants: [] },
    { level: 9, hpDie: 8, choices: [invocationChoice('warlock_invocations_9', 1), spellChoice('warlock_spells_9', 1, 'Choose 1 more warlock spell known.')], grants: [] },
    { level: 10, hpDie: 8, choices: [spellChoice('warlock_cantrips_10', 1, 'Choose 1 more warlock cantrip.')], grants: [] },
    {
      level: 11, hpDie: 8, choices: [spellChoice('warlock_spells_11', 1, 'Choose 1 more warlock spell known.')], grants: [
        ...mysticArcanumGrants(11, 6),
      ],
    },
    { level: 12, hpDie: 8, choices: [invocationChoice('warlock_invocations_12', 1), asiChoice('warlock_asi_12')], grants: [] },
    {
      level: 13, hpDie: 8, choices: [spellChoice('warlock_spells_13', 1, 'Choose 1 more warlock spell known.')], grants: [
        ...mysticArcanumGrants(13, 7),
      ],
    },
    ...stubEntries([14], 8),
    {
      level: 15, hpDie: 8, choices: [invocationChoice('warlock_invocations_15', 1), spellChoice('warlock_spells_15', 1, 'Choose 1 more warlock spell known.')], grants: [
        ...mysticArcanumGrants(15, 8),
      ],
    },
    { level: 16, hpDie: 8, choices: [asiChoice('warlock_asi_16')], grants: [] },
    {
      level: 17, hpDie: 8, choices: [spellChoice('warlock_spells_17', 1, 'Choose 1 more warlock spell known.')], grants: [
        ...mysticArcanumGrants(17, 9),
      ],
    },
    { level: 18, hpDie: 8, choices: [invocationChoice('warlock_invocations_18', 1)], grants: [] },
    { level: 19, hpDie: 8, choices: [asiChoice('warlock_asi_19'), spellChoice('warlock_spells_19', 1, 'Choose 1 more warlock spell known.')], grants: [] },
    { level: 20, hpDie: 8, choices: [], grants: [{ kind: 'feature', value: { id: 'eldritch_master', name: 'Eldritch Master', description: 'You can entreat your patron to regain all your expended spell slots. You can do so again after you finish a long rest.', source: { kind: 'class', refId: 'warlock' }, level: 20, effects: [], actions: [], choices: [], passive: false, activation: { actionType: 'action', resourceCost: { resourceId: 'eldritch_master_pool', quantity: 1 }, range: 'self', target: 'self', requiresSave: null }, abilityEffects: [{ type: 'restore_resource', resourceId: 'spell_slots', amount: 'full' }] } }, { kind: 'resource', value: { resourceId: 'eldritch_master_pool', name: 'Eldritch Master', maximum: 1, recharge: 'long_rest' } }] },
  ],
};

// ── Exports ───────────────────────────────────────────────────────────────────

export const ALL_CLASS_PROGRESSIONS: ClassProgression[] = [
  fighterProgression,
  rogueProgression,
  wizardProgression,
  clericProgression,
  barbarianProgression,
  rangerProgression,
  paladinProgression,
  druidProgression,
  bardProgression,
  monkProgression,
  sorcererProgression,
  warlockProgression,
  ...PROGRESSIONS_2024,
];

/** Lookup map: classId → ClassProgression. Use this instead of hardcoding class names. */
export const ALL_PROGRESSIONS: Record<string, ClassProgression> = Object.fromEntries(
  ALL_CLASS_PROGRESSIONS.map(p => [p.classId, p])
);

// PHB "Multiclassing Proficiencies" table (p.164) — what each class grants
// when taken as a SECOND-OR-LATER class, not your starting class. Sorcerer
// and Wizard grant nothing per RAW (omitted below). Bard's "one skill of
// your choice" and Ranger's "one skill from the class's skill list" and
// choice-driven in the book; this app's ProficiencyGrant has no per-item
// choice mechanism, so those are approximated with a fixed, reasonable pick
// than left off entirely — disclosed simplification, not a silent omission.
const MULTICLASS_PROFICIENCIES: Record<string, import('../../engine/types').ProficiencyGrant> = {
  barbarian: { weapons: ['simple', 'martial'], armor: ['shield'] },
  bard:      { armor: ['light'], tools: ['Musical Instrument'] },
  cleric:    { armor: ['light', 'medium', 'shield'] },
  druid:     { armor: ['light', 'medium', 'shield'] },
  fighter:   { armor: ['light', 'medium', 'shield'], weapons: ['simple', 'martial'] },
  monk:      { weapons: ['simple'], tools: ['Shortsword'] },
  paladin:   { armor: ['light', 'medium', 'shield'], weapons: ['simple', 'martial'] },
  ranger:    { armor: ['light'], weapons: ['simple', 'martial'] },
  rogue:     { armor: ['light'], tools: ["Thieves' Tools"] },
  warlock:   { armor: ['light'], weapons: ['simple'] },
  artificer: { armor: ['light'], weapons: ['simple'], tools: ["Thieves' Tools"] },
  // sorcerer, wizard: grant nothing per RAW — omitted, see multiclassProficienciesFor()'s
  // documented "undefined = grants nothing" semantics.
};

// NON-SRD-FLAG-1: the 12 core PHB classes below are SRD 5.1-safe (matches
// the already-asserted claim on ClassProgression.srd's own doc comment —
// "All 12 core PHB classes are SRD-safe" — this array just never carried
// the tag itself, so it silently showed "Non-SRD" for legitimately-safe
// classes once flagging existed, and was excluded entirely from any
// Cauldron, not the core PHB, and is not part of the SRD.
// Authoritative initial packages. Engine acquisition grants these only for the
// first class; later classes use MULTICLASS_PROFICIENCIES. Named weapons use
// catalog display names, which the weapon-proficiency resolver already supports.
export const ALL_CHAR_CLASSES_CATALOG = [
  { id: 'fighter',   name: 'Fighter',   hitDie: 10, features: [], srd: true, multiclassProficiencies: MULTICLASS_PROFICIENCIES.fighter,
    savingThrows: ['str', 'con'], armorProfs: ['light', 'medium', 'heavy', 'shield'], weaponProfs: ['simple', 'martial'] },
  { id: 'rogue',     name: 'Rogue',     hitDie: 8,  features: [], srd: true, multiclassProficiencies: MULTICLASS_PROFICIENCIES.rogue,
    savingThrows: ['dex', 'int'], armorProfs: ['light'], weaponProfs: ['simple', 'Hand Crossbow', 'Longsword', 'Rapier', 'Shortsword'], toolProfs: ["Thieves' Tools"] },
  { id: 'wizard',    name: 'Wizard',    hitDie: 6,  features: [], srd: true,
    savingThrows: ['int', 'wis'], armorProfs: [], weaponProfs: ['Dagger', 'Dart', 'Sling', 'Quarterstaff', 'Light Crossbow'], spellcastingAbility: 'int', spellPreparationPolicy: 'spellbook_prepared', ritualCastingPolicy: 'spellbook' },
  { id: 'cleric',    name: 'Cleric',    hitDie: 8,  features: [], srd: true, multiclassProficiencies: MULTICLASS_PROFICIENCIES.cleric,
    savingThrows: ['wis', 'cha'], armorProfs: ['light', 'medium', 'shield'], weaponProfs: ['simple'], spellcastingAbility: 'wis', spellPreparationPolicy: 'full_list_prepared', ritualCastingPolicy: 'prepared' },
  { id: 'barbarian', name: 'Barbarian', hitDie: 12, features: [], srd: true, multiclassProficiencies: MULTICLASS_PROFICIENCIES.barbarian,
    savingThrows: ['str', 'con'], armorProfs: ['light', 'medium', 'shield'], weaponProfs: ['simple', 'martial'] },
  { id: 'ranger',    name: 'Ranger',    hitDie: 10, features: [], srd: true, multiclassProficiencies: MULTICLASS_PROFICIENCIES.ranger,
    savingThrows: ['str', 'dex'], armorProfs: ['light', 'medium', 'shield'], weaponProfs: ['simple', 'martial'], spellcastingAbility: 'wis', spellPreparationPolicy: 'known' },
  { id: 'paladin',   name: 'Paladin',   hitDie: 10, features: [], srd: true, multiclassProficiencies: MULTICLASS_PROFICIENCIES.paladin,
    savingThrows: ['wis', 'cha'], armorProfs: ['light', 'medium', 'heavy', 'shield'], weaponProfs: ['simple', 'martial'], spellcastingAbility: 'cha', spellPreparationPolicy: 'full_list_prepared' },
  { id: 'druid',     name: 'Druid',     hitDie: 8,  features: [], srd: true, multiclassProficiencies: MULTICLASS_PROFICIENCIES.druid,
    savingThrows: ['int', 'wis'], armorProfs: ['light', 'medium', 'shield'], weaponProfs: ['Club', 'Dagger', 'Dart', 'Javelin', 'Mace', 'Quarterstaff', 'Scimitar', 'Sickle', 'Sling', 'Spear'], toolProfs: ['Herbalism Kit'], spellcastingAbility: 'wis', spellPreparationPolicy: 'full_list_prepared', ritualCastingPolicy: 'prepared' },
  { id: 'bard',      name: 'Bard',      hitDie: 8,  features: [], srd: true, multiclassProficiencies: MULTICLASS_PROFICIENCIES.bard,
    savingThrows: ['dex', 'cha'], armorProfs: ['light'], weaponProfs: ['simple', 'Hand Crossbow', 'Longsword', 'Rapier', 'Shortsword'], spellcastingAbility: 'cha', spellPreparationPolicy: 'known', ritualCastingPolicy: 'known' },
  { id: 'monk',      name: 'Monk',      hitDie: 8,  features: [], srd: true, multiclassProficiencies: MULTICLASS_PROFICIENCIES.monk,
    savingThrows: ['str', 'dex'], armorProfs: [], weaponProfs: ['simple', 'Shortsword'] },
  { id: 'sorcerer',  name: 'Sorcerer',  hitDie: 6,  features: [], srd: true,
    savingThrows: ['con', 'cha'], armorProfs: [], weaponProfs: ['Dagger', 'Dart', 'Sling', 'Quarterstaff', 'Light Crossbow'], spellcastingAbility: 'cha', spellPreparationPolicy: 'known' },
  { id: 'warlock',   name: 'Warlock',   hitDie: 8,  features: [], srd: true, multiclassProficiencies: MULTICLASS_PROFICIENCIES.warlock,
    savingThrows: ['wis', 'cha'], armorProfs: ['light'], weaponProfs: ['simple'], spellcastingAbility: 'cha', spellPreparationPolicy: 'known' },
  ...CLASSES_2024,
] as import('../../engine/types').CharClass[];

/** Exposure policy for public SRD builds. The full catalog remains bundled. */
export function filterClassesForExposure(
  classes: readonly import('../../engine/types').CharClass[],
  srdOnly: boolean,
): import('../../engine/types').CharClass[] {
  return classes.filter(cls => !srdOnly || cls.srd === true);
}

export const ALL_CHAR_CLASSES = filterClassesForExposure(
  ALL_CHAR_CLASSES_CATALOG,
  process.env.EXPO_PUBLIC_SRD_ONLY === 'true',
);

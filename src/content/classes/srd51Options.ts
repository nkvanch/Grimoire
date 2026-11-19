// ============================================================================
// FILE: src/content/classes/srd51Options.ts
// The options SRD 5.1 class features ask the player to pick: Fighting Style, Favored Enemy, favored terrain (Natural Explorer),
// Metamagic, Pact Boon, Eldritch Invocations and Mystic Arcanum. This work includes material from the System Reference Document 5.1 by Wizards of the Coast LLC
// (Creative Commons Attribution 4.0); the rules are written out in this app's words.
//
// Each option grants one feature. An option keeps the same feature id wherever it is offered (a Ranger's second favored enemy,
// the Champion's second Fighting Style), so an option the character already has is not offered again.
// Modeled: Defense's +1 AC (asked as a yes/no "wearing armor?"). The rest is text: the engine has no hook for an attack-roll
// bonus, a damage reroll, a check made with advantage against one kind of creature, or a sorcery-point cost per spell.
// ============================================================================
import { ChoiceDefinition, ChoiceOption, Effect, Feature, Grant, Prerequisite } from '../../engine/types';
import { feature, activation } from '../homebrewPack/helpers';

type Source = Feature['source'];

const option = (id: string, label: string, value: Feature): ChoiceOption => ({ id, label, value });

function poolChoice(id: string, prompt: string, count: number, pool: ChoiceOption[]): ChoiceDefinition {
  return { id, prompt, kind: 'feature_pool', count, pool, grants: [], required: true, resolved: false };
}

// ── Fighting Style ──────────────────────────────────────────────────────────

const defenseAc: Effect = {
  type: 'stat_modifier', target: 'ac', operation: 'add', value: 1, condition: null,
  situational: { id: 'fighting_style_defense_armored', question: 'Are you wearing armor?' },
};

type Style = 'archery' | 'defense' | 'dueling' | 'great_weapon_fighting' | 'protection' | 'two_weapon_fighting';

const STYLES: Record<Style, (source: Source) => ChoiceOption> = {
  archery: s => option('fs_archery', 'Archery', feature({ id: 'fighting_style_srd51_archery', name: 'Fighting Style: Archery', source: s,
    description: 'You gain a +2 bonus to attack rolls you make with ranged weapons.' })),
  defense: s => option('fs_defense', 'Defense', feature({ id: 'fighting_style_srd51_defense', name: 'Fighting Style: Defense', source: s, effects: [defenseAc],
    description: 'While you are wearing armor, you gain a +1 bonus to AC.' })),
  dueling: s => option('fs_dueling', 'Dueling', feature({ id: 'fighting_style_srd51_dueling', name: 'Fighting Style: Dueling', source: s,
    description: 'When you are wielding a melee weapon in one hand and no other weapons, you gain a +2 bonus to damage rolls with that weapon.' })),
  great_weapon_fighting: s => option('fs_great_weapon_fighting', 'Great Weapon Fighting', feature({ id: 'fighting_style_srd51_great_weapon_fighting', name: 'Fighting Style: Great Weapon Fighting', source: s,
    description: 'When you roll a 1 or 2 on a damage die for an attack you make with a melee weapon that you are wielding with two hands, you can reroll the die and must use the new roll, even if it is a 1 or a 2. The weapon must have the two-handed or versatile property.' })),
  protection: s => option('fs_protection', 'Protection', feature({ id: 'fighting_style_srd51_protection', name: 'Fighting Style: Protection', source: s,
    activation: activation('reaction', { range: '5 feet', target: 'single' }),
    description: 'When a creature you can see attacks a target other than you that is within 5 feet of you, you can use your reaction to impose disadvantage on the attack roll. You must be wielding a shield.' })),
  two_weapon_fighting: s => option('fs_two_weapon_fighting', 'Two-Weapon Fighting', feature({ id: 'fighting_style_srd51_two_weapon_fighting', name: 'Fighting Style: Two-Weapon Fighting', source: s,
    description: 'When you engage in two-weapon fighting, you can add your ability modifier to the damage of the second attack.' })),
};

/** A Fighting Style pick from the given styles, in the SRD's order. */
export function fightingStyleChoice(id: string, source: Source, styles: Style[]): ChoiceDefinition {
  return poolChoice(id, 'Choose a Fighting Style.', 1, styles.map(s => STYLES[s](source)));
}

export const FIGHTER_STYLES: Style[] = ['archery', 'defense', 'dueling', 'great_weapon_fighting', 'protection', 'two_weapon_fighting'];
export const PALADIN_STYLES: Style[] = ['defense', 'dueling', 'great_weapon_fighting', 'protection'];
export const RANGER_STYLES: Style[] = ['archery', 'defense', 'dueling', 'two_weapon_fighting'];

// ── Ranger: Favored Enemy and Natural Explorer ─────────────────────────────

const RANGER: Source = { kind: 'class', refId: 'ranger' };

const ENEMIES: [string, string][] = [
  ['aberrations', 'Aberrations'], ['beasts', 'Beasts'], ['celestials', 'Celestials'], ['constructs', 'Constructs'], ['dragons', 'Dragons'],
  ['elementals', 'Elementals'], ['fey', 'Fey'], ['fiends', 'Fiends'], ['giants', 'Giants'], ['monstrosities', 'Monstrosities'],
  ['oozes', 'Oozes'], ['plants', 'Plants'], ['undead', 'Undead'],
];

// A creature type can be a favored enemy once; a pair of humanoid races can be named again at each pick, so that option is its own
// option and feature at each of the three picks (`nth`: 1, 2, 3).
const enemyPool = (nth: number): ChoiceOption[] => {
  const suffix = nth === 1 ? '' : `_${nth}`;
  return [
    ...ENEMIES.map(([id, label]) => option(`favored_enemy_${id}`, label, feature({
      id: `favored_enemy_srd51_${id}`, name: `Favored Enemy: ${label}`, source: RANGER,
      description: `You have advantage on Wisdom (Survival) checks to track ${label.toLowerCase()} and on Intelligence checks to recall information about them. You also learn one language they speak, if they speak one (add it on the sheet).`,
    }))),
    option(`favored_enemy_humanoids${suffix}`, 'Two humanoid races', feature({
      id: `favored_enemy_srd51_humanoids${suffix}`, name: nth === 1 ? 'Favored Enemy: Two Humanoid Races' : `Favored Enemy: Two Humanoid Races (${nth === 2 ? 'second' : 'third'} pair)`, source: RANGER,
      description: 'Name two races of humanoid (such as gnolls and orcs) in your notes. You have advantage on Wisdom (Survival) checks to track them and on Intelligence checks to recall information about them. You also learn one language they speak, if they speak one (add it on the sheet).',
    })),
  ];
};

/** A favored enemy (Ranger 1st, 6th and 14th level: `nth` 1, 2, 3). */
export function favoredEnemyChoice(id: string, nth: number): ChoiceDefinition {
  return poolChoice(id, 'Choose a favored enemy.', 1, enemyPool(nth));
}

const TERRAINS: [string, string][] = [
  ['arctic', 'Arctic'], ['coast', 'Coast'], ['desert', 'Desert'], ['forest', 'Forest'], ['grassland', 'Grassland'], ['mountain', 'Mountain'],
  ['swamp', 'Swamp'], ['underdark', 'Underdark'],
];

const TERRAIN_POOL: ChoiceOption[] = TERRAINS.map(([id, label]) => option(`favored_terrain_${id}`, label, feature({
  id: `favored_terrain_srd51_${id}`, name: `Favored Terrain: ${label}`, source: RANGER,
  description: `The benefits of Natural Explorer apply in ${id === 'underdark' ? 'the Underdark' : `${label.toLowerCase()} terrain`}.`,
})));

/** A favored terrain for Natural Explorer (Ranger 1st, 6th and 10th level). */
export function favoredTerrainChoice(id: string): ChoiceDefinition {
  return poolChoice(id, 'Choose a favored terrain.', 1, TERRAIN_POOL);
}

// ── Sorcerer: Metamagic ─────────────────────────────────────────────────────

const SORCERER: Source = { kind: 'class', refId: 'sorcerer' };

const METAMAGIC: [string, string, string][] = [
  ['careful', 'Careful Spell', 'When you cast a spell that forces other creatures to make a saving throw, you can spend 1 sorcery point and choose a number of those creatures up to your Charisma modifier (minimum one). They automatically succeed on their saving throws against the spell.'],
  ['distant', 'Distant Spell', 'When you cast a spell that has a range of 5 feet or greater, you can spend 1 sorcery point to double its range. A spell with a range of touch gets a range of 30 feet instead.'],
  ['empowered', 'Empowered Spell', 'When you roll damage for a spell, you can spend 1 sorcery point to reroll a number of the damage dice up to your Charisma modifier (minimum one). You must use the new rolls. You can use Empowered Spell even if you have already used a different Metamagic option on the spell.'],
  ['extended', 'Extended Spell', 'When you cast a spell that has a duration of 1 minute or longer, you can spend 1 sorcery point to double its duration, to a maximum of 24 hours.'],
  ['heightened', 'Heightened Spell', 'When you cast a spell that forces a creature to make a saving throw to resist its effects, you can spend 3 sorcery points to give one target of the spell disadvantage on its first saving throw against it.'],
  ['quickened', 'Quickened Spell', 'When you cast a spell that has a casting time of 1 action, you can spend 2 sorcery points to change the casting time to 1 bonus action for this casting.'],
  ['subtle', 'Subtle Spell', 'When you cast a spell, you can spend 1 sorcery point to cast it without any somatic or verbal components.'],
  ['twinned', 'Twinned Spell', 'When you cast a spell that targets only one creature and doesn\'t have a range of self, you can spend a number of sorcery points equal to the spell\'s level (1 for a cantrip) to target a second creature in range with the same spell.'],
];

const METAMAGIC_POOL: ChoiceOption[] = METAMAGIC.map(([id, label, text]) => option(`metamagic_${id}`, label, feature({
  id: `metamagic_srd51_${id}`, name: `Metamagic: ${label}`, source: SORCERER,
  description: `${text} (Spend the sorcery points on the Font of Magic pool yourself.)`,
})));

/** Metamagic options (Sorcerer: two at 3rd level, one more at 10th and 17th). */
export function metamagicChoice(id: string, count: number): ChoiceDefinition {
  return poolChoice(id, count === 1 ? 'Choose a Metamagic option.' : `Choose ${count} Metamagic options.`, count, METAMAGIC_POOL);
}

// ── Warlock: Pact Boon ──────────────────────────────────────────────────────

const WARLOCK: Source = { kind: 'class', refId: 'warlock' };

const PACT_BOON_POOL: ChoiceOption[] = [
  option('pact_of_the_chain', 'Pact of the Chain', feature({ id: 'pact_boon_srd51_chain', name: 'Pact of the Chain', source: WARLOCK,
    description: 'You learn the find familiar spell and can cast it as a ritual. It doesn\'t count against your spells known. When you cast it, your familiar can also take the form of an imp, a pseudodragon, a quasit or a sprite. When you take the Attack action, you can give up one of your attacks so that your familiar attacks once with its reaction instead.' })),
  option('pact_of_the_blade', 'Pact of the Blade', feature({ id: 'pact_boon_srd51_blade', name: 'Pact of the Blade', source: WARLOCK,
    activation: activation('action'),
    description: 'You can use your action to create a pact weapon in your empty hand, in any melee weapon form you choose. You are proficient with it while you wield it, and it counts as magical for overcoming resistance and immunity to nonmagical attacks and damage. It disappears if it is more than 5 feet from you for 1 minute, if you use this feature again, if you dismiss it (no action required), or if you die. You can also bond a magic weapon to you with a 1-hour ritual during a short rest, and then summon it as your pact weapon.' })),
  option('pact_of_the_tome', 'Pact of the Tome', feature({ id: 'pact_boon_srd51_tome', name: 'Pact of the Tome', source: WARLOCK,
    description: 'Your patron gives you a Book of Shadows. Choose three cantrips from any class\'s spell list; while the book is on your person, you can cast them at will. They don\'t count against your cantrips known and count as warlock spells for you. (Add the three cantrips on the sheet.) If you lose the book, you can perform a 1-hour ceremony during a short or long rest to receive a replacement.' })),
];

/** The Warlock's Pact Boon (3rd level). */
export function pactBoonChoice(id: string): ChoiceDefinition {
  return poolChoice(id, 'Choose your Pact Boon.', 1, PACT_BOON_POOL);
}

// ── Warlock: Eldritch Invocations ───────────────────────────────────────────
// Two at 2nd level and one more at 5th, 7th, 9th, 12th, 15th and 18th (eight in all). A level prerequisite is the warlock's level;
// the Pact Boon ones need that pact (the 3rd-level pick above); the Eldritch Blast ones need that cantrip. An invocation that lets
// the warlock cast a spell at will puts that spell on the sheet; one that spends a spell slot once a day is told in its text.

const castsAtWill = (id: string): Effect =>
  ({ type: 'grant_spell', target: '', operation: 'add', value: null, condition: null, spellIds: [id], spellcastingAbility: 'cha' });
const proficientIn = (skill: string): Effect =>
  ({ type: 'grant_proficiency', target: `skill:${skill}`, operation: 'add', value: null, condition: null });
const warlockLevel = (min: number): Prerequisite => ({ kind: 'level', min });
const eldritchBlast: Prerequisite = { kind: 'spell', spellId: 'eldritch_blast', label: 'the Eldritch Blast cantrip' };
const pactOf = (name: 'Chain' | 'Blade' | 'Tome'): Prerequisite =>
  ({ kind: 'has_option', optionId: `pact_of_the_${name.toLowerCase()}`, label: `Pact of the ${name}` });

type Invocation = { key: string; name: string; requires?: Prerequisite[]; prereq?: string; text: string; spell?: string; skills?: string[] };

const INVOCATIONS: Invocation[] = [
  { key: 'agonizing_blast', name: 'Agonizing Blast', requires: [eldritchBlast], prereq: 'Eldritch Blast cantrip',
    text: 'Each hit with eldritch blast adds your Charisma modifier to its damage.' },
  { key: 'armor_of_shadows', name: 'Armor of Shadows', spell: 'mage_armor',
    text: 'You can cast mage armor on yourself whenever you like, with no spell slot and no material components.' },
  { key: 'ascendant_step', name: 'Ascendant Step', requires: [warlockLevel(9)], prereq: '9th level', spell: 'levitate',
    text: 'You can cast levitate on yourself whenever you like, with no spell slot and no material components.' },
  { key: 'beast_speech', name: 'Beast Speech', spell: 'speak_with_animals',
    text: 'You can cast speak with animals whenever you like, with no spell slot.' },
  { key: 'beguiling_influence', name: 'Beguiling Influence',
    text: 'You become proficient in the Deception and Persuasion skills.', skills: ['deception', 'persuasion'] },
  { key: 'bewitching_whispers', name: 'Bewitching Whispers', requires: [warlockLevel(7)], prereq: '7th level',
    text: 'Once, you can cast compulsion with one of your warlock spell slots. You can do it again after a long rest.' },
  { key: 'book_of_ancient_secrets', name: 'Book of Ancient Secrets', requires: [pactOf('Tome')], prereq: 'Pact of the Tome',
    text: 'Your Book of Shadows gains two 1st-level spells of your choice that have the ritual tag, from any class\'s list; you can cast them as rituals while you hold the book, though not normally. You can also cast any warlock spell you know as a ritual if it has the ritual tag. Rituals you find later can be copied in too, if their level is no more than half your warlock level (rounded up), at 2 hours and 50 gp of ink for each spell level.' },
  { key: 'chains_of_carceri', name: 'Chains of Carceri', requires: [warlockLevel(15), pactOf('Chain')], prereq: '15th level, Pact of the Chain', spell: 'hold_monster',
    text: 'You can cast hold monster whenever you like, with no spell slot and no material components, as long as the target is a celestial, a fiend or an elemental. Once a creature has been targeted this way, you need a long rest before you can target it again.' },
  { key: 'devils_sight', name: 'Devil\'s Sight',
    text: 'You see normally in darkness, ordinary or magical, out to 120 feet.' },
  { key: 'dreadful_word', name: 'Dreadful Word', requires: [warlockLevel(7)], prereq: '7th level',
    text: 'Once, you can cast confusion with one of your warlock spell slots. You can do it again after a long rest.' },
  { key: 'eldritch_sight', name: 'Eldritch Sight', spell: 'detect_magic',
    text: 'You can cast detect magic whenever you like, with no spell slot.' },
  { key: 'eldritch_spear', name: 'Eldritch Spear', requires: [eldritchBlast], prereq: 'Eldritch Blast cantrip',
    text: 'Your eldritch blast reaches out to 300 feet.' },
  { key: 'eyes_of_the_rune_keeper', name: 'Eyes of the Rune Keeper',
    text: 'Every written language is open to you: you can read it all.' },
  { key: 'fiendish_vigor', name: 'Fiendish Vigor', spell: 'false_life',
    text: 'You can cast false life on yourself whenever you like, as a 1st-level spell, with no spell slot and no material components.' },
  { key: 'gaze_of_two_minds', name: 'Gaze of Two Minds',
    text: 'With an action, touch a willing humanoid: until the end of your next turn you see through its eyes and hear what it hears, and you share any special senses it has, while you are blind and deaf to your own surroundings. Each turn you can spend another action to keep the link going. It works only while you are both on the same plane of existence.' },
  { key: 'lifedrinker', name: 'Lifedrinker', requires: [warlockLevel(12), pactOf('Blade')], prereq: '12th level, Pact of the Blade',
    text: 'A hit with your pact weapon also deals necrotic damage equal to your Charisma modifier (at least 1).' },
  { key: 'mask_of_many_faces', name: 'Mask of Many Faces', spell: 'disguise_self',
    text: 'You can cast disguise self whenever you like, with no spell slot.' },
  { key: 'master_of_myriad_forms', name: 'Master of Myriad Forms', requires: [warlockLevel(15)], prereq: '15th level', spell: 'alter_self',
    text: 'You can cast alter self whenever you like, with no spell slot.' },
  { key: 'minions_of_chaos', name: 'Minions of Chaos', requires: [warlockLevel(9)], prereq: '9th level',
    text: 'Once, you can cast conjure elemental with one of your warlock spell slots. You can do it again after a long rest.' },
  { key: 'mire_the_mind', name: 'Mire the Mind', requires: [warlockLevel(5)], prereq: '5th level',
    text: 'Once, you can cast slow with one of your warlock spell slots. You can do it again after a long rest.' },
  { key: 'misty_visions', name: 'Misty Visions', spell: 'silent_image',
    text: 'You can cast silent image whenever you like, with no spell slot and no material components.' },
  { key: 'one_with_shadows', name: 'One with Shadows', requires: [warlockLevel(5)], prereq: '5th level',
    text: 'While you stand in dim light or darkness, you can use an action to turn invisible. You stay invisible until you move, take an action or take a reaction.' },
  { key: 'otherworldly_leap', name: 'Otherworldly Leap', requires: [warlockLevel(9)], prereq: '9th level', spell: 'jump',
    text: 'You can cast jump on yourself whenever you like, with no spell slot and no material components.' },
  { key: 'repelling_blast', name: 'Repelling Blast', requires: [eldritchBlast], prereq: 'Eldritch Blast cantrip',
    text: 'A creature hit by your eldritch blast can be pushed up to 10 feet straight away from you.' },
  { key: 'sculptor_of_flesh', name: 'Sculptor of Flesh', requires: [warlockLevel(7)], prereq: '7th level',
    text: 'Once, you can cast polymorph with one of your warlock spell slots. You can do it again after a long rest.' },
  { key: 'sign_of_ill_omen', name: 'Sign of Ill Omen', requires: [warlockLevel(5)], prereq: '5th level',
    text: 'Once, you can cast bestow curse with one of your warlock spell slots. You can do it again after a long rest.' },
  { key: 'thief_of_five_fates', name: 'Thief of Five Fates',
    text: 'Once, you can cast bane with one of your warlock spell slots. You can do it again after a long rest.' },
  { key: 'thirsting_blade', name: 'Thirsting Blade', requires: [warlockLevel(5), pactOf('Blade')], prereq: '5th level, Pact of the Blade',
    text: 'When you take the Attack action, you can attack twice with your pact weapon instead of once.' },
  { key: 'visions_of_distant_realms', name: 'Visions of Distant Realms', requires: [warlockLevel(15)], prereq: '15th level', spell: 'arcane_eye',
    text: 'You can cast arcane eye whenever you like, with no spell slot.' },
  { key: 'voice_of_the_chain_master', name: 'Voice of the Chain Master', requires: [pactOf('Chain')], prereq: 'Pact of the Chain',
    text: 'While your familiar is on the same plane as you, you can talk to it in your mind and use its senses, and while you do, you can speak through it in your own voice.' },
  { key: 'whispers_of_the_grave', name: 'Whispers of the Grave', requires: [warlockLevel(9)], prereq: '9th level', spell: 'speak_with_dead',
    text: 'You can cast speak with dead whenever you like, with no spell slot.' },
  { key: 'witch_sight', name: 'Witch Sight', requires: [warlockLevel(15)], prereq: '15th level',
    text: 'Within 30 feet, and in your line of sight, you see the true form of a shapechanger, or of a creature hidden by illusion or transmutation magic.' },
];

// The same option and feature at every pick, so an invocation already taken is not offered again.
const INVOCATION_POOL: ChoiceOption[] = INVOCATIONS.map(i => ({
  id: `invocation_${i.key}`,
  label: i.prereq ? `${i.name} (${i.prereq})` : i.name,
  value: feature({ id: `invocation_srd51_${i.key}`, name: `Eldritch Invocation: ${i.name}`, source: WARLOCK,
    description: `${i.prereq ? `Prerequisite: ${i.prereq}. ` : ''}${i.text}`,
    effects: [...(i.spell ? [castsAtWill(i.spell)] : []), ...(i.skills ?? []).map(proficientIn)] }),
  ...(i.requires ? { requires: i.requires } : {}),
}));

/** Eldritch Invocations (Warlock: two at 2nd level, one more at 5th, 7th, 9th, 12th, 15th and 18th); one can be swapped at each warlock level. */
export function invocationChoice(id: string, count: number): ChoiceDefinition {
  return {
    ...poolChoice(id, count === 1 ? 'Eldritch Invocations: choose one more invocation.' : `Eldritch Invocations: choose ${count} invocations.`, count, INVOCATION_POOL),
    replace: { timing: 'level_up', rule: 'Each time you gain a warlock level, you may trade one invocation you know for another you qualify for.' },
  };
}

// ── Warlock: Mystic Arcanum ─────────────────────────────────────────────────

const ORDINAL: Record<number, string> = { 6: '6th', 7: '7th', 8: '8th', 9: '9th' };

/** Mystic Arcanum (Warlock 11th, 13th, 15th and 17th level: spell levels 6 to 9): the feature, the pick of one warlock spell of that
 *  level, and its free casting once per long rest. The feature keeps its old id, so a character that has it is not given it twice. */
export function mysticArcanumGrants(classLevel: number, spellLevel: number): Grant[] {
  const nth = ORDINAL[spellLevel];
  const pick: ChoiceDefinition = {
    id: `warlock_arcanum_${spellLevel}`, prompt: `Mystic Arcanum: choose one ${nth}-level warlock spell.`, kind: 'spell', count: 1, pool: 'all',
    grants: [], required: true, resolved: false,
    spellFilter: { lists: ['warlock'], levels: [spellLevel], ignoreSlotCap: true, label: `Mystic Arcanum (${nth}-level warlock spell)` },
  };
  return [
    { kind: 'feature', value: { ...feature({ id: `mystic_arcanum_${spellLevel}`, name: `Mystic Arcanum (${nth} level)`, source: WARLOCK, level: classLevel,
        activation: activation('free', { resource: `mystic_arcanum_${spellLevel}` }),
        description: `Your patron grants you one ${nth}-level warlock spell as an arcanum (the pick waits with your class choices). You can cast it once without spending a spell slot, and that free casting comes back when you finish a long rest.` }),
      grantsChoices: [pick] } },
    { kind: 'resource', value: { resourceId: `mystic_arcanum_${spellLevel}`, name: `Mystic Arcanum (${nth} level, free cast)`, maximum: 1, recharge: 'long_rest' } },
  ];
}

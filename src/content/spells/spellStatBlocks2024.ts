// ============================================================================
// FILE: src/content/spells/spellStatBlocks2024.ts
// The stat blocks that four SRD 5.2.1 spells name (Animated Object, Otherworldly Steed, Giant Insect, Draconic Spirit), as text under
// the spell. Creative Commons Attribution 4.0 (System Reference Document 5.2.1, by Wizards of the Coast LLC; see NOTICE.md).
// They are the spell's summoned creature, not monsters in the library, so they are read here and rolled by hand at the table.
// ============================================================================

export const SPELL_STAT_BLOCKS_2024: Record<string, string> = {
  animate_objects: [
    'Animated Object (Huge or smaller Construct, Unaligned)',
    'AC 15. HP 10 (Medium or smaller), 20 (Large), 40 (Huge). Speed 30 ft.',
    'Str 16 (+3), Dex 10 (+0), Con 10 (+0), Int 3 (-4), Wis 3 (-4), Cha 1 (-5). Saving throws equal the modifiers.',
    'Immunities: Poison, Psychic; Charmed, Exhaustion, Frightened, Paralyzed, Poisoned.',
    'Senses: Blindsight 30 ft.; Passive Perception 6. Languages: understands the languages you know. CR: none (PB equals your Proficiency Bonus).',
    'Actions',
    'Slam. Melee Attack Roll: bonus equals your spell attack modifier, reach 5 ft. Hit: Force damage equal to 1d4 + 3 (Medium or smaller), 2d6 + 3 + your spellcasting ability modifier (Large), or 2d12 + 3 + your spellcasting ability modifier (Huge).',
  ].join('\n'),

  find_steed: [
    'Otherworldly Steed (Large Celestial, Fey, or Fiend (your choice), Neutral)',
    'AC 10 + 1 per spell level. HP 5 + 10 per spell level (the steed has a number of Hit Dice [d10s] equal to the spell\'s level). Speed 60 ft., Fly 60 ft. (requires a level 4+ spell).',
    'Str 18 (+4), Dex 12 (+1), Con 14 (+2), Int 6 (-2), Wis 12 (+1), Cha 8 (-1). Saving throws equal the modifiers.',
    'Senses: Passive Perception 11. Languages: Telepathy 1 mile (works only with you). CR: none (PB equals your Proficiency Bonus).',
    'Traits',
    'Life Bond. When you regain Hit Points from a level 1+ spell, the steed regains the same number of Hit Points if you\'re within 5 feet of it.',
    'Actions',
    'Otherworldly Slam. Melee Attack Roll: bonus equals your spell attack modifier, reach 5 ft. Hit: 1d8 plus the spell\'s level of Radiant (Celestial), Psychic (Fey), or Necrotic (Fiend) damage.',
    'Bonus Actions',
    'Fell Glare (Fiend only; recharges after a Long Rest). Wisdom Saving Throw: DC equals your spell save DC, one creature within 60 feet the steed can see. Failure: The target has the Frightened condition until the end of your next turn.',
    'Fey Step (Fey only; recharges after a Long Rest). The steed teleports, along with its rider, to an unoccupied space of your choice up to 60 feet away from itself.',
    'Healing Touch (Celestial only; recharges after a Long Rest). One creature within 5 feet of the steed regains a number of Hit Points equal to 2d8 plus the spell\'s level.',
  ].join('\n'),

  giant_insect: [
    'Giant Insect (Large Beast, Unaligned)',
    'AC 11 + the spell\'s level. HP 30 + 10 for each spell level above 4. Speed 40 ft., Climb 40 ft., Fly 40 ft. (Wasp only).',
    'Str 17 (+3), Dex 13 (+1), Con 15 (+2), Int 4 (-3), Wis 14 (+2), Cha 3 (-4). Saving throws equal the modifiers.',
    'Senses: Darkvision 60 ft.; Passive Perception 12. Languages: understands the languages you know. CR: none (PB equals your Proficiency Bonus).',
    'Traits',
    'Spider Climb. The insect can climb difficult surfaces, including along ceilings, without needing to make an ability check.',
    'Actions',
    'Multiattack. The insect makes a number of attacks equal to half this spell\'s level (round down).',
    'Poison Jab. Melee Attack Roll: bonus equals your spell attack modifier, reach 10 ft. Hit: 1d6 + 3 plus the spell\'s level Piercing damage plus 1d4 Poison damage.',
    'Web Bolt (Spider only). Ranged Attack Roll: bonus equals your spell attack modifier, range 60 ft. Hit: 1d10 + 3 plus the spell\'s level Bludgeoning damage, and the target\'s Speed is reduced to 0 until the start of the insect\'s next turn.',
    'Bonus Actions',
    'Venomous Spew (Centipede only). Constitution Saving Throw: your spell save DC, one creature the insect can see within 10 feet. Failure: The target has the Poisoned condition until the start of the insect\'s next turn.',
  ].join('\n'),

  summon_dragon: [
    'Draconic Spirit (Large Dragon, Neutral)',
    'AC 14 + the spell\'s level. HP 50 + 10 for each spell level above 5. Speed 30 ft., Fly 60 ft., Swim 30 ft.',
    'Str 19 (+4), Dex 14 (+2), Con 17 (+3), Int 10 (+0), Wis 14 (+2), Cha 14 (+2). Saving throws equal the modifiers.',
    'Resistances: Acid, Cold, Fire, Lightning, Poison. Immunities: Charmed, Frightened, Poisoned.',
    'Senses: Blindsight 30 ft., Darkvision 60 ft.; Passive Perception 12. Languages: Draconic, understands the languages you know. CR: none (PB equals your Proficiency Bonus).',
    'Traits',
    'Shared Resistances. When you summon the spirit, choose one of its Resistances. You have Resistance to the chosen damage type until the spell ends.',
    'Actions',
    'Multiattack. The spirit makes a number of Rend attacks equal to half the spell\'s level (round down), and it uses Breath Weapon.',
    'Rend. Melee Attack Roll: bonus equals your spell attack modifier, reach 10 feet. Hit: 1d6 + 4 + the spell\'s level Piercing damage.',
    'Breath Weapon. Dexterity Saving Throw: DC equals your spell save DC, each creature in a 30-foot Cone. Failure: 2d6 damage of a type this spirit has Resistance to (your choice when you cast the spell). Success: Half damage.',
  ].join('\n'),
};

/** The spell's text with its stat block under it, or the text unchanged when it names none. */
export function withStatBlock(spellId: string, description: string): string {
  const block = SPELL_STAT_BLOCKS_2024[spellId];
  return block && !description.includes(block.split('\n')[0]) ? `${description}\n\n${block}` : description;
}

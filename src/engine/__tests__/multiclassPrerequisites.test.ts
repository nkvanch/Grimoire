// The multiclass ability requirements (the desktop's ADR-014): every class involved, the record's own requirement first, then the SRD's.
import { buildSrd51Pack } from '../../content/packs/srdPacks';
import { packContentProvider, InstalledPack } from '../../content/provider/contentProvider';
import { createCharacter } from '../../content/provider/createCharacter';
import { DEFAULT_RULES } from '../defaults';
import { multiclassLacks, multiclassRequirementApplies, multiclassRequirementOf, describeRequirement } from '../multiclassPrerequisites';
import type { CharClass, Entity, RulesetId } from '../types';
import { compileClassFields, multiclassNeedsDraft, type ClassDraft } from '../../content/homebrewCompile';

const provider = packContentProvider([JSON.parse(JSON.stringify(buildSrd51Pack())) as InstalledPack], 'dnd5e-2014' as RulesetId);
const classes = provider.classes();
/** A dwarf fighter: Strength 15, Dexterity 12, Wisdom 10, Intelligence 8, Charisma 10. */
const fighter = (): Entity => createCharacter(provider, {
  id: 'f', name: 'F', classId: 'fighter', raceId: 'dwarf', backgroundId: 'acolyte', stats: { str: 15, dex: 12, con: 14, int: 8, wis: 10, cha: 10 }, level: 3,
}, DEFAULT_RULES);

it('names what is short, for the new class and the one held', () => {
  expect(multiclassLacks(fighter(), 'barbarian', classes)).toEqual([]);
  expect(multiclassLacks(fighter(), 'monk', classes).map(l => l.message)).toEqual(['Monk needs Dexterity 13 and Wisdom 13']);
  const weak = { ...fighter(), stats: { ...fighter().stats, str: 10 } };
  expect(multiclassLacks(weak, 'barbarian', classes).map(l => l.message)).toEqual(['Fighter needs Strength 13 or Dexterity 13', 'Barbarian needs Strength 13']);
});

it('one class asks nothing; a class the table does not know asks nothing unless its record does', () => {
  expect(multiclassLacks(fighter(), null, classes)).toEqual([]);
  expect(multiclassLacks(fighter(), 'fighter', classes)).toEqual([]);
  expect(multiclassLacks(fighter(), 'my_class', classes)).toEqual([]);
  const mine = { id: 'my_class', name: 'Mystic', multiclassPrerequisites: [[{ ability: 'int', minimum: 15 }], [{ ability: 'cha' }]] } as unknown as CharClass;
  expect(multiclassLacks(fighter(), 'my_class', [...classes, mine]).map(l => l.message)).toEqual(['Mystic needs Intelligence 15 or Charisma 13']);
});

it('a 2024 class asks what its 2014 namesake does', () => {
  expect(describeRequirement(multiclassRequirementOf('paladin_2024')!)).toBe('Strength 13 and Charisma 13');
});

it('applies unless the table turns it off or the character was pinned before revision 3', () => {
  expect(multiclassRequirementApplies(DEFAULT_RULES, undefined)).toBe(true);
  expect(multiclassRequirementApplies(DEFAULT_RULES, 3)).toBe(true);
  expect(multiclassRequirementApplies(DEFAULT_RULES, 2)).toBe(false);
  expect(multiclassRequirementApplies({ multiclassPrerequisites: false }, undefined)).toBe(false);
});

it('a homebrew class\'s "Abilities needed" compiles as the desktop does, and reads back into the builder', () => {
  const draft = { name: 'Mystic', hitDie: 8, hpAbility: 'con', description: '', savingThrows: [], armorProfs: [], weaponProfs: [], toolProfs: [], startingEquipment: [],
    equipmentNotes: '', isCaster: false, spellAbilities: [], spellStyle: 'full', spellPrepPolicy: 'known', spellStartLevel: '1', spellSource: 'own', levelFeatures: [], asiLevels: [4, 8, 12, 16, 19] } as unknown as ClassDraft;
  expect(compileClassFields(draft, 'mystic').multiclassPrerequisites).toBeUndefined();   // none named: compiles as before
  const all = compileClassFields({ ...draft, multiclassNeeds: ['int', 'wis'], multiclassNeedsMinimum: 14 }, 'mystic').multiclassPrerequisites;
  expect(all).toEqual([[{ ability: 'int', minimum: 14 }, { ability: 'wis', minimum: 14 }]]);
  const any = compileClassFields({ ...draft, multiclassNeeds: ['int', 'cha'], multiclassNeedsAny: true, multiclassNeedsMinimum: 99 }, 'mystic').multiclassPrerequisites;
  expect(any).toEqual([[{ ability: 'int', minimum: 13 }], [{ ability: 'cha', minimum: 13 }]]);   // out of range: 13
  expect(multiclassNeedsDraft(all)).toEqual({ abilities: ['int', 'wis'], minimum: 14, any: false });
  expect(multiclassNeedsDraft(any)).toEqual({ abilities: ['int', 'cha'], minimum: 13, any: true });
});

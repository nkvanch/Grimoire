// Magic armor whose rules leave the base armor open ("Armor (Any Medium or Heavy, Except Hide Armor)": Armor +1, Adamantine Armor,
// Armor of Resistance) gave no AC at all (found 2026-11-15). The owner now picks the base on the item; its AC and weight follow it.
import { buildSrd51Pack } from '../../content/packs/srdPacks';
import { packContentProvider, InstalledPack } from '../../content/provider/contentProvider';
import { createCharacter } from '../../content/provider/createCharacter';
import { DEFAULT_RULES } from '../defaults';
import { recomputeDerived } from '../pipeline';
import { baseArmorChoices, wornGearOf } from '../itemMechanics';
import { equipItem, setItemChoices } from '../inventory';
import type { Entity, Item, RulesetId } from '../types';

const provider = packContentProvider([JSON.parse(JSON.stringify(buildSrd51Pack())) as InstalledPack], 'dnd5e-2014' as RulesetId);
const item = (id: string, name: string, properties: string[], description = ''): Item => ({
  id, name, weight: 0, cost: '—', properties,
  features: [{ id: `${id}_f`, name, description, source: { kind: 'item', refId: id }, level: null, effects: [], actions: [], choices: [], passive: true }],
} as unknown as Item);
const plusOne = item('t_plus1', 'Armor, +1, +2, or +3', ['magic item', 'armor'], 'Armor (Any Light, Medium, or Heavy), Rare (+1). You have a bonus to Armor Class.');
const adamantine = item('t_adam', 'Adamantine Armor', ['magic item', 'armor'], 'Armor (Any Medium or Heavy, Except Hide Armor), Uncommon. Critical hits become normal hits.');
const adamantine2014 = item('t_adam14', 'Adamantine Armor', ['magic item', 'armor'], 'Armor reinforced with adamantine.');
const chain = item('t_chain', 'Chain Mail', ['heavy armor', 'ac 16']);
const items = [plusOne, adamantine, adamantine2014, chain];

/** DEX 13 + human 1 = 14 (+2). */
const carrying = (...defs: Item[]): Entity => {
  const e = createCharacter(provider, { id: 'f', name: 'F', classId: 'fighter', raceId: 'human', backgroundId: 'acolyte',
    stats: { str: 16, dex: 13, con: 14, int: 10, wis: 10, cha: 8 }, level: 1 }, DEFAULT_RULES);
  return recomputeDerived({ ...e, inventory: { ...e.inventory, equipped: [],
    carried: defs.map(d => ({ id: `i-${d.id}`, itemId: d.id, quantity: 1, attuned: false, features: [] } as never)) } }, DEFAULT_RULES, { items });
};
const ac = (e: Entity) => recomputeDerived(e, DEFAULT_RULES, { items }).derived.ac;

it('the choices follow the heading: any armor, or medium and heavy without hide; a named 2014 one follows the rules', () => {
  expect(baseArmorChoices(plusOne)).toHaveLength(12);
  expect(baseArmorChoices(adamantine)).toEqual(['chain shirt', 'scale mail', 'breastplate', 'half plate', 'ring mail', 'chain mail', 'splint', 'plate']);
  expect(baseArmorChoices(adamantine2014)).toEqual(baseArmorChoices(adamantine));
  expect(baseArmorChoices(chain)).toBeNull();   // its base is fixed
});

it('with no base chosen it gives no AC; with plate chosen it is plate with its bonus, and counts as heavy armor', () => {
  let e = equipItem(carrying(plusOne), 't_plus1', plusOne, DEFAULT_RULES, 'i-t_plus1');
  expect(ac(e)).toBe(12);   // 10 + DEX 2: nothing known to go on
  e = setItemChoices(e, 'i-t_plus1', { baseArmor: 'plate' }, plusOne);
  expect(ac(e)).toBe(18 + 1);
  expect(wornGearOf(e.inventory.equipped, id => items.find(i => i.id === id)).armor).toBe('heavy');
  e = setItemChoices(e, 'i-t_plus1', { baseArmor: 'studded leather' }, plusOne);
  expect(ac(e)).toBe(12 + 1 + 2);   // light: all of DEX
});

it('once it has a base, putting it on takes off the armor already worn, and choosing a base for worn armor does the same', () => {
  let e = equipItem(carrying(chain, adamantine), 't_chain', chain, DEFAULT_RULES, 'i-t_chain');
  e = setItemChoices(e, 'i-t_adam', { baseArmor: 'half plate' }, adamantine);   // carried: just set
  e = equipItem(e, 't_adam', adamantine, DEFAULT_RULES, 'i-t_adam');
  expect(e.inventory.equipped.map(i => i.itemId)).toEqual(['t_adam']);
  expect(ac(e)).toBe(15 + 2);
  e = equipItem(e, 't_chain', chain, DEFAULT_RULES, 'i-t_chain');
  expect(e.inventory.equipped.map(i => i.itemId)).toEqual(['t_chain']);
});

it('a record that covers +1, +2 and +3 takes the bonus its owner picks, for armor, a shield and a weapon', () => {
  const { bonusChoices } = require('../itemMechanics');
  expect(bonusChoices(plusOne)).toEqual([1, 2, 3]);
  expect(bonusChoices(chain)).toBeNull();
  let e = equipItem(carrying(plusOne), 't_plus1', plusOne, DEFAULT_RULES, 'i-t_plus1');
  e = setItemChoices(e, 'i-t_plus1', { baseArmor: 'plate' }, plusOne);
  expect(ac(e)).toBe(18 + 1);   // +1 until a bonus is picked: the name's first
  e = setItemChoices(e, 'i-t_plus1', { magicBonus: 3 }, plusOne);
  expect(ac(e)).toBe(18 + 3);
  expect(e.inventory.equipped[0].baseArmor).toBe('plate');   // the other choice is kept
});

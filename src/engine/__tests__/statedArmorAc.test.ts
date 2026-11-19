// Worn armor changes AC even when its data carries no AC effect of its own (found 2026-11-15: the non-SRD "Plate Armor", only
// "heavy armor, ac 18", left AC unchanged when equipped; so did 41 other armors and shields across the packs).
import { buildSrd51Pack } from '../../content/packs/srdPacks';
import { packContentProvider, InstalledPack } from '../../content/provider/contentProvider';
import { createCharacter } from '../../content/provider/createCharacter';
import { DEFAULT_RULES } from '../defaults';
import { recomputeDerived } from '../pipeline';
import { statedArmorAc } from '../itemMechanics';
import type { Entity, Item, RulesetId } from '../types';

const provider = packContentProvider([JSON.parse(JSON.stringify(buildSrd51Pack())) as InstalledPack], 'dnd5e-2014' as RulesetId);
/** DEX 14 (+2): a heavy armor ignores it, a medium one takes it up to 2. */
const fighter = (): Entity => recomputeDerived(createCharacter(provider, { id: 'f', name: 'F', classId: 'fighter', raceId: 'human',
  backgroundId: 'acolyte', stats: { str: 16, dex: 13, con: 14, int: 10, wis: 10, cha: 8 }, level: 3 }, DEFAULT_RULES), DEFAULT_RULES);
const item = (id: string, name: string, properties: string[], description = '', effects: unknown[] = []): Item => ({
  id, name, weight: 0, cost: '—', properties,
  features: [{ id: `${id}_desc`, name, description, source: { kind: 'item', refId: id }, level: null, effects, actions: [], choices: [], passive: true }],
} as unknown as Item);
const acWearing = (...items: Item[]) => {
  const e = fighter();
  const worn = { ...e, inventory: { ...e.inventory, carried: [], equipped: items.map(i => ({ id: `inst-${i.id}`, itemId: i.id, quantity: 1, attuned: true, features: [] } as never)) } };
  return recomputeDerived(worn, DEFAULT_RULES, { items }).derived.ac;
};

it('the non-SRD Plate Armor (only "heavy armor, ac 18") gives AC 18', () => {
  expect(acWearing(item('plate_armor', 'Plate Armor', ['heavy armor', 'ac 18']))).toBe(18);
});

it('armor known only by its name takes its base armor; a medium one adds Dexterity up to 2; a stated one is read as stated', () => {
  expect(acWearing(item('t_gleaming_plate', 'Gleaming Plate Armor', []))).toBe(18);
  expect(acWearing(item('t_half', 'Test Half Plate', ['medium armor', 'ac 15 + dexterity modifier (max 2)']))).toBe(15 + 2);
  expect(acWearing(item('t_scale', 'Dragon Scale Mail', ['magic item', 'very rare']))).toBe(14 + 1 + 2);   // scale mail, its +1, Dex
});

it('a magic bonus in the name or the text is added', () => {
  expect(acWearing(item('t_dwarven', 'Dwarven Plate', ['magic item', 'armor'], 'While wearing this armor, you gain a +2 bonus to Armor Class.'))).toBe(20);
  expect(acWearing(item('t_plate1', 'Mithral Plate +1', []))).toBe(19);
});

it('a magic armor whose text states neither bonus nor base gets the ones the rules fix (paraphrased pack data)', () => {
  expect(acWearing(item('t_efreeti', 'Efreeti Chain Mail', ['magic item'], 'Fire-infused chain mail.'))).toBe(16 + 3);
  expect(acWearing(item('t_scale', 'Black Dragon Scale Mail', ['medium armor', 'ac 14 + dex (max 2)'], 'Crafted from black dragon scales.'))).toBe(15 + 2);
  expect(acWearing(item('t_invuln', 'Armor of Invulnerability', ['heavy armor'], 'Grants resistance.'))).toBe(18);
});

it('the base armor can come from the "Armor (…)" heading; "Any…" means the player picks it, so nothing is guessed', () => {
  expect(acWearing(item('t_heading', 'Armor of Something', ['armor'], 'Armor (Plate Armor), Legendary. Shiny.'))).toBe(18);
  expect(statedArmorAc(item('t_any', 'Demon Armor', ['armor'], 'Armor (Any Light, Medium, or Heavy), Very Rare. You gain a +1 bonus to Armor Class.'))).toBeNull();
});

it('a shield with no AC effect adds 2 on top of the armor', () => {
  expect(acWearing(item('plate_armor', 'Plate Armor', ['heavy armor', 'ac 18']), item('t_shield', 'Oak Shield', ['shield']))).toBe(20);
});

it('armor that carries its own AC effect is left to it (never counted twice), and a non-armor item gives nothing', () => {
  const own = item('t_own', 'Odd Plate', ['heavy armor', 'ac 18'], '', [{ type: 'base_ac_formula', target: 'ac', operation: 'set', value: 17, condition: null }]);
  expect(acWearing(own)).toBe(17);
  expect(statedArmorAc(own)).toBeNull();
  expect(statedArmorAc(item('t_rope', 'Rope', []))).toBeNull();
});

it('never mistakes other things for armor, and never counts a bonus that applies only sometimes (found scanning every pack)', () => {
  expect(statedArmorAc(item('t_tools', "Leatherworker's Tools", ['tool']))).toBeNull();
  expect(statedArmorAc(item('t_belt', 'Snakeskin Belt +1', ['magic item', 'uncommon']))).toBeNull();
  const arrows = statedArmorAc(item('t_arrows', 'Arrow-Catching Shield', ['shield'], 'You gain a +2 bonus to AC against ranged attacks while you wield this shield.'));
  expect(arrows?.value).toBe(2);
});

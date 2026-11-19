// One suit of armor and one shield at a time (found 2026-11-15 on the phone: Chain Mail and Plate Armor could be worn together).
// Equipping armor or a shield takes off the one already worn there; other gear, and a belt whose name only contains "hide", stay.
import { buildSrd51Pack } from '../../content/packs/srdPacks';
import { packContentProvider, InstalledPack } from '../../content/provider/contentProvider';
import { createCharacter } from '../../content/provider/createCharacter';
import { armorWeight } from '../../content/items/itemBrowse';
import { toItemIndexEntry } from '../../content/itemRepo.types';
import { buildEquipmentSummaryRows } from '../../components/sheet/EquipmentPreviewModal';
import { DEFAULT_RULES } from '../defaults';
import { recomputeDerived } from '../pipeline';
import { equipItem } from '../inventory';
import type { Entity, Item } from '../types';

const provider = packContentProvider([JSON.parse(JSON.stringify(buildSrd51Pack())) as InstalledPack], 'dnd5e-2014' as never);
// made-up items, so the test needs no catalog (and the public tree, which has a smaller one, runs it as it is)
const item = (id: string, name: string, properties: string[]): Item => ({ id, name, weight: 0, cost: '—', properties, features: [] } as unknown as Item);
const ITEMS = [item('chain_mail', 'Test Chain Mail', ['heavy armor', 'ac 16']), item('plate', 'Test Plate', ['heavy armor', 'ac 18']),
  item('leather_armor', 'Test Leather Armor', ['light armor']), item('shield', 'Test Shield', ['shield']),
  item('snakehide_belt', 'Snakehide Belt', ['magic item'])];
const def = (id: string) => ITEMS.find(i => i.id === id)!;
const IDS = ITEMS.map(i => i.id);
const carrying = (): Entity => {
  const e = recomputeDerived(createCharacter(provider, { id: 'f', name: 'F', classId: 'fighter', raceId: 'human', backgroundId: 'acolyte',
    stats: { str: 16, dex: 14, con: 14, int: 10, wis: 10, cha: 8 }, level: 3 }, DEFAULT_RULES), DEFAULT_RULES);
  return { ...e, inventory: { ...e.inventory, equipped: [], carried: IDS.map(id => ({ id: `i-${id}`, itemId: id, quantity: 1, attuned: false, features: [] })) } };
};
const wear = (e: Entity, ...ids: string[]) => ids.reduce((x, id) => equipItem(x, id, def(id), DEFAULT_RULES), e);
const worn = (e: Entity) => e.inventory.equipped.map(i => i.itemId).sort();

it('a second suit of armor takes the first one off', () => {
  const e = wear(carrying(), 'chain_mail', 'plate');
  expect(worn(e)).toEqual(['plate']);
  expect(e.inventory.carried.map(i => i.itemId)).toContain('chain_mail');
  expect(e.derived.ac).toBe(18);
});

it('a second shield takes the first off; armor and a shield are worn together', () => {
  let e = wear(carrying(), 'leather_armor', 'shield');
  expect(worn(e)).toEqual(['leather_armor', 'shield']);
  e = { ...e, inventory: { ...e.inventory, carried: [...e.inventory.carried, { id: 'i-shield-2', itemId: 'shield', quantity: 1, attuned: false, features: [] }] } };
  e = equipItem(e, 'shield', def('shield'), DEFAULT_RULES, 'i-shield-2');
  expect(e.inventory.equipped.filter(i => i.itemId === 'shield').map(i => i.id)).toEqual(['i-shield-2']);
});

it('a belt named with "hide" is not armor and takes nothing off', () => {
  expect(armorWeight(toItemIndexEntry(def('snakehide_belt')))).toBeNull();
  const e = wear(carrying(), 'chain_mail', 'snakehide_belt');
  expect(worn(e)).toEqual(['chain_mail', 'snakehide_belt']);
});

it('the equip preview says what was taken off', () => {
  const before = wear(carrying(), 'chain_mail');
  const after = equipItem(before, 'plate', def('plate'), DEFAULT_RULES);
  const labels = buildEquipmentSummaryRows(before, after, id => def(id).name).map(r => r.label);
  expect(labels).toContain('Taken off: Test Chain Mail');
  expect(labels).toContain('AC: 16 → 18');
});

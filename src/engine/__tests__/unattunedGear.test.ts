// Gear that requires attunement and is not attuned still gives its nonmagical benefits (found 2026-11-18 on an Android 15
// emulator: an unattuned Dragon Scale Mail gave AC as if nothing were worn; an unattuned magic sword had no attack at all).
// Armor counts as its plain base armor, a weapon attacks as its plain base weapon; the magic waits for attunement.
import { buildSrd51Pack } from '../../content/packs/srdPacks';
import { packContentProvider, InstalledPack } from '../../content/provider/contentProvider';
import { createCharacter } from '../../content/provider/createCharacter';
import { DEFAULT_RULES } from '../defaults';
import { recomputeDerived } from '../pipeline';
import { generateAllActionCards } from '../actionCards';
import { isAppliedFightingStyle } from '../weaponAttackBonuses';
import type { Entity, Item, RulesetId } from '../types';

const provider = packContentProvider([JSON.parse(JSON.stringify(buildSrd51Pack())) as InstalledPack], 'dnd5e-2014' as RulesetId);
const ATTUNE = 'requires attunement';
const armor = (id: string, name: string, properties: string[], effects: unknown[] = []): Item => ({
  id, name, weight: 0, cost: '—', properties,
  features: [{ id: `${id}_f`, name, description: '', source: { kind: 'item', refId: id }, level: null, effects, actions: [], choices: [], passive: true }],
} as unknown as Item);
/** A magic longsword: its own attack (1d8 slashing) with a fire rider, and a +1 in its name. */
const sword: Item = {
  id: 't_flame', name: 'Test Longsword +1', weight: 3, cost: '—', properties: ['versatile (1d10)', ATTUNE],
  features: [{ id: 't_flame_attack', name: 'Test Longsword +1', description: '', source: { kind: 'item', refId: 't_flame' }, level: null, effects: [], actions: [],
    choices: [], passive: false, activation: { actionType: 'action', resourceCost: null, range: '5 feet', target: 'single', requiresSave: null },
    abilityEffects: [{ type: 'damage', dice: '1d8', damageType: 'slashing' }, { type: 'damage', dice: '2d6', damageType: 'fire' }] }],
} as unknown as Item;
const items = [
  armor('t_scale', 'Dragon Scale Mail', ['magic item', ATTUNE]),
  armor('t_chain1', 'Chain Mail of Testing', ['heavy armor', ATTUNE], [{ type: 'base_ac_formula', target: 'ac', operation: 'set', value: 19, condition: null }]),
  armor('t_shield', 'Animated Shield', ['shield', ATTUNE]),
  armor('t_ring', 'Ring of Testing', [ATTUNE], [{ type: 'stat_modifier', target: 'ac', operation: 'add', value: 1, condition: null }]),
  sword,
];
/** STR 16 (+3), DEX 14 (+2), proficiency +2. */
const wearing = (ids: string[], attuned: boolean): Entity => {
  const e = createCharacter(provider, { id: 'f', name: 'F', classId: 'fighter', raceId: 'human', backgroundId: 'acolyte',
    stats: { str: 16, dex: 13, con: 14, int: 10, wis: 10, cha: 8 }, level: 1 }, DEFAULT_RULES);
  return recomputeDerived({ ...e, inventory: { ...e.inventory, carried: [],
    equipped: ids.map(id => ({ id: `inst-${id}`, itemId: id, quantity: 1, attuned, features: [] } as never)) } }, DEFAULT_RULES, { items });
};

it('unattuned magic armor is plain armor: its base AC without the bonus; attuned, the bonus counts', () => {
  expect(wearing(['t_scale'], false).derived.ac).toBe(14 + 2);        // scale mail, Dex up to 2
  expect(wearing(['t_scale'], true).derived.ac).toBe(14 + 1 + 2);
  expect(wearing(['t_chain1'], false).derived.ac).toBe(16);           // its own AC effect waits; chain mail by its name
  expect(wearing(['t_chain1'], true).derived.ac).toBe(19);
  expect(wearing(['t_scale', 't_shield'], false).derived.ac).toBe(16 + 2);
});

it('an unattuned item that is not armor still gives nothing', () => {
  expect(wearing(['t_ring'], false).derived.ac).toBe(wearing([], false).derived.ac);
  expect(wearing(['t_ring'], true).derived.ac).toBe(wearing([], false).derived.ac + 1);
});

it('an unattuned magic weapon attacks as a plain weapon, and its card says so; attuned, it has its bonus and its own card', () => {
  const plain = wearing(['t_flame'], false);
  const attack = plain.derived.attackBonuses.find(a => a.id === 't_flame')!;
  expect([attack.bonus, attack.damageBonus, attack.damageDice]).toEqual([2 + 3, 3, '1d8']);
  const card = generateAllActionCards(plain, DEFAULT_RULES, { items }).find(c => c.name === 'Test Longsword +1')!;
  expect(card.layer2).toMatch(/^\+5 to hit • 1d8\+3 Slashing/);
  expect(card.layer2).not.toMatch(/fire/i);
  expect(card.layer3).toMatch(/Not attuned/);
  const attuned = wearing(['t_flame'], true);
  expect(attuned.derived.attackBonuses.find(a => a.id === 't_flame')!.bonus).toBe(2 + 3 + 1);
  expect(generateAllActionCards(attuned, DEFAULT_RULES, { items }).find(c => c.name === 'Test Longsword +1')!.layer2).toMatch(/Fire/);
});

it('the four fighting styles the engine applies are not flavor, under either way their features are named', () => {
  for (const n of ['Archery', 'Fighting Style: Dueling', 'Great Weapon Fighting', 'Fighting Style: Two-Weapon Fighting']) expect([n, isAppliedFightingStyle(n)]).toEqual([n, true]);
  expect(isAppliedFightingStyle('Protection')).toBe(false);
});

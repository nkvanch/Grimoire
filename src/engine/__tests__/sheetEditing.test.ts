// Editing a character by hand: an ability set by its total, and an owned item customised into the person's own copy.
import { buildSrd51Pack } from '../../content/packs/srdPacks';
import { packContentProvider, InstalledPack } from '../../content/provider/contentProvider';
import { createCharacter } from '../../content/provider/createCharacter';
import { DEFAULT_RULES } from '../defaults';
import { effectiveAbilityScores, recomputeDerived } from '../pipeline';
import { setAbilityTotal } from '../abilityTotal';
import { itemEditsOf, customizedItem, moveOwnedItem } from '../itemCustomize';
import { itemRequiresAttunement } from '../itemMechanics';
import { explainValue } from '../audit';
import type { Entity, Item, RulesetId } from '../types';

const pack = JSON.parse(JSON.stringify(buildSrd51Pack())) as InstalledPack;
const provider = packContentProvider([pack], 'dnd5e-2014' as RulesetId);
/** A dwarf fighter: Constitution 14 base, +2 from being a dwarf. */
const dwarf = (): Entity => createCharacter(provider, {
  id: 'brakka', name: 'Brakka', classId: 'fighter', raceId: 'dwarf', backgroundId: 'acolyte', stats: { str: 15, dex: 12, con: 14, int: 8, wis: 10, cha: 10 }, level: 3,
}, DEFAULT_RULES);

/** An item worn by the character, resolved from `homebrew` as the sheet would. */
function wearing(e: Entity, item: Item): Entity {
  const inst = { id: 'inst-1', itemId: item.id, quantity: 1, attuned: true, features: item.features } as never;
  return { ...e, inventory: { ...e.inventory, equipped: [...e.inventory.equipped, inst] } };
}

describe('setting an ability by its total', () => {
  it('moves the base so the total is what was typed; the race bonus is not added again', () => {
    const e = dwarf();
    expect(effectiveAbilityScores(e).con).toBe(16);
    const r = setAbilityTotal(e, 'con', 18);
    expect(r.ok).toBe(true);
    expect(r.entity.stats.con).toBe(16);                       // base 16 + 2 dwarf = 18, not 18 + 2
    expect(effectiveAbilityScores(r.entity).con).toBe(18);
  });

  it('says so, and changes nothing, when something else sets the score', () => {
    const e = { ...dwarf(), characterOverrides: [{ id: 'o', entityId: 'brakka', stat: 'str', value: 19, label: 'x', operation: 'set', active: true, appliedAt: 1, cancelledAt: null }] } as unknown as Entity;
    const r = setAbilityTotal(e, 'str', 12);
    expect(r.ok).toBe(false);
    expect(r.entity).toBe(e);
    if (!r.ok) expect(r.reason).toMatch(/sets this score to 19/);
  });

  it('changes nothing, and says why, when the base is already at its limit', () => {
    const e = { ...dwarf(), stats: { ...dwarf().stats, str: 30 } };
    const r = setAbilityTotal(e, 'str', 99);
    expect(r.ok).toBe(false);
    expect(r.entity).toBe(e);
    if (!r.ok) expect(r.reason).toMatch(/already at its highest \(30\)/);
  });

  it('stops at the base limits and says where', () => {
    const r = setAbilityTotal(dwarf(), 'con', 40);
    expect(r.ok).toBe(false);
    expect(r.entity.stats.con).toBe(30);
    if (!r.ok) expect(r.reason).toMatch(/stops at 30, so the total is 32/);
  });
});

describe('customising an owned item', () => {
  const belt: Item = {
    id: 'belt_of_hill_giant_strength', name: 'Belt of Hill Giant Strength', weight: 0, cost: '—', properties: ['magic item', 'rare'], srd: true,
    features: [{ id: 'belt_desc', name: 'Belt of Hill Giant Strength', description: 'Sets Strength score to 21 while worn.', source: { kind: 'item', refId: 'belt_of_hill_giant_strength' }, level: null, effects: [], actions: [], choices: [], passive: true }],
  } as unknown as Item;

  it('an item that needs attunement by its id alone still needs it as a copy', () => {
    const amulet = { ...belt, id: 'amulet_of_health', name: 'Amulet of Health' };
    expect(itemRequiresAttunement(amulet)).toBe(true);
    expect(itemRequiresAttunement(customizedItem(amulet, itemEditsOf(amulet), 'amulet_mine'))).toBe(true);
    expect(itemRequiresAttunement(customizedItem(belt, itemEditsOf(belt), 'belt_mine'))).toBe(false);   // nor gains it
  });

  it('makes a copy that sets Strength to 22 and leaves the official record alone', () => {
    const edits = { ...itemEditsOf(belt), description: 'Sets Strength to 22 while worn.', abilities: { str: { operation: 'set' as const, value: 22 } } };
    const mine = customizedItem(belt, edits, 'belt_mine');
    expect(mine.id).toBe('belt_mine');
    expect((mine as { srd?: boolean }).srd).toBeUndefined();
    expect(mine.features[0]).toMatchObject({ description: 'Sets Strength to 22 while worn.', source: { refId: 'belt_mine' } });
    expect(mine.features[0].effects).toEqual([{ type: 'stat_modifier', target: 'str', operation: 'set', value: 22, condition: null, atLeast: true }]);
    expect(belt.features[0].effects).toEqual([]);
    expect(itemEditsOf(mine).abilities).toEqual({ str: { operation: 'set', value: 22 } });   // the form reads back what it wrote
  });

  it('the worn copy then sets the total, whatever the base and race add', () => {
    const mine = customizedItem(belt, { ...itemEditsOf(belt), abilities: { str: { operation: 'set', value: 22 } } }, 'belt_mine');
    const e = moveOwnedItem(wearing(dwarf(), belt), 'inst-1', belt, mine);
    expect(e.inventory.equipped.find(i => i.id === 'inst-1')).toMatchObject({ itemId: 'belt_mine', attuned: true });
    expect(effectiveAbilityScores(e).str).toBe(22);
    expect(recomputeDerived(e, DEFAULT_RULES).derived.savingThrows.str).toBeGreaterThanOrEqual(6);   // +6 from 22, plus proficiency
  });

  it('"set to" is the score, with no other bonus added on top, and does nothing when the score is already higher', () => {
    const mine = customizedItem(belt, { ...itemEditsOf(belt), abilities: { str: { operation: 'set', value: 22 } } }, 'belt_mine');
    const gauntlets = { ...belt, id: 'gauntlets', name: 'Gauntlets', features: [] } as unknown as Item;
    const plusTwo = customizedItem(gauntlets, { ...itemEditsOf(gauntlets), abilities: { str: { operation: 'add', value: 2 } } }, 'gauntlets_mine');
    let e = moveOwnedItem(wearing(dwarf(), belt), 'inst-1', belt, mine);
    e = { ...e, inventory: { ...e.inventory, equipped: [...e.inventory.equipped, { id: 'inst-2', itemId: 'gauntlets_mine', quantity: 1, attuned: true, features: plusTwo.features }] } };
    expect(effectiveAbilityScores(e).str).toBe(22);                                   // 15 + 2 = 17, the belt makes it 22, not 24
    expect(effectiveAbilityScores({ ...e, stats: { ...e.stats, str: 23 } }).str).toBe(25);   // 23 + 2 is already higher: the belt does nothing
  });

  it('uses: a new pool is granted on a worn item, a changed maximum keeps the spent uses, and a removed pool goes', () => {
    const wand = { ...belt, id: 'wand', name: 'Wand', features: [] } as unknown as Item;
    const withUses = customizedItem(wand, { ...itemEditsOf(wand), uses: { maximum: 7, recharge: 'dawn' } }, 'wand_mine');
    let e = moveOwnedItem(wearing(dwarf(), wand), 'inst-1', wand, withUses);
    const pool = () => e.resources.custom.find(c => c.id === 'wand_mine_uses');
    expect(pool()).toMatchObject({ maximum: 7, current: 7, recharge: 'dawn' });
    e = { ...e, resources: { ...e.resources, custom: e.resources.custom.map(c => (c.id === 'wand_mine_uses' ? { ...c, current: 4 } : c)) } };   // three spent
    const fewer = customizedItem(withUses, { ...itemEditsOf(withUses), uses: { maximum: 5, recharge: 'dawn' } }, 'wand_mine');
    e = moveOwnedItem(e, 'inst-1', withUses, fewer);
    expect(pool()).toMatchObject({ maximum: 5, current: 2 });   // still three spent
    const none = customizedItem(fewer, { ...itemEditsOf(fewer), uses: null }, 'wand_mine');
    e = moveOwnedItem(e, 'inst-1', fewer, none);
    expect(pool()).toBeUndefined();
  });
});

describe('the ability breakdown', () => {
  const plain = (id: string, effects: unknown[]) => ({ id: `inst-${id}`, itemId: id, quantity: 1, attuned: true,
    features: [{ id: `${id}_f`, name: id, description: '', source: { kind: 'item', refId: id }, level: null, effects, actions: [], choices: [], passive: true }] });
  const wear = (e: Entity, ...items: ReturnType<typeof plain>[]) => ({ ...e, inventory: { ...e.inventory, equipped: [...e.inventory.equipped, ...items] } }) as unknown as Entity;
  const add = (v: number) => ({ type: 'stat_modifier', target: 'str', operation: 'add', value: v, condition: null });
  const set = (v: number, atLeast?: boolean) => ({ type: 'stat_modifier', target: 'str', operation: 'set', value: v, condition: null, ...(atLeast ? { atLeast } : {}) });

  it('adds up to the score shown: items count, a set is the final score, a floor raises it last', () => {
    for (const e of [
      wear(dwarf(), plain('gauntlets', [add(2)])),                                   // 15 + 2
      wear(dwarf(), plain('gauntlets', [add(2)]), plain('belt', [set(21)])),          // set: 21, the +2 does not count
      wear(dwarf(), plain('gauntlets', [add(2)]), plain('belt', [set(22, true)])),    // 17, the floor makes it 22
      wear({ ...dwarf(), stats: { ...dwarf().stats, str: 24 } }, plain('belt', [set(22, true)])),   // already higher: 24
    ]) {
      const trail = explainValue(e, 'str');
      expect(trail.total).toBe(effectiveAbilityScores(e).str);
    }
    const trail = explainValue(wear(dwarf(), plain('gauntlets', [add(2)]), plain('belt', [set(21)])), 'str');
    expect(trail.total).toBe(21);
    expect(trail.entries.map(x => x.label)).toEqual(['Base score', 'gauntlets (+2, does not count: the score is set)', 'belt sets it to 21']);
  });
});


// Modes on a feature, a character's or an item's: the active mode's effects apply, the first by default, and switching is per owned copy.
import { buildSrd51Pack } from '../../content/packs/srdPacks';
import { packContentProvider, InstalledPack } from '../../content/provider/contentProvider';
import { createCharacter } from '../../content/provider/createCharacter';
import { DEFAULT_RULES } from '../defaults';
import { effectiveAbilityScores } from '../pipeline';
import { activeMode, effectsInForce, modeKey, setFeatureMode } from '../featureModes';
import { customizedItem, itemEditsOf, abilityChangesOf, abilityChangeEffects, type ItemEdits } from '../itemCustomize';
import { grantCustomFeature } from '../../components/sheet/AddCustomFeatureModal';
import { newDraftTrait } from '../../content/traitCompiler';
import type { Entity, Item, RulesetId } from '../types';

const provider = packContentProvider([JSON.parse(JSON.stringify(buildSrd51Pack())) as InstalledPack], 'dnd5e-2014' as RulesetId);
/** A half-orc sorcerer: 10 12 11 11 12 17 before the half-orc's +2 Strength and +1 Constitution. */
const sorcerer = (): Entity => createCharacter(provider, {
  id: 'o', name: 'Orclindbad', classId: 'sorcerer', raceId: 'half_orc', backgroundId: 'acolyte', stats: { str: 10, dex: 12, con: 11, int: 11, wis: 12, cha: 17 }, level: 7,
}, DEFAULT_RULES);

const belt: Item = {
  id: 'belt_of_hill_giant_strength', name: 'Belt of Hill Giant Strength', weight: 0, cost: '—', properties: ['magic item', 'rare'],
  features: [{ id: 'belt_desc', name: 'Belt of Hill Giant Strength', description: '', source: { kind: 'item', refId: 'belt_of_hill_giant_strength' }, level: null, effects: [], actions: [], choices: [], passive: true }],
} as unknown as Item;
const down10 = { operation: 'add' as const, value: -10, min: 4 };
const edits = (): ItemEdits => ({
  ...itemEditsOf(belt),
  modes: [
    { id: 'worn', name: 'Worn', abilities: { str: { operation: 'set', value: 22 }, int: down10, wis: down10 } },
    { id: 'twisted', name: 'Twisted', abilities: { int: { operation: 'set', value: 22 }, wis: { operation: 'set', value: 22 }, str: down10, dex: down10, con: down10 } },
  ],
});
function wearing(e: Entity, item: Item): Entity {
  const inst = { id: 'inst-belt', itemId: item.id, quantity: 1, attuned: true, features: item.features } as never;
  return { ...e, inventory: { ...e.inventory, equipped: [...e.inventory.equipped, inst] } };
}

it('an add with a minimum never goes below it, and reads back as one', () => {
  expect(abilityChangesOf(abilityChangeEffects({ int: down10 }))).toEqual({ int: down10 });
});

it("the belt: worn, Strength 22 and Intelligence and Wisdom down to 4; twisted, the other way round", () => {
  const mine = customizedItem(belt, edits(), 'belt_mine');
  expect(itemEditsOf(mine).modes.map(m => m.name)).toEqual(['Worn', 'Twisted']);   // the form reads back what it wrote
  let e = wearing(sorcerer(), mine);
  const base = effectiveAbilityScores(sorcerer());
  expect(base).toMatchObject({ str: 12, dex: 12, con: 12, int: 11, wis: 12, cha: 17 });
  expect(effectiveAbilityScores(e)).toMatchObject({ str: 22, int: 4, wis: 4, dex: 12, con: 12, cha: 17 });   // the first mode until switched
  e = setFeatureMode(e, modeKey('belt_desc', 'inst-belt'), 'twisted');
  expect(effectiveAbilityScores(e)).toMatchObject({ str: 4, dex: 4, con: 4, int: 22, wis: 22, cha: 17 });
  e = setFeatureMode(e, modeKey('belt_desc', 'inst-belt'), 'worn');
  expect(effectiveAbilityScores(e).str).toBe(22);
});

it('a feature without modes is unchanged, and an unknown mode falls back to the first', () => {
  const f = { effects: [], modes: [{ id: 'a', name: 'A', effects: [] }, { id: 'b', name: 'B', effects: [] }] };
  expect(activeMode({ modes: undefined }, {}, 'x')).toBeNull();
  expect(activeMode(f, { featureModes: { x: 'gone' } }, 'x')?.id).toBe('a');
  expect(effectsInForce({ effects: [], modes: undefined }, {}, 'x')).toEqual([]);
});

it('a custom feature on the character can carry modes too', () => {
  const draft = { ...newDraftTrait('Battle Trance'), localId: 'trance' };
  let e = grantCustomFeature(sorcerer(), draft, DEFAULT_RULES, null, [
    { id: 'calm', name: 'Calm', abilities: {} },
    { id: 'fury', name: 'Fury', abilities: { str: { operation: 'add', value: 4 } } },
  ]);
  const feature = e.features.find(f => f.modes?.length)!;
  expect(feature.modes!.map(m => m.name)).toEqual(['Calm', 'Fury']);
  expect(effectiveAbilityScores(e).str).toBe(12);
  e = setFeatureMode(e, feature.id, 'fury');
  expect(effectiveAbilityScores(e).str).toBe(16);
});

it('a rename carries to what is named after the item (its feature, so the mode switch), and leaves other names alone', () => {
  const withMore: Item = { ...belt, features: [...belt.features, { ...belt.features[0], id: 'belt_other', name: 'Giant Grip' }],
    resources: [{ resourceId: 'belt_uses', name: 'Belt of Hill Giant Strength uses', maximum: 1, recharge: 'long_rest' }] } as unknown as Item;
  const mine = customizedItem(withMore, { ...itemEditsOf(withMore), modes: edits().modes, name: 'Belt of the Twisted Giant' }, 'belt_mine');
  expect(mine.features.map(f => f.name)).toEqual(['Belt of the Twisted Giant', 'Giant Grip']);
  expect(mine.resources?.[0]?.name).toBe('Belt of the Twisted Giant uses');
  expect(customizedItem(withMore, edits(), 'belt_mine').features[0].name).toBe('Belt of Hill Giant Strength');   // no rename, no change
});

it('an item renamed before renames carried over gets its name onto its feature at the next save, even with the name unchanged', () => {
  const stale: Item = { ...belt, name: 'Belt of the Twisted Giant' };   // the item renamed, its feature still named the old way
  expect(stale.features[0].name).toBe('Belt of Hill Giant Strength');
  expect(customizedItem(stale, itemEditsOf(stale), 'belt_mine').features[0].name).toBe('Belt of the Twisted Giant');
});

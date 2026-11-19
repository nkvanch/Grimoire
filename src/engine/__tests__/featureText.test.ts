// Tapping a card or a resource shows its rules text, found on the feature, item or spell behind it.
import { buildSrd51Pack } from '../../content/packs/srdPacks';
import { packContentProvider, InstalledPack } from '../../content/provider/contentProvider';
import { createCharacter } from '../../content/provider/createCharacter';
import { DEFAULT_RULES } from '../defaults';
import { recomputeDerived } from '../pipeline';
import { cardDescription, resourceDescription } from '../featureText';
import type { Entity, Item, RulesetId } from '../types';

const provider = packContentProvider([JSON.parse(JSON.stringify(buildSrd51Pack())) as InstalledPack], 'dnd5e-2014' as RulesetId);
const sword: Item = {
  id: 't_sword', name: 'Test Sword', weight: 3, cost: '15 gp', properties: ['versatile (1d10)'],
  features: [{ id: 't_sword_attack', name: 'Test Sword', description: 'A plain blade.', source: { kind: 'item', refId: 't_sword' }, level: null,
    effects: [], actions: [], choices: [], passive: false, abilityEffects: [{ type: 'damage', dice: '1d8', damageType: 'slashing' }] }],
} as unknown as Item;
const fighter = (): Entity => {
  const e = createCharacter(provider, { id: 'f', name: 'F', classId: 'fighter', raceId: 'human', backgroundId: 'acolyte',
    stats: { str: 16, dex: 12, con: 14, int: 10, wis: 10, cha: 8 }, level: 7 }, DEFAULT_RULES);
  return recomputeDerived({ ...e, inventory: { ...e.inventory, carried: [], equipped: [{ id: 'inst-sword', itemId: 't_sword', quantity: 1, attuned: false, features: [] }] } },
    DEFAULT_RULES, { items: [sword] });
};

it('a class feature card, an item weapon card', () => {
  const f = fighter();
  const surge = f.actionCards!.find(c => c.featureId === 'action_surge')!;
  expect(cardDescription(f, surge)).toMatch(/additional action/i);
  const second = f.actionCards!.find(c => /second wind/i.test(c.name))!;
  expect(cardDescription(f, second)).toBeTruthy();
  const blade = f.actionCards!.find(c => c.featureId === 'inst-sword_basic_weapon_attack')!;
  expect(cardDescription(f, blade, [sword])).toBe('A plain blade.');
});

it("a resource named unlike its feature (Action Surge's pool) is explained by the feature that spends it", () => {
  const f = fighter();
  const pool = f.resources.custom.find(r => r.id === 'action_surge_pool')!;
  expect(resourceDescription(f, pool).map(x => x.name)).toEqual(['Action Surge']);
  expect(resourceDescription(f, { id: 'nothing', name: 'Nothing' })).toEqual([]);
});

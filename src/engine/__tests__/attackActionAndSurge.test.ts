// A 7th-level Fighter taps a weapon card on its own, as on the Actions or Favorites tab: with Extra Attack that is one attack of
// the Attack action, so the second tap is the second attack, not a blocked second Action. Action Surge gives one more action.
import { buildSrd51Pack } from '../../content/packs/srdPacks';
import { packContentProvider, InstalledPack } from '../../content/provider/contentProvider';
import { createCharacter } from '../../content/provider/createCharacter';
import { DEFAULT_RULES } from '../defaults';
import { recomputeDerived } from '../pipeline';
import { startTurn } from '../combat';
import { applyActionCardUse } from '../actionUse';
import type { ActionCard, Entity, Item, RulesetId } from '../types';

const provider = packContentProvider([JSON.parse(JSON.stringify(buildSrd51Pack())) as InstalledPack], 'dnd5e-2014' as RulesetId);
const sword: Item = {
  id: 't_sword', name: 'Test Sword', weight: 3, cost: '15 gp', properties: ['versatile (1d10)'],
  features: [{ id: 't_sword_attack', name: 'Test Sword', description: '', source: { kind: 'item', refId: 't_sword' }, level: null, effects: [], actions: [],
    choices: [], passive: false, abilityEffects: [{ type: 'damage', dice: '1d8', damageType: 'slashing' }] }],
} as unknown as Item;
const content = { items: [sword] };
const r = (e: Entity) => recomputeDerived(e, DEFAULT_RULES, content);

function fighter(): Entity {
  const e = createCharacter(provider, { id: 'f', name: 'F', classId: 'fighter', raceId: 'human', backgroundId: 'acolyte',
    stats: { str: 16, dex: 12, con: 14, int: 10, wis: 10, cha: 8 }, level: 7 }, DEFAULT_RULES);
  const armed = { ...e, inventory: { ...e.inventory, carried: [], equipped: [{ id: 'inst-sword', itemId: 't_sword', quantity: 1, attuned: false, features: [] } as never] } };
  return r(startTurn(r(armed)));
}
const card = (e: Entity, id: string): ActionCard => e.actionCards!.find(c => c.featureId === id)!;
const SWORD = 'inst-sword_basic_weapon_attack';
const use = (e: Entity, id: string) => applyActionCardUse(e, card(e, id), DEFAULT_RULES, undefined, undefined, undefined, undefined, content);

it('a 7th-level Fighter has two attacks in the Attack action and Action Surge', () => {
  const f = fighter();
  expect(f.derived.attackActionAttacks).toBe(2);
  expect(card(f, SWORD)).toBeDefined();
  expect(card(f, 'action_surge')).toBeDefined();
});

it('tapping the weapon twice is the two attacks of one Attack action; a third is refused', () => {
  const one = use(fighter(), SWORD);
  expect(one.turnState?.actionUsed).toBe(true);
  expect(card(one, SWORD).available).toBe(true);              // the second attack is still there, not an Overrule
  const two = use(one, SWORD);
  expect(two).not.toBe(one);
  expect(card(two, SWORD).available).toBe(false);             // the Attack action is over
  expect(use(two, SWORD)).toBe(two);
});

it('Action Surge gives one more action: another two attacks, then no more', () => {
  const spent = use(use(fighter(), SWORD), SWORD);
  const surged = use(spent, 'action_surge');
  expect(surged.turnState?.extraActions).toBe(1);
  expect(card(surged, SWORD).available).toBe(true);
  const three = use(surged, SWORD);
  const four = use(three, SWORD);
  expect(four).not.toBe(three);
  expect(four.turnState?.extraActions).toBe(0);
  expect(card(four, SWORD).available).toBe(false);
  expect(use(four, SWORD)).toBe(four);
});

it('Action Surge before acting still leaves room for two Attack actions', () => {
  const surged = use(fighter(), 'action_surge');
  const a = use(use(surged, SWORD), SWORD);
  const b = use(use(a, SWORD), SWORD);
  expect(b).not.toBe(a);
  expect(card(b, SWORD).available).toBe(false);
});

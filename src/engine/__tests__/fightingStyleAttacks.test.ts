// Archery (+2 to hit with ranged weapons) and Dueling (+2 damage with a one-handed melee weapon and no other weapon) are applied to
// the weapon attacks the sheet shows, whichever rules, feat or subclass gave them (pipeline.ts hasFightingStyle).
import { buildSrd51Pack } from '../../content/packs/srdPacks';
import { packContentProvider, InstalledPack } from '../../content/provider/contentProvider';
import { createCharacter } from '../../content/provider/createCharacter';
import { DEFAULT_RULES } from '../defaults';
import { recomputeDerived } from '../pipeline';
import type { Entity, FeatureInstance, Item, RulesetId } from '../types';

const provider = packContentProvider([JSON.parse(JSON.stringify(buildSrd51Pack())) as InstalledPack], 'dnd5e-2014' as RulesetId);
const weapon = (id: string, properties: string[]): Item => ({
  id, name: id, weight: 1, cost: '1 gp', properties,
  features: [{ id: `${id}_attack`, name: id, description: '', source: { kind: 'item', refId: id }, level: null, effects: [], actions: [], choices: [],
    passive: false, abilityEffects: [{ type: 'damage', dice: '1d8', damageType: 'slashing' }] }],
} as unknown as Item);
const items = [weapon('t_bow', ['ammunition (range 150/600)', 'two-handed']), weapon('t_sword', ['versatile (1d10)']),
  weapon('t_greatsword', ['heavy', 'two-handed']), weapon('t_dagger', ['finesse', 'light'])];
const style = (name: string, kind: 'class' | 'feat' | 'subclass' = 'class'): FeatureInstance => ({
  id: `fs_${name}`, name, description: '', source: { kind, refId: 'x' }, level: 1, effects: [], actions: [], choices: [], passive: true, isActive: true,
} as unknown as FeatureInstance);
const fighter = (features: FeatureInstance[], wielding: string[]): Entity => {
  const e = createCharacter(provider, { id: 'f', name: 'F', classId: 'fighter', raceId: 'human', backgroundId: 'acolyte',
    stats: { str: 16, dex: 14, con: 14, int: 10, wis: 10, cha: 8 }, level: 1 }, DEFAULT_RULES);
  return { ...e, features: [...e.features, ...features],
    inventory: { ...e.inventory, carried: [], equipped: wielding.map(id => ({ id: `inst-${id}`, itemId: id, quantity: 1, attuned: false, features: [] } as never)) } };
};
const attack = (e: Entity, id: string) => recomputeDerived(e, DEFAULT_RULES, { items }).derived.attackBonuses.find(a => a.id === id)!;

it('Archery adds 2 to hit with a ranged weapon only, from a class feature or a 2024 feat', () => {
  expect(attack(fighter([style('Fighting Style: Archery')], ['t_bow']), 't_bow').bonus).toBe(attack(fighter([], ['t_bow']), 't_bow').bonus + 2);
  expect(attack(fighter([style('Archery', 'feat')], ['t_bow']), 't_bow').bonus).toBe(attack(fighter([], ['t_bow']), 't_bow').bonus + 2);
  expect(attack(fighter([style('Archery')], ['t_sword']), 't_sword').bonus).toBe(attack(fighter([], ['t_sword']), 't_sword').bonus);
});

it('Dueling adds 2 damage to a lone one-handed melee weapon, not a two-handed one or with a second weapon', () => {
  const duel = [style('Dueling', 'subclass')];
  expect(attack(fighter(duel, ['t_sword']), 't_sword').damageBonus).toBe(attack(fighter([], ['t_sword']), 't_sword').damageBonus + 2);
  expect(attack(fighter(duel, ['t_greatsword']), 't_greatsword').damageBonus).toBe(attack(fighter([], ['t_greatsword']), 't_greatsword').damageBonus);
  expect(attack(fighter(duel, ['t_sword', 't_dagger']), 't_sword').damageBonus).toBe(attack(fighter([], ['t_sword', 't_dagger']), 't_sword').damageBonus);
  expect(attack(fighter(duel, ['t_sword']), 't_sword').bonus).toBe(attack(fighter([], ['t_sword']), 't_sword').bonus);   // damage only
});

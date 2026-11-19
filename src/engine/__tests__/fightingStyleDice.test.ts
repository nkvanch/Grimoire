// Great Weapon Fighting (reroll a 1 or 2 once in 2014, count it as a 3 in 2024) and two-weapon fighting (an off-hand Bonus Action
// attack with two light weapons, adding the ability modifier to its damage only with the Two-Weapon Fighting style), from the
// weapon attack to the card and the roll. Both were text only (found 2026-11-14).
import { buildSrd51Pack } from '../../content/packs/srdPacks';
import { packContentProvider, InstalledPack } from '../../content/provider/contentProvider';
import { createCharacter } from '../../content/provider/createCharacter';
import { DEFAULT_RULES } from '../defaults';
import { recomputeDerived } from '../pipeline';
import { generateAllActionCards } from '../actionCards';
import { rollExpression, setRandomSource, doubleDiceCount, withDamageDieRule, readableExpression } from '../dice';
import type { Entity, FeatureInstance, Item, RulesetId } from '../types';

const provider = packContentProvider([JSON.parse(JSON.stringify(buildSrd51Pack())) as InstalledPack], 'dnd5e-2014' as RulesetId);
const weapon = (id: string, properties: string[], dice = '1d8'): Item => ({
  id, name: id, weight: 1, cost: '1 gp', properties,
  features: [{ id: `${id}_attack`, name: id, description: '', source: { kind: 'item', refId: id }, level: null, effects: [], actions: [], choices: [],
    passive: false, abilityEffects: [{ type: 'damage', dice, damageType: 'slashing' }] }],
} as unknown as Item);
const items = [weapon('t_greatsword', ['heavy', 'two-handed'], '2d6'), weapon('t_sword', ['versatile (1d10)']),
  weapon('t_dagger', ['finesse', 'light', 'thrown (range 20/60)'], '1d4'), weapon('t_shortsword', ['finesse', 'light'], '1d6'),
  { id: 't_shield', name: 't_shield', weight: 6, cost: '10 gp', properties: ['shield'], features: [] } as unknown as Item];
const style = (name: string): FeatureInstance => ({
  id: `fs_${name}`, name, description: '', source: { kind: 'class', refId: 'x' }, level: 1, effects: [], actions: [], choices: [], passive: true, isActive: true,
} as unknown as FeatureInstance);
/** STR 16 (+3), DEX 14 (+2, 15 with the human's +1: still +2). */
const fighter = (features: FeatureInstance[], wielding: string[], rulesetId: RulesetId = 'dnd5e-2014' as RulesetId): Entity => {
  const e = createCharacter(provider, { id: 'f', name: 'F', classId: 'fighter', raceId: 'human', backgroundId: 'acolyte',
    stats: { str: 16, dex: 14, con: 14, int: 10, wis: 10, cha: 8 }, level: 1 }, DEFAULT_RULES);
  return recomputeDerived({ ...e, rulesetId, features: [...e.features, ...features],
    inventory: { ...e.inventory, carried: [], equipped: wielding.map(id => ({ id: `inst-${id}`, itemId: id, quantity: 1, attuned: false, features: [] } as never)) } },
  DEFAULT_RULES, { items });
};
const attack = (e: Entity, id: string) => e.derived.attackBonuses.find(a => a.id === id)!;
const cards = (e: Entity) => generateAllActionCards(e, DEFAULT_RULES, { items });

afterEach(() => setRandomSource(Math.random));

it('the dice roller rerolls a 1 or 2 once, or counts it as 3, and a critical hit keeps the rule', () => {
  const seq = [0, 0.99, 0.5];   // d6 rolls 1, then 6, then 4
  let i = 0;
  setRandomSource(() => seq[i++ % seq.length]);
  expect(rollExpression('2d6ro<2+3').rolls).toEqual([6, 4]);   // the 1 is rolled again once (6); the 4 stands
  setRandomSource(() => 0);   // every die a 1
  expect(rollExpression('2d6mi3').total).toBe(6);
  expect(doubleDiceCount('2d6ro<2+3')).toBe('4d6ro<2+3');
  expect(withDamageDieRule('2d6+3', 'min_3')).toBe('2d6mi3+3');
  expect(withDamageDieRule('2d6+3', undefined)).toBe('2d6+3');
  expect(readableExpression('4d6ro<2+3')).toBe('4d6+3 (1s and 2s rolled again once)');   // as the roll result shows it
  expect(readableExpression('2d6mi3')).toBe('2d6 (1s and 2s count as 3)');
  expect(readableExpression('1d20+5')).toBe('1d20+5');
});

it('Great Weapon Fighting: a two-handed weapon, or a versatile one with nothing else in hand; the edition picks the rule', () => {
  const gwf = [style('Fighting Style: Great Weapon Fighting')];
  expect(attack(fighter(gwf, ['t_greatsword']), 't_greatsword').damageDieRule).toBe('reroll_1_2');
  expect(attack(fighter(gwf, ['t_greatsword'], 'dnd5e-2024' as RulesetId), 't_greatsword').damageDieRule).toBe('min_3');
  expect(attack(fighter(gwf, ['t_sword']), 't_sword').damageDieRule).toBe('reroll_1_2');
  expect(attack(fighter(gwf, ['t_sword', 't_shield']), 't_sword').damageDieRule).toBeUndefined();   // the shield takes the other hand
  expect(attack(fighter([], ['t_greatsword']), 't_greatsword').damageDieRule).toBeUndefined();
  const card = cards(fighter(gwf, ['t_greatsword'])).find(c => c.name === 't_greatsword')!;
  expect(card.damageDieRule).toBe('reroll_1_2');
  expect(card.layer3).toMatch(/Great Weapon Fighting/);
});

it('two light weapons give an off-hand Bonus Action attack, with the ability modifier only under Two-Weapon Fighting', () => {
  const plain = fighter([], ['t_dagger', 't_shortsword']);
  expect(attack(plain, 't_dagger').damageBonus).toBe(3);   // finesse: the better of STR +3 and DEX +2
  expect(attack(plain, 't_dagger').offHandDamageBonus).toBe(0);
  expect(attack(fighter([style('Two-Weapon Fighting')], ['t_dagger', 't_shortsword']), 't_dagger').offHandDamageBonus).toBe(3);
  expect(attack(fighter([], ['t_dagger']), 't_dagger').offHandDamageBonus).toBeUndefined();   // one light weapon: no off-hand attack
  const offHand = cards(plain).filter(c => c.name.endsWith('(off-hand)'));
  expect(offHand.map(c => c.name).sort()).toEqual(['t_dagger (off-hand)', 't_shortsword (off-hand)']);
  expect(offHand[0].activation?.actionType).toBe('bonus_action');
  expect(offHand[0].isWeaponAttack).toBeFalsy();
  expect(offHand.find(c => c.name === 't_dagger (off-hand)')!.layer2).toMatch(/1d4 Slashing/);
});

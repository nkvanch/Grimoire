// Temp HP and damage-log healing as card effects, and an ability that also uses the bonus action.
import { makeEmptyEntity, DEFAULT_RULES } from '../../store/characterStore';
import { recomputeDerived } from '../pipeline';
import { applyDamage, startTurn, toggleActionEconomy } from '../combat';
import { generateActionCard, buildLayer2, resolveProficiencyDice } from '../actionCards';
import { applyActionCardUse } from '../actionUse';
import type { Entity, Feature } from '../types';

const feature = (over: Partial<Feature>): Feature => ({
  id: 'f', name: 'F', description: 'text', source: { kind: 'class', refId: 'x' }, level: null,
  effects: [], actions: [], choices: [], passive: false, ...over,
});
const withFeature = (f: Feature, level = 5): Entity => {
  const e = makeEmptyEntity('t');
  const hp = { ...e.resources.hp, current: 30, maximum: 40, temp: 0 };
  return recomputeDerived({ ...e, identity: { ...e.identity, level }, features: [{ ...f, isActive: false }], resources: { ...e.resources, hp } }, DEFAULT_RULES);
};

describe('temp_hp', () => {
  const f = feature({
    id: 'aid', name: 'Aid', activation: { actionType: 'bonus_action', resourceCost: null, range: '30 feet', target: 'single', requiresSave: null },
    abilityEffects: [{ type: 'temp_hp', dice: 'PBd6' }],
  });
  it('resolves PB into real dice on the card', () => {
    const e = withFeature(f, 5);                 // proficiency bonus +3 at level 5
    expect(e.derived.proficiencyBonus).toBe(3);
    expect(buildLayer2(f, e)).toContain('Temp HP 3d6');
    expect(resolveProficiencyDice('PB', e)).toBe('3');
    expect(resolveProficiencyDice('2d6', e)).toBe('2d6');
  });
});

describe('heal_from_damage_taken', () => {
  const f = feature({
    id: 'reform', name: 'Reformation', activation: { actionType: 'bonus_action', resourceCost: null, range: 'self', target: 'self', requiresSave: null },
    abilityEffects: [{ type: 'heal_from_damage_taken', fraction: 0.5, turnsBack: 1 }],
  });
  it('shows the number and applies it on use', () => {
    let e = withFeature(f);
    e = applyDamage(e, 12, DEFAULT_RULES);       // 30 -> 18
    e = startTurn(e);
    e = applyDamage(e, 8, DEFAULT_RULES);        // 18 -> 10
    expect(e.resources.hp.current).toBe(10);
    expect(buildLayer2(f, e)).toContain('Heal 10');            // half of the 20 taken since the previous turn
    const card = generateActionCard(e.features[0], e)!;
    const after = applyActionCardUse(e, card, DEFAULT_RULES);
    expect(after.resources.hp.current).toBe(20);
  });
});

describe('alsoCosts', () => {
  const f = feature({
    id: 'ball', name: 'Ball', activation: { actionType: 'action', resourceCost: null, range: '30 feet', target: 'area', requiresSave: null, alsoCosts: 'bonus_action' },
    abilityEffects: [],
  });
  const card = (e: Entity) => generateActionCard(e.features[0], e)!;
  it('is available only while both slots are free, and spends both', () => {
    let e = startTurn(withFeature(f));
    expect(card(e).available).toBe(true);
    expect(buildLayer2(f, e)).toContain('Also uses your bonus action');
    e = toggleActionEconomy(e, 'bonus_action');
    const c = card(e);
    expect(c.available).toBe(false);
    expect(c.unavailableReason).toMatch(/bonus action/);
    e = toggleActionEconomy(e, 'bonus_action');     // free again
    const used = applyActionCardUse(e, card(e), DEFAULT_RULES);
    expect(used.turnState).toMatchObject({ actionUsed: true, bonusActionUsed: true });
  });
});

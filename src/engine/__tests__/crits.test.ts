// Critical hits: a creature whose crits against it are negated, and an extended crit range shown on attack cards.
import { makeEmptyEntity, DEFAULT_RULES } from '../../store/characterStore';
import { recomputeDerived } from '../pipeline';
import { generateActionCard } from '../actionCards';
import type { Entity, Feature, Effect } from '../types';

const feat = (id: string, effects: Effect[]) => ({
  id, name: id, description: '', source: { kind: 'class', refId: 'x' }, level: null, effects, actions: [], choices: [], passive: true, isActive: true,
}) as Feature & { isActive: boolean };
const withFeatures = (fs: (Feature & { isActive: boolean })[]): Entity =>
  recomputeDerived({ ...makeEmptyEntity('t'), features: fs as never }, DEFAULT_RULES);

describe('crits', () => {
  it('defaults to a 20 and crits that count', () => {
    const e = withFeatures([]);
    expect(e.derived.critRange).toBe(20);
    expect(e.derived.critsNegated).toBe(false);
  });
  it('an extended range takes the lowest value any effect sets', () => {
    const e = withFeatures([feat('champ', [{ type: 'stat_modifier', target: 'crit_range', operation: 'set', value: 19, condition: null }]),
                            feat('more', [{ type: 'stat_modifier', target: 'crit_range', operation: 'set', value: 18, condition: null }])]);
    expect(e.derived.critRange).toBe(18);
  });
  it('immunity to critical hits is a derived flag', () => {
    const e = withFeatures([feat('gooey', [{ type: 'grant_immunity', target: 'critical_hits_against', operation: 'immunity', value: null, condition: null }])]);
    expect(e.derived.critsNegated).toBe(true);
  });
  it('an attack card states the crit range', () => {
    const attack: Feature = {
      id: 'sword_attack', name: 'Longsword', description: '', source: { kind: 'item', refId: 'longsword' }, level: null,
      effects: [], actions: [], choices: [], passive: false,
      activation: { actionType: 'action', resourceCost: null, range: '5 feet', target: 'single', requiresSave: null },
      abilityEffects: [{ type: 'damage', dice: '1d8', damageType: 'slashing' }],
    };
    const normal = withFeatures([]);
    expect(generateActionCard(attack, normal)!.outcomes.join(' ')).toMatch(/\(20\)/);
    const champ = withFeatures([feat('champ', [{ type: 'stat_modifier', target: 'crit_range', operation: 'set', value: 19, condition: null }])]);
    expect(generateActionCard(attack, champ)!.outcomes.join(' ')).toMatch(/19.20/);
  });
  it('a non-attack ability gets no crit line', () => {
    const heal: Feature = {
      id: 'h', name: 'H', description: '', source: { kind: 'class', refId: 'x' }, level: null, effects: [], actions: [], choices: [], passive: false,
      activation: { actionType: 'action', resourceCost: null, range: 'self', target: 'self', requiresSave: null },
      abilityEffects: [{ type: 'heal', dice: '1d8' }],
    };
    expect(generateActionCard(heal, withFeatures([]))!.outcomes).toEqual([]);
  });
});

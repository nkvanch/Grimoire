import { automationOf } from '../automation';
import type { Feature } from '../types';

const f = (over: Partial<Feature>): Feature => ({
  id: 'x', name: 'X', description: '', source: { kind: 'class', refId: 'c' }, level: 1, effects: [], actions: [], choices: [], passive: true, ...over,
});

describe('automationOf', () => {
  it('text only is left to the player (Evasion, Reliable Talent)', () => {
    expect(automationOf(f({}))).toBe('manual');
  });
  it('a use counter or a card without effects is tracked', () => {
    expect(automationOf(f({ resources: [{ id: 'r', name: 'R', max: 1, recharge: 'long_rest' } as never] }))).toBe('tracked');
    expect(automationOf(f({ activation: { actionType: 'action', resourceCost: null, range: 'self', target: 'self', requiresSave: null } }))).toBe('tracked');
  });
  it('effects, rolled effects, auras, riders and choices are automated', () => {
    expect(automationOf(f({ effects: [{ type: 'stat_modifier', target: 'ac', operation: 'add', value: 1, condition: null }] }))).toBe('automated');
    expect(automationOf(f({ abilityEffects: [{ type: 'damage', dice: '1d6', damageType: 'fire' }] }))).toBe('automated');
    expect(automationOf(f({ aura: { affects: 'allies', effects: [] } }))).toBe('automated');
    expect(automationOf(f({ choices: [{ id: 'c', prompt: 'p', kind: 'skill', count: 1, pool: 'all', grants: [], required: true, resolved: false }] }))).toBe('automated');
  });
});

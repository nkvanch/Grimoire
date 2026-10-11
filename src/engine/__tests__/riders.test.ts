// Riders: bonus effects that attach to weapon attacks and spells, with a limit, a cost and a gating flag.
import { makeEmptyEntity, DEFAULT_RULES } from '../../store/characterStore';
import { recomputeDerived } from '../pipeline';
import { startTurn } from '../combat';
import { ridersForCard, applyRider } from '../riders';
import { suspendFeature } from '../suspension';
import type { Entity, Feature, Rider, ActionCard } from '../types';

const ride = (riders: Rider[], id = 'bonus'): Feature & { isActive: boolean } => ({
  id, name: id, description: '', source: { kind: 'class', refId: 'x' }, level: null, effects: [], actions: [], choices: [], passive: true, isActive: true, riders,
}) as never;
const withRiders = (riders: Rider[], flags: Record<string, boolean> = {}): Entity => {
  const e = makeEmptyEntity('t');
  return recomputeDerived({
    ...e, features: [ride(riders)] as never,
    conditionMonitor: { ...e.conditionMonitor, flags },
    resources: { ...e.resources, custom: [{ id: 'pool', name: 'Pool', current: 2, maximum: 2, recharge: 'long_rest' } as never] },
  }, DEFAULT_RULES);
};
const unarmed = (e: Entity): ActionCard => e.actionCards!.find(c => c.isWeaponAttack)!;

describe('riders', () => {
  it('a weapon rider is offered on a weapon attack card', () => {
    const e = withRiders([{ id: 'burn', name: 'Burn', on: 'weapon_attack', damage: { dice: '1d6', damageType: 'fire' } }]);
    const offers = ridersForCard(e, unarmed(e));
    expect(offers).toHaveLength(1);
    expect(offers[0]).toMatchObject({ name: 'Burn', available: true, damage: { dice: '1d6', damageType: 'fire' } });
  });
  it('a cantrip-only rider is not offered on a weapon attack', () => {
    const e = withRiders([{ id: 'zap', name: 'Zap', on: 'cantrip' }]);
    expect(ridersForCard(e, unarmed(e))).toEqual([]);
  });
  it('once per turn: used once, offered again after the next turn begins', () => {
    let e = withRiders([{ id: 'burn', name: 'Burn', on: 'weapon_attack', limit: 'once_per_turn', damage: { dice: '1d8', damageType: 'psychic' } }]);
    e = applyRider(e, 'bonus', 'burn');
    expect(ridersForCard(e, unarmed(e))[0].available).toBe(false);
    e = recomputeDerived(startTurn(e), DEFAULT_RULES);
    expect(ridersForCard(e, unarmed(e))[0].available).toBe(true);
  });
  it('spends its cost, and cannot be used with none left', () => {
    let e = withRiders([{ id: 'burn', name: 'Burn', on: 'weapon_attack', cost: { resourceId: 'pool', quantity: 1 } }]);
    e = applyRider(e, 'bonus', 'burn');
    e = applyRider(e, 'bonus', 'burn');
    expect(e.resources.custom[0].current).toBe(0);
    expect(ridersForCard(e, unarmed(e))[0]).toMatchObject({ available: false, reason: 'No uses left.' });
    expect(applyRider(e, 'bonus', 'burn')).toBe(e);
  });
  it('needs its flag and clears it when used', () => {
    let e = withRiders([{ id: 'sap', name: 'Sap', on: 'weapon_attack', requires: 'empowered', clears: 'empowered' }]);
    expect(ridersForCard(e, unarmed(e))[0].available).toBe(false);
    e = withRiders([{ id: 'sap', name: 'Sap', on: 'weapon_attack', requires: 'empowered', clears: 'empowered' }], { empowered: true });
    expect(ridersForCard(e, unarmed(e))[0].available).toBe(true);
    e = applyRider(e, 'bonus', 'sap');
    expect(e.conditionMonitor.flags.empowered).toBe(false);
  });
  it('a suspended feature offers no riders', () => {
    let e = withRiders([{ id: 'burn', name: 'Burn', on: 'weapon_attack' }]);
    e = recomputeDerived(suspendFeature(e, 'bonus', 'end_of_next_turn'), DEFAULT_RULES);
    expect(ridersForCard(e, unarmed(e))).toEqual([]);
  });
});

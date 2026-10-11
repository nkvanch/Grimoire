// Recharges the app has no event for are reset by hand, explicitly (the creator audit's custom-recharge finding).
import { rechargeKind, isResetByHand, rechargeLabel } from '../recharge';
import { makeEmptyEntity, DEFAULT_RULES } from '../../store/characterStore';
import { takeRest, takeDawn } from '../rest';
import { startTurn } from '../combat';

describe('recharge kinds', () => {
  it.each([
    ['short_rest', 'short_rest'], ['long_rest', 'long_rest'], ['start_of_turn', 'start_of_turn'], ['never', 'never'],
    ['dawn', 'dawn'], ['dawn:1d3', 'dawn'], ['Recharge 5-6', 'roll'], ['recharge 6', 'roll'],
    ['after a turn without moving', 'by_hand'], ['12 days', 'by_hand'], ['weekly', 'by_hand'], ['monthly', 'by_hand'], ['yearly', 'by_hand'],
    ['after an hour in a thunderstorm', 'by_hand'],
  ])('%s is %s', (text, kind) => expect(rechargeKind(text)).toBe(kind));

  it('labels a by-hand pool with what to wait for', () => {
    expect(rechargeLabel('after a turn without moving')).toBe('after a turn without moving, reset by hand');
    expect(rechargeLabel('monthly')).toBe('monthly, reset by hand');
    expect(rechargeLabel('long_rest')).toBe('long rest');
    expect(isResetByHand('weekly')).toBe(true);
    expect(isResetByHand('short_rest')).toBe(false);
  });

  it('no rest, dawn or turn refills a by-hand pool', () => {
    const base = makeEmptyEntity('r');
    const e = { ...base, resources: { ...base.resources, custom: [{ id: 'burst', name: 'Burst', current: 0, maximum: 1, recharge: 'after a turn without moving' }] } };
    expect(takeRest(e, 'short', DEFAULT_RULES).resources.custom[0].current).toBe(0);
    expect(takeRest(e, 'long', DEFAULT_RULES).resources.custom[0].current).toBe(0);
    expect(takeDawn(e, DEFAULT_RULES).resources.custom[0].current).toBe(0);
    expect(startTurn(e, DEFAULT_RULES).resources.custom[0].current).toBe(0);
  });
});

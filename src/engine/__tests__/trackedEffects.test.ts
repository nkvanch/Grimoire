// Per-target state: marks and accepted challenges the owner placed, damage recorded on a marked target, and due-not-removed.
import { makeEmptyEntity, DEFAULT_RULES } from '../../store/characterStore';
import { recomputeDerived } from '../pipeline';
import { startTurn, applyAbilityEffects } from '../combat';
import {
  addTrackedEffect, endTrackedEffect, setTrackedTarget, trackedEffectStatus, recordDamageOnTarget, recordDamageAcross, recordedFraction,
  effectsOnTarget,
} from '../trackedEffects';
import type { Entity } from '../types';

const rogue = (): Entity => recomputeDerived(makeEmptyEntity('rogue'), DEFAULT_RULES);

describe('tracked effects', () => {
  it('adds an effect with a target and shows it on that target', () => {
    const e = addTrackedEffect(rogue(), { name: 'Marked', targetName: 'Goblin Boss', records: true });
    expect(e.trackedEffects).toHaveLength(1);
    expect(effectsOnTarget([e], { name: 'goblin boss' })).toHaveLength(1);
    expect(effectsOnTarget([e], { name: 'Ogre' })).toHaveLength(0);
  });
  it('records the damage a marked target takes, only for that target', () => {
    let e = addTrackedEffect(rogue(), { name: 'Marked', targetName: 'Goblin Boss', records: true });
    e = recordDamageOnTarget(e, { name: 'Goblin Boss' }, 9);
    e = recordDamageOnTarget(e, { name: 'Ogre' }, 50);
    e = recordDamageOnTarget(e, { name: 'Goblin Boss' }, 4);
    expect(e.trackedEffects![0].recordedDamage).toBe(13);
    expect(recordedFraction(e.trackedEffects![0], 0.5)).toBe(6);
  });
  it('an effect that does not record ignores damage', () => {
    const e = recordDamageOnTarget(addTrackedEffect(rogue(), { name: 'Challenge', targetName: 'Ogre' }), { name: 'Ogre' }, 10);
    expect(e.trackedEffects![0].recordedDamage).toBeUndefined();
  });
  it('a DM can record one hit across the whole party', () => {
    const a = addTrackedEffect(rogue(), { name: 'Marked', targetName: 'Ogre', records: true });
    const b = addTrackedEffect(rogue(), { name: 'Marked', targetName: 'Ogre', records: true });
    const [a2, b2] = recordDamageAcross([a, b], { name: 'Ogre' }, 7);
    expect(a2.trackedEffects![0].recordedDamage).toBe(7);
    expect(b2.trackedEffects![0].recordedDamage).toBe(7);
  });
  it('becomes due on the turn mark but is never removed by the app', () => {
    let e = addTrackedEffect(startTurn(rogue()), { name: 'Marked', targetName: 'Ogre', until: 'end_of_next_turn' });
    expect(trackedEffectStatus(e, e.trackedEffects![0])).toBe('active');
    e = startTurn(e);
    expect(trackedEffectStatus(e, e.trackedEffects![0])).toBe('active');   // the next turn is under way
    e = startTurn(e);
    expect(trackedEffectStatus(e, e.trackedEffects![0])).toBe('due');
    expect(e.trackedEffects).toHaveLength(1);
    expect(endTrackedEffect(e, e.trackedEffects![0].id).trackedEffects).toHaveLength(0);
  });
  it('a card effect creates one without a target, to be named afterwards', () => {
    let e = applyAbilityEffects(rogue(), [{ type: 'track_effect', name: 'Marked', records: true, until: 'end_of_next_turn' }], DEFAULT_RULES);
    expect(e.trackedEffects![0]).toMatchObject({ name: 'Marked', targetName: '', records: true });
    e = setTrackedTarget(e, e.trackedEffects![0].id, 'Goblin Boss');
    expect(e.trackedEffects![0].targetName).toBe('Goblin Boss');
  });
});

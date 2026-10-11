// A tracked effect can close its damage recording before it is due (the creator audit's single-deadline finding).
import { makeEmptyEntity, DEFAULT_RULES } from '../../store/characterStore';
import { addTrackedEffect, setTrackedTarget, recordDamageOnTarget, trackedEffectStatus, isRecording, recordedFraction } from '../trackedEffects';
import { startTurn } from '../combat';
import type { Entity } from '../types';

const marked = (spec: Parameters<typeof addTrackedEffect>[1]): Entity => {
  let e = startTurn(makeEmptyEntity('m'), DEFAULT_RULES);
  e = addTrackedEffect(e, spec);
  return setTrackedTarget(e, e.trackedEffects![0].id, 'Target', 'tgt');
};
const hit = (e: Entity, n: number) => recordDamageOnTarget(e, { id: 'tgt' }, n);

describe('tracked effect recording window', () => {
  it('without recordUntil it records until it ends, as before', () => {
    let e = marked({ name: 'Mark', records: true, until: 'end_of_next_turn' });
    e = hit(e, 12);
    e = startTurn(startTurn(e, DEFAULT_RULES), DEFAULT_RULES);
    expect(trackedEffectStatus(e, e.trackedEffects![0])).toBe('due');
    expect(isRecording(e, e.trackedEffects![0])).toBe(true);
    expect(hit(e, 7).trackedEffects![0].recordedDamage).toBe(19);
  });
  it('closes recording at its own turn and keeps the total until due', () => {
    let e = marked({ name: 'Death Mark', records: true, until: 'end_of_next_turn', recordUntil: 'end_of_this_turn' });
    e = hit(e, 12);
    expect(isRecording(e, e.trackedEffects![0])).toBe(true);
    e = startTurn(e, DEFAULT_RULES);                       // the owner's next turn begins: recording is closed
    expect(isRecording(e, e.trackedEffects![0])).toBe(false);
    expect(trackedEffectStatus(e, e.trackedEffects![0])).toBe('active');
    const after = hit(e, 7);
    expect(after).toBe(e);                                  // damage after the window is not added
    expect(recordedFraction(after.trackedEffects![0], 0.5)).toBe(6);
    const due = startTurn(e, DEFAULT_RULES);
    expect(trackedEffectStatus(due, due.trackedEffects![0])).toBe('due');
    expect(due.trackedEffects![0].recordedDamage).toBe(12);
  });
  it('an effect that does not record has no window', () => {
    const e = marked({ name: 'Mark', recordUntil: 'end_of_this_turn' });
    expect(e.trackedEffects![0].recordsUntilTurn).toBeUndefined();
  });
});

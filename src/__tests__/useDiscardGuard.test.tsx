// useEdited: loading a saved record is not an edit; a change after the form settled is; reopening starts again.
import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { useEdited, SETTLE_MS } from '../hooks/useDiscardGuard';

let seen: boolean[] = [];
function Form({ value, resetKey }: { value: string; resetKey?: string }) {
  seen.push(useEdited(() => ({ value }), resetKey));
  return null;
}
const last = () => seen[seen.length - 1];

beforeEach(() => { jest.useFakeTimers(); seen = []; });
afterEach(() => jest.useRealTimers());

it('a form filled in while it opens is not edited; a change after that is, and changing it back is not', () => {
  let r!: TestRenderer.ReactTestRenderer;
  act(() => { r = TestRenderer.create(<Form value="" />); });
  act(() => { r.update(<Form value="Saved name" />); });          // the screen fills itself in from the record
  act(() => { jest.advanceTimersByTime(SETTLE_MS); });
  act(() => { r.update(<Form value="Saved name" />); });
  expect(last()).toBe(false);
  act(() => { r.update(<Form value="Saved name!" />); });
  expect(last()).toBe(true);
  act(() => { r.update(<Form value="Saved name" />); });
  expect(last()).toBe(false);
});

it('a new resetKey (reopening, another record) starts again', () => {
  let r!: TestRenderer.ReactTestRenderer;
  act(() => { r = TestRenderer.create(<Form value="a" resetKey="1" />); });
  act(() => { jest.advanceTimersByTime(SETTLE_MS); });
  act(() => { r.update(<Form value="b" resetKey="1" />); });
  expect(last()).toBe(true);
  act(() => { r.update(<Form value="c" resetKey="2" />); });
  expect(last()).toBe(false);
  act(() => { jest.advanceTimersByTime(SETTLE_MS); });
  act(() => { r.update(<Form value="c" resetKey="2" />); });
  expect(last()).toBe(false);
});

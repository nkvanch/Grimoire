// DATA-007 on this side: a member this build does not know of, on a record an engine operation rewrites, is carried through it.
// (The desktop app's test of the same requirement is tests/test_unknown_fields.cpp; the two apps open each other's characters.)
import { makeEmptyEntity } from '../../store/characterStore';
import { takeRest } from '../rest';
import type { Entity } from '../types';

function withUnknown(): Entity {
  const e = makeEmptyEntity('unknown-fields') as unknown as Record<string, unknown> & { resources: Record<string, unknown> };
  e.resources = { ...e.resources, deathSaves: { successes: 1, failures: 2, stable: false, 'x-unknown': 'keep me' } };
  return e as unknown as Entity;
}

describe('unknown members survive engine operations', () => {
  it('a long rest resets the death saves and keeps what else the record carries', () => {
    const after = takeRest(withUnknown(), 'long');
    expect(after.resources.deathSaves).toEqual({ successes: 0, failures: 0, stable: false, 'x-unknown': 'keep me' });
  });
});

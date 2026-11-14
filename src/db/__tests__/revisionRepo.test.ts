// Durable revisions (contract LIFE-004): the table, on a real SQLite (Node's own), refuses to change or delete a kept revision, and the device's
// store writes a newly kept revision through and reads it back after a restart.
import { DatabaseSync } from 'node:sqlite';
import { CREATE_DEFINITION_REVISIONS_TABLE } from '../schema';
import { revisionKeyOf, getRevision } from '../../engine/pinning/revisionStore';

function realDb() {
  const db = new DatabaseSync(':memory:');
  db.exec(CREATE_DEFINITION_REVISIONS_TABLE);
  // the expo-sqlite methods the repo uses, over Node's SQLite
  return {
    db,
    api: {
      getAllAsync: async (sql: string, params: unknown[] = []) => db.prepare(sql).all(...(params as never[])),
      runAsync: async (sql: string, params: unknown[] = []) => db.prepare(sql).run(...(params as never[])),
    },
  };
}

describe('the definition_revisions table', () => {
  it('keeps a revision and refuses to change or delete it', () => {
    const { db } = realDb();
    const key = revisionKeyOf('{"id":"fighter"}');
    db.prepare('INSERT INTO definition_revisions (key, text) VALUES (?, ?)').run(key, '{"id":"fighter"}');
    expect(() => db.prepare('UPDATE definition_revisions SET text = ? WHERE key = ?').run('{"id":"other"}', key)).toThrow(/never changed/);
    expect(() => db.prepare('DELETE FROM definition_revisions WHERE key = ?').run(key)).toThrow(/never deleted/);
    expect(db.prepare('SELECT text FROM definition_revisions WHERE key = ?').get(key)).toEqual({ text: '{"id":"fighter"}' });
  });
});

describe('the device\'s revision store', () => {
  beforeEach(() => jest.resetModules());

  it('writes a newly kept revision through, and has it again after a restart', async () => {
    const { api } = realDb();
    jest.doMock('../db', () => ({ getDb: () => api }));
    const { DurableRevisionStore } = require('../revisionRepo') as typeof import('../revisionRepo');
    const first = await DurableRevisionStore.open();
    const key = first.put('{"id":"wizard"}');
    first.put('{"id":"wizard"}');                       // kept once
    await first.flush();
    const again = await DurableRevisionStore.open();    // a restart: a new store over the same table
    expect(getRevision(again, key)).toEqual({ status: 'found', text: '{"id":"wizard"}' });
    expect(again.size).toBe(1);
  });

  it('reports a write that could not be made, rather than losing it silently', async () => {
    jest.doMock('../db', () => ({ getDb: () => ({ getAllAsync: async () => [], runAsync: async () => { throw new Error('disk full'); } }) }));
    const { DurableRevisionStore } = require('../revisionRepo') as typeof import('../revisionRepo');
    const store = await DurableRevisionStore.open();
    store.put('{"id":"bard"}');
    await expect(store.flush()).rejects.toThrow('disk full');
  });
});

// The pinning kernel, ported from the desktop app (core/state/DependencyLock, RevisionStore; tests/test_revision_store.cpp, test_pinning_dnd5e.cpp).
import { lockFromJson, lockToJson, compareLock, checkOperations, operationRegistry, DependencyLock, ContentProbe, ContentState } from '../lock';
import { MemoryRevisionStore, getRevision, isRevisionKey, revisionKeyOf } from '../revisionStore';
import { DND5E_OPERATIONS } from '../../ruleset/dnd5eOperations';

const lockOf = (json: unknown): DependencyLock => {
  const r = lockFromJson(json);
  if ('error' in r) throw new Error(r.error);
  return r.lock;
};
const base = (): DependencyLock => lockOf({
  ruleset: { id: 'dnd5e-2014', revision: '1' }, content: { 'pack:grimoire.srd.5.1': '1.0.0' },
  definitions: { 'class:fighter': revisionKeyOf('{"id":"fighter"}') }, operations: { 'dnd5e.long_rest': 1 }, lockedAt: 1700000000,
});

describe('the lock in the character file', () => {
  it('reads and writes the desktop app\'s format, keeping members it does not know', () => {
    const json = {
      ruleset: { id: 'dnd5e-2014', revision: '1' }, content: { 'pack:b': '2.0.0', 'pack:a': '1.0.0' },
      definitions: { 'spell:fireball': 'sha256:' + 'a'.repeat(64) }, operations: { 'dnd5e.level_up': 3, 'dnd5e.apply_damage': 1 },
      lockedAt: 1700000000, 'x-future': { kept: true },
    };
    const out = lockToJson(lockOf(json));
    expect(Object.keys(out)).toEqual(['ruleset', 'content', 'definitions', 'operations', 'lockedAt', 'x-future']);
    expect(Object.keys(out.content as object)).toEqual(['pack:a', 'pack:b']);   // the desktop writes its maps sorted
    expect(out['x-future']).toEqual({ kept: true });
    expect(lockToJson(lockOf(out))).toEqual(out);
  });

  it('writes `definitions` only when there are any, so an older lock is written back unchanged', () => {
    const old = { ruleset: { id: 'dnd5e-2014', revision: '1' }, content: {}, operations: {}, lockedAt: 5 };
    expect(lockToJson(lockOf(old))).toEqual(old);
  });

  it('refuses what the desktop app refuses', () => {
    expect(lockFromJson([])).toEqual({ error: 'a dependency lock must be an object' });
    expect(lockFromJson({ ruleset: {} })).toEqual({ error: 'a lock names its ruleset' });
    expect(lockFromJson({ ruleset: { id: 'x' }, content: [] })).toEqual({ error: 'content must be an object' });
    expect(lockFromJson({ ruleset: { id: 'x' }, operations: { a: 1.5 } })).toEqual({ error: '"a" must be a revision number' });
  });
});

describe('comparing a lock with what is installed', () => {
  it('names a changed ruleset, changed and missing content, changed definitions and operations it can no longer run', () => {
    const pinned = base();
    pinned.operations = { 'dnd5e.long_rest': 1, 'dnd5e.level_up': 9, 'dnd5e.gone': 1 };
    const now = base();
    now.rulesetRevision = '2';
    now.content = {};
    now.definitions = { 'class:fighter': revisionKeyOf('{"id":"fighter","changed":true}') };
    const kinds = compareLock(pinned, now, DND5E_OPERATIONS).map(m => `${m.kind} ${m.key}`);
    expect(kinds).toEqual(['ruleset_changed dnd5e-2014', 'content_missing pack:grimoire.srd.5.1', 'content_changed class:fighter',
      'operation_unavailable dnd5e.gone', 'operation_unavailable dnd5e.level_up']);
    expect(compareLock(base(), base(), DND5E_OPERATIONS)).toEqual([]);
  });
});

describe('the execution gate', () => {
  it('runs a character that is not pinned, an older revision still runnable, and an operation the lock does not name', () => {
    expect(checkOperations(null, DND5E_OPERATIONS, ['dnd5e.level_up']).allowed).toBe(true);
    const lock = base();
    lock.operations = { 'dnd5e.level_up': 1 };
    // a registry that can still run revision 1 runs it ...
    const older = operationRegistry([{ id: 'dnd5e.level_up', description: '', current: 2, available: [1, 2], automatic: true, reads: [] },
      { id: 'dnd5e.long_rest', description: '', current: 1, available: [1], automatic: true, reads: [] }]);
    expect(checkOperations(lock, older, ['dnd5e.level_up', 'dnd5e.long_rest']).allowed).toBe(true);
    // ... and this app, with one implementation of each operation, does not claim to
    expect(checkOperations(lock, DND5E_OPERATIONS, ['dnd5e.level_up']).allowed).toBe(false);
  });

  it('refuses a revision this build cannot run and an operation it does not know, never manual free edit', () => {
    const lock = base();
    lock.operations = { 'dnd5e.level_up': 9, 'dnd5e.free_edit': 9 };
    const check = checkOperations(lock, DND5E_OPERATIONS, ['dnd5e.level_up', 'dnd5e.free_edit', 'dnd5e.unknown']);
    expect(check.allowed).toBe(false);
    expect(check.problems.map(p => p.key)).toEqual(['dnd5e.level_up', 'dnd5e.unknown']);
    expect(check.message).toMatch(/Nothing was changed/);
    expect(checkOperations(lock, DND5E_OPERATIONS, ['dnd5e.free_edit']).allowed).toBe(true);
  });

  // a fake ruleset: a class names a spell, the spell names nothing; one item is worn, one carried
  const probe = (states: Record<string, ContentState>): ContentProbe => ({
    roots: read => ({ class: ['class:wizard'], spell: [], 'item.equipped': ['item:robe'], 'item.carried': ['item:robe', 'item:rope'] } as Record<string, string[]>)[read] ?? [],
    state: key => states[key] ?? 'absent',
    dependencies: key => (key === 'class:wizard' ? ['spell:shield', 'item:staff'] : []),
  });

  it('refuses only the operations that read content that cannot be had, following what the content names', () => {
    const lock = base();
    const p = probe({ 'class:wizard': 'exact', 'spell:shield': 'missing', 'item:staff': 'missing', 'item:robe': 'exact', 'item:rope': 'invalid' });
    const levelUp = checkOperations(lock, DND5E_OPERATIONS, ['dnd5e.level_up'], p);   // reads spells: the class's spell is missing
    expect(levelUp.problems.map(m => `${m.operation} ${m.key}`)).toEqual(['dnd5e.level_up spell:shield']);
    // a long rest reads no spells and no items: the staff the class names is not its concern
    expect(checkOperations(lock, DND5E_OPERATIONS, ['dnd5e.long_rest'], p).allowed).toBe(true);
    // equipment reads every carried item: the damaged rope stops it; healing reads nothing
    expect(checkOperations(lock, DND5E_OPERATIONS, ['dnd5e.equipment'], p).problems.map(m => m.key)).toEqual(['item:rope']);
    expect(checkOperations(lock, DND5E_OPERATIONS, ['dnd5e.apply_healing'], p).allowed).toBe(true);
  });

  it('does not gate content for a lock that names no definitions, and a cycle is harmless', () => {
    const legacy = base();
    legacy.definitions = {};
    expect(checkOperations(legacy, DND5E_OPERATIONS, ['dnd5e.level_up'], probe({ 'class:wizard': 'missing' })).allowed).toBe(true);
    const cyclic: ContentProbe = { roots: () => ['class:a'], state: () => 'exact', dependencies: key => [key === 'class:a' ? 'class:b' : 'class:a'] };
    expect(checkOperations(base(), operationRegistry([{ ...DND5E_OPERATIONS.find('dnd5e.long_rest')!, reads: ['class'] }]), ['dnd5e.long_rest'], cyclic).allowed).toBe(true);
  });
});

describe('the revision store', () => {
  it('keeps a text under its hash, hands it back checked, and never hands out what does not match', () => {
    const store = new MemoryRevisionStore();
    const key = store.put('{"id":"fighter"}');
    expect(isRevisionKey(key)).toBe(true);
    expect(store.put('{"id":"fighter"}')).toBe(key);
    expect(getRevision(store, key)).toEqual({ status: 'found', text: '{"id":"fighter"}' });
    expect(getRevision(store, revisionKeyOf('other')).status).toBe('missing');
    expect(getRevision(store, 'sha256:XYZ').status).toBe('invalid');
    store.corruptForTest(key, '{"id":"fighter","tampered":true}');
    expect(getRevision(store, key).status).toBe('invalid');
  });

  it('hashes UTF-8 the way the desktop app does', () => {
    expect(revisionKeyOf('abc')).toBe('sha256:ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const node = require('crypto') as typeof import('crypto');
    for (const text of ['é', 'Mordenkainen’s Sword', '{"name":"Ætherfire 🔥"}']) {
      expect(revisionKeyOf(text)).toBe('sha256:' + node.createHash('sha256').update(text, 'utf8').digest('hex'));
    }
  });
});

describe('the D&D operations', () => {
  it('are the desktop app\'s 27, with the same revisions and reads', () => {
    expect(DND5E_OPERATIONS.all).toHaveLength(27);
    // revision 3 checks the multiclass ability requirements, as on the desktop; revision 2 is the same step with that check off
    expect(DND5E_OPERATIONS.find('dnd5e.level_up')).toMatchObject({ current: 3, available: [2, 3] });
    expect(DND5E_OPERATIONS.find('dnd5e.character_creation')).toMatchObject({ current: 3, reads: [] });
    expect(DND5E_OPERATIONS.find('dnd5e.equipment')!.reads).toContain('item.carried');
    expect(DND5E_OPERATIONS.find('dnd5e.free_edit')!.automatic).toBe(false);
  });
});

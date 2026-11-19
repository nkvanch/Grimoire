// ============================================================================
// FILE: src/engine/pinning/lock.ts
// Revision pinning (contract LIFE-004; the desktop app's ADR-005, docs/architecture/REVISION_PINNING.md). A character keeps the exact revisions it
// was made and last resolved with, so an update to a pack or to the engine's behaviour never changes it without an explicit step. This file is what
// is true of any game: the lock, the registry of executable operations and their revisions, the comparison, and the execution gate.
// The lock is the character's `pins` member, written in the desktop app's format (core/state/DependencyLock.cpp), so a character pinned on one app
// reads the same on the other.
// ============================================================================

/** An executable operation of a ruleset: a stable id and a revision. A change in what an operation does is a new revision. */
export type OperationInfo = {
  id: string;                     // "dnd5e.apply_damage"
  current: number;                // the revision new work is resolved with
  available: readonly number[];   // the revisions this build can still run
  description: string;
  /** False for what the person does by hand (a manual override): never refused for want of a revision. */
  automatic: boolean;
  /** The kinds of content it reads, as content keys are written ("kind:id"); "item.equipped" narrows the roots to what is worn. */
  reads: readonly string[];
};

export type OperationRegistry = { all: readonly OperationInfo[]; find: (id: string) => OperationInfo | undefined };

export function operationRegistry(operations: readonly OperationInfo[]): OperationRegistry {
  const seen = new Set<string>();
  for (const o of operations) {
    if (!o.id) throw new Error('an operation needs an id');
    if (o.current < 1) throw new Error(`the revision of "${o.id}" must be 1 or more`);
    if (!o.available.includes(o.current)) throw new Error(`the current revision of "${o.id}" must be one this build can run`);
    if (seen.has(o.id)) throw new Error(`the operation "${o.id}" is already registered`);
    seen.add(o.id);
  }
  const byId = new Map(operations.map(o => [o.id, o]));
  return { all: operations, find: id => byId.get(id) };
}

export type DependencyLock = {
  rulesetId: string;
  rulesetRevision: string;
  /** What the content was resolved against: "pack:<id>" -> the pack version. */
  content: Record<string, string>;
  /** The exact revision of each definition: "<type>:<id>" -> a revision key ("sha256:" + 64 hex). Written only when there are any. */
  definitions: Record<string, string>;
  /** Operation id -> the revision it was resolved with. */
  operations: Record<string, number>;
  lockedAt: number;
  /** Members this version does not know, kept and written back. */
  extra: Record<string, unknown>;
};

const KNOWN = new Set(['ruleset', 'content', 'definitions', 'operations', 'lockedAt']);
const isObj = (x: unknown): x is Record<string, unknown> => !!x && typeof x === 'object' && !Array.isArray(x);

/** Reads a lock; refuses (returns an error message) what the desktop app refuses. */
export function lockFromJson(json: unknown): { lock: DependencyLock } | { error: string } {
  if (!isObj(json)) return { error: 'a dependency lock must be an object' };
  const ruleset = isObj(json.ruleset) ? json.ruleset : {};
  const rulesetId = typeof ruleset.id === 'string' ? ruleset.id : '';
  if (!rulesetId) return { error: 'a lock names its ruleset' };
  const stringMap = (key: string, what: string): Record<string, string> | string => {
    if (json[key] === undefined) return {};
    if (!isObj(json[key])) return `${key} must be an object`;
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(json[key])) {
      if (typeof v !== 'string') return `"${k}" must be ${what}`;
      out[k] = v;
    }
    return out;
  };
  const content = stringMap('content', 'a version');
  if (typeof content === 'string') return { error: content };
  const definitions = stringMap('definitions', 'a revision key');
  if (typeof definitions === 'string') return { error: definitions };
  const operations: Record<string, number> = {};
  if (json.operations !== undefined) {
    if (!isObj(json.operations)) return { error: 'operations must be an object' };
    for (const [k, v] of Object.entries(json.operations)) {
      if (typeof v !== 'number' || !Number.isInteger(v)) return { error: `"${k}" must be a revision number` };
      operations[k] = v;
    }
  }
  const extra: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(json)) if (!KNOWN.has(k)) extra[k] = v;
  return {
    lock: {
      rulesetId, rulesetRevision: typeof ruleset.revision === 'string' ? ruleset.revision : '',
      content, definitions, operations, lockedAt: typeof json.lockedAt === 'number' ? json.lockedAt : 0, extra,
    },
  };
}

/** Writes a lock exactly as the desktop app does (member order, `definitions` only when there are any, unknown members last). */
export function lockToJson(lock: DependencyLock): Record<string, unknown> {
  const sorted = <T,>(m: Record<string, T>): Record<string, T> => Object.fromEntries(Object.keys(m).sort().map(k => [k, m[k]]));
  const out: Record<string, unknown> = {
    ruleset: { id: lock.rulesetId, revision: lock.rulesetRevision },
    content: sorted(lock.content),
  };
  if (Object.keys(lock.definitions).length > 0) out.definitions = sorted(lock.definitions);
  out.operations = sorted(lock.operations);
  out.lockedAt = lock.lockedAt;
  for (const [k, v] of Object.entries(lock.extra)) out[k] = v;
  return out;
}

export type LockMismatchKind = 'ruleset_changed' | 'content_changed' | 'content_missing' | 'operation_unavailable' | 'content_unavailable';
export type LockMismatch = { kind: LockMismatchKind; key: string; operation?: string; pinned: string; installed: string; message: string };

/** What differs between a character's lock and what is installed now (built the same way for the same character). */
export function compareLock(pinned: DependencyLock, installedNow: DependencyLock, operations: OperationRegistry): LockMismatch[] {
  const out: LockMismatch[] = [];
  if (pinned.rulesetId !== installedNow.rulesetId || pinned.rulesetRevision !== installedNow.rulesetRevision) {
    const p = `${pinned.rulesetId} ${pinned.rulesetRevision}`, i = `${installedNow.rulesetId} ${installedNow.rulesetRevision}`;
    out.push({ kind: 'ruleset_changed', key: pinned.rulesetId, pinned: p, installed: i, message: `This character was made with ${p}, and this build has ${i}.` });
  }
  for (const [key, version] of Object.entries(pinned.content).sort()) {
    const now = installedNow.content[key];
    if (now === undefined) out.push({ kind: 'content_missing', key, pinned: version, installed: '', message: `${key} (${version}) is not installed now.` });
    else if (now !== version) out.push({ kind: 'content_changed', key, pinned: version, installed: now, message: `${key} is installed at ${now}; this character was resolved with ${version}.` });
  }
  for (const [key, revision] of Object.entries(pinned.definitions).sort()) {
    const now = installedNow.definitions[key];
    if (now === undefined) out.push({ kind: 'content_missing', key, pinned: revision, installed: '', message: `${key} is not installed now.` });
    else if (now !== revision) out.push({ kind: 'content_changed', key, pinned: revision, installed: now, message: `${key} has been changed since this character was resolved with it.` });
  }
  for (const [id, revision] of Object.entries(pinned.operations).sort()) {
    const info = operations.find(id);
    if (!info || !info.available.includes(revision)) {
      out.push({
        kind: 'operation_unavailable', key: id, pinned: String(revision), installed: info ? String(info.current) : '',
        message: `This build can no longer run ${id} as it was when this character was resolved (revision ${revision}), so that automation is unavailable.`,
      });
    }
  }
  return out;
}

/** Whether the pinned revision of one definition can be had exactly. */
export type ContentState = 'exact' | 'missing' | 'invalid' | 'not_pinned' | 'absent';

/** What the ruleset tells the gate about one character's content. Reads, never changes. */
export type ContentProbe = {
  roots: (read: string) => string[];
  /** `pinnedRevision` is '' when the lock does not name the key. */
  state: (key: string, pinnedRevision: string) => ContentState;
  dependencies: (key: string, pinnedRevision: string) => string[];
};

export type OperationCheck = { allowed: boolean; problems: LockMismatch[]; message: string };

const kindOf = (key: string) => (key.includes(':') ? key.slice(0, key.indexOf(':')) : '');
const baseKind = (read: string) => (read.includes('.') ? read.slice(0, read.indexOf('.')) : read);
const shortRevision = (r: string) => (r.length > 19 ? r.slice(0, 19) : r);
const REASON: Partial<Record<ContentState, string>> = {
  missing: 'that revision is not kept', invalid: 'that revision is damaged or its key is not valid', not_pinned: 'the lock does not name it',
};

/**
 * Whether the operations a step runs may run for a character with this lock. Not refused: a character that is not pinned, an operation the
 * lock does not mention, one done by hand, a step that names none. Refused: a pinned revision this build cannot run, an operation this build does
 * not know, and (with `content`) an automatic operation whose content cannot be had at the pinned revision. A lock that names no definitions does
 * not gate content.
 */
export function checkOperations(pinned: DependencyLock | null, registry: OperationRegistry, operationIds: readonly string[], content?: ContentProbe): OperationCheck {
  const problems: LockMismatch[] = [];
  for (const id of operationIds) {
    const info = registry.find(id);
    if (!info) { problems.push({ kind: 'operation_unavailable', key: id, pinned: '', installed: '', message: `${id} is not an operation this build knows.` }); continue; }
    if (!info.automatic || !pinned) continue;
    const at = pinned.operations[id];
    if (at === undefined || info.available.includes(at)) continue;
    problems.push({ kind: 'operation_unavailable', key: id, pinned: String(at), installed: String(info.current), message: `${id} was resolved at revision ${at}, which this build can no longer run.` });
  }
  if (content && pinned && Object.keys(pinned.definitions).length > 0) {
    const reported = new Set<string>();
    for (const id of operationIds) {
      const info = registry.find(id);
      if (!info || !info.automatic || info.reads.length === 0) continue;
      const rootKinds = new Set(info.reads.map(baseKind));
      const followKinds = new Set(info.reads.filter(r => !r.includes('.')));
      const queue: [string, boolean][] = [];
      for (const read of info.reads) for (const key of content.roots(read)) queue.push([key, true]);
      const visited = new Set<string>();
      for (let i = 0; i < queue.length && visited.size < 5000; i++) {
        const [key, isRoot] = queue[i];
        if (!(isRoot ? rootKinds : followKinds).has(kindOf(key)) || visited.has(key)) continue;
        visited.add(key);
        const revision = pinned.definitions[key] ?? '';
        const state = content.state(key, revision);
        if (state === 'absent') continue;
        if (state === 'exact') { for (const next of content.dependencies(key, revision)) queue.push([next, false]); continue; }
        if (reported.has(`${id}|${key}`)) continue;
        reported.add(`${id}|${key}`);
        problems.push({
          kind: 'content_unavailable', key, operation: id, pinned: revision, installed: '',
          message: `${id} needs ${key}${revision ? ` as this character was pinned to it (${shortRevision(revision)})` : ''}, and ${REASON[state]}.`,
        });
      }
    }
  }
  if (problems.length === 0) return { allowed: true, problems, message: '' };
  const revisions = problems.filter(p => p.kind !== 'content_unavailable')
    .map(p => p.key + (p.pinned ? ` (revision ${p.pinned})` : ' (not known to this version)')).join(', ');
  const contents = problems.filter(p => p.kind === 'content_unavailable').map(p => p.message).join(' ');
  let message = 'This step is automatic and cannot run:';
  if (revisions) message += ` this character was resolved with ${revisions}, which this version can no longer run.`;
  if (contents) message += ` ${contents} The installed version, where there is one, can be looked at but is never used in place of it.`;
  message += " Nothing was changed, and the character's pinned versions were left as they are. You can still view the sheet and make the change by hand.";
  return { allowed: false, problems, message };
}

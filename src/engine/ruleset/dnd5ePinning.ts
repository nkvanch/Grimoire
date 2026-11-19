// ============================================================================
// FILE: src/engine/ruleset/dnd5ePinning.ts
// A D&D character's lock and the exact definitions it was resolved with (the desktop app's core/rules/DependencyLockRules and
// DefinitionRevisions, same behaviour). The definitions a character depends on are the ones it names (species, subrace, classes, subclasses,
// background, spells, items, the feats it took) and those they name in turn (a class's starting equipment, a subrace's parent). Each is kept in a
// revision store under the hash of its canonical JSON, and the lock (`pins`) names that hash. A key is "<type>:<id>".
// ============================================================================
import type { Entity } from '../types';
import type { ContentCacheType, HomebrewContent } from '../contentRecords';
import { canonicalJson } from '../contentPackManifest';
import { collectTypedContentRefs } from '../packDiagnostics';
import { collectContentDependencies } from '../contentDependencies';
import {
  DependencyLock, LockMismatch, ContentProbe, ContentState, OperationCheck, OperationRegistry,
  lockFromJson, lockToJson, compareLock, checkOperations,
} from '../pinning/lock';
import { RevisionStore, getRevision, revisionKeyOf } from '../pinning/revisionStore';
import { DND5E_OPERATIONS, RULESET_REVISION } from './dnd5eOperations';

export type DefinitionRecord = Record<string, unknown>;

/** What is installed, as the lock needs to see it: the records as the packs and the person's library hold them (never a derived view). */
export interface PinningCatalog {
  /** The definition this ruleset resolves now for a pinned kind, or undefined. */
  definition(type: string, id: string, rulesetId: string): DefinitionRecord | undefined;
  /** The packs installed now. */
  packs(): readonly { id: string; version: string; ruleset?: string }[];
}

export const PINNED_KINDS: readonly string[] = ['race', 'subrace', 'class', 'subclass', 'background', 'spell', 'item', 'feat'];

const pinsOf = (entity: Entity): unknown => (entity as unknown as { pins?: unknown }).pins;
const rulesetOf = (entity: Entity): string => (entity.rulesetId as string | undefined) || 'dnd5e-2014';
const shortKey = (key: string) => (key.length > 19 ? key.slice(0, 19) : key);

function splitKey(key: string): { type: string; id: string } | null {
  const colon = key.indexOf(':');
  if (colon <= 0 || colon + 1 >= key.length) return null;
  return { type: key.slice(0, colon), id: key.slice(colon + 1) };
}

/** What the character names itself: no help from the catalog, so a definition that is gone is still named. */
function namedBy(entity: Entity): { type: string; id: string }[] {
  const out: { type: string; id: string }[] = collectTypedContentRefs(entity).map(r => ({ type: r.type, id: r.id }));
  for (const f of entity.features ?? []) {
    if (f?.source?.kind === 'feat' && f.source.refId) out.push({ type: 'feat', id: String(f.source.refId) });
  }
  return out;
}

const dependencies = (type: string, record: DefinitionRecord) =>
  collectContentDependencies(type as ContentCacheType, record as unknown as HomebrewContent).map(d => ({ type: d.type, id: d.id }));

const pinned = (type: string) => PINNED_KINDS.includes(type);
const current = (catalog: PinningCatalog, ruleset: string, type: string, id: string) =>
  (pinned(type) && id ? catalog.definition(type, id, ruleset) : undefined);

/** What the character depends on, in the order found, each once. A reference the catalog cannot resolve is not listed. */
export function definitionsOf(entity: Entity, catalog: PinningCatalog): { type: string; id: string }[] {
  const ruleset = rulesetOf(entity);
  const roots = namedBy(entity);
  const out: { type: string; id: string }[] = [];
  const seen = new Set<string>();
  for (let i = 0; i < roots.length && out.length < 5000; i++) {
    const ref = roots[i];
    const key = `${ref.type}:${ref.id}`;
    if (!ref.id || seen.has(key)) continue;
    seen.add(key);
    const record = current(catalog, ruleset, ref.type, ref.id);
    if (!record) continue;
    out.push(ref);
    roots.push(...dependencies(ref.type, record));
  }
  return out;
}

/** "<type>:<id>" -> the revision key of the definition as the catalog has it. With `archive` the text of each revision is kept there. */
export function definitionRevisions(entity: Entity, catalog: PinningCatalog, archive?: RevisionStore): Record<string, string> {
  const ruleset = rulesetOf(entity);
  const out: Record<string, string> = {};
  for (const ref of definitionsOf(entity, catalog)) {
    const record = current(catalog, ruleset, ref.type, ref.id);
    if (!record) continue;
    const text = canonicalJson(record);
    out[`${ref.type}:${ref.id}`] = archive ? archive.put(text) : revisionKeyOf(text);
  }
  return out;
}

/** What is installed now, for this character. Pass `archive` only when the lock is being kept: it keeps the text of every revision named. */
export function currentLockFor(entity: Entity, catalog: PinningCatalog, now: number, archive?: RevisionStore,
                               operations: OperationRegistry = DND5E_OPERATIONS): DependencyLock {
  const rulesetId = rulesetOf(entity);
  const content: Record<string, string> = {};
  for (const pack of catalog.packs()) if (!pack.ruleset || pack.ruleset === rulesetId) content[`pack:${pack.id}`] = pack.version;
  return {
    rulesetId, rulesetRevision: RULESET_REVISION[rulesetId] ?? '1', content,
    definitions: definitionRevisions(entity, catalog, archive),
    operations: Object.fromEntries(operations.all.map(o => [o.id, o.current])), lockedAt: now, extra: {},
  };
}

/** The lock a character carries, or null (a character from before pinning is not pinned). Older homebrew fingerprints read as definitions. */
export function pinnedLockOf(entity: Entity): DependencyLock | null {
  const raw = pinsOf(entity);
  if (raw === undefined) return null;
  const read = lockFromJson(raw);
  if ('error' in read) return null;
  const lock = { ...read.lock, content: { ...read.lock.content }, definitions: { ...read.lock.definitions } };
  for (const key of Object.keys(lock.content)) {
    if (!key.startsWith('homebrew:')) continue;
    const def = key.slice('homebrew:'.length);
    if (!(def in lock.definitions)) lock.definitions[def] = lock.content[key];
    delete lock.content[key];
  }
  return lock;
}

/** Writes the lock to the character. Replacing an existing lock is the caller's explicit decision. */
export const attachLock = (entity: Entity, lock: DependencyLock): Entity => ({ ...entity, pins: lockToJson(lock) });

/** How the character's lock stands against what is installed: nothing to say when it is not pinned or nothing differs. */
export function lockReport(entity: Entity, catalog: PinningCatalog, operations: OperationRegistry = DND5E_OPERATIONS): LockMismatch[] {
  const lock = pinnedLockOf(entity);
  return lock ? compareLock(lock, currentLockFor(entity, catalog, 0, undefined, operations), operations) : [];
}

// ── resolving a pinned character ──────────────────────────────────────────────

type Access = { state: ContentState; fromStore: boolean; installed: boolean; record?: DefinitionRecord; detail: string };

function accessPinned(catalog: PinningCatalog, ruleset: string, store: RevisionStore, type: string, id: string, revision: string): Access {
  const now = current(catalog, ruleset, type, id);
  if (now && revisionKeyOf(canonicalJson(now)) === revision) return { state: 'exact', fromStore: false, installed: true, detail: '' };
  const lookup = getRevision(store, revision);
  if (lookup.status === 'found') {
    try {
      return { state: 'exact', fromStore: true, installed: !!now, record: JSON.parse(lookup.text) as DefinitionRecord, detail: '' };
    } catch {
      return { state: 'invalid', fromStore: false, installed: !!now, detail: 'the kept text is not readable' };
    }
  }
  return { state: lookup.status === 'missing' ? 'missing' : 'invalid', fromStore: false, installed: !!now, detail: lookup.message };
}

export type ResolutionIssue = {
  kind: 'revision_missing' | 'revision_invalid' | 'not_pinned';
  key: string;
  message: string;
  revision?: string;
  /** An installed version exists under this key and is shown in its place, for looking at only. */
  substituted: boolean;
};
export type PinnedResolution = {
  pinned: boolean;
  /** The kept revisions that differ from what is installed: to be laid over the catalog for this character. */
  records: { type: string; id: string; record: DefinitionRecord }[];
  issues: ResolutionIssue[];
};

/** Resolves a character against its lock. Reads the character, the catalog and the store; changes none of them. */
export function resolvePinnedContent(entity: Entity, installed: PinningCatalog, store: RevisionStore): PinnedResolution {
  const lock = pinnedLockOf(entity);
  const out: PinnedResolution = { pinned: !!lock, records: [], issues: [] };
  if (!lock) return out;
  const ruleset = lock.rulesetId || rulesetOf(entity);
  for (const [key, revision] of Object.entries(lock.definitions).sort()) {
    const parts = splitKey(key);
    if (!parts) continue;
    const access = accessPinned(installed, ruleset, store, parts.type, parts.id, revision);
    if (access.state === 'exact') {
      if (access.fromStore && access.record) out.records.push({ ...parts, record: access.record });
      continue;
    }
    const used = access.installed
      ? 'the installed version is shown for inspection only, and automatic steps that need this definition are off'
      : 'it is not installed, so it cannot be resolved, and automatic steps that need it are off';
    out.issues.push(access.state === 'missing'
      ? { kind: 'revision_missing', key, revision, substituted: access.installed, message: `${key}: the revision this character was pinned to (${shortKey(revision)}) is not kept; ${used}.` }
      : { kind: 'revision_invalid', key, revision, substituted: access.installed, message: `${key}: the revision this character was pinned to is damaged (${access.detail}), so it was not used; ${used}.` });
  }
  for (const ref of definitionsOf(entity, installed)) {
    const key = `${ref.type}:${ref.id}`;
    if (key in lock.definitions) continue;
    out.issues.push({ kind: 'not_pinned', key, substituted: true, message: `${key} is not pinned to a revision; automatic steps that need it are off until it is pinned (pin to installed).` });
  }
  return out;
}

/** A catalog with the pinned records laid over the installed one, for this character only; the installed catalog is never changed. */
export function catalogWithPinned(installed: PinningCatalog, resolution: PinnedResolution): PinningCatalog {
  if (resolution.records.length === 0) return installed;
  const over = new Map(resolution.records.map(r => [`${r.type}:${r.id}`, r.record]));
  return { packs: () => installed.packs(), definition: (type, id, ruleset) => over.get(`${type}:${id}`) ?? installed.definition(type, id, ruleset) };
}

// ── the content gate ──────────────────────────────────────────────────────────

export function contentProbeFor(entity: Entity, installed: PinningCatalog, store: RevisionStore): ContentProbe {
  const ruleset = rulesetOf(entity);
  const named = namedBy(entity);
  const equipped = (entity.inventory?.equipped ?? []).map(i => `item:${i.itemId}`).filter(k => k !== 'item:');
  const carried = (entity.inventory?.carried ?? []).map(i => `item:${i.itemId}`).filter(k => k !== 'item:');
  return {
    roots: read => {
      if (read === 'item.equipped') return equipped;
      if (read === 'item.carried') return [...carried, ...equipped];
      return named.filter(r => r.type === read && r.id).map(r => `${r.type}:${r.id}`);
    },
    state: (key, revision) => {
      const parts = splitKey(key);
      if (!parts || !pinned(parts.type)) return 'absent';   // a kind that is not pinned is not gated
      if (!revision) return current(installed, ruleset, parts.type, parts.id) ? 'not_pinned' : 'absent';
      return accessPinned(installed, ruleset, store, parts.type, parts.id, revision).state;
    },
    dependencies: (key, revision) => {
      const parts = splitKey(key);
      if (!parts) return [];
      const access = accessPinned(installed, ruleset, store, parts.type, parts.id, revision);
      if (access.state !== 'exact') return [];
      const record = access.fromStore ? access.record : current(installed, ruleset, parts.type, parts.id);
      if (!record) return [];
      return dependencies(parts.type, record).filter(d => pinned(d.type)).map(d => `${d.type}:${d.id}`);
    },
  };
}

/** Whether the automatic operations a step runs may run for this character: their revisions, and the pinned content each reads. */
export function checkOperationsFor(entity: Entity, operations: readonly string[], installed: PinningCatalog, store: RevisionStore,
                                   registry: OperationRegistry = DND5E_OPERATIONS): OperationCheck {
  const lock = pinnedLockOf(entity);
  if (!lock) return checkOperations(null, registry, operations);   // never pinned: nothing to hold it to
  return checkOperations(lock, registry, operations, contentProbeFor(entity, installed, store));
}

/** For a pinned character whose lock names definitions: names the definitions it has taken on since (keeping their text). Adds only what the lock
 *  lacks; every revision already named stays. A character that is not pinned, or whose lock names none, is left alone. */
export function extendLockDefinitions(entity: Entity, catalog: PinningCatalog, store: RevisionStore): { entity: Entity; added: number } {
  const raw = pinsOf(entity);
  if (raw === undefined) return { entity, added: 0 };
  const read = lockFromJson(raw);
  if ('error' in read || Object.keys(read.lock.definitions).length === 0) return { entity, added: 0 };
  const known = pinnedLockOf(entity)!;
  const ruleset = rulesetOf(entity);
  const definitions = { ...read.lock.definitions };
  let added = 0;
  for (const ref of definitionsOf(entity, catalog)) {
    const key = `${ref.type}:${ref.id}`;
    if (key in known.definitions) continue;
    const record = current(catalog, ruleset, ref.type, ref.id);
    if (!record) continue;
    definitions[key] = store.put(canonicalJson(record));
    added++;
  }
  return added > 0 ? { entity: attachLock(entity, { ...read.lock, definitions }), added } : { entity, added: 0 };
}

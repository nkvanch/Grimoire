// ============================================================================
// FILE: src/engine/pinning/revisionStore.ts
// Immutable, content-addressed storage of definitions (the desktop app's core/state/RevisionStore). What a definition said is kept under the hash
// of that text, so a revision is never edited: an update adds a revision beside the one a character was pinned to instead of replacing it.
// ============================================================================
import { sha256Hex } from '../sha256';

const PREFIX = 'sha256:';

/** "sha256:" and 64 lowercase hex characters. */
export const isRevisionKey = (key: string): boolean => /^sha256:[0-9a-f]{64}$/.test(key);

/** The key of a text: the hash of exactly these bytes (UTF-8). */
export const revisionKeyOf = (text: string): string => PREFIX + sha256Hex(text);

export type RevisionLookup =
  | { status: 'found'; text: string }
  | { status: 'missing' | 'invalid'; message: string };

export interface RevisionStore {
  /** Keeps the text under its key and returns the key. A text already kept is left as it is. */
  put(text: string): string;
  /** What is stored under the key, exactly as stored, without checking it. Use getRevision(). */
  readStored(key: string): string | undefined;
}

/** What is stored under the key, checked: a text is returned only when its hash is the key. */
export function getRevision(store: RevisionStore, key: string): RevisionLookup {
  if (!isRevisionKey(key)) return { status: 'invalid', message: `"${key}" is not a revision key` };
  const stored = store.readStored(key);
  if (stored === undefined) return { status: 'missing', message: `no revision ${key.slice(0, PREFIX.length + 12)} is kept` };
  if (revisionKeyOf(stored) !== key) return { status: 'invalid', message: `what is kept under ${key.slice(0, PREFIX.length + 12)} does not match its hash` };
  return { status: 'found', text: stored };
}

/** In memory: for tests, and as the working copy the durable store loads into and writes through. */
export class MemoryRevisionStore implements RevisionStore {
  protected readonly texts = new Map<string, string>();
  put(text: string): string {
    const key = revisionKeyOf(text);
    if (!this.texts.has(key)) this.texts.set(key, text);   // already kept: left as it is
    return key;
  }
  readStored(key: string): string | undefined { return this.texts.get(key); }
  get size(): number { return this.texts.size; }
  /** Every key kept, for writing through to durable storage. */
  keys(): string[] { return [...this.texts.keys()]; }
  /** Damages an entry, to show that a damaged store is detected. */
  corruptForTest(key: string, text: string): void { this.texts.set(key, text); }
}

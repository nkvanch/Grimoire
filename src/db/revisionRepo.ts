// ============================================================================
// FILE: src/db/revisionRepo.ts
// Durable storage of the revisions characters are pinned to (contract LIFE-004; the desktop app keeps the same table). The store a character's lock
// is resolved against works in memory: every kept revision is loaded at start, and a revision kept since is written through to the table. The table
// refuses to change or delete a row, so what was kept stays as it was.
// ============================================================================
import { getDb } from './db';
import { MemoryRevisionStore } from '../engine/pinning/revisionStore';

/** Every kept revision. */
export async function loadKeptRevisions(): Promise<{ key: string; text: string }[]> {
  return getDb().getAllAsync<{ key: string; text: string }>('SELECT key, text FROM definition_revisions');
}

/** Keeps a revision; one already kept is left as it is. */
export async function keepRevision(key: string, text: string): Promise<void> {
  await getDb().runAsync('INSERT OR IGNORE INTO definition_revisions (key, text) VALUES (?, ?)', [key, text]);
}

/** The revision store of this device: in memory, written through to the table. */
export class DurableRevisionStore extends MemoryRevisionStore {
  private writing: Promise<void> = Promise.resolve();
  private failed: Error | null = null;

  /** Loads what is kept. A row is taken as it was stored: a damaged one is found when it is read (getRevision checks the hash). */
  static async open(): Promise<DurableRevisionStore> {
    const store = new DurableRevisionStore();
    for (const row of await loadKeptRevisions()) store.texts.set(row.key, row.text);
    return store;
  }

  put(text: string): string {
    const before = this.size;
    const key = super.put(text);
    if (this.size > before) {
      this.writing = this.writing.then(() => keepRevision(key, text)).catch(e => { this.failed = e instanceof Error ? e : new Error(String(e)); });
    }
    return key;
  }

  /** Waits for every revision kept so far to be written; throws if one could not be. */
  async flush(): Promise<void> {
    await this.writing;
    if (this.failed) {
      const e = this.failed;
      this.failed = null;
      throw e;
    }
  }
}

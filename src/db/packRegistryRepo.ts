// ============================================================================
// FILE: src/db/packRegistryRepo.ts
// imported content-pack (see installed_packs in schema.ts), so a shared
// pack can be seen and removed as a group instead of only item-by-item.
// Deliberately NOT a full pack system — no version/dependency/priority
// tracking, since nothing produces or consumes those yet. 'backup' type
// imports (a user restoring their OWN device) are never registered here —
// only 'content-pack' imports (content brought in from elsewhere) are.
// ============================================================================
import { getDb } from './db';

import type { PackItemRef, InstalledPack } from '../engine/contentRecords';
export type { PackItemRef, InstalledPack } from '../engine/contentRecords';
export { buildPackOwnershipIndex } from '../engine/contentRecords';

type InstalledPackRow = {
  id:             string;
  name:           string;
  importedAt:     number;
  itemRefs:       string;
  packageVersion: string | null;
  author:         string | null;
};

/** Records a freshly-imported content-pack. No-op on web (no SQLite there). */
export async function recordInstalledPack(
  id:       string,
  name:     string,
  itemRefs: PackItemRef[],
  meta?:    { packageVersion?: string; author?: string },
): Promise<void> {
  const db = getDb();
  await db.runAsync(
    'INSERT OR REPLACE INTO installed_packs (id, name, importedAt, itemRefs, packageVersion, author) VALUES (?, ?, ?, ?, ?, ?)',
    [id, name, Date.now(), JSON.stringify(itemRefs), meta?.packageVersion ?? null, meta?.author ?? null],
  );
}

/** Every installed pack, newest first. Empty on web. */
export async function loadInstalledPacks(): Promise<InstalledPack[]> {
  const db = getDb();
  const rows = await db.getAllAsync<InstalledPackRow>(
    'SELECT * FROM installed_packs ORDER BY importedAt DESC',
  );
  return rows.map(r => ({
    id:         r.id,
    name:       r.name,
    importedAt: r.importedAt,
    itemRefs:   JSON.parse(r.itemRefs) as PackItemRef[],
    packageVersion: r.packageVersion ?? undefined,
    author:         r.author ?? undefined,
  }));
}


/** Removes a pack's registry row only — does NOT delete the content items
 *  themselves. Callers that want a full "uninstall" must separately call
 *  useHomebrewStore's deleteItem for each of the pack's itemRefs first
 *  (see src/components/compendium/InstalledPackagesView.tsx). Kept as two
 *  explicit steps rather than one so a user can un-track a pack (e.g. it
 *  turned out to be a mistake) without losing content they've since
 *  edited and want to keep. */
export async function deleteInstalledPack(id: string): Promise<void> {
  const db = getDb();
  await db.runAsync('DELETE FROM installed_packs WHERE id = ?', [id]);
}

// ============================================================================
// FILE: src/engine/contentRecords.ts
// The kinds of content record, the installed-pack record and the pure index over it. Types and a pure function the
// engine needs, kept here so it does not import the database modules (contract ARCH-003); src/db re-exports them.
// ============================================================================
import type { Race, Subrace, CharClass, HomebrewSubclass, Spell, Feature, Background, Item, Feat, Condition, SpellList } from './types';
import type { MonsterTemplate } from '../content/monsters/types';

export type ContentCacheType = 'race' | 'subrace' | 'class' | 'subclass' | 'spell' | 'background' | 'feature' | 'item' | 'feat' | 'monster' | 'condition' | 'spellList';
export type HomebrewContent   = Race | Subrace | CharClass | HomebrewSubclass | Spell | Feature | Background | Item | Feat | MonsterTemplate | Condition | SpellList;

/** `included` records whether the package's author picked the entry ('selected') or it was pulled in
 *  automatically because something requires it ('dependency'). Optional: older registrations and packages
 *  without a manifest simply don't know, and are treated as selected. Stored inside the itemRefs JSON, so it
 *  needs no schema change and never affects content identity. */
export type PackItemRef = { type: ContentCacheType; id: string; included?: 'selected' | 'dependency' };

export type InstalledPack = {
  id:         string;
  name:       string;
  importedAt: number;
  itemRefs:   PackItemRef[];
  /** HOMEBREW-PACKAGE-1 item 15: package provenance — the author-set
   *  version string / author name from the .grimoire-pack file, if
   *  present. Provenance only, never used as content identity (stable
   *  content ids are the itemRefs themselves). */
  packageVersion?: string;
  author?:         string;
};

/**
 * PROVENANCE-1: a cached, O(1)-lookup reverse index from a content item
 * (`${type}:${id}`) to the pack that owns it — built once from
 * InstalledPack.itemRefs (the one authoritative registry of pack
 * ownership) rather than storing a `packId` directly on every content
 * item. A direct field would create two sources of truth that could drift
 * (e.g. a pack uninstalled and a same-id item re-authored locally would
 * leave a stale packId behind unless every content-mutation path
 * remembered to clear it); this index is instead recomputed from
 * `InstalledPack[]` whenever the pack list changes (callers should
 * memoize the result against their own `packs` state, the same "explicit
 * dependency array" pattern already used for getMergedContentDB() call
 * sites — see homebrewStore.ts's PERF-1 precedent) and is never persisted
 * itself, so it can never itself go stale independently of its source.
 */
export function buildPackOwnershipIndex(packs: InstalledPack[]): Map<string, { packId: string; packName: string }> {
  const index = new Map<string, { packId: string; packName: string }>();
  for (const pack of packs) {
    for (const ref of pack.itemRefs) {
      // First pack wins on a (should-be-impossible) double-claim — same
      // "don't silently overwrite, don't crash" posture as the rest of
      // this file's diagnostics.
      const key = `${ref.type}:${ref.id}`;
      if (!index.has(key)) index.set(key, { packId: pack.id, packName: pack.name });
    }
  }
  return index;
}

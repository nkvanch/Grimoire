// ============================================================================
// FILE: src/content/itemRepo.ts
// The item repo on every platform: a thin synchronous wrapper around the static item arrays
// (src/content/items/index.ts, which Metro swaps for an empty module in the app), served through the
// installed packs by withOfficialItems. Mirrors spellRepo.ts's design exactly.
// ============================================================================
import { Item } from '../engine/types';
import { ALL_ITEMS } from './items/index';
import { toItemIndexEntry } from './itemRepo.types';
import type { ItemIndexEntry, ItemRepo } from './itemRepo.types';
import { withOfficialItems } from './packRepos';

const itemById = new Map<string, Item>(ALL_ITEMS.map(i => [i.id, i]));

const index: ItemIndexEntry[] = ALL_ITEMS.map(toItemIndexEntry);

export const itemRepo: ItemRepo = withOfficialItems({
  async init() { /* no-op — the static arrays are already in memory */ },
  getIndex() { return index; },
  async ensureLoaded() { /* no-op — everything is already resident */ },
  getItemSync(id) { return itemById.get(id); },
});

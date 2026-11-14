// ============================================================================
// FILE: src/content/pinningCatalog.ts
// The catalog a character's lock is computed against: the records exactly as the installed packs and the person's library hold them, never a
// derived view (no class tags another pack adds, see provider/contentProvider.ts), found by the same rules as the desktop app's ItemCatalog, so the
// two apps give a definition the same revision key:
//  - the person's own record wins over a pack record with the same id;
//  - items, classes, subclasses, species, backgrounds and (top-level) subraces: a later pack replaces an earlier record;
//  - spells and feats are filed by their pack's ruleset: the asked-for ruleset first, else the first ruleset (in sorted order) that has the id.
// A subrace nested inside a species record is not a record of its own here, as it is not on the desktop.
// ============================================================================
import type { PinningCatalog, DefinitionRecord } from '../engine/ruleset/dnd5ePinning';
import { orderPacks, InstalledPack } from './provider/contentProvider';

type Rec = DefinitionRecord & { id?: unknown };
/** The person's own records, by kind ("race", "subrace", "class", "subclass", "background", "spell", "item", "feat"). */
export type HomebrewByKind = Partial<Record<string, readonly Rec[]>>;

const LISTS: Record<string, string> = { race: 'races', subrace: 'subraces', class: 'classes', subclass: 'subclasses', background: 'backgrounds', item: 'items' };

export function pinningCatalog(packs: readonly InstalledPack[], homebrew: HomebrewByKind = {}): PinningCatalog {
  const ordered = orderPacks(packs);
  const byKind = new Map<string, Map<string, Rec>>();               // later pack wins
  const byRuleset = { spell: new Map<string, Map<string, Rec>>(), feat: new Map<string, Map<string, Rec>>() };
  for (const p of ordered) {
    const hb = (p.homebrew ?? {}) as Record<string, readonly Rec[] | undefined>;
    for (const [kind, key] of Object.entries(LISTS)) {
      for (const r of hb[key] ?? []) {
        if (typeof r?.id !== 'string') continue;
        if (!byKind.has(kind)) byKind.set(kind, new Map());
        byKind.get(kind)!.set(r.id, r);
      }
    }
    const ruleset = (p.manifest?.ruleset as string | undefined) ?? '';
    for (const [kind, key] of [['spell', 'spells'], ['feat', 'feats']] as const) {
      for (const r of hb[key] ?? []) {
        if (typeof r?.id !== 'string') continue;
        if (!byRuleset[kind].has(ruleset)) byRuleset[kind].set(ruleset, new Map());
        byRuleset[kind].get(ruleset)!.set(r.id, r);
      }
    }
  }
  const own = new Map<string, Map<string, Rec>>();
  for (const [kind, list] of Object.entries(homebrew)) {
    own.set(kind, new Map((list ?? []).filter(r => typeof r?.id === 'string').map(r => [r.id as string, r])));
  }
  const versioned = (kind: 'spell' | 'feat', id: string, ruleset: string): Rec | undefined => {
    const preferred = byRuleset[kind].get(ruleset)?.get(id);
    if (preferred) return preferred;
    for (const r of [...byRuleset[kind].keys()].sort()) {
      const found = byRuleset[kind].get(r)!.get(id);
      if (found) return found;
    }
    return undefined;
  };
  return {
    definition: (type, id, ruleset) => {
      const mine = own.get(type)?.get(id);
      if (mine) return mine;
      if (type === 'spell' || type === 'feat') return versioned(type, id, ruleset);
      return byKind.get(type)?.get(id);
    },
    packs: () => ordered.map(p => ({ id: p.manifest.id, version: p.manifest.version, ruleset: p.manifest.ruleset as string | undefined })),
  };
}

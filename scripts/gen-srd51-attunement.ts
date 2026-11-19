// The catalog items the SRD 5.1 text says require attunement ("(requires attunement)" in their heading), from the extraction in
// third_party/wotc/srd/5.1. Writes src/content/items/srd51AttunementIds.json, which items/index.ts uses to mark them.
//   npx tsx scripts/gen-srd51-attunement.ts
// Linked through srdProvenance.json's canonical ids; a record whose catalog items are variants with other names ("Belt of Giant
// extraction misses a few headings broken across lines, so an item it does not list is left as it is.
import fs from 'fs';
import { FULL_ITEM_LIBRARY } from '../src/content/items/index';

const srd = JSON.parse(fs.readFileSync('third_party/wotc/srd/5.1/extracted/items.json', 'utf8')).records as {
  canonicalId: string; name: string; category: string; structured?: { attunement?: string | null }; normalizedText?: string;
}[];
const provenance = JSON.parse(fs.readFileSync('src/content/items/srdProvenance.json', 'utf8')) as Record<string, { canonicalId?: string }>;
// the extraction's own attunement field misses headings with a longer type line ("Armor (light, medium, or heavy), rare (requires
// attunement)"): read the heading too, which is the text after the name up to its first full stop
const headingSaysAttunement = (r: typeof srd[number]) => /^[^.]*\(requires attunement/i.test((r.normalizedText ?? '').slice(r.name.length));
const needs = srd.filter(r => r.category === 'magic-item' && (r.structured?.attunement || headingSaysAttunement(r)));
const words = (s: string) => s.toLowerCase().replace(/[^a-z ]+/g, ' ').split(/\s+/).filter(Boolean);
const joined = (s: string) => words(s).join('');
const inOrder = (record: string, name: string) => {
  const hay = words(name);
  let at = 0;
  for (const w of words(record)) {
    const j = hay.indexOf(w, at);
    if (j < 0) return false;
    at = j + 1;
  }
  return true;
};

const ids = new Set<string>();
for (const r of needs) {
  for (const [id, p] of Object.entries(provenance)) if (p.canonicalId === r.canonicalId) ids.add(id);
  // unmarked on the emulator 2026-11-18). The extraction merged a table row into one heading ("Storm giant 29 Legendary Berserker
  // Axe") and split some words ("Am ulet").
  const name = r.name.replace(/^.*\d+\s+legendary\s+/i, '');
  for (const item of FULL_ITEM_LIBRARY) {
    if (provenance[item.id]?.canonicalId) continue;
    if (joined(item.name).startsWith(joined(name)) || inOrder(name, item.name)) ids.add(item.id);
  }
}
const known = new Set(FULL_ITEM_LIBRARY.map(i => i.id));
const out = [...ids].filter(id => known.has(id)).sort();
fs.writeFileSync('src/content/items/srd51AttunementIds.json', JSON.stringify(out, null, 1) + '\n');
console.log(`${out.length} items`);

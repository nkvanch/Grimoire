// The native (C++) desktop app opens a character this app exported, changes it, saves it, and this app imports the result.
// It does nothing in a normal run; the desktop project's test run writes the files:
//   GRIMOIRE_NATIVE_ROUNDTRIP_DIR=D:/path/build/roundtrip-out npx jest src/io/__tests__/nativeRoundTrip
import * as fs from 'fs';
import * as path from 'path';
import { parsePortableCharacter } from '../characterPortable';

const DIR = process.env.GRIMOIRE_NATIVE_ROUNDTRIP_DIR;
const ORIGINALS = path.resolve(__dirname, '../../../builds/test-characters');
const run = DIR ? describe : describe.skip;

type Slots = Record<string, { total: number; used: number }>;
const slotsOf = (e: { spellcasting?: { slots: Slots } }): Slots => (e.spellcasting ? e.spellcasting.slots : {});

run('characters saved by the native app', () => {
  const files = DIR ? fs.readdirSync(path.join(DIR, 'changed')).filter(f => f.endsWith('.json')).sort() : [];

  it('has files to check', () => {
    expect(files.length).toBeGreaterThanOrEqual(6);
  });

  for (const file of files) {
    const original = fs.readFileSync(path.join(ORIGINALS, file), 'utf8');

    it(`${file}: opened and saved with no change imports as the same character`, () => {
      const before = parsePortableCharacter(original).entity;
      const after = parsePortableCharacter(fs.readFileSync(path.join(DIR, 'unchanged', file), 'utf8')).entity;
      expect(after).toEqual(before);
    });

    it(`${file}: the one change the native engine made arrives intact and nothing else moved`, () => {
      const before = parsePortableCharacter(original).entity;
      const after = parsePortableCharacter(fs.readFileSync(path.join(DIR, 'changed', file), 'utf8')).entity;
      const slotsBefore = slotsOf(before as never);
      const expected = JSON.parse(JSON.stringify(before));
      const first = slotsBefore['1'];
      if (first && first.used < first.total) expected.spellcasting.slots['1'].used = first.used + 1;
      expect(after).toEqual(expected);
    });
  }
});

// DATA-007: members the native app does not know of, written beside every record of a character, survive the native app's changes and
// this app's import. `unknown-fields-clean` is the same character with the same changes and no such members.
const MARKER = 'x-unknown';
const UNKNOWN_DIR = DIR ? path.join(DIR, 'unknown-fields') : '';

// every record by a path in which array entries are named by their id, as the native test names them
function records(node: unknown, at: string, out: Map<string, Record<string, unknown>>): void {
  if (Array.isArray(node)) {
    node.forEach((element, index) => {
      const id = element && typeof element === 'object' ? ['id', 'instanceId', 'key', 'resourceId', 'itemId'].map(k => (element as Record<string, unknown>)[k]).find(v => typeof v === 'string') : undefined;
      records(element, at + (id !== undefined ? `[${id}]` : `[${index}]`), out);
    });
  } else if (node && typeof node === 'object') {
    let key = at;
    for (let n = 2; out.has(key); n++) key = `${at}#${n}`;
    out.set(key, node as Record<string, unknown>);
    for (const [k, v] of Object.entries(node)) records(v, `${key}/${k}`, out);
  }
}

/** The character with each owned item's id replaced by where it sits (equipped #0, carried #1, ...). */
function withPlacedItemIds(entity: unknown): unknown {
  const e = entity as { inventory?: Record<string, unknown> };
  if (!e?.inventory) return entity;
  const place = (list: unknown, where: string) => (Array.isArray(list) ? list.map((item, i) => ({ ...(item as object), id: `${where} #${i}` })) : list);
  return { ...e, inventory: { ...e.inventory, equipped: place(e.inventory.equipped, 'equipped'), carried: place(e.inventory.carried, 'carried') } };
}

function strip(node: unknown): unknown {
  if (Array.isArray(node)) return node.map(strip);
  if (node && typeof node === 'object') {
    return Object.fromEntries(Object.entries(node).filter(([k]) => !k.startsWith(MARKER) && !k.startsWith('x-future')).map(([k, v]) => [k, strip(v)]));
  }
  return node;
}

run('characters with unknown members saved by the native app (DATA-007)', () => {
  const files = DIR && fs.existsSync(UNKNOWN_DIR) ? fs.readdirSync(UNKNOWN_DIR).filter(f => f.endsWith('.json')).sort() : [];

  it('has files to check', () => {
    expect(files.length).toBeGreaterThanOrEqual(6);
  });

  for (const file of files) {
    it(`${file}: imports, keeps its unknown members, and changes nothing else`, () => {
      const text = fs.readFileSync(path.join(UNKNOWN_DIR, file), 'utf8');
      const native = JSON.parse(text) as { entity: unknown };
      const imported = parsePortableCharacter(text).entity;
      const clean = parsePortableCharacter(fs.readFileSync(path.join(DIR, 'unknown-fields-clean', file), 'utf8')).entity;

      // unknown members change nothing: without them the import equals the import of the clean character. An owned item the file
      // carries without an id is given a fresh one on every import, so those ids are compared by position, not by value.
      expect(withPlacedItemIds(strip(imported))).toEqual(withPlacedItemIds(clean));

      // and every one the native app saved is still on its record after this app's import (derived values are rebuilt, not kept)
      const before = new Map<string, Record<string, unknown>>();
      const after = new Map<string, Record<string, unknown>>();
      const survivors = new Map<string, Record<string, unknown>>();
      records(native.entity, '', before);
      records(imported, '', after);
      records(clean, '', survivors);
      const lost: string[] = [];
      for (const [p, record] of before) {
        if (!(MARKER in record) || p.startsWith('/derived') || p.startsWith('/actionCards')) continue;
        if (!survivors.has(p)) continue;
        if (after.get(p)?.[MARKER] !== record[MARKER]) lost.push(p);
      }
      expect(lost).toEqual([]);
    });
  }
});

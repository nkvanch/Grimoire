// What this repository and its packs may contain is checked against the TEXT of the System Reference Documents, not only
// against ids. An id check passed fifteen spells whose source records carried 2014 wording from other books, because the
// same ids exist in SRD 5.2.1. The SRD text is extracted from the PDFs in third_party/wotc/srd (see the SOURCE.md files
// there) and committed gzipped, so this runs anywhere Jest does.
import { readFileSync, readdirSync, statSync } from 'fs';
import { join, relative } from 'path';
import { gunzipSync } from 'zlib';
import { ALL_VAULT_SPELLS } from '../spells/generated';
import { SPELL_VERSIONS_2024 } from '../spells/spellVersions2024';
import { OFFICIAL_BACKGROUND_CHARACTERISTICS } from '../backgrounds/characteristics';
import { packContentProvider } from '../provider/contentProvider';
import { plainText } from '../plainText';
import type { InstalledPack } from '../provider/contentProvider';

const ROOT = join(__dirname, '../../..');
const srdText = (version: '5.1' | '5.2.1') =>
  gunzipSync(readFileSync(join(ROOT, 'third_party/wotc/srd', version, 'extracted/srd-text.txt.gz'))).toString('utf8');
const SRD = { '5.1': srdText('5.1'), '5.2.1': srdText('5.2.1') };
const loadPack = (file: string) => JSON.parse(readFileSync(join(ROOT, 'assets/packs', file), 'utf8')) as InstalledPack & {
  homebrew: { spells: { id: string; name: string; description: string; upcast: string | null }[] };
};
const PACKS = { '5.1': loadPack('grimoire.srd.5.1.json'), '5.2.1': loadPack('grimoire.srd.5.2.1.json') };

// ── Text helpers ─────────────────────────────────────────────────────────────

/** A heading line as a comparable key: case, punctuation and the PDF's spacing ignored. */
const lineKey = (t: string) => t.normalize('NFKD').toLowerCase().replace(/[’]/g, "'").replace(/[^a-z0-9']+/g, ' ').trim();
const HEADINGS = { '5.1': new Set(SRD['5.1'].split('\n').map(lineKey)), '5.2.1': new Set(SRD['5.2.1'].split('\n').map(lineKey)) };

const words = (t: string) => t.normalize('NFKD').toLowerCase().replace(/[’']/g, '').split(/[^a-z0-9]+/).filter(Boolean);
const PHRASE = 6;
const phrases = (w: string[]) => { const out = new Set<string>(); for (let i = 0; i + PHRASE <= w.length; i++) out.add(w.slice(i, i + PHRASE).join(' ')); return out; };
const SRD_PHRASES = { '5.1': phrases(words(SRD['5.1'])), '5.2.1': phrases(words(SRD['5.2.1'])) };
/** The share of a text's six-word phrases that also occur in an SRD document. */
const overlap = (text: string, version: '5.1' | '5.2.1') => {
  const p = [...phrases(words(plainText(text)))];
  return p.length === 0 ? 1 : p.filter(x => SRD_PHRASES[version].has(x)).length / p.length;
};
/** Whether a sentence occurs in an SRD document, ignoring the PDF's line breaks, spacing and punctuation. */
const flat = (t: string) => t.normalize('NFKD').toLowerCase().replace(/[^a-z0-9]+/g, '');
const SRD_FLAT = { '5.1': flat(SRD['5.1']), '5.2.1': flat(SRD['5.2.1']) };

const spellText = (s: { description: string; upcast: string | null }) => [s.description, s.upcast].filter(Boolean).join('\n');

// ── Spells ───────────────────────────────────────────────────────────────────

describe('spells are SRD text', () => {
  it.each(['5.1', '5.2.1'] as const)('every spell in the SRD %s pack has an entry of that name in SRD %s', version => {
    const missing = PACKS[version].homebrew.spells.filter(s => !HEADINGS[version].has(lineKey(s.name))).map(s => s.name);
    expect(missing).toEqual([]);
  });

  // The 5.1 records are lightly edited SRD text ("The damage increases by 1d10 at 5th level"), so this is not a verbatim
  // check: it catches wording taken from somewhere else, which shares few six-word phrases with the SRD. The floors sit
  // just under the lowest scores the shipped packs have (0.25 and 0.51).
  it.each([['5.1', 0.2], ['5.2.1', 0.45]] as const)('every spell in the SRD %s pack is worded substantially as SRD %s words it', (version, floor) => {
    const low = PACKS[version].homebrew.spells
      .map(s => ({ id: s.id, score: overlap(spellText(s), version) }))
      .filter(r => r.score < floor);
    expect(low).toEqual([]);
  });

  it('every spell in the source library is an SRD 5.1 spell or carries its SRD 5.2.1 wording exactly', () => {
    const offending = ALL_VAULT_SPELLS.filter(s => {
      if (HEADINGS['5.1'].has(lineKey(s.name))) return false;
      const v = (SPELL_VERSIONS_2024 as Record<string, { description: string; upcast: string | null }>)[s.id];
      return !v || s.description !== v.description || (s.upcast ?? null) !== (v.upcast ?? null);
    }).map(s => s.id);
    expect(offending).toEqual([]);
  });

  it('the SRD 5.2.1 versions are SRD 5.2.1 text', () => {
    const low = Object.entries(SPELL_VERSIONS_2024)
      .map(([id, v]) => ({ id, score: overlap(spellText(v), '5.2.1') }))
      .filter(r => r.score < 0.45);
    expect(low).toEqual([]);
  });
});

// ── Links to other sites ─────────────────────────────────────────────────────

/**
 * SRD 5.1 spell records whose text still carries links to the third-party site it was collected from. They are inside the
 * signed SRD 5.1 pack, which only changes when it is rebuilt and re-signed with the project's key
 * (`npx tsx scripts/build-srd-packs.ts`), so the source records keep them until then too; the content provider strips them
 * on the way into the app (content/plainText.ts). Clean these records and re-sign the pack, then empty this list. It can
 * only shrink: a link anywhere else fails.
 */
const LINKED_UNTIL_RESIGNED = new Set([
  'arcane_lock', 'astral_projection', 'awaken', 'clairvoyance', 'contact_other_plane', 'contagion', 'find_steed',
  'find_traps', 'gentle_repose', 'giant_insect', 'imprisonment', 'knock', 'locate_creature', 'modify_memory',
  'nystuls_magic_aura', 'otilukes_resilient_sphere', 'phantom_steed', 'speak_with_plants',
]);
const hasLink = (t: string | null | undefined) => /https?:\/\//.test(t ?? '');

describe('no text links to another site', () => {
  it('no pack or library spell links anywhere, apart from the records waiting for a re-sign', () => {
    const linked = [
      ...PACKS['5.1'].homebrew.spells, ...PACKS['5.2.1'].homebrew.spells, ...ALL_VAULT_SPELLS,
    ].filter(s => hasLink(s.description) || hasLink(s.upcast)).map(s => s.id);
    expect([...new Set(linked)].filter(id => !LINKED_UNTIL_RESIGNED.has(id))).toEqual([]);
  });

  it('a player never sees link syntax: spells reach the app as plain text', () => {
    const provider = packContentProvider([PACKS['5.1'], PACKS['5.2.1']]);
    for (const ruleset of ['dnd5e-2014', 'dnd5e-2024'] as const) {
      const shown = provider.spells(ruleset as never).filter(s => hasLink(s.description) || hasLink(s.upcast) || /\]\(/.test(s.description ?? ''));
      expect(shown.map(s => s.id)).toEqual([]);
    }
    const knock = provider.getSpell('knock', 'dnd5e-2014' as never)!;
    expect(knock.description).toContain('arcane lock');
    expect(knock.description).not.toMatch(/aidedd|\[|\]|_arcane/);
  });
});

// ── Backgrounds ──────────────────────────────────────────────────────────────

describe('background characteristics are SRD text', () => {
  it('the official tables are SRD 5.1 text word for word', () => {
    const notInSrd = Object.values(OFFICIAL_BACKGROUND_CHARACTERISTICS)
      .flatMap(c => [...c.traits, ...c.ideals, ...c.bonds, ...c.flaws])
      .filter(line => !SRD_FLAT['5.1'].includes(flat(line)));
    expect(notInSrd).toEqual([]);
  });

  it('only backgrounds SRD 5.1 has get an official table', () => {
    for (const id of Object.keys(OFFICIAL_BACKGROUND_CHARACTERISTICS)) {
      expect(HEADINGS['5.1'].has(lineKey(id.replace(/_/g, ' ')))).toBe(true);
    }
  });

  // The features of the twelve 2014 backgrounds that are not in SRD 5.1 (only the Acolyte is). Their names, traits and
  // flaws used to sit in the creation screen and shipped in the web build.
  const NON_SRD_BACKGROUND_FEATURES = [
    'False Identity', 'Criminal Contact', 'By Popular Demand', 'Rustic Hospitality', 'Guild Membership',
    'Position of Privilege', "Ship's Passage", 'Military Rank', 'City Secrets',
  ];
  it('no source file names a non-SRD background feature', () => {
    const self = relative(ROOT, __filename);
    const hits: string[] = [];
    const walk = (dir: string) => {
      for (const name of readdirSync(dir)) {
        const path = join(dir, name);
        if (statSync(path).isDirectory()) { if (name !== 'node_modules') walk(path); continue; }
        if (!/\.(ts|tsx|json)$/.test(name) || relative(ROOT, path) === self) continue;
        const text = readFileSync(path, 'utf8');
        for (const f of NON_SRD_BACKGROUND_FEATURES) if (text.includes(f)) hits.push(`${relative(ROOT, path)}: ${f}`);
      }
    };
    walk(join(ROOT, 'app'));
    walk(join(ROOT, 'src'));
    expect(hits).toEqual([]);
    // The SRD itself has none of them, so finding one here would mean the scan is wrong, not the source.
    expect(NON_SRD_BACKGROUND_FEATURES.filter(f => HEADINGS['5.1'].has(lineKey(`Feature: ${f}`)))).toEqual([]);
  });
});

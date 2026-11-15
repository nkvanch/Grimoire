import { BUNDLED_PACKS, withDependencies, installBundledPacks, refreshBundledPacks } from '../bundledPacks';
import { buildSrd51Pack, buildSrd521Pack, serializePack } from '../packs/srdPacks';
import { PackStore, installedOfficialPacks, resetOfficialPackService, bootOfficialPacks } from '../officialPackService';
import { clearOfficialPacks } from '../officialPacks';
import { globalContentDB } from '../classes/library';
import { rulesetHasContent } from '../../components/MissingRulesetContentBanner';
import { editionLabel } from '../../components/EditionBadge';
import { isNonSrd } from '../../components/NonSrdBadge';
import { RulesetId } from '../../engine/types';
import { verifyPackSignature } from '../packSigning';
import { packHashInput } from '../../engine/contentPackManifest';
import { sha256Hex } from '../../engine/sha256';

const R2024 = 'dnd5e-2024' as RulesetId;
const R2014 = 'dnd5e-2014' as RulesetId;

function memoryStore(): PackStore & { rows: Map<string, unknown> } {
  const rows = new Map<string, unknown>();
  return { rows, save: async (id, _v, pack) => { rows.set(id, pack); }, load: async () => [], remove: async id => { rows.delete(id); } };
}
beforeEach(() => { resetOfficialPackService(); clearOfficialPacks(); });
afterAll(() => { resetOfficialPackService(); clearOfficialPacks(); });

describe('the SRD packs bundled with the app', () => {
  it('are exactly what the pack builder produces now (a stale bundle fails here; rebuild with scripts/build-srd-packs.ts)', () => {
    const built = { 'grimoire.srd.5.1': buildSrd51Pack(), 'grimoire.srd.5.2.1': buildSrd521Pack() };
    for (const b of BUNDLED_PACKS) {
      const file = b.load() as { manifest: { contentHash: string; version: string; signature?: unknown } };
      expect(file.manifest.contentHash).toBe(built[b.id as keyof typeof built].manifest.contentHash);
      // The shipped file is the built pack plus the signature the build added; the signature must verify against a key the app trusts.
      const { signature: _signature, ...manifest } = file.manifest;
      void _signature;
      expect(JSON.stringify({ ...file, manifest })).toBe(serializePack(built[b.id as keyof typeof built]));
      expect(verifyPackSignature(file as never).status).toBe('valid');
    }
  });

  it('asking for SRD 5.2.1 brings SRD 5.1 first', () => {
    expect(withDependencies(['grimoire.srd.5.2.1'])).toEqual(['grimoire.srd.5.1', 'grimoire.srd.5.2.1']);
    expect(withDependencies(['grimoire.srd.5.1'])).toEqual(['grimoire.srd.5.1']);
    expect(withDependencies(['nope'])).toEqual([]);
  });

  it('install in one step, skip what is already installed, and report a problem instead of throwing', async () => {
    const store = memoryStore();
    expect(await installBundledPacks(['grimoire.srd.5.2.1'], store)).toEqual({ ok: true });
    expect(installedOfficialPacks().map(p => p.manifest.id)).toEqual(['grimoire.srd.5.1', 'grimoire.srd.5.2.1']);
    expect([...store.rows.keys()]).toEqual(['grimoire.srd.5.1', 'grimoire.srd.5.2.1']);
    expect(await installBundledPacks(['grimoire.srd.5.1', 'grimoire.srd.5.2.1'], store)).toEqual({ ok: true });   // nothing to do
    const failing: PackStore = { ...store, save: async () => { throw new Error('disk full'); } };
    resetOfficialPackService(); clearOfficialPacks();
    const result = await installBundledPacks(['grimoire.srd.5.1'], failing);
    expect(result.ok).toBe(false);
    expect(result.ok ? '' : result.problems.join(' ')).toMatch(/SRD 5\.1 could not be installed.*disk full/);
  });
});

describe('an installed bundled pack is brought up to the copy this app ships', () => {
  // Found 2026-11-11: a phone that installed SRD 5.1 on its first run kept that copy for good, so new class picks and texts in an
  // updated app never reached it (the pack keeps its id and version, and boot reads the stored copy).
  const bundled51 = () => BUNDLED_PACKS.find(p => p.id === 'grimoire.srd.5.1')!.load() as { manifest: { contentHash: string } };

  it('replaces a stored copy whose content differs, and leaves alone what is current or not installed', async () => {
    // an older build of the same pack: one text differs, its hash says so (the stored copy is not re-checked for a signature at boot)
    const older = JSON.parse(JSON.stringify(bundled51())) as { homebrew: { backgrounds: { features: { description: string }[] }[] }; manifest: { contentHash: string } };
    older.homebrew.backgrounds[0].features[1].description = 'An older text.';
    const oldHash = sha256Hex(packHashInput(older as never));
    const old = { ...older, manifest: { ...older.manifest, contentHash: oldHash } };
    const store = memoryStore();
    const stored: PackStore = { ...store, load: async () => [{ id: 'grimoire.srd.5.1', version: '1.0.0', pack: old }] as never };
    expect((await bootOfficialPacks(stored)).ok).toBe(true);
    expect(installedOfficialPacks()[0].manifest.contentHash).toBe(oldHash);

    expect(await refreshBundledPacks(stored)).toEqual({ ok: true, refreshed: ['grimoire.srd.5.1'] });
    expect(installedOfficialPacks().map(p => p.manifest.contentHash)).toEqual([bundled51().manifest.contentHash]);
    expect((store.rows.get('grimoire.srd.5.1') as { manifest: { contentHash: string } }).manifest.contentHash).toBe(bundled51().manifest.contentHash);

    // now current; SRD 5.2.1 was never installed and is not installed by this
    expect(await refreshBundledPacks(stored)).toEqual({ ok: true, refreshed: [] });
    expect(installedOfficialPacks().map(p => p.manifest.id)).toEqual(['grimoire.srd.5.1']);
  });
});

describe('5.5e content availability and edition labels', () => {
  it('a 5.5e character has no 5.5e content until the SRD 5.2.1 pack is installed (an SRD-only build starts with 5e content only)', async () => {
    const store = memoryStore();
    expect(await installBundledPacks(['grimoire.srd.5.1'], store)).toEqual({ ok: true });   // 5e content only, as the SRD-only catalog is
    expect(rulesetHasContent(R2014)).toBe(true);
    expect(rulesetHasContent(R2024)).toBe(false);
    expect(rulesetHasContent(undefined)).toBe(true);
    expect(await installBundledPacks(['grimoire.srd.5.2.1'], store)).toEqual({ ok: true });
    expect(rulesetHasContent(R2024)).toBe(true);
    expect(globalContentDB.classes.filter(c => c.rulesetId === R2024)).toHaveLength(12);
  });

  it('classes say which edition they are from', () => {
    expect(editionLabel({ rulesetId: R2024 }, true)).toBe('5.5e · 2024');
    expect(editionLabel({ rulesetId: R2014 }, true)).toBe('5e · 2014');
    expect(editionLabel({}, true)).toBe('5e · 2014');        // official content with no tag is the original 5e
    expect(editionLabel({}, false)).toBeUndefined();         // homebrew with no tag works in every edition
  });

  it('2024 content is not flagged Non-SRD (it is the SRD 5.2.1), while untagged unaudited content still is', () => {
    expect(isNonSrd(false, 'dnd5e-2024')).toBe(false);
    expect(isNonSrd(false)).toBe(true);
    expect(isNonSrd(true)).toBe(false);
  });
});

import { buildSrd51Pack, buildSrd521Pack, canonicalJson, sha256, serializePack, SRD_5_1_PACK_ID, SRD_5_2_1_PACK_ID } from '../srdPacks';
import { validateManifest, compareVersions } from '../../../engine/contentPackManifest';
import { validateGrimoirePack, validatePackContents } from '../../../engine/backup';

const a = buildSrd51Pack();
const b = buildSrd521Pack();
const all = (p: typeof a) => Object.values(p.homebrew ?? {}).flat() as { id: string; name?: string; provenance?: { kind: string; family?: string } }[];

describe('first-party SRD packs', () => {
  it('have valid manifests with explicit licence, attribution and first-party flag', () => {
    expect(validateManifest(a.manifest)).toEqual([]);
    expect(validateManifest(b.manifest)).toEqual([]);
    expect(a.manifest).toMatchObject({ id: SRD_5_1_PACK_ID, ruleset: 'dnd5e-2014', sourceFamily: 'SRD_5_1', license: 'CC-BY-4.0', officialFirstPartyPack: true });
    expect(b.manifest).toMatchObject({ id: SRD_5_2_1_PACK_ID, ruleset: 'dnd5e-2024', sourceFamily: 'SRD_5_2_1', license: 'CC-BY-4.0', officialFirstPartyPack: true });
    expect(a.manifest.attribution).toMatch(/System Reference Document 5\.1/);
    expect(b.manifest.attribution).toMatch(/dndbeyond\.com\/srd/);
    expect(b.manifest.dependencies.map(d => d.id)).toEqual([SRD_5_1_PACK_ID]);
    expect(a.manifest.dependencies).toEqual([]);
  });

  it('every record carries provenance naming the SRD family of its pack', () => {
    for (const r of all(a)) expect(r.provenance).toMatchObject({ kind: 'srd', family: '5.1' });
    for (const r of all(b)) expect(r.provenance).toMatchObject({ kind: 'srd', family: '5.2.1' });
    expect(all(a).length).toBeGreaterThan(700);
  });

  it('hold the expected content', () => {
    expect(a.manifest.counts).toMatchObject({ spells: 319, monsters: 322 });
    expect(a.manifest.counts.classes).toBeGreaterThanOrEqual(12);
    expect(b.manifest.counts).toMatchObject({ classes: 12, subclasses: 12, spells: 339, feats: 19 });
    expect(b.manifest.counts.races).toBe(9);
    expect(b.manifest.counts.items).toBe(427);   // the 5.5e equipment (tools, gear, armor, mounts, vehicles, firearms), 258 magic item entries, and the shared weapons and armor
    expect(b.manifest.counts.backgrounds).toBe(4);
  });

  it('keep the editions apart: the 5.1 pack has no 2024 content, the 5.2.1 pack has no 2014 records', () => {
    expect(all(a).some(r => r.id.endsWith('_2024'))).toBe(false);
    for (const s of (a.homebrew!.spells as { classes?: string[] }[])) expect((s.classes ?? []).some(c => c.endsWith('_2024'))).toBe(false);
    for (const c of b.homebrew!.classes as { id: string }[]) expect(c.id).toMatch(/_2024$/);
    const text = (b.homebrew!.spells as { id: string; school: string }[]).find(s => s.id === 'acid_splash')!;
    expect(text.school).toBe('Evocation');
    expect((a.homebrew!.spells as { id: string; school: string }[]).find(s => s.id === 'acid_splash')!.school).toBe('Conjuration');
  });

  it('can never carry private or non-SRD content', () => {
    const ids = new Set([...all(a), ...all(b)].map(r => r.id));
    const text = serializePack(a) + serializePack(b);
    for (const r of a.homebrew!.classes as { srd?: boolean }[]) expect(r.srd).toBe(true);
    for (const r of a.homebrew!.items as { srd?: boolean }[]) expect(r.srd).not.toBe(false);
  });

  it('are self-describing JSON: no functions, round-trip unchanged, and the hash is stable and verifies the content', () => {
    for (const p of [a, b]) {
      const round = JSON.parse(serializePack(p));
      expect(canonicalJson(round.homebrew)).toBe(canonicalJson(p.homebrew));
      expect(sha256(canonicalJson({ homebrew: round.homebrew, rules: round.rules ?? null }))).toBe(p.manifest.contentHash);
    }
    expect(buildSrd51Pack().manifest.contentHash).toBe(a.manifest.contentHash);
    expect(buildSrd521Pack().manifest.contentHash).toBe(b.manifest.contentHash);
    expect(a.manifest.contentHash).not.toBe(b.manifest.contentHash);
  });

  it('the 5.2.1 pack carries its rules tables with provenance (Weapon Mastery and the class spell lists)', () => {
    const rules = b.rules as { weaponMastery: { weapons: unknown[]; properties: object; provenance: { family: string } }; spellLists: { byClass: Record<string, unknown> } };
    expect(rules.weaponMastery.weapons).toHaveLength(38);
    expect(Object.keys(rules.weaponMastery.properties)).toHaveLength(8);
    expect(rules.weaponMastery.provenance.family).toBe('5.2.1');
    expect(Object.keys(rules.spellLists.byClass).sort()).toEqual(['bard', 'cleric', 'druid', 'paladin', 'ranger', 'sorcerer', 'warlock', 'wizard']);
  });

  it('record ids are unique within each pack per type, so installing never duplicates', () => {
    for (const p of [a, b]) {
      for (const [cat, records] of Object.entries(p.homebrew ?? {})) {
        const ids = (records as { id: string }[]).map(r => r.id);
        expect([cat, ids.length - new Set(ids).size]).toEqual([cat, 0]);
      }
    }
  });

  it('versions compare semantically', () => {
    expect(compareVersions('1.0.1', '1.0.0')).toBeGreaterThan(0);
    expect(compareVersions('1.2.0', '1.10.0')).toBeLessThan(0);
    expect(compareVersions('1.0.0', '1.0.0')).toBe(0);
  });

  it('pass the same envelope and content validation every imported pack goes through', () => {
    for (const p of [a, b]) {
      expect(validateGrimoirePack(JSON.parse(serializePack(p)))).toBeNull();
      const problems = validatePackContents(JSON.parse(serializePack(p)));
      expect(problems.slice(0, 8)).toEqual([]);
    }
  });
});

// A character made from the 5.1 pack alone (the desktop app's first run) gets only what the pack's records say: nothing a
// creation screen adds from a table of its own reaches it.
describe('the 5.1 pack stands on its own for a new character', () => {
  type Entry = { level: number; grants: { kind: string; value: unknown }[]; choices: { kind: string; pool?: unknown }[] };
  const classes = a.homebrew!.classes as unknown as { id: string; rawProgression: { entries: Entry[] } }[];
  const items = new Set((a.homebrew!.items as { id: string }[]).map(i => i.id));
  const fixedOf = (id: string) => classes.find(c => c.id === id)!.rawProgression.entries.find(e => e.level === 1)!
    .grants.filter(g => g.kind === 'starting_item').map(g => String(g.value));

  it('describes every item its classes start with, chosen or fixed', () => {
    const named = new Set<string>();
    for (const c of classes) for (const e of c.rawProgression.entries) {
      for (const g of e.grants) if (g.kind === 'starting_item') named.add(String(g.value));
      for (const ch of e.choices) if (ch.kind === 'equipment' && Array.isArray(ch.pool)) {
        for (const o of ch.pool as { value?: unknown }[]) if (Array.isArray(o.value)) for (const v of o.value) named.add(String(v).replace(/\*\d+$/, ''));
      }
    }
    expect(named.size).toBeGreaterThan(30);
    expect([...named].filter(id => !items.has(id)).sort()).toEqual([]);
  });

  it('gives each class the gear the SRD gives it with no choice', () => {
    expect(fixedOf('fighter')).toEqual([]);   // every line of the fighter's equipment is a choice
    expect(fixedOf('wizard')).toEqual(['spellbook']);
    expect(fixedOf('barbarian')).toEqual(['explorers_pack', 'javelin', 'javelin', 'javelin', 'javelin']);
    expect(fixedOf('bard')).toEqual(['leather_armor', 'dagger']);
    expect(fixedOf('cleric')).toEqual(['shield', 'holy_symbol']);
    expect(fixedOf('druid')).toEqual(['leather_armor', 'explorers_pack', 'druidic_focus']);
    expect(fixedOf('monk')).toEqual(Array(10).fill('dart'));
    expect(fixedOf('paladin')).toEqual(['chain_mail', 'holy_symbol']);
    expect(fixedOf('ranger')).toEqual(['longbow', 'arrows_20']);
    expect(fixedOf('rogue')).toEqual(['leather_armor', 'dagger', 'dagger', 'thieves_tools']);
    expect(fixedOf('sorcerer')).toEqual(['dagger', 'dagger']);
    expect(fixedOf('warlock')).toEqual(['leather_armor', 'dagger', 'dagger']);
  });

  it('every race names the languages its members speak, and each is a language the app knows', () => {
    const { ALL_LANGUAGES } = require('../../languages');
    const known = new Set((ALL_LANGUAGES as { name: string }[]).map(l => l.name));
    const races = a.homebrew!.races as unknown as { id: string; languages?: string[] }[];
    expect(Object.fromEntries(races.map(r => [r.id, r.languages]))).toEqual({
      human: ['Common'], elf: ['Common', 'Elvish'], dwarf: ['Common', 'Dwarvish'], halfling: ['Common', 'Halfling'],
      dragonborn: ['Common', 'Draconic'], gnome: ['Common', 'Gnomish'], half_elf: ['Common', 'Elvish'], half_orc: ['Common', 'Orc'],
      tiefling: ['Common', 'Infernal'],
    });
    for (const r of races) for (const l of r.languages ?? []) expect(known.has(l)).toBe(true);
  });

  it('the races and the background that give a language of the player\'s choice ask for it', () => {
    type Choice = { id: string; kind: string; count: number };
    const races = a.homebrew!.races as unknown as { id: string; pendingChoices?: Choice[] }[];
    const asked = (id: string) => (races.find(r => r.id === id)!.pendingChoices ?? []).filter(c => c.kind === 'language').map(c => c.count);
    expect(asked('human')).toEqual([1]);
    expect(asked('half_elf')).toEqual([1]);
    const acolyte = (a.homebrew!.backgrounds as unknown as { id: string; pendingChoices?: Choice[] }[]).find(b => b.id === 'acolyte')!;
    expect((acolyte.pendingChoices ?? []).filter(c => c.kind === 'language')).toMatchObject([{ id: 'background_choice_acolyte_languages', count: 2 }]);
  });
});

describe('pack content does not depend on the build environment', () => {
  it('Magic Initiate offers the 2024 class lists, and the 5.2.1 pack is the same whether or not the SRD-only filter is on', () => {
    const { SPELL_LIST_2024 } = require('../../classes2024/spellLists2024');
    const feats = b.homebrew!.feats as { id: string; pendingChoices?: { id: string; pool: { label: string }[] }[] }[];
    for (const key of ['cleric', 'druid', 'wizard'] as const) {
      const feat = feats.find(f => f.id === `magic_initiate_${key}_2024`)!;
      const offered = feat.pendingChoices!.find(c => c.id.endsWith('cantrips'))!.pool.length;
      expect(offered).toBe(SPELL_LIST_2024[key][0].length);
    }
  });
});

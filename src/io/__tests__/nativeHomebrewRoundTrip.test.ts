// The native (C++) desktop app exports a homebrew package; this app's real pack code reads it. It does nothing in a normal run; the
// desktop project's test run writes the file:
//   GRIMOIRE_NATIVE_ROUNDTRIP_DIR=D:/path/build-ui/roundtrip-out npx jest src/io/__tests__/nativeHomebrewRoundTrip
import * as fs from 'fs';
import * as path from 'path';
import { validateGrimoirePack, validatePackContents } from '../../engine/backup';
import { validateFeat, validateItem, validateSpell } from '../../engine/homebrewValidator';
import { compileItemFields, type ItemDraft } from '../../content/homebrewCompile';
import { buildItemCases } from '../../engine/__tests__/parityHomebrewScenarios';
import type { Feat, Item, Spell } from '../../engine/types';

const DIR = process.env.GRIMOIRE_NATIVE_ROUNDTRIP_DIR;
const run = DIR ? describe : describe.skip;

run('a homebrew package written by the native app', () => {
  const file = DIR ? path.join(DIR, 'homebrew', 'desktop-homebrew.grimoire-pack') : '';
  const pack = () => JSON.parse(fs.readFileSync(file, 'utf8'));

  it('has the envelope the phone app accepts', () => {
    expect(validateGrimoirePack(pack())).toBeNull();
    expect(pack().packType).toBe('content-pack');
    expect(pack().name).toBe('Desktop homebrew');
  });

  it('every record passes the phone app\'s own content checks', () => {
    expect(validatePackContents(pack())).toEqual([]);
  });

  it('keeps every record it was given, with the manifest listing them', () => {
    const p = pack();
    const counted = ['feats', 'spells', 'items', 'races', 'backgrounds'].reduce((n, k) => n + (p.homebrew[k]?.length ?? 0), 0);
    expect(counted).toBe(9);
    expect(p.contents).toHaveLength(9);
    expect(p.contents.every((c: { type: string; id: string }) => c.type && c.id)).toBe(true);
  });

  it('feats, spells and items validate individually', () => {
    const p = pack();
    for (const f of p.homebrew.feats as Feat[]) expect(validateFeat(f).errors).toEqual([]);
    for (const s of p.homebrew.spells as Spell[]) expect(validateSpell(s).errors).toEqual([]);
    for (const i of p.homebrew.items as Item[]) expect(validateItem(i).errors).toEqual([]);
  });

  it('an item compiled natively equals the one this app compiles from the same draft', () => {
    const p = pack();
    const c = buildItemCases().find(x => x.name === 'armor-medium')!;
    const mine = JSON.parse(JSON.stringify(compileItemFields(c.draft as ItemDraft, c.id)));
    const theirs = (p.homebrew.items as Item[]).find(i => i.id === c.id);
    // the local id of a draft trait is generated per session
    for (const it of [mine, theirs] as { homebrewDraft: { trait: { localId?: string } } }[]) delete it.homebrewDraft.trait.localId;
    expect(theirs).toEqual(mine);
  });
});

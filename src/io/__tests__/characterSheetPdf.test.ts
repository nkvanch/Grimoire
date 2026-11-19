// The printable character sheet: one model, three looks, two pages. Checked on a wizard and a fighter made from the SRD pack.
import * as fs from 'fs';
import { buildSrd51Pack } from '../../content/packs/srdPacks';
import { packContentProvider, InstalledPack } from '../../content/provider/contentProvider';
import { createCharacter } from '../../content/provider/createCharacter';
import { DEFAULT_RULES } from '../../engine/defaults';
import { recomputeDerived } from '../../engine/pipeline';
import type { Entity, RulesetId } from '../../engine/types';
import { buildCharacterSheetHtml, buildSheetModel, SHEET_THEMES, DEFAULT_SHEET_THEME, isSheetTheme, type SheetLookup } from '../characterSheetPdf';

const pack = JSON.parse(JSON.stringify(buildSrd51Pack())) as InstalledPack;
const provider = packContentProvider([pack], 'dnd5e-2014' as RulesetId);
const STATS = { str: 8, dex: 14, con: 14, int: 16, wis: 12, cha: 10 };
const make = (classId: string, level: number, name: string): Entity =>
  createCharacter(provider, { id: classId, name, classId, raceId: 'human', backgroundId: 'acolyte', stats: STATS, level }, DEFAULT_RULES);

const resolveName = (kind: string, id: string): string =>
  (kind === 'spell' ? provider.getSpell(id)?.name : kind === 'item' ? provider.getItem(id)?.name : kind === 'race' ? provider.getRace(id)?.name
    : kind === 'class' ? provider.getClass(id)?.name : provider.getBackground(id)?.name) ?? id;
const lookup: SheetLookup = { spell: id => provider.getSpell(id), item: id => provider.getItem(id) };

/** A level 5 wizard with a spellbook, two prepared spells and a few things carried. */
function wizard(): Entity {
  const made = make('wizard', 5, 'Mirela <Voss> & Co');
  const carried = ['quarterstaff', 'dagger', 'spellbook'].filter(id => provider.getItem(id)).map(itemId => ({ id: `inst-${itemId}`, itemId, quantity: itemId === 'dagger' ? 2 : 1 }));
  const derived = recomputeDerived({
    ...made,
    inventory: { ...made.inventory, carried: carried as never, currency: { ...made.inventory.currency, gp: 15 } },
    notes: 'Owes the ferryman a favour.',
  }, DEFAULT_RULES);
  // set after the numbers are worked out: the sheet prints the spell lists as the character holds them
  return { ...derived, spellcasting: { ...derived.spellcasting!, cantrips: ['firebolt', 'light'], known: ['magic_missile', 'shield', 'detect_magic', 'fireball', 'not_in_any_pack'], prepared: ['magic_missile', 'fireball'] } };
}

describe('the sheet model', () => {
  const m = buildSheetModel(wizard(), resolveName, lookup);

  it('has six abilities with effective scores, eighteen skills, and what the app derived', () => {
    expect(m.abilities.map(a => a.key)).toEqual(['STR', 'DEX', 'CON', 'INT', 'WIS', 'CHA']);
    expect(m.abilities.find(a => a.key === 'INT')).toMatchObject({ saveProf: true });
    expect(m.abilities.find(a => a.key === 'STR')!.mod).toBe('−1');   // a real minus sign, 8 or 9 either way
    expect(m.skills).toHaveLength(18);
    expect(m.hpMax).toBeGreaterThan(0);
    expect(m.hitDice).toBe('5d6');
  });

  it('groups spells by level with the slots to tick, marks what is prepared, and never drops a spell it cannot look up', () => {
    const levels = m.casting!.levels;
    expect(levels.map(l => l.label)).toEqual(['Cantrips', '1st level', '2nd level', '3rd level', 'Spells']);
    expect(levels[1].slots).toBe(4);
    const first = levels[1].spells;
    expect(first.map(s => s.name)).toEqual(['Detect Magic', 'Magic Missile', 'Shield']);
    expect(first.map(s => s.prepared)).toEqual([false, true, false]);
    expect(first[0].note).toMatch(/ritual/);
    expect(levels[0].spells.every(s => s.prepared)).toBe(true);            // a cantrip is always ready
    expect(levels[4].spells.map(s => s.name)).toEqual(['not_in_any_pack']);
  });

  it('lists what is carried, with weights when they are known', () => {
    expect(m.items.find(i => i.name === 'Dagger')).toMatchObject({ qty: 2, weight: '2 lb' });
    expect(m.carried).toMatch(/lb$/);
    expect(buildSheetModel(wizard(), resolveName as never).items.every(i => i.weight === '')).toBe(true);   // no lookup: still listed
    expect(m.coins.find(c => c.label === 'GP')!.value).toBe(15);
  });
});

describe('the fonts a sheet carries', () => {
  it('each look embeds the fonts its stylesheet names first, built from the files in assets/fonts/sheet', () => {
    const expected: Record<string, string[]> = { illuminated: ['Cormorant Garamond', 'EB Garamond'], astrolabe: ['Outfit', 'JetBrains Mono'], ledger: ['Inter', 'Space Grotesk'] };
    for (const { id } of SHEET_THEMES) {
      const html = buildCharacterSheetHtml(make('fighter', 1, 'Brakka'), resolveName, { theme: id });
      for (const family of expected[id]) expect(html).toContain(`@font-face{font-family:'${family}'`);
    }
    // the generated module is in step with the font file it was built from
    const bytes = fs.readFileSync(`${__dirname}/../../../assets/fonts/sheet/Outfit-var.woff2`).toString('base64');
    expect(buildCharacterSheetHtml(make('fighter', 1, 'Brakka'), resolveName as never, { theme: 'astrolabe' })).toContain(bytes);
  });
});

describe('the sheet HTML', () => {
  it.each(SHEET_THEMES.map(t => t.id))('prints both pages in the %s look', theme => {
    const html = buildCharacterSheetHtml(wizard(), resolveName, { theme, lookup });
    expect(html).toContain(`class="t-${theme}"`);
    expect(html).toContain('class="p1"');
    expect(html).toContain('class="p2"');
    expect(html).toContain('Spells and Gear');
    expect(html.match(/class="row"><i class="mark/g)!.length).toBe(6 + 18);        // saving throws and skills
    expect(html).toContain('Owes the ferryman a favour.');
    expect(html.slice(html.indexOf('<body'))).not.toMatch(/undefined|NaN|\[object/);   // the page itself, not the font data before it
    if (process.env.SHEET_SAMPLE_DIR) fs.writeFileSync(`${process.env.SHEET_SAMPLE_DIR}/sheet-${theme}.html`, html);
  });

  it('escapes what the person typed', () => {
    const html = buildCharacterSheetHtml(wizard(), resolveName);
    expect(html).toContain('irela &lt;Voss&gt; &amp; Co');
    expect(html).not.toContain('<Voss>');
  });

  it('prints numbers as numbers even when an imported character carries text in their place', () => {
    const bad = '<img src=x onerror=alert(1)>';
    const w = wizard();
    const hostile = {
      ...w,
      stats: { ...w.stats, str: bad },
      identity: { ...w.identity, level: bad, xp: bad },
      derived: { ...w.derived, ac: bad, initiative: bad, passivePerception: bad, proficiencyBonus: bad, spellSaveDC: bad, spellAttackBonus: bad,
        attackBonuses: [{ id: 'x', name: bad, bonus: bad, type: bad, ability: 'str', damageBonus: bad, damageDice: bad, damageType: bad }] },
      resources: { ...w.resources, hp: { ...w.resources.hp, maximum: bad }, hitDice: { ...w.resources.hitDice, total: bad, die: bad } },
      inventory: { ...w.inventory, carried: w.inventory.carried.map(i => ({ ...i, quantity: bad })), currency: { cp: bad, sp: bad, ep: bad, gp: bad, pp: bad } },
      spellcasting: { ...w.spellcasting!, slots: { ...w.spellcasting!.slots, '1': { total: bad, used: 0 } } },
    } as unknown as Entity;
    for (const { id } of SHEET_THEMES) {
      const html = buildCharacterSheetHtml(hostile, resolveName, { theme: id, lookup });
      expect(html).not.toContain('<img');
      expect(html).not.toContain('onerror=alert(1)>');
    }
  });

  it('uses the default look for a look it does not know, and prints a character with no spells', () => {
    expect(isSheetTheme('neon')).toBe(false);
    const html = buildCharacterSheetHtml(make('fighter', 3, 'Brakka'), resolveName, { theme: 'neon' as never });
    expect(html).toContain(`class="t-${DEFAULT_SHEET_THEME}"`);
    expect(html).toContain('Gear and Notes');
    expect(html).not.toContain('Spellcasting');
  });

  it('cuts page 1 to what fits and says where the rest is', () => {
    const base = make('fighter', 3, 'Brakka');
    const many = { ...base, features: Array.from({ length: 9 }, (_, i) => ({ ...base.features[0], id: `f${i}`, name: `Feature ${i}`, description: 'word '.repeat(60), passive: true })) } as Entity;
    const html = buildCharacterSheetHtml(many, resolveName);
    const page1 = html.slice(html.indexOf('class="p1"'), html.indexOf('class="p2"'));
    expect(page1).toContain('Feature 4');
    expect(page1).not.toContain('Feature 5');
    expect(page1).toContain('In full on page 2.');
    expect(html.slice(html.indexOf('class="p2"'))).toContain('Feature 8');
  });
});

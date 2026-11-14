// src/io/characterSheetPdf.ts
// Exports a character to a printable two-page PDF for paper use at a table, in one of three looks (Illuminated, Astrolabe, Ledger).
//
// Approach: one plain model of the character (buildSheetModel), one HTML structure, and one stylesheet per look. The HTML is printed at
// US Letter by expo-print (or the desktop bridge) and handed to the share sheet, the same "generate then share" pattern as backupIO.ts.
//
// Page 1 is a fixed one-page layout: long lists are cut to what fits and say so. Page 2 flows onto further pages when a character has
// many spells, items or features. Current and temporary hit points, spell slots and death saves are left blank to be written on.
//
// Ability scores, saves and skills use the EFFECTIVE scores (applyStatModifiers): entity.stats holds only the base scores.
//
// Fonts: each look carries its own fonts inside the HTML (sheetFonts.generated.ts, built by scripts/build-sheet-fonts.mjs from
// assets/fonts/sheet), since the sheet is printed with no network. They are Latin subsets: other scripts fall back to the device's fonts.

import { desktopBridge } from '../platform/desktop';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { Entity } from '../engine/types';
import { applyStatModifiers, collectAllEffects } from '../engine/pipeline';
import { SHEET_FONT_CSS } from './sheetFonts.generated';

export type SheetTheme = 'illuminated' | 'astrolabe' | 'ledger';
export const DEFAULT_SHEET_THEME: SheetTheme = 'illuminated';
export const SHEET_THEMES: { id: SheetTheme; label: string; hint: string }[] = [
  { id: 'illuminated', label: 'Illuminated', hint: 'Serif type and double rules, like a manuscript' },
  { id: 'astrolabe',   label: 'Astrolabe',   hint: 'Rings and gauges in indigo ink' },
  { id: 'ledger',      label: 'Ledger',      hint: 'Plain and modern, the least ink' },
];
export const isSheetTheme = (v: unknown): v is SheetTheme => SHEET_THEMES.some(t => t.id === v);

type ResolveName = (kind: 'spell' | 'item' | 'race' | 'class' | 'background', id: string) => string;
/** Optional detail lookups. Without them the sheet still prints: spells are listed by name only and items without weights. */
export type SheetLookup = {
  spell?: (id: string) => { level?: number; school?: string; castingTime?: string; range?: string; components?: string[]; duration?: string; ritual?: boolean; concentration?: boolean } | undefined;
  item?:  (id: string) => { weight?: number } | undefined;
};
export type SheetOptions = { theme?: SheetTheme; lookup?: SheetLookup };

// ── Small formatting helpers ────────────────────────────────────────────────

/** A number, whatever the field holds: a character can come from an imported file, and what prints as a number must be one. */
const num = (v: unknown, fallback = 0): number => { const n = typeof v === 'number' ? v : Number(v); return Number.isFinite(n) ? n : fallback; };
const signed = (n: number): string => (n >= 0 ? `+${n}` : `−${Math.abs(n)}`);
const modOf = (score: number): number => Math.floor((score - 10) / 2);

function esc(s: string | number | null | undefined): string {
  if (s === null || s === undefined) return '';
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
const words = (id: string): string => id.split('_').filter(Boolean).map(w => w[0].toUpperCase() + w.slice(1)).join(' ');
const ordinal = (n: number): string => `${n}${n === 1 ? 'st' : n === 2 ? 'nd' : n === 3 ? 'rd' : 'th'}`;
/** The first `max` characters, cut at a word, with an ellipsis when something was left out. */
function clip(text: string, max: number): string {
  const t = text.replace(/\s+/g, ' ').trim();
  if (t.length <= max) return t;
  const cut = t.slice(0, max);
  return `${cut.slice(0, Math.max(cut.lastIndexOf(' '), max - 20)).replace(/[ ,;:.]+$/, '')}…`;
}

const ABILITY_LABELS: Record<string, string> = {
  str: 'Strength', dex: 'Dexterity', con: 'Constitution', int: 'Intelligence', wis: 'Wisdom', cha: 'Charisma',
};
const ABILITY_ORDER = ['str', 'dex', 'con', 'int', 'wis', 'cha'] as const;

// Standard 5e skill → governing ability map (fixed by the rules, not per-character).
const SKILL_ABILITY: Record<string, string> = {
  acrobatics: 'dex', animal_handling: 'wis', arcana: 'int', athletics: 'str',
  deception: 'cha', history: 'int', insight: 'wis', intimidation: 'cha',
  investigation: 'int', medicine: 'wis', nature: 'int', perception: 'wis',
  performance: 'cha', persuasion: 'cha', religion: 'int', sleight_of_hand: 'dex',
  stealth: 'dex', survival: 'wis',
};

// What fits on page 1 beside everything else.
const PAGE1_FEATURES = 5;
const PAGE1_FEATURE_CHARS = 100;
const PAGE1_ATTACKS = 5;
const PAGE1_ITEMS = 14;

// ── The model ────────────────────────────────────────────────────────────────

type SpellRow = { name: string; time: string; range: string; comp: string; duration: string; note: string; prepared: boolean };
type SpellLevel = { label: string; short: string; slots: number; spells: SpellRow[] };
export type SheetModel = {
  name: string; meta: string; eyebrow: string; xp: number; prof: string;
  abilities: { key: string; label: string; score: number; mod: string; save: string; saveProf: boolean; pct: number }[];
  skills: { name: string; ability: string; mod: string; prof: boolean; expert: boolean }[];
  passive: number; ac: number; initiative: string; speed: number; hpMax: number; hitDice: string;
  attacks: { name: string; hit: string; damage: string; kind: string }[];
  casting: null | { ability: string; abilityMod: string; dc: string; attack: string; levels: SpellLevel[] };
  features: { name: string; text: string }[];
  items: { name: string; qty: number; weight: string }[];
  carried: string;
  coins: { label: string; long: string; value: number }[];
  profs: { label: string; text: string }[];
  notes: string;
};

export function buildSheetModel(entity: Entity, resolveName: ResolveName, lookup: SheetLookup = {}): SheetModel {
  const { identity, derived, resources, skills, proficiencies, inventory, spellcasting, features } = entity;
  const stats = applyStatModifiers(entity.stats, collectAllEffects(entity)) as unknown as Record<string, number>;
  const profBonus = num(derived.proficiencyBonus, 2);
  const savingThrowIds = new Set<string>((proficiencies?.savingThrows ?? []) as string[]);

  const raceName = resolveName('race', identity.raceId ?? '');
  const className = resolveName('class', identity.classId ?? '');
  const backgroundName = identity.backgroundId ? resolveName('background', identity.backgroundId) : '';
  const alignment = (identity as { alignment?: string }).alignment;

  const abilities = ABILITY_ORDER.map(key => {
    const score = num(stats[key], 10);
    const saveProf = savingThrowIds.has(key);
    return {
      key: key.toUpperCase(), label: ABILITY_LABELS[key], score, mod: signed(modOf(score)),
      save: signed(modOf(score) + (saveProf ? profBonus : 0)), saveProf, pct: Math.max(0, Math.min(100, Math.round((score / 20) * 100))),
    };
  });

  const skillState = (skills?.skills ?? {}) as Record<string, { trained?: boolean; expertise?: boolean } | undefined>;
  const skillRows = Object.keys(SKILL_ABILITY).map(id => {
    const ability = SKILL_ABILITY[id];
    const prof = !!skillState[id]?.trained;
    const expert = !!skillState[id]?.expertise;
    return { name: words(id), ability: ability.toUpperCase(), mod: signed(modOf(num(stats[ability], 10)) + (prof ? profBonus * (expert ? 2 : 1) : 0)), prof, expert };
  });

  const attacks = (derived.attackBonuses ?? []).map(a => ({
    name: String(a.name ?? ''), hit: signed(num(a.bonus)),
    damage: `${a.damageDice ?? ''}${num(a.damageBonus) ? ` ${num(a.damageBonus) > 0 ? '+' : '−'} ${Math.abs(num(a.damageBonus))}` : ''} ${a.damageType ?? ''}`.trim(),
    kind: a.type === 'ranged' ? 'Ranged' : a.type === 'spell' ? 'Spell' : 'Melee',
  }));

  let casting: SheetModel['casting'] = null;
  if (spellcasting) {
    const preparedIds = new Set(spellcasting.prepared ?? []);
    const knownIds = [...new Set([...(spellcasting.known ?? []), ...(spellcasting.prepared ?? [])])];
    const nothingPrepared = preparedIds.size === 0;   // a class that knows its spells prepares none: all of them are ready
    const row = (id: string, cantrip: boolean): SpellRow & { level: number } => {
      const s = lookup.spell?.(id);
      const tags = [s?.school ? words(s.school) : '', s?.ritual ? 'ritual' : '', s?.concentration ? 'concentration' : ''].filter(Boolean);
      return {
        name: resolveName('spell', id), time: s?.castingTime ?? '', range: s?.range ?? '', comp: (s?.components ?? []).join(' '),
        duration: s?.duration ?? '', note: tags.join(', '), prepared: cantrip || nothingPrepared || preparedIds.has(id),
        level: cantrip ? 0 : (s?.level ?? -1),
      };
    };
    const all = [...(spellcasting.cantrips ?? []).map(id => row(id, true)), ...knownIds.map(id => row(id, false))];
    const levels: SpellLevel[] = [];
    const byName = (a: SpellRow, b: SpellRow) => a.name.localeCompare(b.name);
    const cantrips = all.filter(s => s.level === 0).sort(byName);
    if (cantrips.length) levels.push({ label: 'Cantrips', short: 'Cantrips', slots: 0, spells: cantrips });
    for (let n = 1; n <= 9; n++) {
      const slots = Math.max(0, Math.min(12, Math.floor(num(spellcasting.slots?.[String(n) as '1']?.total))));
      const spells = all.filter(s => s.level === n).sort(byName);
      if (slots > 0 || spells.length) levels.push({ label: `${ordinal(n)} level`, short: ordinal(n), slots, spells });
    }
    const unsorted = all.filter(s => s.level < 0).sort(byName);   // no detail lookup for these: listed, never dropped
    if (unsorted.length) levels.push({ label: 'Spells', short: 'Spells', slots: 0, spells: unsorted });
    for (let n = 1; n <= 9; n++) {
      const pact = Math.max(0, Math.min(12, Math.floor(num(spellcasting.pactSlots?.[String(n) as '1']?.total))));
      if (pact > 0) levels.push({ label: `Pact, ${ordinal(n)} level`, short: `Pact ${ordinal(n)}`, slots: pact, spells: [] });
    }
    const ability = spellcasting.ability;
    casting = {
      ability: ABILITY_LABELS[ability] ?? words(String(ability)), abilityMod: signed(modOf(num(stats[ability], 10))),
      dc: derived.spellSaveDC === null || derived.spellSaveDC === undefined ? '—' : String(num(derived.spellSaveDC)),
      attack: derived.spellAttackBonus === null || derived.spellAttackBonus === undefined ? '—' : signed(num(derived.spellAttackBonus)),
      levels,
    };
  }

  const owned = [...(inventory?.equipped ?? []), ...(inventory?.carried ?? [])];
  let totalWeight = 0, anyWeight = false;
  const items = owned.map(inst => {
    const each = lookup.item?.(inst.itemId)?.weight;
    const qty = num(inst.quantity, 1);
    if (typeof each === 'number' && each > 0) { totalWeight += each * qty; anyWeight = true; }
    return { name: resolveName('item', inst.itemId), qty, weight: typeof each === 'number' && each > 0 ? `${Math.round(each * qty * 10) / 10} lb` : '' };
  });
  const c = inventory?.currency;
  const coins = [['CP', 'Copper', c?.cp], ['SP', 'Silver', c?.sp], ['EP', 'Electrum', c?.ep], ['GP', 'Gold', c?.gp], ['PP', 'Platinum', c?.pp]]
    .map(([label, long, value]) => ({ label: label as string, long: long as string, value: num(value) }));

  const p = (proficiencies ?? {}) as Record<string, unknown>;
  const list = (v: unknown): string => (Array.isArray(v) ? v.map(x => words(String(x))).join(', ') : '');
  const profs = [['Armor', list(p.armor)], ['Weapons', list(p.weapons)], ['Tools', list(p.tools)], ['Languages', list(p.languages)]]
    .filter(([, text]) => text).map(([label, text]) => ({ label, text }));

  const hd = resources.hitDice;
  return {
    name: identity.name || 'Unnamed',
    meta: [`Level ${num(identity.level, 1)} ${raceName} ${className}`.replace(/\s+/g, ' ').trim(), backgroundName, alignment].filter(Boolean).join(' · '),
    eyebrow: [`Level ${num(identity.level, 1)}`, raceName, className].filter(Boolean).join(' · '),
    xp: num(identity.xp), prof: signed(profBonus),
    abilities, skills: skillRows, passive: num(derived.passivePerception, 10),
    ac: num(derived.ac, 10), initiative: signed(num(derived.initiative)), speed: num(derived.speed ?? resources.speed), hpMax: num(resources.hp?.maximum),
    hitDice: hd ? `${num(hd.total)}d${num(hd.die)}` : '',
    attacks, casting,
    // the passive and reference features; ones with their own activation are played from the app
    features: (features ?? []).filter(f => f.passive || !f.activation).map(f => ({ name: f.name, text: (f.description ?? '').replace(/\s+/g, ' ').trim() })),
    items, carried: anyWeight ? `${Math.round(totalWeight * 10) / 10} lb` : '', coins, profs,
    notes: ((entity as { notes?: string }).notes ?? '').trim(),
  };
}

// ── HTML ─────────────────────────────────────────────────────────────────────

const pips = (n: number): string => Array.from({ length: n }, () => '<i class="pip"></i>').join('');
const mark = (on: boolean, twice = false): string => `<i class="mark${on ? ' on' : ''}${twice ? ' twice' : ''}"></i>`;

function page1(m: SheetModel): string {
  const [initial, rest] = [m.name.slice(0, 1), m.name.slice(1)];
  const cell = (cls: string, label: string, value: string | number, blank = false) =>
    `<div class="cell ${cls}${blank ? ' blank' : ''}"><div class="l">${label}</div><div class="v">${blank ? '' : esc(value)}</div></div>`;
  const shownFeatures = m.features.slice(0, PAGE1_FEATURES);
  const featuresCut = m.features.length > PAGE1_FEATURES || shownFeatures.some(f => f.text.length > PAGE1_FEATURE_CHARS);
  const itemNames = m.items.map(i => `${i.name}${i.qty > 1 ? ` ×${i.qty}` : ''}`);
  const coins = m.coins.filter(c => c.value > 0).map(c => `${c.value} ${c.label.toLowerCase()}`).join(', ');
  return `
<section class="p1">
  <header class="head">
    <div class="id">
      <div class="eyebrow">${esc(m.eyebrow)}</div>
      <h1><span class="init">${esc(initial)}</span>${esc(rest)}</h1>
      <div class="meta">${esc(m.meta)}</div>
      <div class="orn"><span class="line"></span><i></i><i class="small"></i><i></i><span class="line"></span></div>
    </div>
    <div class="headfacts">
      <div><div class="l">Player</div><div class="write"></div></div>
      <div><div class="l">Experience</div><div class="v">${esc(m.xp.toLocaleString('en-US'))}</div></div>
      <div><div class="l">Proficiency</div><div class="v">${esc(m.prof)}</div></div>
    </div>
    <div class="hprings">
      <div class="hp"><span class="v">${esc(m.hpMax)}</span><span class="l">HP MAX</span></div>
      <div class="now"><span class="l">NOW</span></div>
      <div class="tmp"><span class="l">TEMP</span></div>
    </div>
  </header>
  <div class="grid">
    <div class="abilities">${m.abilities.map(a => `
      <div class="ab">
        <div class="ab-name">${esc(a.label)}</div>
        <div class="ab-top"><span class="ab-key">${esc(a.key)}</span><span class="ab-score">${esc(a.score)}</span></div>
        <div class="gem" style="--pct:${num(a.pct)}%"><span class="ab-mod">${esc(a.mod)}</span></div>
        <div class="ab-save">${mark(a.saveProf)}<span>save ${esc(a.save)}</span></div>
      </div>`).join('')}
    </div>
    <div class="combat">
      ${cell('c-ac', 'Armor Class', m.ac)}${cell('c-init', 'Initiative', m.initiative)}${cell('c-speed', 'Speed', `${m.speed} ft`)}
      ${cell('c-prof', 'Proficiency', m.prof)}${cell('c-hp', 'Hit Points', m.hpMax)}${cell('c-cur', 'Current', '', true)}
      ${cell('c-tmp', 'Temporary', '', true)}${cell('c-hd', 'Hit Dice', m.hitDice)}${cell('c-pass', 'Passive', m.passive)}
    </div>
    <div class="left">
      <section class="saves"><h2>Saving Throws</h2>${m.abilities.map(a => `<div class="row">${mark(a.saveProf)}<span class="n">${esc(a.label)}</span><span class="m">${esc(a.save)}</span></div>`).join('')}</section>
      <section class="skills"><h2>Skills <span class="passnote">Passive Perception ${esc(m.passive)}</span></h2>${m.skills.map(s =>
        `<div class="row">${mark(s.prof, s.expert)}<span class="n">${esc(s.name)}</span><span class="a">${esc(s.ability)}</span><span class="m">${esc(s.mod)}</span></div>`).join('')}</section>
      <div class="plaque"><span>Passive Perception</span><b>${esc(m.passive)}</b></div>
      <section class="death"><div class="row"><span class="n">Death saves, passed</span><span>${pips(3)}</span></div><div class="row"><span class="n">Death saves, failed</span><span>${pips(3)}</span></div></section>
    </div>
    <div class="right">
      <section><h2>Attacks</h2>${m.attacks.length ? `
        <table><thead><tr><th>Name</th><th class="num">To hit</th><th>Damage</th><th>Kind</th></tr></thead><tbody>${m.attacks.slice(0, PAGE1_ATTACKS).map(a =>
          `<tr><td class="b">${esc(a.name)}</td><td class="num">${esc(a.hit)}</td><td>${esc(a.damage)}</td><td>${esc(a.kind)}</td></tr>`).join('')}</tbody></table>` : '<div class="dim">No weapon in hand.</div>'}</section>
      ${m.casting ? `<section><h2>Spellcasting <span class="h2note">${esc(m.casting.ability)} · save DC ${esc(m.casting.dc)} · attack ${esc(m.casting.attack)}</span></h2>${m.casting.levels.map(l =>
        `<div class="lvl"><span class="b">${esc(l.label)}</span><span class="slots">${pips(l.slots)}</span><span class="names">${esc(l.spells.map(s => s.name).join(', '))}</span></div>`).join('')}</section>` : ''}
      <section><h2>Features and Traits</h2>${shownFeatures.length ? shownFeatures.map(f =>
        `<div class="feat"><span class="b">${esc(f.name)}.</span> ${esc(clip(f.text, PAGE1_FEATURE_CHARS))}</div>`).join('') : '<div class="dim">—</div>'}${featuresCut ? '<div class="dim">In full on page 2.</div>' : ''}</section>
      <section class="equip"><h2>Equipment</h2><div>${itemNames.length ? esc(itemNames.slice(0, PAGE1_ITEMS).join(', ')) + (itemNames.length > PAGE1_ITEMS ? `, and ${itemNames.length - PAGE1_ITEMS} more on page 2` : '') : '<span class="dim">—</span>'}.${coins ? ` ${esc(coins)}.` : ''}</div></section>
    </div>
  </div>
  <footer><span>Made with Grimoire</span><span>Page 1</span></footer>
</section>`;
}

function page2(m: SheetModel): string {
  const c = m.casting;
  const spellRows = c ? c.levels.filter(l => l.spells.length).map(l => `
    <h3>${esc(l.label)}</h3>${l.spells.map(s =>
      `<div class="srow">${mark(s.prepared)}<span class="b">${esc(s.name)}</span><span>${esc(s.time)}</span><span>${esc(s.range)}</span><span>${esc(s.comp)}</span><span>${esc(s.duration)}</span><span>${esc(s.note)}</span></div>`).join('')}`).join('') : '';
  return `
<section class="p2">
  <header class="head2">
    <div><div class="eyebrow">${esc(m.name)} · ${esc(m.eyebrow)}</div><h1>${c ? 'Spells and Gear' : 'Gear and Notes'}</h1></div>
    ${c ? `<div class="facts"><div><b>${esc(c.dc)}</b><span>Save DC</span></div><div><b>${esc(c.attack)}</b><span>Attack</span></div><div><b>${esc(c.abilityMod)}</b><span>${esc(c.ability.slice(0, 3))}</span></div></div>` : ''}
  </header>
  ${c && c.levels.some(l => l.slots) ? `<div class="slots2">${c.levels.filter(l => l.slots).map(l => `<div><span>${esc(l.short)}</span><span>${pips(l.slots)}</span></div>`).join('')}</div>` : ''}
  ${c && spellRows ? `<section class="spells">
    <div class="srow shead"><span></span><span>Spell</span><span>Time</span><span>Range</span><span>Parts</span><span>Duration</span><span>Notes</span></div>${spellRows}
    <div class="dim">A filled mark is a spell ready to cast. Concentrating on <span class="write inline"></span></div>
  </section>` : ''}
  <div class="two">
    <section class="inv"><h2>Inventory</h2>
      <div class="irow shead"><span>Item</span><span class="num">Qty</span><span class="num">Weight</span></div>
      ${m.items.length ? m.items.map(i => `<div class="irow"><span>${esc(i.name)}</span><span class="num">${esc(i.qty)}</span><span class="num">${esc(i.weight)}</span></div>`).join('') : '<div class="dim">—</div>'}
      ${m.carried ? `<div class="irow total"><span>Carried</span><span></span><span class="num">${esc(m.carried)}</span></div>` : ''}
      <div class="coins">${m.coins.map(x => `<div><b>${esc(x.value)}</b><span>${esc(x.label)}</span></div>`).join('')}</div>
    </section>
    <div class="side">
      ${m.profs.length ? `<section><h2>Proficiencies and Languages</h2>${m.profs.map(x => `<div><span class="b">${esc(x.label)}.</span> ${esc(x.text)}</div>`).join('')}</section>` : ''}
      <section class="notes"><h2>Notes</h2>${m.notes ? `<div class="pre">${esc(clip(m.notes, 600))}</div>` : ''}<div class="lines"></div></section>
    </div>
  </div>
  ${m.features.length ? `<section class="full"><h2>Features and Traits, in Full</h2>${m.features.map(f => `<div class="feat"><span class="b">${esc(f.name)}.</span> ${esc(f.text)}</div>`).join('')}</section>` : ''}
  <footer><span>Made with Grimoire</span><span>Page 2</span></footer>
</section>`;
}

// ── The three looks ──────────────────────────────────────────────────────────

const BASE_CSS = `
@page { size: letter; margin: 0.5in; }
* { box-sizing: border-box; }
html, body { margin: 0; padding: 0; }
body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
h1, h2, h3 { margin: 0; }
i { font-style: normal; }
.p1 { height: 10in; overflow: hidden; display: flex; flex-direction: column; gap: 16px; page-break-after: always; }
.grid { flex: 1; min-height: 0; display: grid; }
.abilities { grid-area: ab; } .combat { grid-area: cb; } .left { grid-area: l; min-width: 0; } .right { grid-area: r; min-width: 0; }
.left, .right { display: flex; flex-direction: column; gap: 12px; }
.row { display: flex; align-items: center; gap: 8px; }
.row .n { flex: 1; } .row .m { width: 26px; text-align: right; font-weight: 600; }
.b { font-weight: 600; } .num { text-align: right; }
table { width: 100%; border-collapse: collapse; } th { font-weight: 400; text-align: left; padding: 2px 0; } td { padding: 2px 0; } th.num, td.num { text-align: right; padding-right: 16px; width: 60px; }
.lvl { display: flex; gap: 10px; padding: 3px 0; } .lvl .b { width: 72px; flex-shrink: 0; } .lvl .slots { width: 76px; flex-shrink: 0; white-space: nowrap; } .lvl .names { flex: 1; }
.feat { padding: 2px 0; }
.mark, .pip { display: inline-block; flex-shrink: 0; }
.write { border-bottom: 1px solid currentColor; height: 20px; } .write.inline { display: inline-block; width: 180px; height: 12px; }
footer { display: flex; justify-content: space-between; }
.p2 > * { margin-bottom: 14px; }
.head2 { display: flex; justify-content: space-between; align-items: center; gap: 24px; }
.facts { display: flex; gap: 10px; } .facts > div { display: flex; flex-direction: column; align-items: center; justify-content: center; }
.slots2 { display: flex; flex-wrap: wrap; gap: 8px; } .slots2 > div { flex: 1; min-width: 150px; display: flex; align-items: center; justify-content: space-between; }
.srow { display: grid; grid-template-columns: 16px 146px 96px 60px 56px 104px minmax(0, 1fr); column-gap: 8px; align-items: center; min-height: 21px; break-inside: avoid; }
.srow span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.two { display: grid; grid-template-columns: 330px minmax(0, 1fr); gap: 26px; }
.side { display: flex; flex-direction: column; gap: 12px; }
.irow { display: grid; grid-template-columns: minmax(0, 1fr) 36px 60px; column-gap: 8px; min-height: 20px; align-items: center; break-inside: avoid; }
.coins { display: grid; grid-template-columns: repeat(5, 1fr); gap: 6px; margin-top: 10px; } .coins > div { text-align: center; display: flex; flex-direction: column; }
.notes .pre { white-space: pre-wrap; }
.lines { height: 2.2in; margin-top: 6px; background: repeating-linear-gradient(to bottom, transparent 0, transparent 23px, var(--rule) 23px, var(--rule) 24px); }
.full .feat { break-inside: avoid; padding: 3px 0; }
.frame, .orn, .hprings, .headfacts, .eyebrow, .saves, .plaque, .ab-name, .passnote { display: none; }
`;

const LEDGER_CSS = `
body { --ink: #16181D; --dim: #5B616E; --accent: #C8371B; --hair: #E3E5E9; --rule: #C4C8CF; color: var(--ink); font: 12px/1.5 'Inter', 'Roboto', 'Helvetica Neue', Arial, sans-serif; }
h1, .v, .ab-mod, .facts b, .coins b { font-family: 'Space Grotesk', 'Inter', 'Roboto', 'Helvetica Neue', Arial, sans-serif; }
.dim, .l, th, .shead, .a, .ab-score { color: var(--dim); }
.head { display: flex; justify-content: space-between; align-items: flex-end; gap: 24px; border-top: 4px solid var(--accent); padding-top: 14px; }
.eyebrow { display: block; letter-spacing: 0.14em; text-transform: uppercase; color: var(--dim); }
.head h1 { font-size: 42px; line-height: 1.05; font-weight: 700; letter-spacing: -0.02em; } .meta { font-size: 14px; margin-top: 6px; }
.headfacts { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; width: 300px; } .headfacts .v { font-size: 16px; font-weight: 500; }
.grid { grid-template-columns: 232px minmax(0, 1fr); grid-template-areas: "ab ab" "cb cb" "l r"; grid-template-rows: auto auto 1fr; gap: 18px 28px; }
.abilities { display: grid; grid-template-columns: repeat(6, 1fr); gap: 10px; }
.ab { border: 1px solid var(--ink); padding: 8px 10px 6px; }
.ab-top { display: flex; justify-content: space-between; } .ab-key { font-weight: 600; letter-spacing: 0.08em; }
.ab-mod { display: block; text-align: center; font-size: 36px; line-height: 1.1; font-weight: 700; }
.ab-save { display: flex; align-items: center; gap: 6px; border-top: 1px solid var(--rule); padding-top: 4px; text-transform: capitalize; }
.combat { display: grid; grid-template-columns: repeat(7, 1fr); border-top: 2px solid var(--ink); border-bottom: 1px solid var(--ink); }
.combat .c-prof, .combat .c-pass { display: none; }
.cell { padding: 8px; border-left: 1px solid var(--rule); } .cell:first-child { border-left: 0; padding-left: 0; }
.cell .v { font-size: 26px; font-weight: 700; line-height: 1.2; } .cell.blank .v { height: 30px; border: 1px dashed var(--dim); }
h2 { font-size: 12px; font-weight: 600; letter-spacing: 0.14em; text-transform: uppercase; color: var(--accent); border-bottom: 1px solid var(--ink); padding-bottom: 3px; margin-bottom: 4px; display: flex; justify-content: space-between; align-items: baseline; }
.h2note, .passnote { display: inline; font-weight: 400; letter-spacing: 0; text-transform: none; color: var(--ink); }
.skills .row { height: 19px; border-bottom: 1px solid var(--hair); }
.mark { width: 9px; height: 9px; border: 1.5px solid var(--ink); border-radius: 50%; } .mark.on { background: var(--accent); } .mark.twice { box-shadow: 0 0 0 2px #fff, 0 0 0 3px var(--ink); }
.pip { width: 10px; height: 10px; border: 1.5px solid var(--ink); border-radius: 50%; margin-right: 5px; }
tbody tr, .lvl, .srow, .irow { border-top: 1px solid var(--hair); }
footer { color: var(--dim); border-top: 1px solid var(--rule); padding-top: 6px; }
.head2 { border-top: 4px solid var(--accent); padding-top: 14px; align-items: flex-end; } .head2 h1 { font-size: 30px; font-weight: 700; letter-spacing: -0.02em; }
.facts { gap: 22px; } .facts > div { flex-direction: column-reverse; align-items: flex-start; } .facts b { font-size: 20px; } .facts span { color: var(--dim); }
.slots2 { border-top: 2px solid var(--ink); border-bottom: 1px solid var(--ink); padding: 7px 0; gap: 8px 24px; } .slots2 span:first-child { color: var(--dim); }
h3 { margin-top: 6px; font-size: 12px; font-weight: 600; letter-spacing: 0.14em; text-transform: uppercase; color: var(--accent); }
.srow.shead, .irow.shead { border-top: 0; border-bottom: 1px solid var(--ink); }
.irow.total { border-top: 1px solid var(--ink); font-weight: 600; }
.coins { border: 1px solid var(--ink); gap: 0; } .coins > div { flex-direction: column-reverse; padding: 4px 8px; text-align: left; } .coins b { font-size: 16px; } .coins span { color: var(--dim); }
`;

const ASTROLABE_CSS = `
body { --ink: #1B1F4B; --dim: #4B5080; --accent: #A85705; --hair: #D9DCEF; --tint: #F1F2FA; --rule: #B9BEDD; color: var(--ink); font: 12.5px/1.45 'Outfit', 'Roboto', 'Helvetica Neue', Arial, sans-serif; }
.l, .eyebrow, .a, .row .m, th, .shead, .ab-top, footer, .facts span, .slots2 span:first-child, .coins span, td.num { font-family: 'JetBrains Mono', 'Roboto Mono', 'Courier New', monospace; font-size: 12px; }
.dim, .l, .eyebrow, th, .shead, .a, footer, .ab-save { color: var(--dim); }
.head { display: flex; justify-content: space-between; align-items: center; gap: 24px; }
.eyebrow { display: block; letter-spacing: 0.12em; text-transform: uppercase; }
.head h1 { font-size: 46px; line-height: 1.05; font-weight: 600; letter-spacing: -0.01em; } .meta { font-size: 14px; margin-top: 4px; }
.hprings { display: flex; align-items: center; gap: 12px; }
.hprings > div { border-radius: 50%; display: flex; flex-direction: column; align-items: center; }
.hprings .hp { width: 100px; height: 100px; border: 7px solid var(--accent); justify-content: center; } .hprings .hp .v { font-size: 34px; font-weight: 600; line-height: 1; }
.hprings .now { width: 78px; height: 78px; } .hprings .tmp { width: 60px; height: 60px; }
.hprings .now, .hprings .tmp { border: 1.5px dashed var(--ink); justify-content: flex-end; padding-bottom: 7px; }
.grid { grid-template-columns: 250px minmax(0, 1fr); grid-template-areas: "ab ab" "cb cb" "l r"; grid-template-rows: auto auto 1fr; gap: 16px 24px; }
.abilities { display: grid; grid-template-columns: repeat(6, 1fr); gap: 10px; border-top: 1.5px solid var(--ink); padding-top: 16px; }
.ab { display: flex; flex-direction: column; align-items: center; gap: 4px; }
.gem { order: 1; width: 88px; height: 88px; border-radius: 50%; background: conic-gradient(var(--accent) var(--pct), var(--hair) 0); display: flex; align-items: center; justify-content: center; }
.ab-mod { width: 74px; height: 74px; border-radius: 50%; background: #fff; display: flex; align-items: center; justify-content: center; font-size: 30px; font-weight: 600; }
.ab-top { order: 2; display: flex; gap: 6px; font-weight: 500; letter-spacing: 0.08em; } .ab-save { order: 3; display: flex; align-items: center; gap: 6px; }
.combat { display: grid; grid-template-columns: repeat(6, 1fr); gap: 10px; }
.combat .c-hp, .combat .c-cur, .combat .c-tmp { display: none; }
.cell { background: var(--tint); border-radius: 14px; padding: 7px 4px; text-align: center; } .cell .l { letter-spacing: 0.04em; text-transform: uppercase; } .cell .v { font-size: 22px; font-weight: 600; line-height: 1.2; }
h2 { display: flex; align-items: center; gap: 8px; font-family: 'JetBrains Mono', 'Roboto Mono', 'Courier New', monospace; font-size: 12px; font-weight: 500; letter-spacing: 0.12em; text-transform: uppercase; margin-bottom: 4px; }
h2 .h2note { margin-left: auto; font: 400 12.5px 'Outfit', 'Roboto', 'Helvetica Neue', Arial, sans-serif; letter-spacing: 0; text-transform: none; color: var(--dim); }
h2::before, h3::before { content: ""; width: 9px; height: 9px; border: 2.5px solid var(--accent); border-radius: 50%; flex-shrink: 0; }
.skills { border: 1.5px solid var(--ink); border-radius: 16px; padding: 10px 14px; } .skills .row { height: 19px; }
.death { padding: 0 14px; display: flex; flex-direction: column; gap: 6px; }
.mark { width: 9px; height: 9px; border: 1.5px solid var(--ink); border-radius: 50%; } .mark.on { background: var(--accent); } .mark.twice { box-shadow: 0 0 0 2px #fff, 0 0 0 3px var(--ink); }
.pip { width: 12px; height: 12px; border: 1.5px solid var(--ink); border-radius: 50%; margin-right: 5px; background: #fff; }
tbody tr, .lvl, .srow, .irow { border-top: 1px solid var(--hair); } .lvl { align-items: center; padding: 4px 0; }
.equip { background: var(--tint); border-radius: 14px; padding: 10px 14px; }
.head2 h1 { font-size: 32px; font-weight: 600; } .facts > div { width: 66px; height: 66px; border: 2.5px solid var(--accent); border-radius: 50%; } .facts b { font-size: 20px; font-weight: 600; line-height: 1; } .facts span { color: var(--dim); text-transform: uppercase; }
.slots2 { border-top: 1.5px solid var(--ink); padding-top: 14px; } .slots2 > div { background: var(--tint); border-radius: 14px; padding: 8px 12px; } .slots2 span:first-child { text-transform: uppercase; }
h3 { display: flex; align-items: center; gap: 8px; margin-top: 6px; font-family: 'JetBrains Mono', 'Roboto Mono', 'Courier New', monospace; font-size: 12px; font-weight: 500; letter-spacing: 0.12em; text-transform: uppercase; }
.srow.shead, .irow.shead { border-top: 0; border-bottom: 1.5px solid var(--ink); text-transform: uppercase; }
.irow.total { font-weight: 600; } .coins > div { background: var(--tint); border-radius: 12px; padding: 5px 2px; flex-direction: column-reverse; } .coins b { font-size: 16px; font-weight: 600; }
.notes { border: 1.5px solid var(--ink); border-radius: 16px; padding: 10px 14px; }
`;

const ILLUMINATED_CSS = `
@page { size: letter; margin: 0.36in; }
body { --ink: #1E1A16; --dim: #5F564C; --accent: #9E2B25; --gold: #8A6A1F; --hair: #BDB4A6; --rule: #BDB4A6; color: var(--ink); font: 13.5px/1.35 'EB Garamond', 'Noto Serif', Georgia, 'Times New Roman', serif; font-variant-numeric: lining-nums; }
.frame { display: block; position: fixed; top: 0; left: 0; right: 0; bottom: 0; border: 1.5px solid var(--ink); outline: 1px solid var(--gold); outline-offset: -6px; }
.p1 { height: 10.28in; padding: 0.24in 0.26in 0.2in; gap: 12px; } .p2 { padding: 0.24in 0.26in 0; }
h1, h2, h3, .ab-mod, .ab-name, .cell .v, .plaque, .facts b, .coins b { font-family: 'Cormorant Garamond', 'EB Garamond', 'Noto Serif', Georgia, serif; }
.dim, th, .shead, .a, footer { color: var(--dim); font-style: italic; }
.head { text-align: center; } .head h1 { font-size: 52px; line-height: 1.05; font-weight: 700; } .init { color: var(--accent); font-size: 66px; } .meta { font-style: italic; font-size: 16px; }
.orn { display: flex; align-items: center; gap: 12px; margin-top: 8px; } .orn .line { flex: 1; height: 1px; background: var(--ink); }
.orn i { width: 8px; height: 8px; background: var(--accent); transform: rotate(45deg); } .orn i.small { width: 5px; height: 5px; background: var(--gold); }
.grid { grid-template-columns: 84px 200px minmax(0, 1fr); grid-template-areas: "ab l cb" "ab l r"; grid-template-rows: auto 1fr; gap: 12px 20px; }
.abilities { display: flex; flex-direction: column; gap: 8px; }
.ab { display: flex; flex-direction: column; align-items: center; }
.ab-name { display: block; font-weight: 700; font-variant: small-caps; letter-spacing: 0.08em; font-size: 14px; }
.gem { order: 1; margin: 13px 0; width: 54px; height: 54px; border: 1.5px solid var(--ink); outline: 1px solid var(--gold); outline-offset: -5px; transform: rotate(45deg); display: flex; align-items: center; justify-content: center; }
.ab-mod { transform: rotate(-45deg); font-size: 27px; font-weight: 700; line-height: 1; }
.ab-top { order: 2; } .ab-key, .ab-save { display: none; } .ab-score::before { content: "Score "; }
.saves, .plaque { display: block; }
.combat { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; } .combat .c-pass { display: none; }
.cell { border: 3px double var(--ink); padding: 6px 4px; text-align: center; display: flex; flex-direction: column-reverse; justify-content: flex-end; }
.cell .v { font-size: 30px; font-weight: 700; line-height: 1; min-height: 30px; } .cell .l { font-variant: small-caps; letter-spacing: 0.06em; } .cell.blank { border: 1px solid var(--ink); } .c-hp .v { color: var(--accent); }
h2 { font-size: 16px; font-weight: 700; font-variant: small-caps; letter-spacing: 0.1em; color: var(--accent); border-bottom: 3px double var(--ink); padding-bottom: 2px; margin-bottom: 4px; }
h2 .h2note { float: right; font: italic 400 13.5px 'EB Garamond', 'Noto Serif', Georgia, serif; font-variant: normal; letter-spacing: 0; color: var(--ink); }
.row { height: 20px; gap: 9px; } .row .a { font-style: italic; }
.plaque { display: flex; justify-content: space-between; align-items: baseline; border: 3px double var(--ink); padding: 5px 10px; font-weight: 700; font-variant: small-caps; letter-spacing: 0.08em; font-size: 15px; } .plaque b { font-size: 22px; line-height: 1; }
.mark { width: 7px; height: 7px; border: 1px solid var(--ink); transform: rotate(45deg); } .mark.on { background: var(--accent); } .mark.twice { outline: 1px solid var(--ink); outline-offset: 2px; }
.pip { width: 8px; height: 8px; border: 1px solid var(--ink); transform: rotate(45deg); margin-right: 8px; }
tbody tr, .lvl, .srow, .irow { border-top: 1px solid var(--hair); } .feat .b { font-style: italic; }
footer { justify-content: center; gap: 8px; } footer span + span::before { content: "\\00b7  "; }
.head2 { display: block; text-align: center; } .head2 .eyebrow { display: block; font-style: italic; font-size: 16px; } .head2 h1 { font-size: 36px; font-weight: 700; }
.facts { justify-content: center; gap: 28px; margin-top: 4px; } .facts > div { flex-direction: row; gap: 6px; align-items: baseline; } .facts b { font-size: 22px; } .facts span { font-style: italic; }
.slots2 > div { border: 3px double var(--ink); padding: 5px 10px; font-family: 'Cormorant Garamond', 'EB Garamond', Georgia, serif; font-weight: 700; font-variant: small-caps; letter-spacing: 0.08em; font-size: 15px; }
h3 { margin-top: 6px; font-size: 16px; font-weight: 700; font-variant: small-caps; letter-spacing: 0.1em; color: var(--accent); }
.srow.shead, .irow.shead { border-top: 0; border-bottom: 3px double var(--ink); }
.irow.total { font-weight: 600; } .coins > div { border: 1px solid var(--ink); padding: 4px 2px; } .coins b { font-size: 20px; line-height: 1; } .coins span { font-variant: small-caps; letter-spacing: 0.06em; }
`;

const THEME_CSS: Record<SheetTheme, string> = { illuminated: ILLUMINATED_CSS, astrolabe: ASTROLABE_CSS, ledger: LEDGER_CSS };

/**
 * Builds the printable HTML for a character sheet.
 *
 * `resolveName(kind, id)` is a caller-supplied lookup so this module does not import the content stores. `options.lookup` adds the
 * spell and item details page 2 prints; `options.theme` picks the look.
 */
export function buildCharacterSheetHtml(entity: Entity, resolveName: ResolveName, options: SheetOptions = {}): string {
  const theme = options.theme && isSheetTheme(options.theme) ? options.theme : DEFAULT_SHEET_THEME;
  const model = buildSheetModel(entity, resolveName, options.lookup);
  return `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"><title>${esc(model.name)}</title>
<style>${SHEET_FONT_CSS[theme]}${BASE_CSS}${THEME_CSS[theme]}</style></head>
<body class="t-${theme}"><div class="frame"></div>${page1(model)}${page2(model)}</body></html>`;
}

/**
 * Renders the character sheet to a real PDF file and opens the OS share sheet, same "generate then share" pattern as backupIO.ts's
 * .grimoire-pack export.
 */
export async function exportCharacterSheetPdf(entity: Entity, resolveName: ResolveName, options: SheetOptions = {}): Promise<void> {
  const html = buildCharacterSheetHtml(entity, resolveName, options);
  const desktop = desktopBridge();
  if (desktop) {
    await desktop.pdf.fromHtml(html, `${entity.identity.name || 'Character'} - Character Sheet.pdf`);
    return;
  }
  const { uri } = await Print.printToFileAsync({ html, base64: false });

  const canShare = await Sharing.isAvailableAsync();
  if (!canShare) {
    throw new Error('Sharing isn’t available on this device. The PDF was created but couldn’t be shared.');
  }
  await Sharing.shareAsync(uri, {
    mimeType:    'application/pdf',
    dialogTitle: `${entity.identity.name || 'Character'} — Character Sheet`,
  });
}

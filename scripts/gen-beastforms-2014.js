// Generates src/content/beastforms/beastforms2014Data.ts from the Beast stat blocks of the System Reference Document 5.1
// (Creative Commons Attribution 4.0): every Beast of Challenge Rating 6 or lower that is not a swarm. The text is read with
// pdftotext (raw order, so each column comes out in reading order). Nothing is typed by hand: a form's speeds, senses and
// attacks are what the stat block says.
//
//   node scripts/gen-beastforms-2014.js
const fs = require('fs');
const path = require('path');
const os = require('os');
const { execFileSync } = require('child_process');

const pdf = path.join(__dirname, '..', 'third_party', 'wotc', 'srd', '5.1', 'SRD_CC_v5.1.pdf');
const out = path.join(__dirname, '..', 'src', 'content', 'beastforms', 'beastforms2014Data.ts');
const tmp = path.join(os.tmpdir(), 'srd51-raw.txt');
try { execFileSync('pdftotext', [pdf, tmp], { stdio: 'ignore' }); } catch (e) { /* pdftotext warns about fonts; the text is still written */ }
const text = fs.readFileSync(tmp, 'utf8').replace(/\f/g, '\n');

// The PDF prints a hyphen as "--" and a minus sign as a non-ASCII character.
const clean = s => s.replace(/--/g, '-').replace(/(\d)- (foot)/g, '$1-$2').replace(/[^\x20-\x7E]/g, c => (c === '’' || c === '‘' ? "'" : c === '“' || c === '”' ? '"' : '-'));
const norm = s => clean(s.replace(/\s+/g, ' ').trim());
const lines = text.split('\n').map(norm).filter(l => l && l !== 'System Reference Document 5.1' && !/^\d{1,3}$/.test(l));

const SIZE = /^(Tiny|Small|Medium|Large|Huge|Gargantuan) /;
const TYPE_LINE = /^(Tiny|Small|Medium|Large|Huge|Gargantuan) (swarm of [A-Za-z]+ [a-z]+|[a-z]+( \([^)]*\))?)(,| )/;
// Block starts: a name line followed by a "Size type, alignment" line (which pdftotext often continues with Armor Class etc.).
const starts = [];
for (let i = 1; i < lines.length; i++) if (TYPE_LINE.test(lines[i]) && !SIZE.test(lines[i - 1]) && lines[i - 1].length < 50) starts.push(i - 1);
const blocks = starts.map((s, k) => ({ name: lines[s], type: lines[s + 1], body: lines.slice(s + 2, starts[k + 1] ?? lines.length) }));

const crOf = s => { const m = s.match(/Challenge ([\d/]+)/); if (!m) return null; return m[1].includes('/') ? Number(m[1].split('/')[0]) / Number(m[1].split('/')[1]) : Number(m[1]); };
const idOf = n => n.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');

// A stat block printed under a magic item (Figurine of Wondrous Power), not a creature in the monster list.
const NOT_A_MONSTER = new Set(['Giant Fly']);

// Sentences of a trait or action paragraph, stopping where the stat block's own text ends and its flavour begins.
const TITLE = /^[A-Z][A-Za-z' -]*(?: \([^)]*\))?\.$/;
function keepMechanics(paragraph) {
  const sentences = paragraph.split(/(?<=[.!?]) (?=[A-Z])/);
  const kept = [];
  for (const s of sentences) {
    if (kept.length && (TITLE.test(s) || /^(A|An) (?!creature\b)/.test(s) || /^[A-Z][a-z]+s are /.test(s))) break;
    kept.push(s);
  }
  return kept.join(' ').trim();
}

const forms = [];
for (const b of blocks) {
  if (NOT_A_MONSTER.has(b.name)) continue;
  if (!/ beast,/.test(b.type) || /swarm/.test(b.type)) continue;
  const size = b.type.match(TYPE_LINE)[1];
  const joined = [b.type, ...b.body].join(' ');
  const cr = crOf(joined);
  if (cr === null || cr > 6) continue;

  const ac = joined.match(/Armor Class (\d+)/); const hp = joined.match(/Hit Points (\d+)/);
  const speedM = joined.match(/Speed (.*?) (?=STR)/);
  const abil = joined.match(/STR DEX CON INT WIS CHA (\d+) \([+-]?\d+\) (\d+) \([+-]?\d+\) (\d+) \([+-]?\d+\) (\d+) \([+-]?\d+\) (\d+) \([+-]?\d+\) (\d+) \([+-]?\d+\)/);
  if (!ac || !hp || !speedM || !abil) { console.error('SKIP (unparsed):', b.name); continue; }

  const speeds = { walk: 0 };
  let burrow = 0;
  for (const part of speedM[1].split(',').map(s => s.trim())) {
    const m = part.match(/^(?:(burrow|climb|fly|swim) )?(\d+) ft\./);
    if (!m) continue;
    if (!m[1]) speeds.walk = Number(m[2]); else if (m[1] === 'burrow') burrow = Number(m[2]); else speeds[m[1]] = Number(m[2]);
  }
  const sensesM = joined.match(/Senses (.*?),? passive Perception/);
  const senses = [];
  if (sensesM) for (const s of sensesM[1].split(',')) { const m = s.trim().match(/^(blindsight|darkvision|tremorsense|truesight) (\d+) ft\.?/); if (m) senses.push({ type: m[1], range: Number(m[2]) }); }

  const afterChallenge = joined.split(/Challenge [\d/]+ \([\d,]+ XP\)/)[1] || '';
  // The Giant Rat's block carries a variant (Diseased Giant Rats) after its own actions; the variant is not the base creature.
  const body = afterChallenge.split(/Diseased Giant Rats\./)[0];
  const actionsAt = body.search(/\bActions\b/);
  const traitsText = actionsAt >= 0 ? body.slice(0, actionsAt) : body;
  const actionsText = actionsAt >= 0 ? body.slice(actionsAt + 'Actions'.length) : '';

  // Paragraphs begin where "Title. Capital" begins; the title may carry a parenthesis, e.g. "Ink Cloud (Recharges after a Short or Long Rest)."
  const PARA = /(?<=[.!?]) (?=[A-Z][A-Za-z'-]*(?: [A-Za-z'-]+){0,5}(?: \([^)]*\))?\. [A-Z])/;
  const split = t => t.trim().split(PARA).map(p => p.trim()).filter(Boolean);
  // A title is Title Case ("Keen Hearing and Smell", "Ink Cloud (Recharges after a Short or Long Rest)"); a sentence of the stat block's flavour is not.
  const SMALL = new Set(['and', 'or', 'of', 'the', 'to', 'a', 'in', 'on', 'after']);
  const isTitleCase = s => s.replace(/\([^)]*\)/g, '').trim().split(/\s+/).every(w => /^[A-Z]/.test(w) || SMALL.has(w));
  const titled = p => {
    const m = p.match(/^([A-Z][A-Za-z'-]*(?: [A-Za-z'-]+){0,5}(?: \([^)]*\))?)\. (.*)$/);
    return m && isTitleCase(m[1]) ? { title: m[1], text: m[2] } : null;
  };

  const traits = [];
  if (burrow) traits.push(`Burrow Speed — ${burrow} ft.`);
  for (const p of split(traitsText)) {
    const t = titled(p);
    if (t) traits.push(`${t.title} — ${keepMechanics(t.text)}`);
  }
  const attacks = [];
  for (const p of split(actionsText)) {
    const t = titled(p);
    if (!t) continue;
    const atk = t.text.match(/^(?:Melee|Ranged) Weapon Attack: .*? Hit: (\d+)(?: \(([^)]+)\))? ([a-z]+) damage(.*)$/);
    if (atk) {
      const dice = (atk[2] || atk[1]).replace(/\s+/g, '');
      const toHit = t.text.match(/Weapon Attack: ([+-]\d+) to hit/);
      if (!attacks.some(a => a.name === t.title)) attacks.push({ name: t.title, effect: { type: 'damage', dice, damageType: atk[3] }, ...(toHit ? { attackBonus: Number(toHit[1]) } : {}) });
      // Anything the hit does beyond its damage (a grapple, a poison, a knock-down) is kept as text.
      const more = keepMechanics(atk[4].replace(/^[.,]\s*/, '').trim());
      if (/^(and|plus|if)\b/i.test(more)) traits.push(`${t.title} — Hit: ${dice} ${atk[3]} damage${/^(and|plus)\b/i.test(more) ? ' ' : '. '}${more}`);
    } else {
      traits.push(`${t.title} — ${keepMechanics(t.text)}`);
    }
  }

  const form = {
    id: idOf(b.name), name: b.name, challengeRating: cr, size,
    stats: { str: Number(abil[1]), dex: Number(abil[2]), con: Number(abil[3]), int: Number(abil[4]), wis: Number(abil[5]), cha: Number(abil[6]) },
    ac: Number(ac[1]), hp: Number(hp[1]), speed: speeds.walk,
  };
  if (speeds.swim) form.swimSpeed = speeds.swim;
  if (speeds.fly) form.flySpeed = speeds.fly;
  if (speeds.climb) form.climbSpeed = speeds.climb;
  if (senses.length) form.senses = senses;
  form.attacks = attacks;
  if (traits.length) form.traits = traits;
  forms.push(form);
}

forms.sort((a, b) => a.challengeRating - b.challengeRating || a.name.localeCompare(b.name));
const head = `// ============================================================================
// FILE: src/content/beastforms/beastforms2014Data.ts
// GENERATED by scripts/gen-beastforms-2014.js from the Beast stat blocks of the System Reference Document 5.1 (Creative Commons
// Attribution 4.0): every Beast of Challenge Rating 6 or lower, swarms excluded, as a Wild Shape form for the 2014 Druid. Ids are
// the SRD names, so the forms the 2014 Druid already had (wolf, giant_spider, brown_bear) keep their ids. Attacks are the stat
// block's weapon attack damage (damage dice only, as for every form in this app); a burrow speed, an attack's extra effect and
// the stat block's traits are kept as text. Hand-edit nothing in this file; fix the generator and re-run.
// ============================================================================
import type { BeastForm } from '../../engine/types';

export const BEAST_FORMS_2014: BeastForm[] = [
`;
fs.writeFileSync(out, head + forms.map(f => '  ' + JSON.stringify(f) + ',').join('\n') + '\n];\n');
console.log('forms:', forms.length);
if (process.env.TRAITS) for (const f of forms) if (f.traits) console.log(f.id + ': ' + f.traits.join(' || ').slice(0, 700));

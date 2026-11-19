// Contract ARCH-003 (the rules engine is pure) and ARCH-033 (keep the core portable): the engine never reaches into the store,
// the database, sync, file I/O, the screens, the live session, or the React Native and Expo platform. A file that needs a value
// from one of those takes it as a parameter. Content (src/content) is a separate rule, ARCH-006.
// "Pure" here means no I/O and no platform: it does not mean deterministic. The engine reads the clock (Date.now) for timestamps
// and uses Math.random for dice and for new ids (engine/ids.ts), so a test that needs a fixed time or roll mocks those two.
import * as fs from 'fs';
import * as path from 'path';
import * as dnd5e from '../ruleset/dnd5e';

const ENGINE = path.resolve(__dirname, '..');
const FORBIDDEN = /(?:from\s+|require\(\s*)['"](?:react-native(?:[/'"]|$)|expo(?:-[\w-]+)?(?:[/'"]|$)|zustand|(?:\.\.\/)+(?:store|db|sync|io|components|session|platform)\/|(?:\.\.\/)+\.\.\/app\/)/;

function engineFiles(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) return entry.name === '__tests__' ? [] : engineFiles(p);
    return /\.tsx?$/.test(entry.name) ? [p] : [];
  });
}

describe('the rules engine is pure (ARCH-003)', () => {
  it('no engine file imports the store, the database, sync, I/O, screens, the live session or the platform', () => {
    const offending = engineFiles(ENGINE).flatMap(file =>
      fs.readFileSync(file, 'utf8').split('\n')
        .map((line, i) => ({ line: line.trim(), at: `${path.relative(ENGINE, file)}:${i + 1}` }))
        .filter(({ line }) => FORBIDDEN.test(line))
        .map(({ at, line }) => `${at}  ${line}`));
    expect(offending).toEqual([]);
  });

  // The engine may import src/content, so the rule has to hold for what content pulls in too. This follows every runtime import
  // from the engine, through every platform variant of a file (x.ts, x.native.ts, ...), and names the chain that breaks the rule.
  it('nothing the engine imports reaches them either, through any platform variant', () => {
    const SRC = path.resolve(ENGINE, '..');
    const IMPORT = /(?:^|\n)\s*(?:import|export)\s+(type\s+)?(?:[^'";]*?\s+from\s+)?['"]([^'"]+)['"]|require\(\s*['"]([^'"]+)['"]\s*\)/g;
    const variants = (from: string, spec: string) => {
      const base = path.resolve(path.dirname(from), spec);
      return ['', '/index'].flatMap(i => ['', '.native', '.ios', '.android', '.web'].flatMap(p => ['.ts', '.tsx'].map(x => base + i + p + x)))
        .concat(base).filter(c => fs.existsSync(c) && fs.statSync(c).isFile());
    };
    const via = new Map<string, string | null>(engineFiles(ENGINE).map(f => [f, null]));
    const queue = [...via.keys()];
    const offending: string[] = [];
    const name = (f: string) => path.relative(SRC, f).split(path.sep).join('/');
    const chain = (f: string) => { const out: string[] = []; for (let x: string | null | undefined = f; x; x = via.get(x)) out.unshift(name(x)); return out.join(' -> '); };
    for (let f = queue.shift(); f; f = queue.shift()) {
      for (const m of fs.readFileSync(f, 'utf8').matchAll(IMPORT)) {
        if (m[1]) continue;   // `import type` is erased
        const spec = m[2] ?? m[3];
        if (!spec.startsWith('.')) { if (/^(react-native|expo|zustand)/.test(spec)) offending.push(`${chain(f)} => ${spec}`); continue; }
        for (const r of variants(f, spec)) {
          if (/^(store|db|sync|io|components|session|platform)\/|^\.\.\/app\//.test(name(r))) offending.push(`${chain(f)} => ${name(r)}`);
          else if (!via.has(r)) { via.set(r, f); queue.push(r); }
        }
      }
    }
    expect(offending).toEqual([]);
  });

  it('the check itself catches the imports it is meant to', () => {
    for (const bad of ["import { DEFAULT_RULES } from '../store/characterStore';", "import x from 'react-native';",
      "import { getDb } from '../db/db';", "const lan = require('../session/lanTransport');", "import * as C from 'expo-crypto';"]) {
      expect(FORBIDDEN.test(bad)).toBe(true);
    }
    expect(FORBIDDEN.test("import { recomputeDerived } from './pipeline';")).toBe(false);
  });
});

// Contract ARCH-006: a class, feature or spell is named in one place, the ruleset's own module (ruleset/dnd5e.ts), and every other
// engine file reads it from there. The sample character is content by design (it builds the demo Fighter from the installed packs).
describe('the engine names no class or feature outside the ruleset module (ARCH-006)', () => {
  const ALLOWED = new Set([path.join('ruleset', 'dnd5e.ts'), 'demoCharacter.ts']);
  const classIds = ['artificer', 'barbarian', 'bard', 'cleric', 'druid', 'fighter', 'monk', 'paladin', 'ranger', 'rogue', 'sorcerer', 'warlock', 'wizard']
    .flatMap(id => [id, `${id}_2024`]);
  const declared = [
    ...dnd5e.WILD_SHAPE_CLASS_IDS, dnd5e.WILD_SHAPE_2014_CLASS_ID, dnd5e.KI_SAVE_FEATURE_ID, dnd5e.INFUSION_CLASS_ID,
    ...Object.values(dnd5e.MARTIAL_ARTS).flatMap(m => [m.featureId, m.classId]),
    ...dnd5e.CONCENTRATION_ADVANTAGE_FEATURE_IDS, ...dnd5e.COUNTS_AS_LARGE_FEATURE_IDS,
    ...dnd5e.ATTUNEMENT.setBy.map(([id]) => id), ...dnd5e.ATTUNEMENT.addBy.map(([id]) => id),
  ];
  const names = [...new Set([...classIds, ...declared])];
  // the file without its comment lines, so a name in a comment is not counted
  const code = (text: string) => text.split(/\r?\n/).filter(l => !/^\s*(\/\/|\*|\/\*)/.test(l)).join(' ');

  it('no other engine file has one of those names as a string', () => {
    const found = engineFiles(ENGINE)
      .filter(f => !ALLOWED.has(path.relative(ENGINE, f)))
      .flatMap(f => names.filter(n => new RegExp(`['"\`]${n}['"\`]`).test(code(fs.readFileSync(f, 'utf8')))).map(n => `${path.relative(ENGINE, f)}: '${n}'`));
    expect(found).toEqual([]);
  });
});

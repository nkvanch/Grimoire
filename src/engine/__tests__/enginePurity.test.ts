// Contract ARCH-003 (the rules engine is pure) and ARCH-033 (keep the core portable): the engine never reaches into the store,
// the database, sync, file I/O, the screens, the live session, or the React Native and Expo platform. A file that needs a value
// from one of those takes it as a parameter. Content (src/content) is a separate rule, ARCH-006.
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

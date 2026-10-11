// Guards against the render loop found on the phone (CombatStatePanel, 2026-10-11): a store selector that builds a new array or
// object each time (`s => s.x ?? []`) makes the component re-render without end ("Maximum update depth exceeded"), because the
// selector's result is compared by reference. Read the value, then fall back to a module-level constant outside the selector.
import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '..', '..');

function sourceFiles(dir: string, acc: string[] = []): string[] {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name === 'node_modules' || e.name.startsWith('.') || e.name === '__tests__') continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) sourceFiles(p, acc);
    else if (/\.(tsx?|jsx?)$/.test(p)) acc.push(p);
  }
  return acc;
}

describe('store selectors', () => {
  it('never return a fresh empty array or object literal', () => {
    const bad: string[] = [];
    const pattern = /use[A-Za-z]*Store\(\s*\(?\s*\w+\s*\)?\s*=>[^;\n]*\?\?\s*(\[\s*\]|\{\s*\})/g;
    for (const file of [...sourceFiles(path.join(ROOT, 'app')), ...sourceFiles(path.join(ROOT, 'src'))]) {
      const text = fs.readFileSync(file, 'utf8');
      for (const m of text.matchAll(pattern)) bad.push(`${path.relative(ROOT, file)}: ${m[0].slice(0, 100)}`);
    }
    expect(bad).toEqual([]);
  });
});

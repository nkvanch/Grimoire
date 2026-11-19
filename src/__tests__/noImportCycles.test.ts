/** @jest-environment node */
// No two source files import each other at runtime, directly or through others. In a cycle, whichever file loads first sees
// the other half-built, so a top-level value can be undefined in one bundle order and fine in another. `import type` is
// erased and does not count; a require() inside a function does, because it hides a cycle instead of removing it.
import fs from 'fs';
import path from 'path';

const ROOT = path.resolve(__dirname, '../..');
const IMPORT = /(?:^|\n)\s*(?:import|export)\s+(type\s+)?(?:[^'";]*?\s+from\s+)?['"](\.[^'"]+)['"]|(?<![.\w])require\(\s*['"](\.[^'"]+)['"]\s*\)/g;
const sources = (dir: string): string[] => fs.readdirSync(dir, { withFileTypes: true }).flatMap(e => {
  const p = path.join(dir, e.name);
  if (e.isDirectory()) return ['__tests__', 'testing', 'node_modules'].includes(e.name) ? [] : sources(p);
  return /\.tsx?$/.test(e.name) && !/\.test\./.test(e.name) ? [p] : [];
});
const resolve = (from: string, spec: string) => {
  const base = path.resolve(path.dirname(from), spec);
  return ['', '.ts', '.tsx', '/index.ts', '/index.tsx'].map(x => base + x).find(c => fs.existsSync(c) && fs.statSync(c).isFile());
};

it('src and app have no runtime import cycles', () => {
  const files = [...sources(path.join(ROOT, 'src')), ...sources(path.join(ROOT, 'app'))];
  const graph = new Map(files.map(f => [f, [...fs.readFileSync(f, 'utf8').matchAll(IMPORT)]
    .filter(m => !m[1]).map(m => resolve(f, m[2] ?? m[3])).filter((r): r is string => !!r && r !== f)]));

  // Tarjan: every strongly connected group of two or more files is a cycle.
  const index = new Map<string, number>(), low = new Map<string, number>(), onStack = new Set<string>(), stack: string[] = [], cycles: string[] = [];
  const name = (f: string) => path.relative(ROOT, f).split(path.sep).join('/');
  const visit = (v: string) => {
    index.set(v, index.size); low.set(v, index.get(v)!); stack.push(v); onStack.add(v);
    for (const w of graph.get(v) ?? []) {
      if (!graph.has(w)) continue;
      if (!index.has(w)) { visit(w); low.set(v, Math.min(low.get(v)!, low.get(w)!)); }
      else if (onStack.has(w)) low.set(v, Math.min(low.get(v)!, index.get(w)!));
    }
    if (low.get(v) !== index.get(v)) return;
    const group: string[] = [];
    for (let w = stack.pop()!; ; w = stack.pop()!) { onStack.delete(w); group.push(w); if (w === v) break; }
    if (group.length > 1) cycles.push(group.map(name).sort().join(' <-> '));
  };
  for (const f of files) if (!index.has(f)) visit(f);
  expect(cycles).toEqual([]);
});

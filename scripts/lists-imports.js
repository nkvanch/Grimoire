// Points every import of ScrollView, FlatList or SectionList from react-native at src/components/Lists (which lets a tap through
// while the keyboard is open). Idempotent.
//   node scripts/lists-imports.js            rewrite app/ and src/
//   node scripts/lists-imports.js --check    list the files that still need it (exit 1 if any)
// Also exported: transform(text, file) for a single file's text (used to stage only these lines over another session's edits).
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const NAMES = ['ScrollView', 'FlatList', 'SectionList'];
const OWN = path.join(ROOT, 'src', 'components', 'Lists.tsx');

function transform(text, file) {
  const re = /import\s*\{([^}]*)\}\s*from\s*['"]react-native['"];?/;
  const m = text.match(re);
  if (!m) return text;
  const specs = m[1].split(',').map(s => s.trim()).filter(Boolean);
  const moved = specs.filter(s => NAMES.includes(s));
  if (moved.length === 0) return text;
  const kept = specs.filter(s => !NAMES.includes(s));
  const nl = text.includes('\r\n') ? '\r\n' : '\n';
  let rel = path.relative(path.dirname(file), path.join(ROOT, 'src', 'components', 'Lists')).split(path.sep).join('/');
  if (!rel.startsWith('.')) rel = `./${rel}`;
  const listsImport = `import { ${moved.join(', ')} } from '${rel}';`;
  const rnImport = kept.length ? `import { ${kept.join(', ')} } from 'react-native';` : '';
  return text.replace(re, rnImport ? `${rnImport}${nl}${listsImport}` : listsImport);
}

function files(dir, acc = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name === 'node_modules' || e.name.startsWith('.') || e.name === '__tests__') continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) files(p, acc);
    else if (/\.tsx?$/.test(p) && p !== OWN) acc.push(p);
  }
  return acc;
}

if (require.main === module) {
  const check = process.argv.includes('--check');
  const todo = [];
  for (const f of [...files(path.join(ROOT, 'app')), ...files(path.join(ROOT, 'src'))]) {
    const text = fs.readFileSync(f, 'utf8');
    const out = transform(text, f);
    if (out === text) continue;
    todo.push(path.relative(ROOT, f));
    if (!check) fs.writeFileSync(f, out);
  }
  console.log(`${check ? 'need it' : 'rewrote'}: ${todo.length}`);
  if (check && todo.length) { console.log(todo.join('\n')); process.exit(1); }
}

module.exports = { transform };

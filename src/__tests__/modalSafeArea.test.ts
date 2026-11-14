// Every pop-up goes through components/AppModal, which keeps it above the Android navigation bar (edge-to-edge draws a bare
// react-native Modal under it, so Save buttons sat where a tap hits Back). Scans app/ and src/ so a new modal can't skip it.
import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '..', '..');
const OWN = path.join(ROOT, 'src', 'components', 'AppModal.tsx');

function tsxFiles(dir: string, acc: string[] = []): string[] {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name === 'node_modules' || e.name.startsWith('.') || e.name === '__tests__') continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) tsxFiles(p, acc);
    else if (p.endsWith('.tsx')) acc.push(p);
  }
  return acc;
}

it('no file but AppModal takes Modal from react-native', () => {
  const bad = [...tsxFiles(path.join(ROOT, 'app')), ...tsxFiles(path.join(ROOT, 'src'))]
    .filter(f => f !== OWN)
    .filter(f => /import\s*\{[^}]*\bModal\b[^}]*\}\s*from\s*['"]react-native['"]/.test(fs.readFileSync(f, 'utf8')))
    .map(f => path.relative(ROOT, f));
  expect(bad).toEqual([]);
});

// A stored picture is drawn only through the checked components (RecordPicture's RecordIcon / RecordDetailPicture, and
// PictureField, which runs its value through picturesOf): they refuse what is not a raster data picture and anything over the
// display cap. A raw <Image> elsewhere would draw an imported record's picture unchecked.
import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '..', '..');
const CHECKED = new Set(['src/components/RecordPicture.tsx', 'src/components/homebrew/PictureField.tsx'].map(p => path.join(ROOT, p)));

function tsxFiles(dir: string, acc: string[] = []): string[] {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name === 'node_modules' || e.name.startsWith('.') || e.name === '__tests__') continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) tsxFiles(p, acc);
    else if (p.endsWith('.tsx')) acc.push(p);
  }
  return acc;
}

it('only the checked picture components draw an <Image>', () => {
  const bad = [...tsxFiles(path.join(ROOT, 'app')), ...tsxFiles(path.join(ROOT, 'src'))]
    .filter(f => !CHECKED.has(f) && /<Image\b/.test(fs.readFileSync(f, 'utf8')))
    .map(f => path.relative(ROOT, f));
  expect(bad).toEqual([]);
});

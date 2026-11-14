// Every box that holds a name spreads NAME_INPUT (no autocorrect): the keyboard otherwise rewrites invented names as they are
// typed. Scans app/ and src/ (scripts/name-inputs.js) so a new name box can't skip it; `node scripts/name-inputs.js --fix <file>`.
import * as fs from 'fs';
import * as path from 'path';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { nameInputs, tsxFiles } = require('../../scripts/name-inputs.js');

const ROOT = path.resolve(__dirname, '..', '..');

it('every name box turns autocorrect off', () => {
  const missing = (tsxFiles(ROOT) as string[]).flatMap(f =>
    (nameInputs(fs.readFileSync(f, 'utf8'), f) as { line: number; spreadsName: boolean }[])
      .filter(x => !x.spreadsName).map(x => `${path.relative(ROOT, f)}:${x.line}`));
  expect(missing).toEqual([]);
});

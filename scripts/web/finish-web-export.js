// Finishes an `expo export --platform web` for hosting on a static site (GitHub Pages):
//   node scripts/web/finish-web-export.js <exportDir>
// Copies the cross-origin-isolation worker and its bootstrap next to index.html, loads the bootstrap first, and makes every
// unknown path under the app fall back to the app (a static host has no router).
const fs = require('fs');
const path = require('path');
const dir = process.argv[2];
if (!dir || !fs.existsSync(path.join(dir, 'index.html'))) { console.error('usage: finish-web-export.js <exportDir containing index.html>'); process.exit(1); }
const here = __dirname;
for (const f of ['coi-sw.js', 'coi-bootstrap.js']) fs.copyFileSync(path.join(here, f), path.join(dir, f));

const indexPath = path.join(dir, 'index.html');
let html = fs.readFileSync(indexPath, 'utf8');
if (!html.includes('coi-bootstrap.js')) {
  if (!html.includes('<head>')) { console.error('index.html has no <head>'); process.exit(1); }
  html = html.replace('<head>', '<head>\n<script src="coi-bootstrap.js"></script>');
}
fs.writeFileSync(indexPath, html);
fs.writeFileSync(path.join(dir, '404.html'), html);   // a refresh on a deep link lands on the app, which reads the path
fs.writeFileSync(path.join(dir, '.nojekyll'), '');     // GitHub Pages would otherwise skip the _expo folder
console.log('finished', dir);

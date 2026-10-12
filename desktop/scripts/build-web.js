'use strict';
// Builds the web export the desktop app shows, into desktop/app (served by main.js over grimoire://app).
//   node desktop/scripts/build-web.js        (from the repository root, or via `npm run build:web` in desktop/)
const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..', '..');
const out = path.join(root, 'desktop', 'app');
fs.rmSync(out, { recursive: true, force: true });

// No base URL: the desktop app serves the build from the root of its own scheme.
const env = { ...process.env, CI: '1' };
delete env.GRIMOIRE_WEB_BASE_URL;
const r = spawnSync('npx', ['expo', 'export', '--platform', 'web', '--output-dir', out], { cwd: root, env, stdio: 'inherit', shell: true });
if (r.status !== 0) { console.error('expo export failed'); process.exit(r.status || 1); }
if (!fs.existsSync(path.join(out, 'index.html'))) { console.error('no index.html in', out); process.exit(1); }
console.log('web build ready in', out);

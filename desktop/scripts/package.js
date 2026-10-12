'use strict';
// Packages the desktop app into desktop/out/Grimoire-<platform>-<arch> (a folder with the executable) and archives it.
//   node scripts/package.js [platform] [arch]      from desktop/, after `npm run build:web`
//   platform: win32 (default), linux, darwin       arch: x64 (default), arm64
// Build each platform's package on that platform: an archive made on Windows cannot carry Unix permissions, so a Linux or macOS
// build made there would not start without a manual `chmod +x`.
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const { packager } = require('@electron/packager');

const dir = path.resolve(__dirname, '..');
const pkg = require(path.join(dir, 'package.json'));
const platform = process.argv[2] || 'win32';
const arch = process.argv[3] || 'x64';
if (!['win32', 'linux', 'darwin'].includes(platform)) throw new Error(`unknown platform "${platform}"`);

(async () => {
  if (!fs.existsSync(path.join(dir, 'app', 'index.html'))) throw new Error('desktop/app is missing: run `npm run build:web` first');
  if (platform !== process.platform) {
    console.warn(`warning: packaging for ${platform} on ${process.platform}; Unix file permissions will not survive the archive.`);
  }
  const iconPath = path.join(dir, 'icon.ico');
  const paths = await packager({
    dir,
    out: path.join(dir, 'out'),
    name: 'Grimoire',
    platform,
    arch,
    overwrite: true,
    asar: true,
    prune: true,
    ...(platform === 'win32' && fs.existsSync(iconPath) ? { icon: iconPath } : {}),
    appVersion: pkg.version,
    appCopyright: 'GPL-3.0-or-later',
    ...(platform === 'win32'
      ? { win32metadata: { CompanyName: 'Grimoire', FileDescription: 'Grimoire', ProductName: 'Grimoire', OriginalFilename: 'Grimoire.exe' } }
      : {}),
    // Only the app itself goes in: no tests, build scripts, logs or earlier output.
    ignore: [/^\/scripts($|\/)/, /^\/__tests__($|\/)/, /^\/out($|\/)/, /^\/\.gitignore$/, /\.log$/, /^\/README\.md$/],
  });
  for (const p of paths) console.log('packaged', p);
  const folder = paths[0];
  const base = `Grimoire-${pkg.version}-${platform}-${arch}`;
  const archive = path.join(dir, 'out', platform === 'win32' ? `${base}.zip` : `${base}.tar.gz`);
  fs.rmSync(archive, { force: true });
  // Windows ships bsdtar as System32\tar.exe, which can write a zip. (A GNU tar earlier on PATH reads 'D:' as a host name.)
  const tarExe = process.platform === 'win32' ? path.join(process.env.SystemRoot || 'C:/Windows', 'System32', 'tar.exe') : 'tar';
  const args = platform === 'win32'
    ? ['-a', '-c', '-f', archive, '-C', path.dirname(folder), path.basename(folder)]
    : ['-c', '-z', '-f', archive, '-C', path.dirname(folder), path.basename(folder)];
  const r = spawnSync(tarExe, args, { stdio: 'inherit' });
  if (r.status !== 0) throw new Error('archive failed');
  console.log('archived', archive, Math.round(fs.statSync(archive).size / 1048576), 'MB');
})().catch(e => { console.error(e); process.exit(1); });

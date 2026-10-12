'use strict';
// A GitHub-Pages-like static server for checking the hosted build before it is published: serves <docs> at /Grimoire/ with no special
// headers (the app's service worker adds the isolation headers itself), a directory index, and docs/404.html (status 404) for misses.
//   node scripts/web/serve-pages.js <docsDir> [port]      then open http://127.0.0.1:<port>/Grimoire/app/
const http = require('http');
const fs = require('fs');
const path = require('path');

const docs = path.resolve(process.argv[2] || 'docs');
const port = Number(process.argv[3] || 8141);
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.json': 'application/json', '.wasm': 'application/wasm', '.png': 'image/png',
  '.ico': 'image/x-icon', '.css': 'text/css', '.ttf': 'font/ttf', '.md': 'text/markdown', '.db': 'application/octet-stream' };

http.createServer((req, res) => {
  const u = decodeURIComponent(req.url.split('?')[0]);
  let file = null;
  if (u === '/Grimoire' || u.startsWith('/Grimoire/')) {
    let p = path.join(docs, u.slice('/Grimoire'.length));
    if (fs.existsSync(p) && fs.statSync(p).isDirectory()) p = path.join(p, 'index.html');
    if (p.startsWith(docs) && fs.existsSync(p) && fs.statSync(p).isFile()) file = p;
  }
  if (!file) {
    res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
    fs.createReadStream(path.join(docs, '404.html')).pipe(res);
    return;
  }
  res.writeHead(200, { 'Content-Type': types[path.extname(file)] || 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
}).listen(port, '127.0.0.1', () => console.log(`serving ${docs} at http://127.0.0.1:${port}/Grimoire/`));

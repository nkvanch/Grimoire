'use strict';
// ============================================================================
// FILE: desktop/appServer.js
// Serves the packaged web build to the desktop window over the grimoire:// scheme. The in-browser database needs the page to be
// cross-origin isolated, so every response carries the COOP/COEP headers; an unknown path falls back to index.html because the
// router lives in the page. Paths never leave the app folder. Pure Node, tested directly.
// ============================================================================
const fs = require('fs');
const path = require('path');

const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.wasm': 'application/wasm', '.css': 'text/css; charset=utf-8',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif', '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon', '.ttf': 'font/ttf', '.otf': 'font/otf', '.woff': 'font/woff', '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8', '.map': 'application/json; charset=utf-8', '.db': 'application/octet-stream',
};

// What the page may load: itself, the SQLite worker (a blob made by the router), the wasm, https downloads of packs the person asks
// for, and images and fonts inline. Nothing else, and no frames or plugins.
const CSP = [
  "default-src 'self'",
  "script-src 'self' 'wasm-unsafe-eval'",
  "worker-src 'self' blob:",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  "connect-src 'self' blob: data: https:",
  "media-src 'self' blob:",
  "object-src 'none'",
  "frame-src 'none'",
  "base-uri 'self'",
  "form-action 'none'",
].join('; ');

const ISOLATION_HEADERS = {
  'Content-Security-Policy': CSP,
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Cross-Origin-Embedder-Policy': 'require-corp',
  'Cross-Origin-Resource-Policy': 'same-origin',
};

/**
 * Resolves a request path to a file inside `root`.
 * @param {string} root absolute path of the web build
 * @param {string} urlPath the URL's pathname, e.g. "/_expo/static/js/web/index-1.js" or "/compendium"
 * @returns {{ status: number; filePath: string | null; headers: Record<string, string> }}
 */
function resolveAppFile(root, urlPath) {
  let rel;
  try { rel = decodeURIComponent(urlPath); } catch { return { status: 400, filePath: null, headers: { ...ISOLATION_HEADERS } }; }
  rel = rel.split('?')[0].split('#')[0];
  const base = path.resolve(root);
  let filePath = path.resolve(base, '.' + path.posix.normalize('/' + rel));
  if (filePath !== base && !filePath.startsWith(base + path.sep)) {
    return { status: 403, filePath: null, headers: { ...ISOLATION_HEADERS } };
  }
  let isFile = false;
  try { isFile = fs.statSync(filePath).isFile(); } catch { /* missing */ }
  if (!isFile) {
    // A path with a file extension that is missing is a real 404; anything else is a route in the app.
    if (path.extname(rel) && path.extname(rel) !== '.html') {
      return { status: 404, filePath: null, headers: { ...ISOLATION_HEADERS, 'Content-Type': 'text/plain; charset=utf-8' } };
    }
    filePath = path.join(base, 'index.html');
  }
  const type = TYPES[path.extname(filePath).toLowerCase()] || 'application/octet-stream';
  return { status: 200, filePath, headers: { ...ISOLATION_HEADERS, 'Content-Type': type, 'Cache-Control': 'no-cache' } };
}

module.exports = { resolveAppFile, ISOLATION_HEADERS };

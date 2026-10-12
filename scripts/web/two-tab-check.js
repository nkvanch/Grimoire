'use strict';
// Two tabs on one browser profile: the second must say Grimoire is open elsewhere (instead of running with no storage) and must work
// again once the first is closed. Run it against the hosted build before publishing.
//   node scripts/web/two-tab-check.js <appUrl>        e.g. https://nkvanch.github.io/Grimoire/app/
// Needs Edge or Chrome (CHROME_PATH overrides) and Node 22+. Exits 1 on failure.
const { spawn } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const url = process.argv[2];
if (!url || !url.startsWith('http')) { console.error('usage: two-tab-check.js <appUrl>'); process.exit(2); }
const sleep = ms => new Promise(r => setTimeout(r, ms));
const BROWSERS = [process.env.CHROME_PATH, 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', 'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Google/Chrome/Application/chrome.exe', '/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser'].filter(Boolean);
const browser = BROWSERS.find(p => fs.existsSync(p));
if (!browser) { console.error('no Chromium-based browser found (set CHROME_PATH)'); process.exit(2); }

const port = 9700 + Math.floor(Math.random() * 100);
const profile = path.join(os.tmpdir(), `grimoire-two-tabs-${port}`);
fs.rmSync(profile, { recursive: true, force: true });
const proc = spawn(browser, ['--headless=new', '--disable-gpu', '--no-first-run', `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, 'about:blank'], { stdio: 'ignore' });

async function connect(target) {
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise(r => ws.addEventListener('open', r));
  let id = 0; const pending = new Map();
  ws.addEventListener('message', e => { const m = JSON.parse(e.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); } });
  const send = (method, params = {}) => new Promise(res => { const i = ++id; pending.set(i, res); ws.send(JSON.stringify({ id: i, method, params })); });
  const text = async () => (await send('Runtime.evaluate', { expression: 'document.body ? document.body.innerText.slice(0, 400) : ""', returnByValue: true })).result.result.value || '';
  return { send, text };
}
const pages = async () => (await (await fetch(`http://127.0.0.1:${port}/json`)).json()).filter(t => t.type === 'page');
const blockedRe = /open somewhere else/i;

(async () => {
  let failures = 0;
  const check = (ok, msg) => { console.log((ok ? 'PASS ' : 'FAIL ') + msg); if (!ok) failures++; };
  try {
    let first;
    for (let i = 0; i < 60 && !first; i++) { try { first = (await pages())[0]; } catch { /* starting */ } if (!first) await sleep(250); }
    const A = await connect(first);
    await A.send('Page.enable');
    await A.send('Page.navigate', { url });
    await sleep(15000);   // the first visit registers the service worker and reloads once
    const aText = await A.text();
    check(aText.trim().length > 0 && !blockedRe.test(aText), 'first tab starts');

    const second = await (await fetch(`http://127.0.0.1:${port}/json/new?${encodeURIComponent(url)}`, { method: 'PUT' })).json();
    const B = await connect(second);
    await sleep(24000);   // the app waits about twelve seconds for the lock, then gives up
    check(blockedRe.test(await B.text()), 'second tab says Grimoire is open elsewhere');

    await fetch(`http://127.0.0.1:${port}/json/close/${first.id}`);
    await sleep(1500);
    await B.send('Page.reload');
    await sleep(10000);
    const after = await B.text();
    check(after.trim().length > 0 && !blockedRe.test(after), 'second tab works once the first is closed');
  } finally { proc.kill(); }
  process.exit(failures ? 1 : 0);
})();

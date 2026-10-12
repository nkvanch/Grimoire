'use strict';
// Layout audit for the hosted web app at phone widths: loads each route in headless Chromium (Edge or Chrome) at several narrow widths
// and reports text that overlaps other text, content wider than the window, and truncated labels. Written after a tester's screenshot
// showed Home's section labels hidden under their cards; run it before publishing the web build.
//
//   node scripts/web/layout-audit.js <appBaseUrl> [--widths 320,360,390,412] [--character path/to/character.json] [--routes /,/characters]
//   e.g. node scripts/web/layout-audit.js http://127.0.0.1:8140/Grimoire/app/
// Needs Edge or Chrome (set CHROME_PATH to override) and Node 22+. Exits 1 when any issue is found.
const { spawn } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const args = process.argv.slice(2);
const baseUrl = (args.find(a => !a.startsWith('--')) || '').replace(/\/?$/, '/');
const opt = name => { const i = args.indexOf(`--${name}`); return i >= 0 ? args[i + 1] : null; };
const widths = (opt('widths') || '320,360,390,412').split(',').map(Number);
const characterFile = opt('character');
const DEFAULT_ROUTES = ['/', '/characters', '/homebrew', '/compendium', '/campaigns', '/settings', '/about', '/backup', '/import-character', '/live',
  '/homebrew/spell-builder', '/homebrew/race-builder', '/homebrew/class-builder', '/homebrew/subclass-builder', '/homebrew/feat-builder',
  '/homebrew/item-builder', '/homebrew/monster-builder', '/homebrew/background-builder', '/homebrew/condition-builder', '/homebrew/import-package'];
const routes = (opt('routes') ? opt('routes').split(',') : DEFAULT_ROUTES);
if (!baseUrl.startsWith('http')) { console.error('usage: layout-audit.js <appBaseUrl> [--widths ..] [--character file] [--routes ..]'); process.exit(2); }

const BROWSERS = [process.env.CHROME_PATH, 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', 'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Google/Chrome/Application/chrome.exe', '/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser'].filter(Boolean);
const browser = BROWSERS.find(p => fs.existsSync(p));
if (!browser) { console.error('no Chromium-based browser found (set CHROME_PATH)'); process.exit(2); }

const sleep = ms => new Promise(r => setTimeout(r, ms));

// Runs in the page. Returns a list of issues.
const AUDIT = `(() => {
  const issues = [];
  const vw = document.documentElement.clientWidth;
  if (document.documentElement.scrollWidth > vw + 1) issues.push({ kind: 'page wider than the window', detail: document.documentElement.scrollWidth + ' > ' + vw });
  const inHorizontalScroller = el => { for (let p = el.parentElement; p; p = p.parentElement) { const o = getComputedStyle(p); if ((o.overflowX === 'auto' || o.overflowX === 'scroll') && p.scrollWidth > p.clientWidth + 1) return true; } return false; };
  const fixed = el => { for (let p = el; p; p = p.parentElement) { if (getComputedStyle(p).position === 'fixed') return true; } return false; };
  // The part of an element that can actually be seen: clipped by every scrolling or hidden-overflow ancestor.
  const visibleRect = el => {
    const r = el.getBoundingClientRect();
    let l = r.left, t = r.top, rt = r.right, b = r.bottom;
    for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
      const cs = getComputedStyle(p);
      if (cs.overflowX === 'visible' && cs.overflowY === 'visible') continue;
      const pr = p.getBoundingClientRect();
      if (cs.overflowX !== 'visible') { l = Math.max(l, pr.left); rt = Math.min(rt, pr.right); }
      if (cs.overflowY !== 'visible') { t = Math.max(t, pr.top); b = Math.min(b, pr.bottom); }
    }
    return { left: l, top: t, right: rt, bottom: b, width: rt - l, height: b - t };
  };
  const boxes = [];
  for (const el of document.querySelectorAll('body *')) {
    const own = [...el.childNodes].some(n => n.nodeType === 3 && n.textContent.trim());
    if (!own) continue;
    const cs = getComputedStyle(el);
    if (cs.visibility === 'hidden' || cs.display === 'none' || Number(cs.opacity) === 0) continue;
    const r = visibleRect(el);
    if (r.width < 2 || r.height < 2) continue;
    if (fixed(el) || inHorizontalScroller(el)) continue;
    if (el.textContent.trim() === '🎲') continue;   // the floating dice button is meant to sit over the content
    const full = el.getBoundingClientRect();
    // wider than the area that clips it (not a scroller): the text is cut off sideways
    if (full.right > r.right + 2 || full.left < r.left - 2) boxes.cutOff = (boxes.cutOff || []).concat([{ text: [...el.childNodes].filter(n => n.nodeType === 3).map(n => n.textContent.trim()).join(' ').slice(0, 40), by: Math.round(Math.max(full.right - r.right, r.left - full.left)) }]);
    boxes.push({ el, r, text: [...el.childNodes].filter(n => n.nodeType === 3).map(n => n.textContent.trim()).join(' ').slice(0, 40) });
  }
  for (const c of boxes.cutOff || []) issues.push({ kind: 'text cut off sideways', detail: JSON.stringify(c.text) + ' by ' + c.by + 'px' });
  for (const b of boxes) {
    if (b.r.right > vw + 1 || b.r.left < -1) issues.push({ kind: 'text outside the window', detail: JSON.stringify(b.text) + ' x ' + Math.round(b.r.left) + '..' + Math.round(b.r.right) });
    if (b.el.scrollWidth > b.el.clientWidth + 1 && /ellipsis|clip/.test(getComputedStyle(b.el).textOverflow + getComputedStyle(b.el).overflow)) {
      issues.push({ kind: 'truncated text', detail: JSON.stringify(b.text) });
    }
  }
  // Text partly hidden under a card or panel (a box with a background or a border) that is not around it.
  const panels = [];
  for (const el of document.querySelectorAll('body *')) {
    const cs = getComputedStyle(el);
    const bg = cs.backgroundColor.match(/[d.]+/g) || [];
    const hasBg = cs.backgroundColor !== 'transparent' && !(bg.length === 4 && Number(bg[3]) < 0.05);
    const hasBorder = parseFloat(cs.borderTopWidth) > 0 || parseFloat(cs.borderLeftWidth) > 0;
    if (!hasBg && !hasBorder) continue;
    if (!el.textContent.trim()) continue;   // a background layer with nothing in it is not a card
    if (cs.visibility === 'hidden' || cs.display === 'none' || fixed(el)) continue;
    const r = visibleRect(el);
    if (r.width * r.height < 600) continue;
    panels.push({ el, r });
  }
  for (const b of boxes) {
    const area = b.r.width * b.r.height;
    for (const p of panels) {
      if (p.el === b.el || p.el.contains(b.el) || b.el.contains(p.el)) continue;
      if (p.el.textContent.trim() === b.text) continue;   // the same glyph drawn again in a layer of its own
      const w = Math.min(b.r.right, p.r.right) - Math.max(b.r.left, p.r.left);
      const h = Math.min(b.r.bottom, p.r.bottom) - Math.max(b.r.top, p.r.top);
      if (w > 3 && h > 3 && (w * h) / area > 0.1) { issues.push({ kind: 'text partly under a panel', detail: JSON.stringify(b.text) + ' (' + Math.round(w) + 'x' + Math.round(h) + 'px) under ' + JSON.stringify(p.el.textContent.trim().slice(0, 30)) + ' <' + p.el.tagName.toLowerCase() + ' ' + getComputedStyle(p.el).position + ' bg ' + getComputedStyle(p.el).backgroundColor + '>' }); break; }
    }
  }
  for (let i = 0; i < boxes.length; i++) {
    for (let j = i + 1; j < boxes.length; j++) {
      const a = boxes[i], c = boxes[j];
      if (a.el.contains(c.el) || c.el.contains(a.el)) continue;
      const w = Math.min(a.r.right, c.r.right) - Math.max(a.r.left, c.r.left);
      const h = Math.min(a.r.bottom, c.r.bottom) - Math.max(a.r.top, c.r.top);
      if (w <= 3 || h <= 3) continue;
      const smaller = Math.min(a.r.width * a.r.height, c.r.width * c.r.height);
      if (w * h / smaller < 0.2) continue;
      // the same glyph drawn twice in the same place (a tab icon and its focused copy) is not a visible overlap
      if (a.text === c.text && Math.abs(a.r.left - c.r.left) < 2 && Math.abs(a.r.top - c.r.top) < 2) continue;
      issues.push({ kind: 'overlapping text', detail: JSON.stringify(a.text) + ' over ' + JSON.stringify(c.text) + ' (' + Math.round(w) + 'x' + Math.round(h) + 'px)' });
    }
  }
  return issues;
})()`;

async function main() {
  const port = 9600 + Math.floor(Math.random() * 100);
  const profile = path.join(os.tmpdir(), `grimoire-audit-${port}`);
  fs.rmSync(profile, { recursive: true, force: true });
  const proc = spawn(browser, ['--headless=new', '--disable-gpu', '--no-first-run', `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, 'about:blank'], { stdio: 'ignore' });
  let total = 0;
  try {
    let target;
    for (let i = 0; i < 60 && !target; i++) {
      try { target = (await (await fetch(`http://127.0.0.1:${port}/json`)).json()).find(t => t.type === 'page'); } catch { /* starting */ }
      if (!target) await sleep(250);
    }
    const ws = new WebSocket(target.webSocketDebuggerUrl);
    await new Promise(r => ws.addEventListener('open', r));
    let id = 0; const pending = new Map();
    const send = (method, params = {}) => new Promise(res => { const i = ++id; pending.set(i, res); ws.send(JSON.stringify({ id: i, method, params })); });
    ws.addEventListener('message', e => {
      const m = JSON.parse(e.data);
      if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); }
      // an alert or confirm would block the page for good: answer it
      if (m.method === 'Page.javascriptDialogOpening') {
        if (process.env.AUDIT_DEBUG) console.log('   [dialog]', String(m.params.message).replace(/s+/g, ' ').slice(0, 200));
        void send('Page.handleJavaScriptDialog', { accept: true });
      }
    });
    const evalJs = async src => (await send('Runtime.evaluate', { expression: src, awaitPromise: true, returnByValue: true })).result.result.value;
    await send('Page.enable');

    const pressSkip = `(async()=>{const wait=ms=>new Promise(r=>setTimeout(r,ms)); const el=[...document.querySelectorAll('div,span')].filter(e=>e.textContent.trim()==='Skip').pop(); if(!el) return false;
      const f=(t,C=MouseEvent)=>el.dispatchEvent(new C(t,{bubbles:true,cancelable:true,view:window,button:0,pointerId:1,pointerType:'mouse',isPrimary:true})); f('pointerdown',PointerEvent); f('mousedown'); await wait(60); f('pointerup',PointerEvent); f('mouseup'); f('click'); await wait(1500); return true;})()`;

    for (const width of widths) {
      await send('Emulation.setDeviceMetricsOverride', { width, height: 780, deviceScaleFactor: 2, mobile: true });
      // first visit: the service worker registers and the page reloads once; the packs install
      await send('Page.navigate', { url: baseUrl });
      await sleep(15000);
      await evalJs(pressSkip);
      if (characterFile) {
        await send('Page.navigate', { url: baseUrl + 'import-character' });
        await sleep(5000);
        const text = fs.readFileSync(characterFile, 'utf8');
        await evalJs(`(async()=>{const wait=ms=>new Promise(r=>setTimeout(r,ms)); const b=document.querySelector('[data-testid="choose-character-file"]'); if(b){const f=(t,C=MouseEvent)=>b.dispatchEvent(new C(t,{bubbles:true,cancelable:true,view:window,button:0,pointerId:1,pointerType:'mouse',isPrimary:true})); f('pointerdown',PointerEvent); f('mousedown'); await wait(60); f('pointerup',PointerEvent); f('mouseup'); f('click'); await wait(500);}
          const input=document.querySelector('input[data-grimoire-file-input]'); if(!input) return 'no input'; const file=new File([${JSON.stringify(text)}],'c.json',{type:'application/json'}); const dt=new DataTransfer(); dt.items.add(file); input.files=dt.files; input.dispatchEvent(new Event('change',{bubbles:true})); await wait(7000); return 'imported';})()`);
      }
      const list = [...routes];
      if (characterFile) {
        // open the first character to learn its sheet route
        await send('Page.navigate', { url: baseUrl + 'characters' });
        await sleep(6000);
        const sheet = await evalJs(`(async()=>{const wait=ms=>new Promise(r=>setTimeout(r,ms)); const el=[...document.querySelectorAll('div')].find(d=>d.getAttribute('tabindex')==='0'&&/Level \\d+/.test(d.innerText||'')); if(!el) return null;
          const f=(t,C=MouseEvent)=>el.dispatchEvent(new C(t,{bubbles:true,cancelable:true,view:window,button:0,pointerId:1,pointerType:'mouse',isPrimary:true})); f('pointerdown',PointerEvent); f('mousedown'); await wait(60); f('pointerup',PointerEvent); f('mouseup'); f('click'); await wait(2500); return location.pathname;})()`);
        if (!sheet || !sheet.includes('/sheet/')) console.log('   (could not open a character sheet; got ' + JSON.stringify(sheet) + ')');
        if (sheet && sheet.includes('/sheet/')) list.push(sheet.slice(new URL(baseUrl).pathname.length - 1));
      }
      for (const route of list) {
        await send('Page.navigate', { url: baseUrl.replace(/\/$/, '') + (route === '/' ? '/' : route) });
        await sleep(3500);
        const issues = await evalJs(AUDIT);
        total += issues.length;
        const shown = (issues || []).slice(0, Number(process.env.AUDIT_SHOW || 5)).map(i => `    - ${i.kind}: ${i.detail}`).join('\n');
        console.log(`${String(width).padStart(3)}px ${route.padEnd(34)} ${issues.length ? issues.length + ' issue(s)\n' + shown : 'ok'}`);
      }
    }
    ws.close();
  } finally { proc.kill(); }
  console.log(total ? `\n${total} issue(s) found` : '\nno layout issues found');
  process.exit(total ? 1 : 0);
}
main().catch(e => { console.error('audit failed:', e); process.exit(2); });

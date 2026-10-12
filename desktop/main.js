'use strict';
// ============================================================================
// FILE: desktop/main.js
// The Grimoire desktop app: one window that shows the web build (./app) over a private grimoire:// scheme, plus the few things a
// page cannot do itself, exposed through preload.js: real TCP sockets for live sessions, this computer's LAN address, and PDF
// export. The page is the same code as the phone app and the browser build.
// ============================================================================
const { app, BrowserWindow, protocol, ipcMain, dialog, shell, Menu } = require('electron');
const fs = require('fs');
const path = require('path');
const { TcpBridge } = require('./tcpBridge');
const { localIPv4 } = require('./netInfo');
const { resolveAppFile } = require('./appServer');

const SCHEME = 'grimoire';
const APP_ORIGIN = `${SCHEME}://app`;
const APP_ROOT = path.join(__dirname, 'app');

// Must run before the app is ready: a standard, secure scheme gets cookies-less storage origins, fetch, workers and OPFS.
protocol.registerSchemesAsPrivileged([
  { scheme: SCHEME, privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true, stream: true } },
]);

if (!app.requestSingleInstanceLock()) {
  app.quit();
}

/** @type {BrowserWindow | null} */
let mainWindow = null;
const bridge = new TcpBridge(event => {
  if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('tcp:event', event);
});

/** Only our own page may use the bridge. */
/** True for a URL on the app's own origin (a custom scheme has no URL.origin in Node, so compare the parts). */
function isAppUrl(url) {
  try { const u = new URL(url); return u.protocol === `${SCHEME}:` && u.host === 'app'; } catch { return false; }
}
function fromApp(event) {
  return isAppUrl(event.senderFrame.url);
}
function guarded(handler) {
  return (event, ...args) => {
    if (!fromApp(event)) throw new Error('not allowed');
    return handler(...args);
  };
}

function registerIpc() {
  ipcMain.handle('tcp:listen', guarded((port, host) => bridge.listen(Number(port), String(host))));
  ipcMain.handle('tcp:connect', guarded((host, port) => bridge.connect(String(host), Number(port))));
  ipcMain.handle('tcp:write', guarded((socketId, data) => bridge.write(Number(socketId), String(data))));
  ipcMain.on('tcp:destroy', (event, socketId) => { if (fromApp(event)) bridge.destroy(Number(socketId)); });
  ipcMain.on('tcp:closeServer', (event, serverId) => { if (fromApp(event)) bridge.closeServer(Number(serverId)); });
  ipcMain.handle('net:localIPv4', guarded(() => localIPv4()));
  ipcMain.handle('pdf:fromHtml', guarded((html, suggestedName) => saveHtmlAsPdf(String(html), String(suggestedName))));
}

/** Prints HTML to a PDF in a hidden window with scripts off, then asks where to save it. */
async function saveHtmlAsPdf(html, suggestedName) {
  const printer = new BrowserWindow({
    show: false,
    webPreferences: { sandbox: true, javascript: false, contextIsolation: true, nodeIntegration: false },
  });
  let pdf;
  try {
    await printer.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(html));
    pdf = await printer.webContents.printToPDF({ printBackground: true, preferCSSPageSize: true });
  } finally {
    printer.destroy();
  }
  const name = suggestedName.toLowerCase().endsWith('.pdf') ? suggestedName : `${suggestedName}.pdf`;
  // Automated checks have no one to answer a save box: they name the file up front.
  const forced = process.env.GRIMOIRE_TEST_SAVE_PATH;
  if (forced) {
    await fs.promises.writeFile(forced, pdf);
    return { saved: true, path: forced };
  }
  const result = await dialog.showSaveDialog(mainWindow ?? undefined, {
    defaultPath: path.join(app.getPath('documents'), name.replace(/[<>:"/\\|?*]/g, '-')),
    filters: [{ name: 'PDF', extensions: ['pdf'] }],
  });
  if (result.canceled || !result.filePath) return { saved: false };
  await fs.promises.writeFile(result.filePath, pdf);
  return { saved: true, path: result.filePath };
}

function createWindow() {
  const hidden = process.env.GRIMOIRE_HIDE_WINDOW === '1';   // used by the automated check
  mainWindow = new BrowserWindow({
    width: 1280, height: 860, minWidth: 820, minHeight: 600,
    show: !hidden,
    backgroundColor: '#0f0f1a',
    title: 'Grimoire',
    icon: path.join(__dirname, 'icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      spellcheck: false,
    },
  });

  // Links to the web open in the person's browser; the window never navigates away from the app.
  const isWeb = url => /^https?:\/\//i.test(url);
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (isWeb(url)) void shell.openExternal(url);
    return { action: 'deny' };
  });
  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (isAppUrl(url)) return;
    event.preventDefault();
    if (isWeb(url)) void shell.openExternal(url);
  });

  // The camera is the only permission the page asks for (scanning a join code); microphone and the rest stay off.
  mainWindow.webContents.session.setPermissionRequestHandler((webContents, permission, callback, details) => {
    callback(permission === 'media' && details.requestingUrl.startsWith(APP_ORIGIN) && !(details.mediaTypes || []).includes('audio'));
  });

  // Automated checks run with a hidden window, where a native alert box could never be answered: collect them instead.
  if (process.env.GRIMOIRE_COLLECT_ALERTS === '1') {
    mainWindow.webContents.on('dom-ready', () => {
      void mainWindow.webContents.executeJavaScript(
        'window.__alerts = window.__alerts || []; window.alert = m => { window.__alerts.push(String(m)); }; window.confirm = () => true;');
    });
  }

  // The default light scrollbar is jarring on the dark theme.
  mainWindow.webContents.on('dom-ready', () => {
    void mainWindow.webContents.insertCSS(
      '::-webkit-scrollbar { width: 12px; height: 12px; } ::-webkit-scrollbar-track { background: #0f0f1a; } '
      + '::-webkit-scrollbar-thumb { background: #3a3a5e; border-radius: 6px; border: 2px solid #0f0f1a; } '
      + '::-webkit-scrollbar-thumb:hover { background: #c9a84c; }');
  });

  mainWindow.on('closed', () => { mainWindow = null; bridge.closeAll(); });
  void mainWindow.loadURL(`${APP_ORIGIN}/`);
  if (process.env.GRIMOIRE_DEVTOOLS === '1') mainWindow.webContents.openDevTools({ mode: 'detach' });
}

app.whenReady().then(() => {
  protocol.handle(SCHEME, async request => {
    const url = new URL(request.url);
    const r = resolveAppFile(APP_ROOT, url.pathname);
    if (!r.filePath) return new Response(String(r.status), { status: r.status, headers: r.headers });
    const body = await fs.promises.readFile(r.filePath);
    return new Response(body, { status: r.status, headers: r.headers });
  });
  registerIpc();
  if (app.isPackaged) Menu.setApplicationMenu(null);
  createWindow();
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});

app.on('second-instance', () => {
  if (mainWindow) { if (mainWindow.isMinimized()) mainWindow.restore(); mainWindow.focus(); }
});
app.on('window-all-closed', () => { bridge.closeAll(); app.quit(); });

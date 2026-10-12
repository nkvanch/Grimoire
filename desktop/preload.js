'use strict';
// ============================================================================
// FILE: desktop/preload.js
// Exposes the desktop bridge to the page as window.grimoireDesktop (contract: src/platform/desktop.ts). Nothing else from Node or
// Electron reaches the page; every call goes to a handler in main.js that checks the caller is the app's own page.
// ============================================================================
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('grimoireDesktop', {
  version: '1',
  tcp: {
    listen: (port, host) => ipcRenderer.invoke('tcp:listen', port, host),
    closeServer: serverId => { ipcRenderer.send('tcp:closeServer', serverId); },
    connect: (host, port) => ipcRenderer.invoke('tcp:connect', host, port),
    write: (socketId, data) => ipcRenderer.invoke('tcp:write', socketId, data),
    destroy: socketId => { ipcRenderer.send('tcp:destroy', socketId); },
    onEvent: listener => {
      const handler = (_event, payload) => listener(payload);
      ipcRenderer.on('tcp:event', handler);
      return () => ipcRenderer.removeListener('tcp:event', handler);
    },
  },
  network: {
    localIPv4: () => ipcRenderer.invoke('net:localIPv4'),
  },
  pdf: {
    fromHtml: (html, suggestedName) => ipcRenderer.invoke('pdf:fromHtml', html, suggestedName),
  },
});

# Grimoire for Windows

The Grimoire app in its own window. It is the same code as the phone app, built for the web and shown in an Electron window, with the
parts a web page cannot do provided by the desktop shell:

- **Live sessions over the local network.** Hosting and joining use real TCP sockets (`tcpBridge.js`), so a PC can host a table for
  phones, join a phone's table, or play PC to PC. The room code, ports (7742 and 7743) and protocol are the phone app's.
- **PDF export.** Character sheets and homebrew print to PDF and ask where to save.
- **This computer's network address**, for the room code.
- Your data (characters, homebrew, installed packs) is stored in the app's own profile folder on this computer.

## Build

From the repository root, once: `cd desktop && npm install`.

```
node desktop/scripts/build-web.js     # the web export into desktop/app (about 3 minutes)
cd desktop
npm start                             # run it
npm run package                       # desktop/out/Grimoire-win32-x64 and a .zip
```

`node desktop/scripts/make-ico.js` rebuilds `icon.ico` from `assets/icon.png`.

## How it fits together

| File | Role |
|---|---|
| `main.js` | Window, the `grimoire://` scheme, IPC handlers (each checks the caller is the app's own page), PDF printing |
| `appServer.js` | Maps a request to a file in `app/`, adds the cross-origin-isolation headers and a content security policy |
| `preload.js` | The only thing the page gets: `window.grimoireDesktop` (`src/platform/desktop.ts` is the contract) |
| `tcpBridge.js` | Node sockets behind ids and one event stream |
| `netInfo.js` | Picks the LAN address (skips virtual adapters) |

On the page side, `src/platform/tcpSocket.web.ts` replaces `react-native-tcp-socket` in web builds (see `metro.config.js`) so the
unchanged live-session code runs on the bridge.

## Checks

`desktop/__tests__` and `src/platform/__tests__/desktopTcpShim.test.ts` run with the normal test suite: real localhost sockets through
the shim and bridge, using the app's own transports. For the window itself, start it with `--remote-debugging-port=NNNN` and set
`GRIMOIRE_HIDE_WINDOW=1`, `GRIMOIRE_COLLECT_ALERTS=1` (alerts are collected on `window.__alerts` instead of opening a box) and
`GRIMOIRE_TEST_SAVE_PATH=<file>` (PDF export writes there instead of asking).

## Not done yet

- Windows installer and code signing (the zip is a portable folder; SmartScreen will warn about an unsigned executable).
- Scanning a join QR with the camera (type the room code instead).
- Auto-update.

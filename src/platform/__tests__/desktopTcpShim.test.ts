// The page-side TCP shim (platform/tcpSocket.web.ts) talking through the desktop bridge contract to the real Node bridge
// (desktop/tcpBridge.js) over localhost, driven by the app's own live-session transports.
import * as net from 'net';
import { LanClientTransport, LanServerTransport } from '../../session/lanTransport';
import { tcpAvailable } from '../tcp';
import { _resetTcpShimForTests } from '../tcpSocket.web';
import type { DesktopBridge, DesktopTcpEvent } from '../desktop';

jest.mock('react-native-tcp-socket', () => ({ __esModule: true, default: require('../tcpSocket.web').default }));

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { TcpBridge } = require('../../../desktop/tcpBridge') as { TcpBridge: new (emit: (e: DesktopTcpEvent) => void) => any };

function installBridge() {
  const listeners = new Set<(e: DesktopTcpEvent) => void>();
  // Events cross a process boundary in the real app: deliver them asynchronously and in order.
  const queue: DesktopTcpEvent[] = [];
  let scheduled = false;
  const flush = () => { scheduled = false; for (const e of queue.splice(0)) listeners.forEach(l => l(e)); };
  const node = new TcpBridge(e => { queue.push(e); if (!scheduled) { scheduled = true; setImmediate(flush); } });
  const bridge: DesktopBridge = {
    version: '1',
    tcp: {
      listen: (port, host) => node.listen(port, host),
      closeServer: id => node.closeServer(id),
      connect: (host, port) => node.connect(host, port),
      write: (id, data) => node.write(id, data),
      destroy: id => node.destroy(id),
      onEvent: l => { listeners.add(l); return () => listeners.delete(l); },
    },
    network: { localIPv4: async () => '192.168.1.50' },
    pdf: { fromHtml: async () => ({ saved: false }) },
  };
  (globalThis as unknown as { grimoireDesktop?: DesktopBridge }).grimoireDesktop = bridge;
  return { node, bridge };
}

async function freePort(): Promise<number> {
  return new Promise(resolve => {
    const s = net.createServer();
    s.listen(0, '127.0.0.1', () => { const p = (s.address() as net.AddressInfo).port; s.close(() => resolve(p)); });
  });
}
const until = async (pred: () => boolean, ms = 3000) => {
  const start = Date.now();
  while (!pred()) {
    if (Date.now() - start > ms) throw new Error('timed out waiting');
    await new Promise(r => setTimeout(r, 5));
  }
};

describe('live-session transports over the desktop bridge', () => {
  let node: any;
  afterEach(() => {
    node?.closeAll();
    _resetTcpShimForTests();
    delete (globalThis as unknown as { grimoireDesktop?: unknown }).grimoireDesktop;
  });

  it('is unavailable without the bridge and available with it', () => {
    expect(tcpAvailable()).toBe(false);
    ({ node } = installBridge());
    expect(tcpAvailable()).toBe(true);
  });

  it('a host and a player exchange frames and see the close', async () => {
    ({ node } = installBridge());
    const port = await freePort();
    const server = new LanServerTransport(port);
    const serverSide: { frames: string[]; closed: boolean; send?: (f: string) => void } = { frames: [], closed: false };
    await server.listen(conn => {
      serverSide.send = f => conn.send(f);
      conn.onFrame(f => serverSide.frames.push(f));
      conn.onClose(() => { serverSide.closed = true; });
    });

    const client = await new LanClientTransport('127.0.0.1', port).connect();
    const clientFrames: string[] = [];
    client.onFrame(f => clientFrames.push(f));
    let clientClosed = false;
    client.onClose(() => { clientClosed = true; });

    client.send('{"type":"hello","deviceId":"phone-1"}');
    await until(() => serverSide.frames.length === 1);
    expect(serverSide.frames[0]).toBe('{"type":"hello","deviceId":"phone-1"}');

    serverSide.send!('{"type":"welcome","sessionId":"s1"}');
    await until(() => clientFrames.length === 1);
    expect(clientFrames[0]).toBe('{"type":"welcome","sessionId":"s1"}');

    // several frames in a burst arrive whole and in order
    for (let i = 0; i < 20; i++) client.send(`{"n":${i}}`);
    await until(() => serverSide.frames.length === 21);
    expect(serverSide.frames.slice(1).map(f => JSON.parse(f).n)).toEqual([...Array(20).keys()]);

    client.close();
    await until(() => serverSide.closed);
    await until(() => clientClosed);
    server.close();
  });

  it('a player that cannot reach the host gets a connection error, not a hang', async () => {
    ({ node } = installBridge());
    const port = await freePort();
    await expect(new LanClientTransport('127.0.0.1', port).connect()).rejects.toMatchObject({ code: 'ECONNREFUSED' });
  });

  it('a host on a port that is taken reports the error', async () => {
    ({ node } = installBridge());
    const taken = net.createServer();
    await new Promise<void>(r => taken.listen(0, '0.0.0.0', () => r()));
    const port = (taken.address() as net.AddressInfo).port;
    try {
      await expect(new LanServerTransport(port).listen(() => undefined)).rejects.toMatchObject({ code: 'EADDRINUSE' });
    } finally {
      taken.close();
    }
  });

  it('several players can be connected at once', async () => {
    ({ node } = installBridge());
    const port = await freePort();
    const server = new LanServerTransport(port);
    const seen: string[] = [];
    await server.listen(conn => { conn.onFrame(f => seen.push(f)); });
    const players = await Promise.all([1, 2, 3].map(() => new LanClientTransport('127.0.0.1', port).connect()));
    players.forEach((p, i) => p.send(`p${i}`));
    await until(() => seen.length === 3);
    expect(seen.sort()).toEqual(['p0', 'p1', 'p2']);
    players.forEach(p => p.close());
    server.close();
  });
});

// The Node side of the desktop bridge, against real sockets on localhost, the LAN address picker, and the app file server.
const net = require('net');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { TcpBridge } = require('../tcpBridge');
const { localIPv4, rank } = require('../netInfo');
const { resolveAppFile } = require('../appServer');

const until = async (pred, ms = 2000) => {
  const start = Date.now();
  while (!pred()) {
    if (Date.now() - start > ms) throw new Error('timed out waiting');
    await new Promise(r => setTimeout(r, 5));
  }
};

describe('TcpBridge', () => {
  let events;
  let bridge;
  beforeEach(() => { events = []; bridge = new TcpBridge(e => events.push(e)); });
  afterEach(() => bridge.closeAll());

  it('accepts a connection, delivers data both ways and reports the close', async () => {
    const { serverId } = await bridge.listen(0, '127.0.0.1');
    const port = bridge.servers.get(serverId).address().port;

    const client = net.connect({ host: '127.0.0.1', port });
    client.setEncoding('utf8');
    const fromServer = [];
    client.on('data', d => fromServer.push(d));
    await until(() => events.some(e => e.type === 'connection'));
    const conn = events.find(e => e.type === 'connection');
    expect(conn.serverId).toBe(serverId);

    client.write('{"type":"hello"}\n');
    await until(() => events.some(e => e.type === 'data'));
    expect(events.find(e => e.type === 'data').data).toBe('{"type":"hello"}\n');

    await bridge.write(conn.socketId, '{"type":"welcome"}\n');
    await until(() => fromServer.length > 0);
    expect(fromServer.join('')).toBe('{"type":"welcome"}\n');

    client.destroy();
    await until(() => events.some(e => e.type === 'close'));
    expect(events.find(e => e.type === 'close').socketId).toBe(conn.socketId);
  });

  it('connects out, and keeps multi-byte text intact across chunks', async () => {
    const received = [];
    const server = net.createServer(s => { s.setEncoding('utf8'); s.on('data', d => received.push(d)); });
    await new Promise(r => server.listen(0, '127.0.0.1', r));
    const { socketId } = await bridge.connect('127.0.0.1', server.address().port);
    await bridge.write(socketId, 'Ünïcödé — ⚔️\n');
    await until(() => received.join('').length >= 'Ünïcödé — ⚔️\n'.length);
    expect(received.join('')).toBe('Ünïcödé — ⚔️\n');
    bridge.destroy(socketId);
    await until(() => events.some(e => e.type === 'close'));
    server.close();
  });

  it('rejects a connection to a closed port and a listen on a port in use', async () => {
    const probe = net.createServer();
    await new Promise(r => probe.listen(0, '127.0.0.1', r));
    const port = probe.address().port;
    await expect(bridge.listen(port, '127.0.0.1')).rejects.toMatchObject({ code: 'EADDRINUSE' });
    probe.close();
    await new Promise(r => setTimeout(r, 20));
    await expect(bridge.connect('127.0.0.1', port)).rejects.toMatchObject({ code: 'ECONNREFUSED' });
  });

  it('rejects a write to a socket that is gone', async () => {
    await expect(bridge.write(999, 'x')).rejects.toThrow('closed');
  });
});

describe('localIPv4', () => {
  const nic = (address, extra = {}) => [{ family: 'IPv4', address, internal: false, ...extra }];
  it('prefers a 192.168 address on a real adapter over a virtual one', () => {
    expect(localIPv4({
      'vEthernet (WSL)': nic('172.20.0.1'),
      'Wi-Fi': nic('192.168.1.42'),
      Loopback: nic('127.0.0.1', { internal: true }),
    })).toBe('192.168.1.42');
  });
  it('falls back to a virtual adapter rather than nothing, and skips link-local addresses', () => {
    expect(localIPv4({ 'VirtualBox Host-Only': nic('192.168.56.1'), Ethernet: nic('169.254.7.7') })).toBe('192.168.56.1');
  });
  it('returns null with no usable address', () => {
    expect(localIPv4({ lo: nic('127.0.0.1', { internal: true }), x: [{ family: 'IPv6', address: 'fe80::1', internal: false }] })).toBeNull();
  });
  it('accepts the numeric family some Node versions report', () => {
    expect(localIPv4({ Ethernet: [{ family: 4, address: '10.0.0.5', internal: false }] })).toBe('10.0.0.5');
  });
  it('ranks private ranges', () => {
    expect(rank('192.168.0.9')).toBe(0);
    expect(rank('10.1.1.1')).toBe(1);
    expect(rank('172.16.0.1')).toBe(2);
    expect(rank('8.8.8.8')).toBe(3);
    expect(rank('127.0.0.1')).toBeNull();
    expect(rank('nonsense')).toBeNull();
  });
  it('reads the real interfaces without throwing', () => {
    const ip = localIPv4();
    expect(ip === null || /^\d+\.\d+\.\d+\.\d+$/.test(ip)).toBe(true);
    expect(typeof os.hostname()).toBe('string');
  });
});

describe('resolveAppFile', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'grimoire-app-'));
  beforeAll(() => {
    fs.mkdirSync(path.join(root, '_expo', 'static'), { recursive: true });
    fs.writeFileSync(path.join(root, 'index.html'), '<html></html>');
    fs.writeFileSync(path.join(root, '_expo', 'static', 'a.js'), 'x');
    fs.writeFileSync(path.join(root, 'engine.wasm'), 'w');
    fs.writeFileSync(path.join(path.dirname(root), 'secret.txt'), 'nope');
  });
  afterAll(() => fs.rmSync(root, { recursive: true, force: true }));

  it('serves a file with its type and the isolation headers', () => {
    const r = resolveAppFile(root, '/_expo/static/a.js');
    expect(r.status).toBe(200);
    expect(r.filePath).toBe(path.join(root, '_expo', 'static', 'a.js'));
    expect(r.headers['Content-Type']).toMatch(/javascript/);
    expect(r.headers['Cross-Origin-Opener-Policy']).toBe('same-origin');
    expect(r.headers['Cross-Origin-Embedder-Policy']).toBe('require-corp');
    expect(r.headers['Cross-Origin-Resource-Policy']).toBe('same-origin');
  });
  it('serves wasm with the wasm type', () => {
    expect(resolveAppFile(root, '/engine.wasm').headers['Content-Type']).toBe('application/wasm');
  });
  it('sends app routes to index.html', () => {
    for (const p of ['/', '/compendium', '/homebrew/spell-builder']) {
      const r = resolveAppFile(root, p);
      expect(r.status).toBe(200);
      expect(r.filePath).toBe(path.join(root, 'index.html'));
    }
  });
  it('404s a missing file that has an extension', () => {
    expect(resolveAppFile(root, '/nope.js').status).toBe(404);
  });
  it('never leaves the app folder', () => {
    for (const p of ['/../secret.txt', '/%2e%2e/secret.txt', '/_expo/../../secret.txt']) {
      const r = resolveAppFile(root, p);
      expect(r.filePath === null || r.filePath.startsWith(root)).toBe(true);
      expect(r.filePath).not.toBe(path.join(path.dirname(root), 'secret.txt'));
    }
  });
});

describe('localIPv4 on Linux adapter names', () => {
  const nic = (address) => [{ family: 'IPv4', address, internal: false }];
  it('skips container and VM bridges and prefers the real network', () => {
    expect(localIPv4({
      docker0: nic('172.17.0.1'), 'br-3f2a1c': nic('172.18.0.1'), virbr0: nic('192.168.122.1'), veth12ab: nic('10.0.0.9'),
      wlp3s0: nic('192.168.1.77'),
    })).toBe('192.168.1.77');
  });
  it('treats a wired Linux name as a real adapter', () => {
    expect(localIPv4({ enp5s0: nic('10.0.0.4'), docker0: nic('172.17.0.1') })).toBe('10.0.0.4');
  });
  it('skips WireGuard and tunnels', () => {
    expect(localIPv4({ wg0: nic('10.8.0.2'), eth0: nic('192.168.0.20') })).toBe('192.168.0.20');
  });
});

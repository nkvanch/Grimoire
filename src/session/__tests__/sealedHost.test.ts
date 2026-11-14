// The room's side of the sealed transport (the desktop app's docs/CONTRACTS.md, "Sealed transport", LIVE-SEC-003): it answers a
// secure_hello with the desktop's own bytes, seals a phone host's room end to end, counts the devices that are not protected, turns
// them away when told to, and lets an app whose welcome was lost back in by its resume key, inside a sealed connection only.
import { randomBytes } from '@noble/hashes/utils';
import vectors from './fixtures/session-sealed.json';
import { SealedServerTransport, SealedClientTransport, fromBase64, SealedMode } from '../sealed';
import { InMemoryNetwork } from '../memoryTransport';
import { SessionHost } from '../host';
import { SessionPeer } from '../peer';
import { InMemoryKv } from '../kv';
import { peekRoom } from '../roomPeek';
import type { Connection, ServerTransport } from '../transport';

const b = (text: string) => fromBase64(text);
const ids = (prefix: string) => { let n = 0; return () => `${prefix}${++n}`; };

/** Settles the in-memory network until the promise is done (the handshake needs packets to move while connect() waits). */
async function settled<T>(net: InMemoryNetwork, p: Promise<T>): Promise<T> {
  let done = false; let value: T | undefined; let error: unknown;
  p.then(v => { done = true; value = v; }, e => { done = true; error = e; });
  for (let i = 0; i < 60 && !done; i++) { await net.settle(); await new Promise(r => setTimeout(r, 0)); }
  if (error) throw error;
  if (!done) throw new Error('did not settle');
  return value as T;
}

describe('the room answers with the desktop app\'s bytes', () => {
  it('the same secure_welcome, opens the same sealed hello and seals the same answer', async () => {
    const sent: string[] = [];
    let deliver: (f: string) => void = () => undefined;
    const conn: Connection = {
      id: 'c', send: f => { sent.push(f); }, onFrame: cb => { deliver = cb; }, onClose: () => undefined, close: () => undefined,
    };
    const inner: ServerTransport = { listen: async on => { on(conn); }, close: () => undefined };
    let accepted: Connection | null = null;
    await new SealedServerTransport(inner, { roomSeed: b(vectors.roomSeed), randomBytes: () => b(vectors.hostSecret) }).listen(c => { accepted = c; });

    deliver(JSON.stringify({ type: 'secure_hello', publicKey: vectors.clientPublic }));
    expect(JSON.parse(sent[0])).toEqual({ type: 'secure_welcome', publicKey: vectors.hostPublic, hostKey: vectors.roomPublicKey, signature: vectors.handshakeSignature });
    const got: string[] = [];
    accepted!.onFrame(f => got.push(f));
    deliver(JSON.stringify(vectors.packets[0].sealed));
    expect(got).toEqual([vectors.packets[0].plain]);
    accepted!.send(vectors.packets[1].plain);
    expect(JSON.parse(sent[1])).toEqual(vectors.packets[1].sealed);
  });
});

async function room(mode?: SealedMode) {
  const net = new InMemoryNetwork();
  const host = new SessionHost({ sessionId: 's1', dmPolicy: 'auto-first', newToken: ids('tok_long_enough_') });
  await host.start(new SealedServerTransport(net.server(), { roomSeed: randomBytes(32), randomBytes, ...(mode ? { mode } : {}) }));
  return { net, host };
}

async function join(net: InMemoryNetwork, id: string, sealed: boolean, kv = new InMemoryKv()) {
  const transport = sealed ? new SealedClientTransport(net.client(id), { kv, address: 'room:7743', randomBytes }) : net.client(id);
  const peer = await SessionPeer.create({ participantId: id, nickname: `Nick ${id}`, requestedCapabilities: ['player'], transport, kv, newId: ids(`${id}-`) });
  await settled(net, peer.connect().catch(() => undefined));
  for (let i = 0; i < 10; i++) await net.settle();
  return peer;
}

describe('a phone host seals its room', () => {
  it('a device that seals joins sealed; one that does not joins plain and is counted as not protected', async () => {
    const { net, host } = await room();
    const alice = await join(net, 'alice', true);
    expect(alice.status).toBe('connected');
    expect(alice.sealed).toBe(true);
    expect(host.unprotectedCount()).toBe(0);
    // after the handshake nothing Alice sends or receives is readable on the wire
    const aliceWire = net.log.filter(l => l.label === 'alice').slice(2).map(l => l.frame).join('');
    expect(aliceWire).not.toContain('Nick alice');
    expect(aliceWire).not.toContain('tok_long_enough_');

    const bob = await join(net, 'bob', false);
    expect(bob.status).toBe('connected');
    expect(bob.sealed).toBe(false);
    expect(host.unprotectedCount()).toBe(1);
  });

  it('a room that requires protection turns a plain device away, adds nobody, and still answers a peek', async () => {
    const { net, host } = await room('required');
    const bob = await join(net, 'bob', false);
    expect(bob.status).toBe('disconnected');
    expect(net.log.filter(l => l.label === 'bob' && l.dir === 's2c').map(l => l.frame).join('')).toContain('unsupported-packet');
    expect(host.debugState().participants.bob).toBeUndefined();
    const peek = await settled(net, peekRoom(net.client('carl'), 2000));
    expect(peek.sessionId ?? peek).toBeTruthy();
    expect((await join(net, 'alice', true)).status).toBe('connected');
  });
});

describe('a lost welcome does not lock a player out (resume key)', () => {
  // a raw sealed connection, so the test can send a hello and choose to ignore the welcome
  async function sealedHello(net: InMemoryNetwork, kv: InMemoryKv, token: string | null) {
    const conn = await settled(net, new SealedClientTransport(net.client('pat'), { kv, address: 'room:7743', randomBytes }).connect());
    const got: string[] = [];
    conn.onFrame(f => got.push(f));
    conn.send(JSON.stringify({ type: 'hello', participantId: 'pat', token, nickname: 'Pat', requestedCapabilities: ['player'], characterId: null, lastRevision: 0 }));
    for (let i = 0; i < 10; i++) await net.settle();
    conn.close();
    for (let i = 0; i < 5; i++) await net.settle();
    const first = got.map(f => JSON.parse(f))[0] ?? null;
    return first as { type: string; token?: string; message?: string } | null;
  }

  it('the room gives the token again to the app that never got it, and forgets the key once the token is used', async () => {
    const { net } = await room();
    const kv = new InMemoryKv();
    const first = await sealedHello(net, kv, null);
    expect(first?.type).toBe('welcome');
    const token = first!.token!;
    // the welcome was "lost": the app comes back with no token, and its key gets it in
    const again = await sealedHello(net, kv, null);
    expect(again).toMatchObject({ type: 'welcome', token });
    // with its token it authenticates, and the key no longer opens anything
    expect((await sealedHello(net, kv, token))?.type).toBe('welcome');
    expect(await sealedHello(net, kv, null)).toMatchObject({ type: 'error', message: 'authentication failed' });
  });

  it('a key sent on a plain connection opens nothing', async () => {
    const { net } = await room();
    const kv = new InMemoryKv();
    expect((await sealedHello(net, kv, null))?.type).toBe('welcome');
    const plain = await settled(net, net.client('pat').connect());
    const got: string[] = [];
    plain.onFrame(f => got.push(f));
    plain.send(JSON.stringify({ type: 'hello', participantId: 'pat', token: null, nickname: 'Pat', requestedCapabilities: ['player'], characterId: null, lastRevision: 0, resumeKey: 'x'.repeat(43) + '=' }));
    for (let i = 0; i < 10; i++) await net.settle();
    expect(got.map(f => JSON.parse(f))[0]).toMatchObject({ type: 'error', message: 'authentication failed' });
  });
});

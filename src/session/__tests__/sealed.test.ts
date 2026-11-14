// The sealed transport (the desktop app's docs/CONTRACTS.md, "Sealed transport"). The vectors in fixtures/session-sealed.json are the
// desktop app's, generated there and copied here unchanged: this app must reproduce every value and open every packet.
import { ed25519, x25519 } from '@noble/curves/ed25519';
import { randomBytes } from '@noble/hashes/utils';
import vectors from './fixtures/session-sealed.json';
import {
  SealedClientTransport, RoomKeyChangedError, RoomNotProtectedError, deriveKeys, fromBase64, handshakeMessage, nonceFor, openLine,
  resumeKeyFor, sealLine, toBase64, trustRoomKey,
} from '../sealed';
import { InMemoryKv } from '../kv';
import type { ClientTransport, Connection } from '../transport';

const b = (text: string) => fromBase64(text);

describe('the desktop app\'s test vectors', () => {
  const clientSecret = b(vectors.clientSecret);
  const hostSecret = b(vectors.hostSecret);
  const roomSeed = b(vectors.roomSeed);
  const clientPublic = x25519.getPublicKey(clientSecret);
  const hostPublic = x25519.getPublicKey(hostSecret);
  const roomKey = ed25519.getPublicKey(roomSeed);

  it('derives the same public keys, signature and both direction keys', () => {
    expect(toBase64(clientPublic)).toBe(vectors.clientPublic);
    expect(toBase64(hostPublic)).toBe(vectors.hostPublic);
    expect(toBase64(roomKey)).toBe(vectors.roomPublicKey);
    const signature = ed25519.sign(handshakeMessage(clientPublic, hostPublic), roomSeed);
    expect(toBase64(signature)).toBe(vectors.handshakeSignature);
    expect(ed25519.verify(b(vectors.handshakeSignature), handshakeMessage(clientPublic, hostPublic), roomKey)).toBe(true);

    const fromClient = deriveKeys(x25519.getSharedSecret(clientSecret, hostPublic), clientPublic, hostPublic);
    const fromHost = deriveKeys(x25519.getSharedSecret(hostSecret, clientPublic), clientPublic, hostPublic);
    expect(toBase64(fromClient.clientToRoom)).toBe(vectors.clientToHostKey);
    expect(toBase64(fromClient.roomToClient)).toBe(vectors.hostToClientKey);
    expect(toBase64(fromHost.clientToRoom)).toBe(vectors.clientToHostKey);   // bothSidesAgree
    expect(vectors.bothSidesAgree).toBe(true);
  });

  it('builds the same nonces', () => {
    for (const n of vectors.nonces) expect(toBase64(nonceFor(n.direction as 0 | 1, n.counter))).toBe(n.nonce);
  });

  it('seals every packet to the same bytes, and opens it', () => {
    for (const packet of vectors.packets) {
      const direction = packet.direction === 'clientToHost' ? 0 : 1;
      const key = b(direction === 0 ? vectors.clientToHostKey : vectors.hostToClientKey);
      expect(sealLine(key, direction, packet.sealed.n, packet.plain)).toEqual(packet.sealed);
      expect(openLine(key, direction, packet.sealed.n, packet.sealed.c)).toBe(packet.plain);
    }
  });

  it('does not open a packet with the wrong counter, the wrong direction or a changed byte', () => {
    const packet = vectors.packets[0];
    const key = b(vectors.clientToHostKey);
    expect(() => openLine(key, 0, packet.sealed.n + 1, packet.sealed.c)).toThrow();
    expect(() => openLine(key, 1, packet.sealed.n, packet.sealed.c)).toThrow();
    const bytes = b(packet.sealed.c);
    bytes[3] ^= 1;
    expect(() => openLine(key, 0, packet.sealed.n, toBase64(bytes))).toThrow();
  });
});

describe('base64', () => {
  it('round-trips every length and refuses what is not padded standard base64', () => {
    for (let n = 0; n < 40; n++) {
      const bytes = randomBytes(n);
      expect(fromBase64(toBase64(bytes))).toEqual(bytes);
    }
    expect(toBase64(Uint8Array.of(102, 111, 111, 98, 97))).toBe('Zm9vYmE=');
    for (const bad of ['Zm9vYmE', 'Zm9v-mE=', 'Zm9v YmE=', '=Zm9vYmE', 'Zm9vYmE==']) expect(() => fromBase64(bad)).toThrow();
  });
});

// ── a room, to talk to ────────────────────────────────────────────────────────

type Wire = { dir: 'c2r' | 'r2c'; frame: string }[];

class Pipe implements Connection {
  readonly id = 'pipe';
  private frameCb: ((f: string) => void) | null = null;
  private closeCb: (() => void) | null = null;
  closed = false;
  constructor(private readonly wire: Wire, private readonly room: (frame: string, reply: (frame: string) => void) => void) {}
  send(frame: string) {
    if (this.closed) return;
    this.wire.push({ dir: 'c2r', frame });
    this.room(frame, f => { this.wire.push({ dir: 'r2c', frame: f }); setTimeout(() => this.frameCb?.(f), 0); });
  }
  onFrame(cb: (f: string) => void) { this.frameCb = cb; }
  onClose(cb: () => void) { this.closeCb = cb; }
  close() { if (!this.closed) { this.closed = true; this.closeCb?.(); } }
  /** The room sends a frame of its own. */
  push(frame: string) { setTimeout(() => this.frameCb?.(frame), 0); }
}

/** A room that seals the way the desktop app's does. `behaviour` bends it for the cases that go wrong. */
function sealingRoom(seed = randomBytes(32), behaviour: { badSignature?: boolean } = {}) {
  const roomKey = ed25519.getPublicKey(seed);
  const wire: Wire = [];
  const heard: string[] = [];   // what the room read once opened
  let keys: ReturnType<typeof deriveKeys> | null = null;
  let received = 0;
  let sent = 0;
  let pipe: Pipe | null = null;
  const transport: ClientTransport = {
    async connect() {
      pipe = new Pipe(wire, (frame, reply) => {
        const packet = JSON.parse(frame);
        if (packet.type === 'secure_hello') {
          const hostSecret = randomBytes(32);
          const clientPublic = fromBase64(packet.publicKey);
          const hostPublic = x25519.getPublicKey(hostSecret);
          const signature = ed25519.sign(handshakeMessage(clientPublic, behaviour.badSignature ? clientPublic : hostPublic), seed);
          keys = deriveKeys(x25519.getSharedSecret(hostSecret, clientPublic), clientPublic, hostPublic);
          reply(JSON.stringify({ type: 'secure_welcome', publicKey: toBase64(hostPublic), hostKey: toBase64(roomKey), signature: toBase64(signature) }));
          return;
        }
        if (packet.type === 'sealed' && keys) heard.push(openLine(keys.clientToRoom, 0, received++, packet.c));
      });
      return pipe;
    },
  };
  return {
    transport, wire, heard, roomKey,
    say: (line: string) => pipe!.push(JSON.stringify(sealLine(keys!.roomToClient, 1, sent++, line))),
    sayPlain: (line: string) => pipe!.push(line),
    resend: () => pipe!.push(JSON.stringify(sealLine(keys!.roomToClient, 1, 0, '{"type":"event"}'))),
    skip: () => { sent++; },
  };
}

/** A room that does not read secure_hello and answers as the phone app's host does: an error, the connection left open. */
function plainRoom() {
  const wire: Wire = [];
  const heard: string[] = [];
  const transport: ClientTransport = {
    async connect() {
      return new Pipe(wire, (frame, reply) => {
        const type = JSON.parse(frame).type;
        if (type === 'secure_hello') reply(JSON.stringify({ type: 'error', code: 'malformed', message: 'unknown packet' }));
        else heard.push(frame);
      });
    },
  };
  return { transport, wire, heard };
}

const tick = () => new Promise(r => setTimeout(r, 5));
const options = (kv = new InMemoryKv(), extra = {}) => ({ kv, address: '192.168.1.20:7743', randomBytes, ...extra });

describe('SealedClientTransport', () => {
  it('seals both ways, keeps the token out of the clear, and sends a resume key only inside the sealed hello', async () => {
    const room = sealingRoom();
    const conn = await new SealedClientTransport(room.transport, options()).connect();
    expect((conn as { sealed?: boolean }).sealed).toBe(true);
    const got: string[] = [];
    conn.onFrame(f => got.push(f));
    conn.send(JSON.stringify({ type: 'hello', participantId: 'p1', token: 'secret-token-123', nickname: 'Pat' }));
    conn.send(JSON.stringify({ type: 'op', n: 1 }));
    room.say('{"type":"welcome"}');
    await tick();

    expect(got).toEqual(['{"type":"welcome"}']);
    expect(room.heard).toHaveLength(2);
    const hello = JSON.parse(room.heard[0]);
    expect(hello).toMatchObject({ type: 'hello', token: 'secret-token-123' });
    expect(hello.resumeKey).toMatch(/^[A-Za-z0-9+/]{43}=$/);
    expect(JSON.parse(room.heard[1])).toEqual({ type: 'op', n: 1 });
    // on the wire there is nothing readable but the handshake
    const afterHandshake = room.wire.slice(2).map(w => w.frame).join('');
    expect(afterHandshake).not.toContain('secret-token-123');
    expect(afterHandshake).not.toContain('Pat');
    expect(afterHandshake).not.toContain('resumeKey');
  });

  it('gives each room a different resume key, and the same room the same one', async () => {
    const kv = new InMemoryKv();
    const keyOf = async (seed: Uint8Array, address: string) => {
      const room = sealingRoom(seed);
      const conn = await new SealedClientTransport(room.transport, options(kv, { address })).connect();
      conn.send(JSON.stringify({ type: 'hello', participantId: 'p1' }));
      await tick();
      return JSON.parse(room.heard[0]).resumeKey as string;
    };
    const seedA = randomBytes(32);
    const first = await keyOf(seedA, 'a:1');
    expect(await keyOf(seedA, 'a:1')).toBe(first);
    expect(await keyOf(randomBytes(32), 'b:1')).not.toBe(first);
    expect(resumeKeyFor(randomBytes(32), ed25519.getPublicKey(seedA))).not.toBe(first);
  });

  it('trusts a room\'s key on the first join and stops when the key changes, until the person trusts the new one', async () => {
    const kv = new InMemoryKv();
    const first = sealingRoom();
    await new SealedClientTransport(first.transport, options(kv)).connect();
    await new SealedClientTransport(first.transport, options(kv)).connect();   // the same key again: nothing is asked

    const other = sealingRoom();
    const refused = await new SealedClientTransport(other.transport, options(kv)).connect().catch(e => e);
    expect(refused).toBeInstanceOf(RoomKeyChangedError);
    expect((refused as RoomKeyChangedError).message).toMatch(/key has changed/);
    await trustRoomKey(kv, refused as RoomKeyChangedError);
    await expect(new SealedClientTransport(other.transport, options(kv)).connect()).resolves.toBeDefined();
  });

  it('refuses a room that cannot prove who it is', async () => {
    const room = sealingRoom(randomBytes(32), { badSignature: true });
    await expect(new SealedClientTransport(room.transport, options()).connect()).rejects.toThrow(/prove who it is/);
  });

  it('goes on plain with a room that cannot seal, and sends no resume key there', async () => {
    const room = plainRoom();
    const conn = await new SealedClientTransport(room.transport, options()).connect();
    expect((conn as { sealed?: boolean }).sealed).toBeUndefined();
    conn.send(JSON.stringify({ type: 'hello', participantId: 'p1', token: null }));
    expect(room.heard).toEqual(['{"type":"hello","participantId":"p1","token":null}']);
    expect(room.wire[0].frame).toMatch(/"type":"secure_hello"/);
  });

  it('with "only protected rooms", refuses a room that cannot seal and has sent it nothing but the handshake', async () => {
    const room = plainRoom();
    await expect(new SealedClientTransport(room.transport, options(new InMemoryKv(), { onlyProtected: true })).connect()).rejects.toBeInstanceOf(RoomNotProtectedError);
    expect(room.heard).toEqual([]);
    expect(room.wire.filter(w => w.dir === 'c2r')).toHaveLength(1);
  });

  it('refuses a room that used to seal and no longer does, until the person trusts it', async () => {
    const kv = new InMemoryKv();
    await new SealedClientTransport(sealingRoom().transport, options(kv)).connect();
    const refused = await new SealedClientTransport(plainRoom().transport, options(kv)).connect().catch(e => e);
    expect(refused).toBeInstanceOf(RoomKeyChangedError);
    expect((refused as RoomKeyChangedError).newKey).toBeNull();
    await trustRoomKey(kv, refused as RoomKeyChangedError);
    await expect(new SealedClientTransport(plainRoom().transport, options(kv)).connect()).resolves.toBeDefined();
  });

  it.each([
    ['a plain packet', (room: ReturnType<typeof sealingRoom>) => room.sayPlain('{"type":"welcome"}')],
    ['a repeated packet', (room: ReturnType<typeof sealingRoom>) => { room.say('{"type":"a"}'); room.resend(); }],
    ['a skipped packet', (room: ReturnType<typeof sealingRoom>) => { room.skip(); room.say('{"type":"b"}'); }],
    ['garbage', (room: ReturnType<typeof sealingRoom>) => room.sayPlain('not json')],
  ])('ends the connection on %s, delivering nothing it did not open', async (_name, attack) => {
    const room = sealingRoom();
    const conn = await new SealedClientTransport(room.transport, options()).connect();
    const got: string[] = [];
    let closed = false;
    conn.onFrame(f => got.push(f));
    conn.onClose(() => { closed = true; });
    attack(room);
    await tick();
    expect(closed).toBe(true);
    expect(got.every(f => f === '{"type":"a"}')).toBe(true);
    conn.send('{"type":"hello"}');   // a closed connection sends nothing
    expect(room.wire.filter(w => w.dir === 'c2r')).toHaveLength(1);
  });
});

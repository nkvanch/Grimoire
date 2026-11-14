// ============================================================================
// FILE: src/session/sealed.ts
// The sealed transport of the live session, client side (the desktop app's docs/CONTRACTS.md, "Sealed transport", LIVE-SEC-003).
// A wrapper at the transport boundary: SealedClientTransport.connect() does the handshake and returns a Connection whose frames are
// sealed, so peer.ts is untouched. X25519 for the shared secret, BLAKE2b-512 for the two keys, XChaCha20-Poly1305 for the packets,
// Ed25519 for the room's key (trusted on first use, kept per room address). Reproduces tests/fixtures session-sealed.json byte for byte.
//
// What it does and does not do: it protects against someone listening on the network and against packets changed, repeated,
// skipped or reordered in flight. It does not protect against a malicious host, or against someone answering for the room on the very
// first join (or on a join that was plain before) unless `onlyProtected` is set.
// ============================================================================
import { ed25519, x25519 } from '@noble/curves/ed25519';
import { blake2b } from '@noble/hashes/blake2b';
import { xchacha20poly1305 } from '@noble/ciphers/chacha';
import type { ClientTransport, Connection, ServerTransport } from './transport';
import type { KeyValueStore } from './kv';

export const SEAL_LABEL = 'grimoire-session-secure-1';
const HANDSHAKE_LABEL = 'grimoire-session-secure-1/handshake';
const RESUME_LABEL = 'grimoire-session-resume-1';
const HANDSHAKE_WAIT_MS = 6000;

const utf8 = (s: string): Uint8Array => new TextEncoder().encode(s);
const concat = (...parts: Uint8Array[]): Uint8Array => {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let at = 0;
  for (const p of parts) { out.set(p, at); at += p.length; }
  return out;
};

// ── base64 (standard alphabet, padded) ────────────────────────────────────────

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

export function toBase64(bytes: Uint8Array): string {
  let out = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const n = (bytes[i] << 16) | ((bytes[i + 1] ?? 0) << 8) | (bytes[i + 2] ?? 0);
    out += ALPHABET[(n >> 18) & 63] + ALPHABET[(n >> 12) & 63];
    out += i + 1 < bytes.length ? ALPHABET[(n >> 6) & 63] : '=';
    out += i + 2 < bytes.length ? ALPHABET[n & 63] : '=';
  }
  return out;
}

/** Strict: padded standard base64 only; anything else throws (a packet that does not decode ends the connection). */
export function fromBase64(text: string): Uint8Array {
  if (typeof text !== 'string' || text.length % 4 !== 0 || !/^[A-Za-z0-9+/]*={0,2}$/.test(text)) throw new Error('not base64');
  const pad = text.endsWith('==') ? 2 : text.endsWith('=') ? 1 : 0;
  const out = new Uint8Array((text.length / 4) * 3 - pad);
  let at = 0;
  for (let i = 0; i < text.length; i += 4) {
    const n = (ALPHABET.indexOf(text[i]) << 18) | (ALPHABET.indexOf(text[i + 1]) << 12)
      | ((text[i + 2] === '=' ? 0 : ALPHABET.indexOf(text[i + 2])) << 6) | (text[i + 3] === '=' ? 0 : ALPHABET.indexOf(text[i + 3]));
    if (at < out.length) out[at++] = (n >> 16) & 255;
    if (at < out.length) out[at++] = (n >> 8) & 255;
    if (at < out.length) out[at++] = n & 255;
  }
  return out;
}

// ── the scheme ────────────────────────────────────────────────────────────────

/**
 * What the room signs with its Ed25519 key: the label, the client's X25519 public key and the room's own X25519 public key (the one in
 * secure_welcome). The desktop's CONTRACTS.md says only "the room's public key"; its test vector shows it is the X25519 one.
 */
export const handshakeMessage = (clientPublic: Uint8Array, roomEphemeral: Uint8Array): Uint8Array => concat(utf8(HANDSHAKE_LABEL), clientPublic, roomEphemeral);

export type Direction = 0 | 1;   // 0 client to room, 1 room to client

/** `roomEphemeral` is the room's X25519 public key from secure_welcome (as in the handshake), not its long-lived Ed25519 key. */
export function deriveKeys(shared: Uint8Array, clientPublic: Uint8Array, roomEphemeral: Uint8Array): { clientToRoom: Uint8Array; roomToClient: Uint8Array } {
  if (shared.every(b => b === 0)) throw new Error('refused: the shared secret is all zero');
  const okm = blake2b(concat(shared, clientPublic, roomEphemeral, utf8(SEAL_LABEL)), { dkLen: 64 });
  return { clientToRoom: okm.slice(0, 32), roomToClient: okm.slice(32, 64) };
}

/** 24 bytes: the direction, the counter as 8 bytes little-endian, then zeros. */
export function nonceFor(direction: Direction, counter: number): Uint8Array {
  const nonce = new Uint8Array(24);
  nonce[0] = direction;
  const view = new DataView(nonce.buffer);
  view.setUint32(1, counter % 0x100000000, true);
  view.setUint32(5, Math.floor(counter / 0x100000000), true);
  return nonce;
}

const aad = (direction: Direction): Uint8Array => concat(utf8(SEAL_LABEL), Uint8Array.of(direction));

export function sealLine(key: Uint8Array, direction: Direction, counter: number, line: string): { type: 'sealed'; n: number; c: string } {
  const boxed = xchacha20poly1305(key, nonceFor(direction, counter), aad(direction)).encrypt(utf8(line));
  return { type: 'sealed', n: counter, c: toBase64(boxed) };
}

/** Throws when the packet does not open (changed, repeated, skipped, reordered, wrong direction). */
export function openLine(key: Uint8Array, direction: Direction, counter: number, c: string): string {
  const plain = xchacha20poly1305(key, nonceFor(direction, counter), aad(direction)).decrypt(fromBase64(c));
  return new TextDecoder().decode(plain);
}

/** Per room: BLAKE2b-256 over a label, the app's own secret and the room's public key, so no room learns a key that opens another. */
export const resumeKeyFor = (secret: Uint8Array, roomKey: Uint8Array): string =>
  toBase64(blake2b(concat(utf8(RESUME_LABEL), secret, roomKey), { dkLen: 32 }));

// ── what the app keeps ────────────────────────────────────────────────────────

const roomKeyOf = (address: string) => `sealed/room/${address}`;
const SECRET_KEY = 'sealed/resume-secret';

type KeptRoom = { key: string };   // the room's Ed25519 public key, base64; "none" is a room that was joined plain only

export class RoomKeyChangedError extends Error {
  constructor(readonly address: string, readonly newKey: string | null) {
    super(newKey
      ? "This room's key has changed since you last joined it. Someone else may be answering for the room. Trust the new key only if the host set the room up again."
      : 'This room used to protect its connections and now does not. Someone else may be answering for the room. Trust it only if the host turned protection off.');
    this.name = 'RoomKeyChangedError';
  }
}

/** The person said to trust what the room now shows: the next join keeps it. */
export async function trustRoomKey(kv: KeyValueStore, error: RoomKeyChangedError): Promise<void> {
  if (error.newKey) await kv.set<KeptRoom>(roomKeyOf(error.address), { key: error.newKey });
  else await kv.delete(roomKeyOf(error.address));
}

/** Refused by a joiner who chose to join only protected rooms. */
export class RoomNotProtectedError extends Error {
  constructor() { super('This room does not protect its connections, and you chose to join only protected rooms.'); this.name = 'RoomNotProtectedError'; }
}

export interface SealedOptions {
  kv: KeyValueStore;
  /** "host:port": the keys are kept against it. */
  address: string;
  randomBytes: (n: number) => Uint8Array;
  /** Refuse a room that does not seal, and send it nothing of ours (no name, no token). */
  onlyProtected?: boolean;
  waitMs?: number;
}

/** A Connection whose frames are sealed. Anything that does not open ends it, and nothing is said in the clear. */
class SealedConnection implements Connection {
  readonly id: string;
  readonly sealed = true;
  private sent = 0;
  private received = 0;
  private frameCb: ((f: string) => void) | null = null;
  private closeCb: (() => void) | null = null;
  private queued: string[] = [];
  private closed = false;

  /** `ends`: the key and direction this side seals with, and the ones it opens with (the client sends direction 0, the room 1). The resume
   *  key is the client's; the room's side has none. */
  constructor(private readonly inner: Connection,
              private readonly ends: { sendKey: Uint8Array; sendDirection: Direction; receiveKey: Uint8Array; receiveDirection: Direction },
              private readonly resumeKey: string | null) {
    this.id = inner.id;
    inner.onFrame(raw => this.receive(raw));
    inner.onClose(() => this.fireClose());
  }

  send(frame: string): void {
    if (this.closed) return;
    let line = frame;
    // peer.ts writes `type` first. The resume key goes inside the sealed hello only, never in a plain one.
    if (this.resumeKey && line.startsWith('{"type":"hello"')) {
      const hello = JSON.parse(line) as Record<string, unknown>;
      if (hello.resumeKey === undefined) line = JSON.stringify({ ...hello, resumeKey: this.resumeKey });
    }
    this.inner.send(JSON.stringify(sealLine(this.ends.sendKey, this.ends.sendDirection, this.sent++, line)));
  }

  private receive(raw: string): void {
    if (this.closed) return;
    try {
      const packet = JSON.parse(raw) as { type?: unknown; n?: unknown; c?: unknown };
      if (packet.type !== 'sealed' || packet.n !== this.received || typeof packet.c !== 'string') throw new Error('not the next sealed packet');
      const line = openLine(this.ends.receiveKey, this.ends.receiveDirection, this.received, packet.c);
      this.received++;
      if (this.frameCb) this.frameCb(line);
      else this.queued.push(line);
    } catch {
      this.close();   // plain, changed, repeated, skipped, reordered or wrong direction: end it, say nothing
    }
  }

  onFrame(cb: (frame: string) => void): void {
    this.frameCb = cb;
    for (const line of this.queued.splice(0)) cb(line);
  }
  onClose(cb: () => void): void { this.closeCb = cb; }
  close(): void {
    if (this.closed) return;
    this.inner.close();
    this.fireClose();
  }
  private fireClose(): void {
    if (this.closed) return;
    this.closed = true;
    this.closeCb?.();
  }
}

/**
 * Wraps another client transport. A room that does not read `secure_hello` answers with an error (the phone app's host does); the client
 * then goes on plain, unless it only joins protected rooms or the room used to seal.
 */
export class SealedClientTransport implements ClientTransport {
  constructor(private readonly inner: ClientTransport, private readonly options: SealedOptions) {}

  async connect(): Promise<Connection> {
    const { kv, address, randomBytes, onlyProtected, waitMs = HANDSHAKE_WAIT_MS } = this.options;
    const kept = await kv.get<KeptRoom>(roomKeyOf(address));
    const conn = await this.inner.connect();

    const secret = randomBytes(32);
    const publicKey = x25519.getPublicKey(secret);
    // nothing else leaves until the room has answered: connect() does not return before it
    const answer = await new Promise<string | null>(resolve => {
      const timer = setTimeout(() => resolve(null), waitMs);
      conn.onFrame(f => { clearTimeout(timer); resolve(f); });
      conn.onClose(() => { clearTimeout(timer); resolve(null); });
      conn.send(JSON.stringify({ type: 'secure_hello', publicKey: toBase64(publicKey) }));
    });
    if (answer === null) { conn.close(); throw new Error('The room did not answer.'); }

    let welcome: { type?: unknown; publicKey?: unknown; hostKey?: unknown; signature?: unknown } | null = null;
    try { welcome = JSON.parse(answer); } catch { /* not JSON: not a sealed room */ }

    if (!welcome || welcome.type !== 'secure_welcome') {
      // a room that cannot seal. It could also be someone answering in its place.
      if (kept) { conn.close(); throw new RoomKeyChangedError(address, null); }
      if (onlyProtected) { conn.close(); throw new RoomNotProtectedError(); }
      conn.onFrame(() => undefined);
      return conn;   // plain, as before
    }

    let roomKey: Uint8Array, roomPublic: Uint8Array;
    try {
      roomKey = fromBase64(welcome.hostKey as string);
      roomPublic = fromBase64(welcome.publicKey as string);
      if (roomKey.length !== 32 || roomPublic.length !== 32) throw new Error('bad length');
      if (!ed25519.verify(fromBase64(welcome.signature as string), handshakeMessage(publicKey, roomPublic), roomKey)) throw new Error('bad signature');
    } catch {
      conn.close();
      throw new Error('The room could not prove who it is.');
    }

    const roomKeyText = toBase64(roomKey);
    if (kept && kept.key !== roomKeyText) { conn.close(); throw new RoomKeyChangedError(address, roomKeyText); }

    const keys = deriveKeys(x25519.getSharedSecret(secret, roomPublic), publicKey, roomPublic);
    if (!kept) await kv.set<KeptRoom>(roomKeyOf(address), { key: roomKeyText });   // trust on first use

    let appSecret = await kv.get<string>(SECRET_KEY);
    if (!appSecret) { appSecret = toBase64(randomBytes(32)); await kv.set(SECRET_KEY, appSecret); }
    return new SealedConnection(conn, { sendKey: keys.clientToRoom, sendDirection: 0, receiveKey: keys.roomToClient, receiveDirection: 1 },
      resumeKeyFor(fromBase64(appSecret), roomKey));
  }
}

// ── the room's side ───────────────────────────────────────────────────────────

/** `off`: the room does not seal (a secure_hello is answered as any unknown packet). `optional`: a device that seals is sealed, one that
 *  does not is let in plain and counted as not protected. `required`: a device that does not seal is turned away. */
export type SealedMode = 'off' | 'optional' | 'required';

const ROOM_SEED_KEY = 'sealed/host-room-seed';

/** The room's long-lived Ed25519 key, made the first time this device hosts and kept, so a joiner that trusted it once is not told
 *  that it changed every time a room is opened. */
export async function hostRoomSeed(kv: KeyValueStore, randomBytes: (n: number) => Uint8Array): Promise<Uint8Array> {
  const kept = await kv.get<string>(ROOM_SEED_KEY);
  if (kept) return fromBase64(kept);
  const seed = randomBytes(32);
  await kv.set(ROOM_SEED_KEY, toBase64(seed));
  return seed;
}

/** A plain connection whose first frame was already read (to see whether it was a secure_hello): it is handed on first. */
class ReplayFirstFrame implements Connection {
  readonly id: string;
  constructor(private readonly inner: Connection, private readonly first: string) { this.id = inner.id; }
  send(frame: string): void { this.inner.send(frame); }
  onFrame(cb: (frame: string) => void): void { this.inner.onFrame(cb); cb(this.first); }
  onClose(cb: () => void): void { this.inner.onClose(cb); }
  close(): void { this.inner.close(); }
}

export interface SealedServerOptions {
  roomSeed: Uint8Array;
  randomBytes: (n: number) => Uint8Array;
  mode?: SealedMode;
}

/** Wraps the transport the room listens on. Each connection's first packet decides: a secure_hello is answered and the connection is
 *  sealed; anything else goes on plain (or, in `required` mode, is turned away; a peek is always answered, it holds nothing secret). */
export class SealedServerTransport implements ServerTransport {
  private readonly roomKey: Uint8Array;
  constructor(private readonly inner: ServerTransport, private readonly options: SealedServerOptions) {
    this.roomKey = ed25519.getPublicKey(options.roomSeed);
  }

  listen(onConnection: (conn: Connection) => void): Promise<void> {
    return this.inner.listen(conn => {
      let decided = false;
      conn.onFrame(frame => { if (!decided) { decided = true; this.first(conn, frame, onConnection); } });
      conn.onClose(() => { decided = true; });
    });
  }

  close(): void { this.inner.close(); }

  private first(conn: Connection, frame: string, onConnection: (conn: Connection) => void): void {
    const mode = this.options.mode ?? 'optional';
    let msg: { type?: unknown; publicKey?: unknown } | null = null;
    try { msg = JSON.parse(frame); } catch { /* not JSON: the room answers it as it answers any bad packet */ }
    if (msg?.type === 'secure_hello' && mode !== 'off') {
      try {
        const clientPublic = fromBase64(msg.publicKey as string);
        if (clientPublic.length !== 32) throw new Error('bad key');
        const secret = this.options.randomBytes(32);
        const roomPublic = x25519.getPublicKey(secret);
        const keys = deriveKeys(x25519.getSharedSecret(secret, clientPublic), clientPublic, roomPublic);
        const signature = ed25519.sign(handshakeMessage(clientPublic, roomPublic), this.options.roomSeed);
        conn.send(JSON.stringify({ type: 'secure_welcome', publicKey: toBase64(roomPublic), hostKey: toBase64(this.roomKey), signature: toBase64(signature) }));
        onConnection(new SealedConnection(conn, { sendKey: keys.roomToClient, sendDirection: 1, receiveKey: keys.clientToRoom, receiveDirection: 0 }, null));
      } catch {
        conn.close();   // a handshake that does not hold ends the connection, nothing said
      }
      return;
    }
    if (mode === 'required' && msg?.type !== 'peek') {
      conn.send(JSON.stringify({ type: 'error', code: 'unsupported-packet', packet: 'sealed',
        message: 'This room only lets in devices whose connection is protected. Update the app to join this room.' }));
      conn.close();
      return;
    }
    onConnection(new ReplayFirstFrame(conn, frame));
  }
}

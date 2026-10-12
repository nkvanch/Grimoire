// ============================================================================
// FILE: src/platform/tcpSocket.web.ts
// The web build's stand-in for `react-native-tcp-socket` (metro.config.js points the module name here on web). It implements the
// small part of that API the live-session code uses (createServer, createConnection, and the socket and server events) on top of
// the desktop shell's TCP bridge (platform/desktop.ts). In a plain browser there is no bridge, so `tcpAvailable()` is false and
// the callers show "unavailable" instead of calling in.
// ============================================================================
import { desktopBridge, DesktopBridge, DesktopTcpEvent } from './desktop';

type Listener = (...args: any[]) => void;

/** An error from the bridge. Electron's IPC carries only the message, so the code (ECONNREFUSED, EADDRINUSE ...) is read back out of it. */
const CODE_IN_MESSAGE = /(?:^|[^A-Za-z])(E(?:ADDRINUSE|ADDRNOTAVAIL|CONNREFUSED|CONNRESET|CONNABORTED|HOSTUNREACH|NETUNREACH|TIMEDOUT|PIPE|ACCES|PERM|MFILE))(?![A-Za-z])/;

function toError(err: unknown): Error {
  const source = err as { message?: unknown; code?: unknown } | null;
  const message = typeof source?.message === 'string' ? source.message : String(err);
  const code = typeof source?.code === 'string' ? source.code : CODE_IN_MESSAGE.exec(message)?.[1];
  return Object.assign(new Error(message), code ? { code } : {});
}

class Emitter {
  private handlers = new Map<string, Listener[]>();
  on(event: string, fn: Listener): this {
    const list = this.handlers.get(event) ?? [];
    list.push(fn);
    this.handlers.set(event, list);
    return this;
  }
  once(event: string, fn: Listener): this {
    const wrapper: Listener = (...args) => { this.off(event, wrapper); fn(...args); };
    return this.on(event, wrapper);
  }
  off(event: string, fn: Listener): this {
    const list = this.handlers.get(event);
    if (list) this.handlers.set(event, list.filter(f => f !== fn));
    return this;
  }
  removeListener(event: string, fn: Listener): this { return this.off(event, fn); }
  removeAllListeners(event?: string): this { if (event) this.handlers.delete(event); else this.handlers.clear(); return this; }
  protected emit(event: string, ...args: any[]): void {
    for (const fn of [...(this.handlers.get(event) ?? [])]) {
      try { fn(...args); } catch (e) { console.warn(`[tcp] a "${event}" listener threw`, e); }
    }
  }
}

// One subscription to the bridge for the whole page; sockets and servers register themselves by id.
const sockets = new Map<number, Socket>();
const servers = new Map<number, Server>();
let unsubscribe: (() => void) | null = null;

function ensureSubscribed(bridge: DesktopBridge): void {
  if (unsubscribe) return;
  unsubscribe = bridge.tcp.onEvent((event: DesktopTcpEvent) => {
    switch (event.type) {
      case 'connection': {
        const server = servers.get(event.serverId);
        if (!server) return;
        const socket = new Socket(bridge, event.socketId, event.remoteAddress);
        sockets.set(event.socketId, socket);
        server._accept(socket);
        return;
      }
      case 'data': sockets.get(event.socketId)?._data(event.data); return;
      case 'close': { const s = sockets.get(event.socketId); sockets.delete(event.socketId); s?._closed(); return; }
      case 'error': sockets.get(event.socketId)?._error(Object.assign(new Error(event.message), { code: event.code })); return;
      case 'serverError': servers.get(event.serverId)?._error(Object.assign(new Error(event.message), { code: event.code })); return;
      case 'serverClose': { const s = servers.get(event.serverId); servers.delete(event.serverId); s?._closed(); return; }
    }
  });
}

/** Forgets the shared subscription (tests; a page never needs this). */
export function _resetTcpShimForTests(): void {
  unsubscribe?.();
  unsubscribe = null;
  sockets.clear();
  servers.clear();
}

export class Socket extends Emitter {
  remoteAddress: string | null;
  destroyed = false;
  private id: number | null;
  private pending: { data: string; cb?: () => void }[] = [];

  constructor(private bridge: DesktopBridge, id: number | null, remoteAddress: string | null = null) {
    super();
    this.id = id;
    this.remoteAddress = remoteAddress;
  }

  /** Called once the connection exists (outgoing sockets get their id after connecting). */
  _attach(id: number): void {
    this.id = id;
    sockets.set(id, this);
    for (const p of this.pending.splice(0)) this._send(p.data, p.cb);
  }
  _data(chunk: string): void { this.emit('data', chunk); }
  _error(err: Error): void { this.emit('error', err); }
  _closed(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    this.emit('close', false);
  }

  private _send(data: string, cb?: () => void): void {
    if (this.id === null) return;
    this.bridge.tcp.write(this.id, data).then(() => cb?.(), err => this.emit('error', toError(err)));
  }

  write(data: string | Uint8Array, encodingOrCb?: unknown, cb?: () => void): boolean {
    if (this.destroyed) return false;
    const text = typeof data === 'string' ? data : new TextDecoder().decode(data);
    const done = typeof encodingOrCb === 'function' ? (encodingOrCb as () => void) : cb;
    if (this.id === null) this.pending.push({ data: text, cb: done });
    else this._send(text, done);
    return true;
  }

  destroy(): this {
    if (this.destroyed) return this;
    if (this.id !== null) { sockets.delete(this.id); this.bridge.tcp.destroy(this.id); }
    this._closed();
    return this;
  }
  end(): this { return this.destroy(); }
  setEncoding(): this { return this; }
  setNoDelay(): this { return this; }
  setKeepAlive(): this { return this; }
}

export class Server extends Emitter {
  private id: number | null = null;
  private closedFlag = false;

  constructor(private bridge: DesktopBridge, private connectionListener?: (socket: Socket) => void) { super(); }

  listen(options: { port: number; host?: string } | number, callback?: () => void): this {
    const port = typeof options === 'number' ? options : options.port;
    const host = typeof options === 'number' ? '0.0.0.0' : options.host ?? '0.0.0.0';
    ensureSubscribed(this.bridge);
    this.bridge.tcp.listen(port, host).then(({ serverId }) => {
      if (this.closedFlag) { this.bridge.tcp.closeServer(serverId); return; }
      this.id = serverId;
      servers.set(serverId, this);
      callback?.();
      this.emit('listening');
    }, err => this._error(toError(err)));
    return this;
  }

  _accept(socket: Socket): void {
    this.connectionListener?.(socket);
    this.emit('connection', socket);
  }
  _error(err: Error): void { this.emit('error', err); }
  _closed(): void { this.emit('close'); }

  close(callback?: () => void): this {
    this.closedFlag = true;
    if (this.id !== null) { const id = this.id; servers.delete(id); this.bridge.tcp.closeServer(id); }
    callback?.();
    return this;
  }
}

export interface ConnectionOptions { host: string; port: number; [key: string]: unknown }

const TcpSocket = {
  createServer(connectionListener?: (socket: Socket) => void): Server | null {
    const bridge = desktopBridge();
    if (!bridge) return null;
    return new Server(bridge, connectionListener);
  },
  createConnection(options: ConnectionOptions, callback?: () => void): Socket | null {
    const bridge = desktopBridge();
    if (!bridge) return null;
    ensureSubscribed(bridge);
    const socket = new Socket(bridge, null);
    bridge.tcp.connect(options.host, options.port).then(({ socketId }) => {
      socket._attach(socketId);
      callback?.();
    }, err => {
      socket._error(toError(err));
      socket._closed();
    });
    return socket;
  },
};

export default TcpSocket;

'use strict';
// ============================================================================
// FILE: desktop/tcpBridge.js
// The Node half of the desktop app's TCP bridge: real sockets for the live-session protocol, driven by ids and reporting back
// through one `emit(event)` callback. The page's side is src/platform/tcpSocket.web.ts; the event shapes are in
// src/platform/desktop.ts. Pure Node (no Electron), so it is tested directly with real localhost sockets.
// ============================================================================
const net = require('net');

class TcpBridge {
  /** @param {(event: object) => void} emit */
  constructor(emit) {
    this.emit = emit;
    this.nextId = 1;
    this.servers = new Map();
    this.sockets = new Map();
  }

  /** Starts listening. Resolves once the port is open, rejects if it cannot be (in use, no permission). */
  listen(port, host) {
    return new Promise((resolve, reject) => {
      const serverId = this.nextId++;
      let listening = false;
      const server = net.createServer(socket => {
        const socketId = this._track(socket);
        this.emit({ type: 'connection', serverId, socketId, remoteAddress: socket.remoteAddress ?? null });
        this._wire(socket, socketId);
      });
      server.on('error', err => {
        if (!listening) { reject(err); return; }
        this.emit({ type: 'serverError', serverId, message: err.message, code: err.code });
      });
      server.on('close', () => {
        this.servers.delete(serverId);
        this.emit({ type: 'serverClose', serverId });
      });
      server.listen({ port, host }, () => {
        listening = true;
        this.servers.set(serverId, server);
        resolve({ serverId });
      });
    });
  }

  closeServer(serverId) {
    const server = this.servers.get(serverId);
    if (server) server.close();
  }

  /** Opens a connection. Resolves once connected, rejects on a connection error. */
  connect(host, port) {
    return new Promise((resolve, reject) => {
      const socket = net.connect({ host, port });
      const socketId = this._track(socket);
      let connected = false;
      socket.once('connect', () => {
        connected = true;
        this._wire(socket, socketId);
        resolve({ socketId });
      });
      socket.once('error', err => {
        if (connected) return;      // later errors are reported through the wired handler
        this.sockets.delete(socketId);
        reject(err);
      });
    });
  }

  write(socketId, data) {
    return new Promise((resolve, reject) => {
      const socket = this.sockets.get(socketId);
      if (!socket || socket.destroyed) { reject(new Error('socket is closed')); return; }
      socket.write(data, 'utf8', err => (err ? reject(err) : resolve()));
    });
  }

  destroy(socketId) {
    const socket = this.sockets.get(socketId);
    if (socket) socket.destroy();
  }

  /** Closes every server and connection (the window is going away). */
  closeAll() {
    for (const socket of this.sockets.values()) socket.destroy();
    for (const server of this.servers.values()) server.close();
  }

  _track(socket) {
    const socketId = this.nextId++;
    this.sockets.set(socketId, socket);
    socket.setNoDelay(true);
    socket.setEncoding('utf8');
    return socketId;
  }

  _wire(socket, socketId) {
    socket.on('data', data => this.emit({ type: 'data', socketId, data }));
    socket.on('error', err => this.emit({ type: 'error', socketId, message: err.message, code: err.code }));
    socket.on('close', () => {
      this.sockets.delete(socketId);
      this.emit({ type: 'close', socketId });
    });
  }
}

module.exports = { TcpBridge };

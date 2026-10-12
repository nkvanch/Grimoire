// ============================================================================
// FILE: src/platform/desktop.ts
// The desktop app (Electron) loads this same web build and exposes `window.grimoireDesktop` from its preload script: the few
// things a page cannot do on its own (raw TCP for live sessions, the machine's LAN address, PDF export). Everywhere else this is
// null: on a phone the native modules are used, and in a plain browser those features are simply unavailable.
// The other half of this contract is desktop/preload.js and desktop/tcpBridge.js; keep the event shapes in step.
// ============================================================================

export type DesktopTcpEvent =
  | { type: 'connection'; serverId: number; socketId: number; remoteAddress: string | null }
  | { type: 'data'; socketId: number; data: string }
  | { type: 'close'; socketId: number }
  | { type: 'error'; socketId: number; message: string; code?: string }
  | { type: 'serverError'; serverId: number; message: string; code?: string }
  | { type: 'serverClose'; serverId: number };

export interface DesktopBridge {
  version: string;
  tcp: {
    listen(port: number, host: string): Promise<{ serverId: number }>;
    closeServer(serverId: number): void;
    connect(host: string, port: number): Promise<{ socketId: number }>;
    write(socketId: number, data: string): Promise<void>;
    destroy(socketId: number): void;
    /** Subscribes to every socket and server event; returns the unsubscribe function. */
    onEvent(listener: (event: DesktopTcpEvent) => void): () => void;
  };
  network: {
    /** This computer's address on the local network, or null when it has none. */
    localIPv4(): Promise<string | null>;
  };
  pdf: {
    /** Renders HTML to a PDF and asks where to save it. `saved` is false when the person cancels. */
    fromHtml(html: string, suggestedName: string): Promise<{ saved: boolean; path?: string }>;
  };
}

export function desktopBridge(): DesktopBridge | null {
  const g = globalThis as unknown as { grimoireDesktop?: DesktopBridge };
  return g.grimoireDesktop ?? null;
}

/** True inside the desktop app. */
export const isDesktopApp = (): boolean => desktopBridge() !== null;

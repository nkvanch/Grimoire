// ============================================================================
// FILE: src/session/ports.ts
// The TCP port live sessions listen on. Kept in its own module so the room-code
// helpers (network.ts) and the socket transport (lanTransport.ts) can share it
// without one importing the other's platform modules.
// ============================================================================
export const SESSION_PORT = 7743;

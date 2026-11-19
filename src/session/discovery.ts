// ============================================================================
// FILE: src/session/discovery.ts
// Room-code encode/decode and local IP discovery for Live Sessions.
//
// Room code: 7 characters of a 32-letter alphabet encoding the device's 32-bit
// IPv4 address (32^7 covers the full range). The port is not in the code.
//
// IP lookup uses expo-network's getIpAddressAsync(), which reads the device's
// network interface directly (no WifiManager call) and does NOT require the
// location permission that react-native-network-info needed on Android 10+.
// ============================================================================
import * as Network from 'expo-network';
import { Platform } from 'react-native';
import { desktopBridge } from '../platform/desktop';

/**
 * Returns the device's local IPv4 address on the current network.
 * Returns null if the platform is web or no address is available (e.g. no
 * active network connection).
 */
export async function getLocalIp(): Promise<string | null> {
  // The desktop app reads this computer's LAN address itself; a plain browser has no way to know it.
  const desktop = desktopBridge();
  if (desktop) {
    try { return await desktop.network.localIPv4(); } catch { return null; }
  }
  if (Platform.OS === 'web') return null;

  try {
    const ip = await Network.getIpAddressAsync();
    if (!ip || ip === '0.0.0.0') {
      console.warn('[discovery] getIpAddressAsync() returned empty/0.0.0.0 — no active network connection.');
      return null;
    }
    return ip;
  } catch (e) {
    console.warn('[discovery] getIpAddressAsync() threw:', e);
    return null;
  }
}

/**
 * Room-code alphabet: 32 characters, deliberately excluding the pairs people
 * misread across a table — no 0/O, no 1/I/L. Encoding a 32-bit IPv4 address
 * needs 7 of these (32^7 covers the full 32-bit range with room to spare).
 */
const ROOM_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

/**
 * Encodes an IPv4 address as a 7-character room code in `ROOM_CODE_ALPHABET`.
 *
 * Example: '192.168.1.42' → 'K7M4XQP'
 */
export function encodeRoomCode(ip: string): string {
  const parts = ip.split('.').map(Number);
  if (parts.length !== 4 || parts.some(p => isNaN(p) || p < 0 || p > 255)) {
    throw new Error(`Invalid IP address: "${ip}"`);
  }
  // Build a 32-bit unsigned integer from the four octets, then base-32 it by hand
  // (the alphabet isn't the standard digit set, so Number.toString(36) etc. don't apply).
  let n = ((parts[0] << 24) | (parts[1] << 16) | (parts[2] << 8) | parts[3]) >>> 0;
  let out = '';
  for (let i = 0; i < 7; i++) {
    out = ROOM_CODE_ALPHABET[n % 32] + out;
    n = Math.floor(n / 32);
  }
  return out;
}

/**
 * Decodes a 7-character room code back to an IPv4 address. The code only ever encodes the IP (see `encodeRoomCode`), so the
 * caller supplies the port (`SESSION_PORT`) and gets it back beside the address. Throws if the code format is invalid.
 *
 * Example: decodeRoomCode('K7M4XQP', 7743) → { ip: '192.168.1.42', port: 7743 }
 */
export function decodeRoomCode(code: string, port: number): { ip: string; port: number } {
  const clean = code.trim().toUpperCase();
  if (clean.length !== 7 || [...clean].some(c => !ROOM_CODE_ALPHABET.includes(c))) {
    throw new Error(
      `Invalid room code: "${code}". Must be exactly 7 characters from ${ROOM_CODE_ALPHABET} (no 0/O, 1/I/L).`
    );
  }
  let n = 0;
  for (const ch of clean) n = n * 32 + ROOM_CODE_ALPHABET.indexOf(ch);
  n = n >>> 0;
  const ip = [
    (n >>> 24) & 0xff,
    (n >>> 16) & 0xff,
    (n >>>  8) & 0xff,
     n         & 0xff,
  ].join('.');
  return { ip, port };
}

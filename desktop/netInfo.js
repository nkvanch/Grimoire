'use strict';
// ============================================================================
// FILE: desktop/netInfo.js
// Picks this computer's address on the local network for the room code. A PC often has several interfaces (Wi-Fi, Ethernet, and
// virtual ones from VPNs, WSL, Hyper-V and Docker); a table's players are on the real LAN, so virtual adapters are skipped and
// the usual home and office ranges are preferred.
// ============================================================================
const os = require('os');

// Windows and Linux names of adapters that are not the table's network: VMs, containers, VPNs and tunnels.
const VIRTUAL = /vethernet|virtualbox|vmware|vbox|wsl|docker|hyper-v|hyperv|tailscale|zerotier|loopback|bluetooth|tap-|tun|vpn|npcap|virbr|veth|^br-|lxc|lxd|podman|flannel|cni|kube|wg\d|utun|ham0/i;

/** Lower is better; null means not usable for a room code. */
function rank(address) {
  const p = address.split('.').map(Number);
  if (p.length !== 4 || p.some(n => !Number.isInteger(n) || n < 0 || n > 255)) return null;
  if (p[0] === 127 || p[0] === 0) return null;          // loopback / unspecified
  if (p[0] === 169 && p[1] === 254) return null;        // link-local: no DHCP answer
  if (p[0] === 192 && p[1] === 168) return 0;           // typical home router
  if (p[0] === 10) return 1;
  if (p[0] === 172 && p[1] >= 16 && p[1] <= 31) return 2;
  return 3;                                             // anything else that is routable on a LAN
}

/**
 * @param {Record<string, Array<{ family: string | number; address: string; internal: boolean }>>} [interfaces] defaults to the OS's
 * @returns {string | null}
 */
function localIPv4(interfaces = os.networkInterfaces()) {
  const candidates = [];
  for (const [name, list] of Object.entries(interfaces)) {
    for (const entry of list ?? []) {
      const family = typeof entry.family === 'number' ? `IPv${entry.family}` : entry.family;
      if (family !== 'IPv4' || entry.internal) continue;
      const r = rank(entry.address);
      if (r === null) continue;
      candidates.push({ address: entry.address, rank: r + (VIRTUAL.test(name) ? 10 : 0) });
    }
  }
  candidates.sort((a, b) => a.rank - b.rank);
  return candidates.length ? candidates[0].address : null;
}

module.exports = { localIPv4, rank };

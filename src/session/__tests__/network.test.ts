// Room codes: a 7-character, two-way encoding of the host's IPv4 address, dialled on the live-session port.
jest.mock('expo-network', () => ({ getIpAddressAsync: jest.fn() }));
import { encodeRoomCode, decodeRoomCode, ROOM_CODE_ALPHABET } from '../network';
import { SESSION_PORT } from '../ports';
import { SESSION_PORT as TRANSPORT_PORT } from '../lanTransport';

describe('room codes', () => {
  it('round-trips every kind of private address', () => {
    for (const ip of ['192.168.1.42', '10.0.0.1', '172.16.254.3', '0.0.0.0', '255.255.255.255']) {
      const code = encodeRoomCode(ip);
      expect(code).toHaveLength(7);
      expect([...code].every(c => ROOM_CODE_ALPHABET.includes(c))).toBe(true);
      expect(decodeRoomCode(code).ip).toBe(ip);
    }
  });

  it('dials the live-session port unless told otherwise', () => {
    expect(decodeRoomCode(encodeRoomCode('192.168.1.42')).port).toBe(SESSION_PORT);
    expect(decodeRoomCode(encodeRoomCode('192.168.1.42'), 9000).port).toBe(9000);
    expect(SESSION_PORT).toBe(TRANSPORT_PORT);   // one port for the room code and the socket
  });

  it('accepts lower case and surrounding spaces, and refuses look-alike characters', () => {
    const code = encodeRoomCode('192.168.1.42');
    expect(decodeRoomCode(`  ${code.toLowerCase()} `).ip).toBe('192.168.1.42');
    expect(() => decodeRoomCode('ABC0123')).toThrow(/Invalid room code/);   // 0 is not in the alphabet
    expect(() => decodeRoomCode('ABCDEF')).toThrow(/Invalid room code/);
  });

  it('refuses something that is not an IPv4 address', () => {
    expect(() => encodeRoomCode('192.168.1')).toThrow();
    expect(() => encodeRoomCode('192.168.1.300')).toThrow();
  });
});

// Room codes are how a player finds the Host: a wrong decode sends the join to the wrong address.
import { decodeRoomCode, encodeRoomCode } from '../discovery';

describe('room codes', () => {
  it.each(['192.168.1.42', '10.0.0.1', '0.0.0.0', '255.255.255.255'])('%s survives encode then decode', ip => {
    const code = encodeRoomCode(ip);
    expect(code).toMatch(/^[A-HJ-NP-Z2-9]{7}$/);
    expect(decodeRoomCode(code, 7743)).toEqual({ ip, port: 7743 });
  });

  it('decodes a code typed in lower case with spaces around it', () => {
    const code = encodeRoomCode('192.168.1.42');
    expect(decodeRoomCode(`  ${code.toLowerCase()} `, 7743).ip).toBe('192.168.1.42');
  });

  it('refuses a code of the wrong length or with a letter outside the alphabet', () => {
    expect(() => decodeRoomCode('ABC', 7743)).toThrow('Invalid room code');
    expect(() => decodeRoomCode('ABCDEF0', 7743)).toThrow('Invalid room code');
  });

  it('refuses an address that is not IPv4', () => {
    expect(() => encodeRoomCode('192.168.1')).toThrow('Invalid IP address');
    expect(() => encodeRoomCode('192.168.1.256')).toThrow('Invalid IP address');
  });
});

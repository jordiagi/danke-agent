/**
 * Convert a hex string to a Uint8Array.
 */
export function hexToBytes(hex: string): Uint8Array {
  if (hex.length % 2 !== 0) throw new Error('Invalid hex string length');
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

/**
 * Convert a Uint8Array to a lowercase hex string.
 */
export function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Encode a Uint8Array to a bech32 string with the given human-readable part.
 * Minimal bech32 implementation for npub encoding.
 */
export function encodeBech32(hrp: string, data: Uint8Array): string {
  const CHARSET = 'qpzry9x8gf2tvdw0s3jn54khce6mua7l';
  const GENERATOR = [0x3b6a57b2, 0x26508e6d, 0x1ea119fa, 0x3d4233dd, 0x2a1462b3];

  function polymod(values: number[]): number {
    let chk = 1;
    for (const v of values) {
      const top = chk >> 25;
      chk = ((chk & 0x1ffffff) << 5) ^ v;
      for (let i = 0; i < 5; i++) {
        if ((top >> i) & 1) chk ^= GENERATOR[i];
      }
    }
    return chk;
  }

  function hrpExpand(hrp: string): number[] {
    const ret: number[] = [];
    for (let i = 0; i < hrp.length; i++) ret.push(hrp.charCodeAt(i) >> 5);
    ret.push(0);
    for (let i = 0; i < hrp.length; i++) ret.push(hrp.charCodeAt(i) & 31);
    return ret;
  }

  // Convert 8-bit data to 5-bit groups
  function convertBits(data: Uint8Array, fromBits: number, toBits: number, pad: boolean): number[] {
    let acc = 0;
    let bits = 0;
    const ret: number[] = [];
    const maxv = (1 << toBits) - 1;
    for (const value of data) {
      acc = (acc << fromBits) | value;
      bits += fromBits;
      while (bits >= toBits) {
        bits -= toBits;
        ret.push((acc >> bits) & maxv);
      }
    }
    if (pad) {
      if (bits > 0) ret.push((acc << (toBits - bits)) & maxv);
    } else if (bits >= fromBits || ((acc << (toBits - bits)) & maxv)) {
      throw new Error('bech32: padding error');
    }
    return ret;
  }

  const converted = convertBits(data, 8, 5, true);
  const values = [...hrpExpand(hrp), ...converted, 0, 0, 0, 0, 0, 0];
  const checksum = polymod(values) ^ 1;
  const checksumChars: number[] = [];
  for (let i = 0; i < 6; i++) {
    checksumChars.push((checksum >> (5 * (5 - i))) & 31);
  }
  return hrp + '1' + [...converted, ...checksumChars].map(v => CHARSET[v]).join('');
}

/**
 * Compute pubkey (npub) bech32 from hex pubkey.
 */
export function pubkeyToNpub(pubkeyHex: string): string {
  return encodeBech32('npub', hexToBytes(pubkeyHex));
}

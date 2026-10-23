const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

/** Bytes to base64 without Buffer or btoa, in chunks so a 120 KB font never builds one huge intermediate string. */
export function bytesToBase64(bytes: Uint8Array): string {
  const parts: string[] = [];
  for (let start = 0; start < bytes.length; start += 3 * 4096) {
    let chunk = '';
    const end = Math.min(bytes.length, start + 3 * 4096);
    for (let i = start; i < end; i += 3) {
      const a = bytes[i];
      const b = i + 1 < end ? bytes[i + 1] : 0;
      const c = i + 2 < end ? bytes[i + 2] : 0;
      chunk += ALPHABET[a >> 2] + ALPHABET[((a & 3) << 4) | (b >> 4)];
      chunk += i + 1 < end ? ALPHABET[((b & 15) << 2) | (c >> 6)] : '=';
      chunk += i + 2 < end ? ALPHABET[c & 63] : '=';
    }
    parts.push(chunk);
  }
  return parts.join('');
}

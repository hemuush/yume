import { bytesToBase64 } from './base64';

it('matches Buffer for every remainder length and across chunk boundaries', () => {
  for (const n of [0, 1, 2, 3, 4, 5, 100, 12287, 12288, 12289, 40000]) {
    const bytes = Uint8Array.from({ length: n }, (_, i) => (i * 37 + 11) % 256);
    expect(bytesToBase64(bytes)).toBe(Buffer.from(bytes).toString('base64'));
  }
});

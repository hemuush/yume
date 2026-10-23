import fs from 'fs';
import path from 'path';
import { REPORT_ASSETS } from './embeddedAssets';

const root = path.resolve(__dirname, '../../..');
const bytes = (b64: string) => Buffer.from(b64, 'base64');

describe('embedded report assets', () => {
  it('carry the logo marks exactly as the files in assets/', () => {
    expect(REPORT_ASSETS.markCrescent).toBe(
      fs.readFileSync(path.join(root, 'assets/report-mark-crescent.png')).toString('base64')
    );
    expect(REPORT_ASSETS.markDot).toBe(
      fs.readFileSync(path.join(root, 'assets/report-mark-dot.png')).toString('base64')
    );
  });
  it('are real TrueType fonts, small enough to keep in the app', () => {
    for (const key of ['fredoka', 'archivo', 'archivoBold'] as const) {
      const b = bytes(REPORT_ASSETS[key]);
      expect(b.readUInt32BE(0)).toBe(0x00010000);
      expect(b.length).toBeLessThan(60_000);
    }
  });
});

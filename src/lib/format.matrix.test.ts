/**
 * formatPctChange caps a period-over-period percentage so a near-empty prior
 * period can't overflow one screen with digits while others stay tidy. It's
 * used in identical form on Home, Reports, Notifications and the overspend
 * alert, so every one of those reads the same way.
 */
import { formatPctChange } from './format';

describe('formatPctChange — sign-stripped, rounded, and capped at >999%', () => {
  const VALUES = [
    0, 0.4, 0.5, 1, 1.5, 2, 9, 12.3, 19.9, 20, 20.001, 45.6, 99, 100, 249.5, 500, 998, 999, 999.4, 999.5,
    1000, 1500, 3116, 100000,
  ];
  for (const v of VALUES) {
    for (const sign of [1, -1]) {
      const pct = v * sign;
      it(`${pct}`, () => {
        const out = formatPctChange(pct);
        const abs = Math.abs(pct);
        if (abs > 999) {
          expect(out).toBe('>999%');
        } else {
          expect(out).toBe(`${Math.round(abs)}%`);
        }
        // Never shows a sign, always ends with a percent sign.
        expect(out).not.toContain('-');
        expect(out.endsWith('%')).toBe(true);
      });
    }
  }

  it('treats +x and -x identically (magnitude only)', () => {
    for (const v of VALUES) {
      expect(formatPctChange(v)).toBe(formatPctChange(-v));
    }
  });
});

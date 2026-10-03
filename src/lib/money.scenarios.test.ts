/**
 * Sweep of money conversion across magnitudes (zero, one paisa, typical, crores) and every offered currency,
 * checking round-trip and formatting invariants, since every screen renders through formatMoney().
 */
import { toMinor, toMajor, formatMoney } from './money';

const MAJOR_AMOUNTS = [
  0, 0.01, 0.5, 1, 9.99, 10, 99.5, 100, 999.99, 1000, 12345.67, 100000, 9999999.99, 10000000,
];
const CURRENCIES = ['INR', 'USD', 'EUR', 'GBP', 'AED', 'AUD', 'CAD', 'SGD', 'JPY', 'NPR'];

describe('money conversion matrix — every amount × currency combination', () => {
  for (const amount of MAJOR_AMOUNTS) {
    it(`₹${amount}: toMinor/toMajor round-trips to the nearest whole rupee`, () => {
      const minor = toMinor(amount);
      expect(toMajor(minor)).toBeCloseTo(Math.round(amount), 2);
    });

    it(`₹${amount}: toMinor produces a whole rupee in minor units, never a fraction`, () => {
      expect(Number.isInteger(toMinor(amount))).toBe(true);
      expect(toMinor(amount) % 100 === 0).toBe(true);
    });

    for (const currency of CURRENCIES) {
      it(`₹${amount} formatted as ${currency}: never throws, and preserves sign`, () => {
        const minor = toMinor(amount);
        const formatted = formatMoney(minor, currency);
        expect(typeof formatted).toBe('string');
        expect(formatted.length).toBeGreaterThan(0);
        if (amount > 0) expect(formatted).not.toMatch(/^-/);
      });
    }
  }

  it('negative amounts round-trip and format with a visible negative sign', () => {
    for (const amount of [-1, -100, -9999.99, -10000000]) {
      const minor = toMinor(amount);
      expect(toMajor(minor)).toBeCloseTo(Math.round(amount), 2);
      const formatted = formatMoney(minor, 'INR');
      expect(formatted).toMatch(/-/);
    }
  });

  it('an unrecognized currency code falls back to a plain number instead of throwing', () => {
    expect(() => formatMoney(123456, 'NOT_A_CURRENCY')).not.toThrow();
    // Display is rounded to whole units everywhere (see formatMoney) — 1234.56 rounds to 1235.
    expect(formatMoney(123456, 'NOT_A_CURRENCY')).toBe('1235');
  });

  it('zero formats cleanly in every supported currency', () => {
    for (const currency of CURRENCIES) {
      expect(() => formatMoney(0, currency)).not.toThrow();
    }
  });

  it('sub-unit amounts (a few paise) round to whole-unit display, same as zero', () => {
    // A stray paisa can still exist (legacy data, EMI splits); formatMoney shows it as "0",
    // like an exact zero. New input can't create one (see the toMinor quantization tests above).
    expect(toMajor(1)).toBe(0.01);
    expect(formatMoney(1, 'INR')).toBe(formatMoney(0, 'INR'));
  });
});

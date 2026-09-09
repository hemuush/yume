/**
 * Combinatorial coverage of the money helpers. Everything in the app moves
 * through integer minor units; toMinor/toMajor are the only conversion, and
 * formatMoney must never throw regardless of currency or magnitude.
 */
import { toMinor, toMajor, formatMoney, getCurrencySymbol } from './money';
import { SUPPORTED_CURRENCIES } from '@/db/settings';

const MAJORS = [
  0, 0.01, 0.5, 1, 7, 9.99, 42, 99.5, 100, 250.25, 1000, 12345.67, 100000, 999999.99, 2500000, 10000000,
];
const NEGATIVES = MAJORS.filter((m) => m > 0).map((m) => -m);
const CODES = SUPPORTED_CURRENCIES.map((c) => c.code);

describe('toMinor — rounds major units to integer minor units', () => {
  for (const major of [...MAJORS, ...NEGATIVES]) {
    it(`${major}`, () => {
      const minor = toMinor(major);
      expect(Number.isInteger(minor)).toBe(true);
      expect(minor).toBe(Math.round(major * 100));
    });
  }
});

describe('toMajor ∘ toMinor round-trips any 2-decimal major value exactly', () => {
  for (const major of [...MAJORS, ...NEGATIVES]) {
    it(`${major}`, () => {
      // Values here all have at most 2 decimal places, so the round-trip is exact.
      expect(toMajor(toMinor(major))).toBeCloseTo(major, 10);
    });
  }
});

describe('toMinor is additive over a running total (no float drift across many small adds)', () => {
  for (const step of [0.01, 0.05, 0.1, 0.33, 1.99, 12.5]) {
    for (const count of [3, 10, 50, 137]) {
      it(`${count} × ${step}`, () => {
        let minorTotal = 0;
        for (let i = 0; i < count; i++) minorTotal += toMinor(step);
        expect(minorTotal).toBe(toMinor(step) * count);
        expect(Number.isInteger(minorTotal)).toBe(true);
      });
    }
  }
});

describe('formatMoney — returns a non-empty string and never throws, for every currency × magnitude', () => {
  for (const code of CODES) {
    for (const major of [0, 1, 999, 12345.67, 10000000, -50, -999999.99]) {
      const minor = toMinor(major);
      it(`${code} ${major}`, () => {
        const out = formatMoney(minor, code);
        expect(typeof out).toBe('string');
        expect(out.length).toBeGreaterThan(0);
        // The rounded whole-currency amount's digits all appear, in order, somewhere in the output.
        expect(out.replace(/[^0-9]/g, '')).toContain(String(Math.abs(Math.round(major))));
        if (major < 0) expect(out).toMatch(/-|\(/); // negative marked with a minus or parens
      });
    }
  }

  it('rounds to whole currency units on display — the digit run equals the rounded amount', () => {
    for (const code of CODES) {
      // 12345.67 → 12346; whatever grouping/symbol the locale adds, the bare
      // digits are exactly "12346" with no trailing fractional digits.
      expect(formatMoney(12345_67, code).replace(/[^0-9]/g, '')).toBe('12346');
    }
  });

  it('falls back to a plain rounded number string when Intl rejects the currency code', () => {
    // Intl.NumberFormat only rejects codes that are not 3 ASCII letters.
    expect(formatMoney(12345_67, 'US')).toBe('12346');
    expect(formatMoney(-500_00, 'DOLLARS')).toBe('-500');
    expect(formatMoney(0, '12')).toBe('0');
  });
});

describe('getCurrencySymbol — resolves to a non-empty prefix for every supported currency', () => {
  for (const code of CODES) {
    it(`${code}`, () => {
      const sym = getCurrencySymbol(code);
      expect(typeof sym).toBe('string');
      expect(sym.length).toBeGreaterThan(0);
    });
  }

  it('falls back to the raw code for an unknown currency', () => {
    expect(getCurrencySymbol('ZZZ')).toBe('ZZZ');
  });
});

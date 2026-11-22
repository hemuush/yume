/**
 * Combinatorial coverage of the money helpers. `toMinor` is the sole entry for typed amounts (integer minor units, to
 * the paisa: 205.55 stays 20555); `toWholeMinor` is the whole-unit version loans use. `formatMoney` (whole units) and
 * `formatMoneyExact` (paise when there are some) must never throw.
 */
import { toMinor, toWholeMinor, toMajor, formatMoney, formatMoneyExact, getCurrencySymbol } from './money';
import { MAX_AMOUNT_MAJOR, MAX_AMOUNT_MINOR } from './amountLimits';
import { SUPPORTED_CURRENCIES } from '@/db/settings';

const MAJORS = [
  0, 0.01, 0.5, 1, 7, 9.99, 42, 99.5, 100, 250.25, 1000, 12345.67, 100000, 999999.99, 2500000, 10000000,
];
const NEGATIVES = MAJORS.filter((m) => m > 0).map((m) => -m);
const CODES = SUPPORTED_CURRENCIES.map((c) => c.code);

describe('toMinor — keeps a major amount to the paisa', () => {
  for (const major of [...MAJORS, ...NEGATIVES]) {
    it(`${major}`, () => {
      const minor = toMinor(major);
      expect(Number.isInteger(minor)).toBe(true);
      // The nearest paisa to what was typed, within float noise.
      expect(Math.abs(minor - major * 100)).toBeLessThan(0.5 + 1e-6);
      expect(toMajor(minor)).toBeCloseTo(major, 2);
    });
  }

  it('does not lose a paisa to binary float noise', () => {
    expect(toMinor(1.005)).toBe(101);
    expect(toMinor(0.1 + 0.2)).toBe(30);
    expect(toMinor(12.5)).toBe(1250);
    expect(toMinor(205.55)).toBe(20555);
  });
});

describe('toWholeMinor — quantizes a major amount to whole-unit minor units (loans)', () => {
  for (const major of [...MAJORS, ...NEGATIVES]) {
    it(`${major}`, () => {
      const minor = toWholeMinor(major);
      expect(Number.isInteger(minor)).toBe(true);
      expect(minor).toBe(Math.round(major) * 100);
      expect(minor % 100 === 0).toBe(true);
    });
  }

  it('refuses what toMinor refuses', () => {
    expect(toWholeMinor(MAX_AMOUNT_MAJOR + 1)).toBeNaN();
  });
});

describe('toMinor — refuses amounts too large to sum exactly', () => {
  it('accepts the largest amount and its negative', () => {
    expect(toMinor(MAX_AMOUNT_MAJOR)).toBe(MAX_AMOUNT_MINOR);
    expect(toMinor(-MAX_AMOUNT_MAJOR)).toBe(-MAX_AMOUNT_MINOR);
    expect(Number.isSafeInteger(toMinor(MAX_AMOUNT_MAJOR))).toBe(true);
  });

  it('answers NaN, like unparseable text, beyond it', () => {
    expect(toMinor(MAX_AMOUNT_MAJOR + 1)).toBeNaN();
    expect(toMinor(-(MAX_AMOUNT_MAJOR + 1))).toBeNaN();
    expect(toMinor(parseFloat('1' + '0'.repeat(21)))).toBeNaN();
    expect(toMinor(Infinity)).toBeNaN();
  });

  it('keeps the sum of ninety maximum amounts exact', () => {
    expect(Number.isSafeInteger(toMinor(MAX_AMOUNT_MAJOR) * 90)).toBe(true);
  });
});

describe('toMajor ∘ toMinor round-trips to the paisa', () => {
  for (const major of [...MAJORS, ...NEGATIVES]) {
    it(`${major}`, () => {
      expect(toMajor(toMinor(major))).toBeCloseTo(major, 2);
    });
  }
});

describe('toMinor is additive over a running total (no float drift across many adds)', () => {
  for (const step of [1, 7, 42.4, 199.5, 1234.99, 2500]) {
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

describe('formatMoneyExact — a recorded amount as it was typed', () => {
  it('prints a whole amount like formatMoney, and an amount with paise with both digits', () => {
    for (const code of CODES) {
      expect(formatMoneyExact(12345_00, code)).toBe(formatMoney(12345_00, code));
      const digits = formatMoneyExact(12345_67, code).replace(/[^0-9]/g, '');
      expect(digits).toBe(code === 'JPY' ? '12346' : '1234567');
    }
  });

  it('shows a single paisa, and keeps the minus on a negative amount', () => {
    expect(formatMoneyExact(1, 'INR')).toBe('₹0.01');
    expect(formatMoneyExact(-1250, 'INR')).toBe('-₹12.50');
    expect(formatMoneyExact(0, 'INR')).toBe('₹0');
  });

  it('falls back to a plain number when Intl rejects the currency code, and never throws', () => {
    expect(formatMoneyExact(12345_67, 'US')).toBe('12345.67');
    expect(formatMoneyExact(500_00, 'DOLLARS')).toBe('500');
    expect(() => formatMoneyExact(NaN, 'INR')).not.toThrow();
  });
});

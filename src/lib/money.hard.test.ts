/** Seeded property tests for money.ts and round.ts: round trips, boundaries, every currency, exact allocation. */
import { toMinor, toWholeMinor, toMajor, inputMinor, formatMoney, formatMoneyExact } from './money';
import { roundedMinor, allocateRoundedMinor } from './round';
import { MAX_AMOUNT_MAJOR } from './amountLimits';
import { SUPPORTED_CURRENCIES } from '@/db/settings';

function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const CODES = SUPPORTED_CURRENCIES.map((c) => c.code);

describe('toMinor properties', () => {
  it('round trips every typed two-decimal amount exactly (20000 values)', () => {
    const r = rng(1);
    for (let i = 0; i < 20000; i++) {
      const cents = Math.floor(r() * 10 ** (1 + Math.floor(r() * 12)));
      const typed = Number((cents / 100).toFixed(2));
      expect(toMinor(typed)).toBe(cents);
      expect(Math.round(toMajor(toMinor(typed)) * 100)).toBe(cents);
    }
  });

  it('is symmetric to within one paisa', () => {
    const r = rng(2);
    for (let i = 0; i < 5000; i++) {
      const v = Number((r() * 100000).toFixed(3));
      const pos = toMinor(v);
      const neg = toMinor(-v);
      // Math.round sends negative halves up, so a typed negative may differ by one paisa (loans/typed amounts are positive).
      expect(Math.abs(Math.abs(neg) - pos)).toBeLessThanOrEqual(1);
    }
  });

  it('rounds the half-paisa boundaries up as typed', () => {
    expect(toMinor(1.005)).toBe(101);
    expect(toMinor(0.005)).toBe(1);
    expect(toMinor(0.004)).toBe(0);
    expect(toMinor(2.675)).toBe(268);
    expect(toMinor(0.1 + 0.2)).toBe(30);
    expect(toMinor(0.07)).toBe(7);
    expect(toMinor(1.15)).toBe(115);
    expect(toMinor(8.345)).toBe(835);
  });

  it('is monotonic over a seeded ascending sweep', () => {
    const r = rng(3);
    let v = 0;
    let prev = toMinor(0);
    for (let i = 0; i < 5000; i++) {
      v += r() * 3;
      const m = toMinor(v);
      expect(m).toBeGreaterThanOrEqual(prev);
      prev = m;
    }
  });

  it('handles the limit: exact at MAX, NaN beyond, negatives mirror', () => {
    expect(toMinor(MAX_AMOUNT_MAJOR)).toBe(MAX_AMOUNT_MAJOR * 100);
    expect(toMinor(-MAX_AMOUNT_MAJOR)).toBe(-MAX_AMOUNT_MAJOR * 100);
    expect(toMinor(MAX_AMOUNT_MAJOR + 1)).toBeNaN();
    expect(toMinor(-MAX_AMOUNT_MAJOR - 1)).toBeNaN();
    expect(toMinor(Infinity)).toBeNaN();
    expect(toMinor(-Infinity)).toBeNaN();
    expect(toMinor(NaN)).toBeNaN();
    expect(toWholeMinor(Infinity)).toBeNaN();
    expect(toWholeMinor(NaN)).toBeNaN();
    expect(toWholeMinor(MAX_AMOUNT_MAJOR + 1)).toBeNaN();
    const r = rng(4);
    for (let i = 0; i < 2000; i++) {
      const whole = MAX_AMOUNT_MAJOR - Math.floor(r() * 1000);
      expect(toMinor(whole)).toBe(whole * 100);
      expect(Number.isSafeInteger(toMinor(whole))).toBe(true);
    }
  });

  it('toWholeMinor always gives multiples of 100 within half a unit', () => {
    const r = rng(5);
    for (let i = 0; i < 10000; i++) {
      const v = (r() - 0.5) * 2e6;
      const m = toWholeMinor(v);
      expect(Math.abs(m % 100)).toBe(0);
      expect(Math.abs(m / 100 - v)).toBeLessThanOrEqual(0.5 + 1e-9);
    }
    expect(toWholeMinor(0.5)).toBe(100);
    expect(toWholeMinor(2.5)).toBe(300);
    expect(toWholeMinor(0.49)).toBe(0);
  });

  it('inputMinor parses strings incl. junk, commas and negatives safely', () => {
    expect(inputMinor('')).toBe(0);
    expect(inputMinor('abc')).toBe(0);
    expect(inputMinor('-5')).toBe(0);
    expect(inputMinor('0')).toBe(0);
    expect(inputMinor('12.5')).toBe(1250);
    expect(inputMinor('1.005')).toBe(101);
    expect(inputMinor('1,234')).toBe(100); // parseFloat stops at the comma
    expect(inputMinor('9'.repeat(30))).toBe(0);
    expect(inputMinor('Infinity')).toBe(0);
    expect(inputMinor('NaN')).toBe(0);
  });
});

describe('formatMoney / formatMoneyExact across currencies', () => {
  const samples = [0, 1, 49, 50, 99, 100, 149, 150, 151, 250, 1234, 123456, 12345678, 99999999999900];
  it.each(CODES)('%s: never throws, never prints NaN', (code) => {
    for (const s of [...samples, ...samples.map((x) => -x), -0]) {
      for (const f of [formatMoney, formatMoneyExact]) {
        const out = f(s, code);
        expect(typeof out).toBe('string');
        expect(out).not.toMatch(/NaN|undefined/);
      }
    }
  });

  it.each(CODES)('%s: formatMoney is symmetric in magnitude and rounds half away from zero', (code) => {
    const digits = (s: string) => s.replace(/\D/g, '');
    for (const m of [50, 150, 250, 1050, 12350]) {
      expect(digits(formatMoney(-m, code))).toBe(digits(formatMoney(m, code)));
    }
    expect(digits(formatMoney(150, code))).toBe(digits(formatMoney(200, code)));
    expect(digits(formatMoney(149, code))).toBe(digits(formatMoney(100, code)));
    expect(digits(formatMoney(49, code))).toBe('0');
    expect(formatMoney(-49, code)).toBe(formatMoney(0, code));
    expect(formatMoney(-0, code)).toBe(formatMoney(0, code));
  });

  it.each(CODES)('%s: Exact equals whole when no paise, shows two digits when paise', (code) => {
    expect(formatMoneyExact(125000, code)).toBe(formatMoney(125000, code));
    const out = formatMoneyExact(1250, code);
    if (code === 'JPY') expect(out).toBe(formatMoney(1250, code));
    else expect(out).toMatch(/12[.,]50/);
    expect(formatMoneyExact(1249.6, code)).toBe(formatMoneyExact(1250, code));
  });

  it('bad currency codes fall back without throwing', () => {
    expect(formatMoney(12345, 'ZZZZZZ')).toBe('123');
    expect(formatMoneyExact(12345, 'ZZZZZZ')).toBe('123.45');
    expect(formatMoneyExact(12300, 'ZZZZZZ')).toBe('123');
  });

  it('typed amount survives toMinor then formatMoneyExact for 2000 random values', () => {
    const r = rng(6);
    for (let i = 0; i < 2000; i++) {
      const cents = Math.floor(r() * 1e9);
      const out = formatMoneyExact(toMinor(cents / 100), 'USD');
      const digits = out.replace(/\D/g, '');
      const expected = cents % 100 === 0 ? String(cents / 100) : String(cents);
      expect(digits).toBe(expected);
    }
  });
});

describe('round.ts properties', () => {
  it('roundedMinor is a multiple of 100, never -0, within half a unit, idempotent', () => {
    const r = rng(7);
    for (let i = 0; i < 10000; i++) {
      const m = Math.round((r() - 0.5) * 1e8);
      const out = roundedMinor(m);
      expect(Object.is(out, -0)).toBe(false);
      expect(Math.abs(out % 100)).toBe(0);
      expect(Math.abs(out - m)).toBeLessThanOrEqual(50);
      expect(roundedMinor(out)).toBe(out);
    }
    expect(roundedMinor(50)).toBe(100);
    expect(roundedMinor(-50)).toBe(-100);
    expect(roundedMinor(49)).toBe(0);
    expect(roundedMinor(-49)).toBe(0);
  });

  it('allocateRoundedMinor sums exactly to the rounded total with random mixed-sign parts', () => {
    const r = rng(8);
    for (let i = 0; i < 5000; i++) {
      const n = 1 + Math.floor(r() * 12);
      const parts = Array.from({ length: n }, () => Math.round((r() - (i % 3 === 0 ? 0.3 : 0)) * 100000));
      const out = allocateRoundedMinor(parts);
      const total = parts.reduce((a, b) => a + b, 0);
      expect(out).toHaveLength(n);
      expect(out.reduce((a, b) => a + b, 0)).toBe(roundedMinor(total));
      out.forEach((o, k) => {
        expect(Math.abs(o % 100)).toBe(0);
        expect(Math.abs(o - parts[k])).toBeLessThan(100 * Math.max(2, n));
      });
    }
  });

  it('allocates a total split by random weights exactly (stored EMI case)', () => {
    const r = rng(9);
    for (let i = 0; i < 3000; i++) {
      const total = (1 + Math.floor(r() * 5e6)) * 100;
      const w = Array.from({ length: 2 + Math.floor(r() * 5) }, () => 0.01 + r());
      const sw = w.reduce((a, b) => a + b, 0);
      const parts = w.map((x) => (total * x) / sw);
      const out = allocateRoundedMinor(parts, total);
      expect(out.reduce((a, b) => a + b, 0)).toBe(total);
      out.forEach((o, k) => expect(Math.abs(o - parts[k])).toBeLessThan(100 * (w.length + 1)));
    }
  });

  it('keeps whole input unchanged and handles empty input', () => {
    expect(allocateRoundedMinor([])).toEqual([]);
    expect(allocateRoundedMinor([10000, 25000, -3000])).toEqual([10000, 25000, -3000]);
    expect(allocateRoundedMinor([1040, 1040, 1040]).reduce((a, b) => a + b, 0)).toBe(3100);
  });
});

/**
 * Combinatorial sweeps of every pure date helper — one assertion per
 * generated case, across ranges wide enough to catch month-length, leap-year
 * and timezone-round-trip bugs regardless of which specific date triggers
 * them. These are all local-calendar functions (see src/lib/date.ts's own
 * comments); none of them may ever route through `toISOString()`.
 */
import {
  toLocalIsoDate,
  addMonthsToIsoDate,
  addDaysToIsoDate,
  parseLocalIsoDate,
  monthsBetweenIsoDates,
  partsToIsoDate,
  daysUntilIsoDate,
} from './date';

const pad = (n: number) => String(n).padStart(2, '0');
const iso = (y: number, m: number, d: number) => `${y}-${pad(m)}-${pad(d)}`;

// A span that includes two leap years (2024, 2028).
const YEARS = [2024, 2026, 2028];
const MONTHS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
const ADD_MONTH_STEPS = [0, 1, 2, 6, 11, 12, 13, 24, 60, 240];
const ADD_DAY_STEPS = [0, 1, 7, 14, 31, 90, 365, 366, -1, -7, -31, -365];

describe("toLocalIsoDate — reads the Date object's own local fields, every month across leap years", () => {
  for (const y of YEARS) {
    for (const m of MONTHS) {
      const lastDay = new Date(y, m, 0).getDate();
      for (const d of [1, 14, 28, lastDay]) {
        it(`${iso(y, m, d)}`, () => {
          expect(toLocalIsoDate(new Date(y, m - 1, d))).toBe(iso(y, m, d));
        });
      }
    }
  }

  it('is stable regardless of the time-of-day component', () => {
    for (const hour of [0, 1, 6, 12, 18, 23]) {
      expect(toLocalIsoDate(new Date(2026, 2, 5, hour, 30, 0))).toBe('2026-03-05');
    }
  });
});

describe('parseLocalIsoDate ∘ toLocalIsoDate round-trips to the identical calendar date', () => {
  for (const y of [2024, 2027]) {
    for (const m of MONTHS) {
      for (const d of [1, 15, 28]) {
        const s = iso(y, m, d);
        it(`${s}`, () => {
          const back = parseLocalIsoDate(s);
          expect(back.getFullYear()).toBe(y);
          expect(back.getMonth()).toBe(m - 1);
          expect(back.getDate()).toBe(d);
          expect(toLocalIsoDate(back)).toBe(s);
        });
      }
    }
  }
});

describe('addMonthsToIsoDate — matches native local Date month math for every start × step', () => {
  for (const m of MONTHS) {
    for (const d of [1, 28]) {
      for (const step of ADD_MONTH_STEPS) {
        const start = iso(2025, m, d);
        it(`${start} + ${step}mo`, () => {
          expect(addMonthsToIsoDate(start, step)).toBe(toLocalIsoDate(new Date(2025, m - 1 + step, d)));
        });
      }
    }
  }

  it('is a no-op for 0 months on every day of a 31-day month', () => {
    for (let d = 1; d <= 31; d++) {
      const s = iso(2026, 1, d);
      expect(addMonthsToIsoDate(s, 0)).toBe(s);
    }
  });

  it('composes additively: +a then +b equals +(a+b)', () => {
    for (const a of [1, 3, 7, 12]) {
      for (const b of [1, 5, 11, 24]) {
        expect(addMonthsToIsoDate(addMonthsToIsoDate('2025-01-15', a), b)).toBe(
          addMonthsToIsoDate('2025-01-15', a + b)
        );
      }
    }
  });
});

describe('addDaysToIsoDate — matches native local Date day math for every start × step', () => {
  for (const m of [1, 2, 6, 12]) {
    for (const d of [1, 28]) {
      for (const step of ADD_DAY_STEPS) {
        const start = iso(2025, m, d);
        it(`${start} + ${step}d`, () => {
          expect(addDaysToIsoDate(start, step)).toBe(toLocalIsoDate(new Date(2025, m - 1, d + step)));
        });
      }
    }
  }

  it('a +N days then -N days round-trip returns the original date', () => {
    for (const step of [1, 7, 30, 31, 90, 365]) {
      expect(addDaysToIsoDate(addDaysToIsoDate('2026-03-31', step), -step)).toBe('2026-03-31');
    }
  });
});

describe('monthsBetweenIsoDates — whole elapsed months, partial final month floored', () => {
  // Anchored on the 5th, matching the loan-scenario "installments already paid" check.
  for (const m of MONTHS) {
    for (const laterMonths of [0, 1, 6, 12, 13, 24]) {
      const from = iso(2025, m, 5);
      it(`${from} → +${laterMonths}mo, same day`, () => {
        expect(monthsBetweenIsoDates(from, addMonthsToIsoDate(from, laterMonths))).toBe(laterMonths);
      });
      it(`${from} → +${laterMonths}mo minus one day floors to ${Math.max(0, laterMonths - 1)}`, () => {
        const to = addDaysToIsoDate(addMonthsToIsoDate(from, laterMonths), -1);
        expect(monthsBetweenIsoDates(from, to)).toBe(Math.max(0, laterMonths - 1));
      });
    }
  }

  it('never goes negative when `to` precedes `from`', () => {
    for (const months of [1, 5, 12, 50]) {
      expect(monthsBetweenIsoDates('2027-06-15', addMonthsToIsoDate('2027-06-15', -months))).toBe(0);
    }
  });
});

describe('partsToIsoDate — accepts every real calendar date, rejects impossible ones', () => {
  for (const y of [2024, 2025]) {
    for (const m of MONTHS) {
      const lastDay = new Date(y, m, 0).getDate();
      for (let d = 1; d <= 31; d++) {
        const valid = d <= lastDay;
        it(`${y}-${pad(m)}-${pad(d)} → ${valid ? 'accepted' : 'rejected'}`, () => {
          const result = partsToIsoDate(String(y), String(m), String(d));
          if (valid) expect(result).toBe(iso(y, m, d));
          else expect(result).toBeNull();
        });
      }
    }
  }

  it('rejects out-of-range months and years and non-numeric input', () => {
    expect(partsToIsoDate('2025', '0', '10')).toBeNull();
    expect(partsToIsoDate('2025', '13', '10')).toBeNull();
    expect(partsToIsoDate('1899', '1', '1')).toBeNull();
    expect(partsToIsoDate('2201', '1', '1')).toBeNull();
    expect(partsToIsoDate('abc', '1', '1')).toBeNull();
    expect(partsToIsoDate('2025', '', '')).toBeNull();
  });
});

describe('daysUntilIsoDate — signed whole-day distance from local midnight today', () => {
  const midnightToday = () => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  };
  for (let offset = -30; offset <= 30; offset++) {
    it(`offset ${offset} days`, () => {
      const target = new Date(midnightToday());
      target.setDate(target.getDate() + offset);
      expect(daysUntilIsoDate(toLocalIsoDate(target))).toBe(offset);
    });
  }
});

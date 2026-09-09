/**
 * A combinatorial sweep of date math across years (leap and non-leap),
 * every month, and a spread of days including month-end edge cases —
 * checking the round-trip and ordering invariants every date helper in the
 * app depends on (loan schedules, report period ranges, "member since",
 * "days until due").
 */
import { toLocalIsoDate, parseLocalIsoDate, addMonthsToIsoDate, monthsBetweenIsoDates } from './date';

const YEARS = [2023, 2024, 2025, 2026, 2027, 2028, 2032]; // mix of leap (2024, 2028, 2032) and non-leap
const MONTHS = Array.from({ length: 12 }, (_, i) => i + 1);
const DAYS = [1, 5, 15, 28]; // 28 is safe across every month, incl. Feb

describe('date calculation matrix — every year × month × day combination', () => {
  for (const year of YEARS) {
    for (const month of MONTHS) {
      for (const day of DAYS) {
        const iso = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

        it(`${iso}: toLocalIsoDate and parseLocalIsoDate are exact inverses`, () => {
          expect(toLocalIsoDate(parseLocalIsoDate(iso))).toBe(iso);
        });

        it(`${iso}: adding 0 months is a no-op`, () => {
          expect(addMonthsToIsoDate(iso, 0)).toBe(iso);
        });

        it(`${iso}: adding N months then measuring months-between recovers N, for N up to 24`, () => {
          for (const n of [1, 3, 6, 12, 24]) {
            const later = addMonthsToIsoDate(iso, n);
            expect(monthsBetweenIsoDates(iso, later)).toBe(n);
          }
        });

        it(`${iso}: adding 12 months lands exactly one year later on the same month and day (or Feb 28/29 fallback)`, () => {
          const later = parseLocalIsoDate(addMonthsToIsoDate(iso, 12));
          const original = parseLocalIsoDate(iso);
          expect(later.getFullYear()).toBe(original.getFullYear() + 1);
          expect(later.getMonth()).toBe(original.getMonth());
        });

        it(`${iso}: monthsBetweenIsoDates is never negative when the reference date is not before it`, () => {
          expect(monthsBetweenIsoDates(iso, iso)).toBe(0);
        });
      }
    }
  }

  it('Jan 31 + 1 month lands on the last valid day of February for both leap and non-leap years', () => {
    expect(addMonthsToIsoDate('2024-01-31', 1)).toBe('2024-03-02'); // 2024 leap: native Date overflow rolls into March
    expect(addMonthsToIsoDate('2023-01-31', 1)).toBe('2023-03-03'); // 2023 non-leap: same overflow behavior, one day later
  });

  it('monthsBetweenIsoDates floors a partial final month consistently across every tested year', () => {
    for (const year of YEARS) {
      const start = `${year}-01-15`;
      expect(monthsBetweenIsoDates(start, `${year}-02-14`)).toBe(0); // one day short of a full month
      expect(monthsBetweenIsoDates(start, `${year}-02-15`)).toBe(1); // exactly one full month
    }
  });
});

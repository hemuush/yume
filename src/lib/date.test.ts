import { toLocalIsoDate, addMonthsToIsoDate, monthsBetweenIsoDates, daysUntilIsoDate } from './date';

describe('toLocalIsoDate', () => {
  it("formats using the Date object's own local fields, not a UTC conversion", () => {
    expect(toLocalIsoDate(new Date(2024, 0, 31))).toBe('2024-01-31'); // Jan 31, local midnight
    expect(toLocalIsoDate(new Date(2024, 11, 1))).toBe('2024-12-01');
  });

  it('pads single-digit months and days', () => {
    expect(toLocalIsoDate(new Date(2024, 2, 5))).toBe('2024-03-05');
  });
});

describe('addMonthsToIsoDate', () => {
  it('adds whole months, rolling over year boundaries', () => {
    expect(addMonthsToIsoDate('2024-11-15', 2)).toBe('2025-01-15');
  });

  it('overflows a nonexistent day (Jan 31 + 1 month) into the next valid date, same as native Date', () => {
    expect(addMonthsToIsoDate('2024-01-31', 1)).toBe('2024-03-02'); // 2024 is a leap year: Feb has 29 days
  });

  it('is a no-op for 0 months', () => {
    expect(addMonthsToIsoDate('2024-06-10', 0)).toBe('2024-06-10');
  });

  it('never round-trips through UTC, so it is correct regardless of the device timezone offset', () => {
    // A date-only string parsed via `new Date(str)` is UTC midnight; in a positive-offset
    // timezone that reads back as the previous local day. addMonthsToIsoDate must not do that.
    expect(addMonthsToIsoDate('2024-01-01', 0)).toBe('2024-01-01');
  });
});

describe('monthsBetweenIsoDates', () => {
  it('counts whole elapsed months, flooring a partial final month', () => {
    expect(monthsBetweenIsoDates('2025-09-05', '2026-09-04')).toBe(11); // one day short of 12 full months
    expect(monthsBetweenIsoDates('2025-09-05', '2026-09-05')).toBe(12);
  });

  it('matches the Hdfc loan scenario that motivated it: ~1 year elapsed is nowhere near 50 months', () => {
    expect(monthsBetweenIsoDates('2025-09-05', '2026-09-05')).toBeLessThan(50);
  });

  it('never goes negative for a start date after the reference date', () => {
    expect(monthsBetweenIsoDates('2026-09-05', '2025-01-01')).toBe(0);
  });
});

describe('daysUntilIsoDate', () => {
  const iso = (d: Date) => toLocalIsoDate(d);
  const shift = (days: number) => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() + days);
    return iso(d);
  };

  it('is 0 for today, negative for the past, positive for the future', () => {
    expect(daysUntilIsoDate(shift(0))).toBe(0);
    expect(daysUntilIsoDate(shift(-3))).toBe(-3);
    expect(daysUntilIsoDate(shift(10))).toBe(10);
  });

  it('measures from local midnight, so the current time of day never changes the count', () => {
    expect(daysUntilIsoDate(shift(1))).toBe(1);
  });
});

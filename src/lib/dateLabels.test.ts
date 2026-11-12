import { weekdayDayMonth, weekdayDayMonthYear, weekdayDayMonthMaybeYear } from './dateLabels';

describe('weekdayDayMonthMaybeYear', () => {
  const today = new Date(2026, 10, 12);
  it('leaves the year off a date in this year', () => {
    expect(weekdayDayMonthMaybeYear('2026-03-03', today)).toBe(weekdayDayMonth('2026-03-03'));
  });
  it('names the year of a date in any other, past or future', () => {
    expect(weekdayDayMonthMaybeYear('2027-03-03', today)).toBe(weekdayDayMonthYear('2027-03-03'));
    expect(weekdayDayMonthMaybeYear('2027-03-03', today)).toContain('2027');
    expect(weekdayDayMonthMaybeYear('2025-12-31', today)).toContain('2025');
  });
});

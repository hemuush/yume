import {
  addDays,
  availablePeriods,
  daysBetween,
  inPeriod,
  latestPeriod,
  periodFileStem,
  periodLabel,
  periodRange,
  previousPeriod,
  weekdayIndex,
} from './period';

describe('report period', () => {
  it('spans a month, including leap February', () => {
    expect(periodRange({ kind: 'month', year: 2028, month: 2 })).toEqual({
      from: '2028-02-01',
      to: '2028-02-29',
    });
    expect(periodRange({ kind: 'month', year: 2026, month: 2 })).toEqual({
      from: '2026-02-01',
      to: '2026-02-28',
    });
  });
  it('spans a year, and all time follows the entries', () => {
    expect(periodRange({ kind: 'year', year: 2026 })).toEqual({ from: '2026-01-01', to: '2026-12-31' });
    expect(periodRange({ kind: 'all' }, ['2025-03-02', '2026-01-09', '2024-12-31'])).toEqual({
      from: '2024-12-31',
      to: '2026-01-09',
    });
    expect(periodRange({ kind: 'all' })).toBeNull();
  });
  it('tests membership on whole days, ignoring any time part', () => {
    expect(inPeriod('2026-09-30T23:59:00', { kind: 'month', year: 2026, month: 9 })).toBe(true);
    expect(inPeriod('2026-10-01', { kind: 'month', year: 2026, month: 9 })).toBe(false);
    expect(inPeriod('1999-01-01', { kind: 'all' })).toBe(true);
  });
  it('steps back over a year boundary', () => {
    expect(previousPeriod({ kind: 'month', year: 2026, month: 1 })).toEqual({
      kind: 'month',
      year: 2025,
      month: 12,
    });
    expect(previousPeriod({ kind: 'year', year: 2026 })).toEqual({ kind: 'year', year: 2025 });
    expect(previousPeriod({ kind: 'all' })).toBeNull();
  });
  it('names periods and files', () => {
    expect(periodLabel({ kind: 'month', year: 2026, month: 9 })).toBe('September 2026');
    expect(periodFileStem({ kind: 'month', year: 2026, month: 9 })).toBe('yume-2026-09');
    expect(periodFileStem({ kind: 'year', year: 2026 })).toBe('yume-2026');
    expect(periodFileStem({ kind: 'all' })).toBe('yume-all');
  });
  it('does day maths without time-zone drift', () => {
    expect(weekdayIndex('2026-09-30')).toBe(2); // Wednesday
    expect(weekdayIndex('2026-09-27')).toBe(6); // Sunday
    expect(daysBetween('2026-03-01', '2026-04-01')).toBe(31);
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
  });
  it('offers only periods with entries, newest first', () => {
    const { years, months } = availablePeriods(['2025-03-02', '2026-01-09', '2026-09-30', '2026-09-01']);
    expect(years).toEqual([2026, 2025]);
    expect(months.get(2026)).toEqual([9, 1]);
    expect(latestPeriod('month', ['2026-01-09', '2026-09-01'], '2026-10-23')).toEqual({
      kind: 'month',
      year: 2026,
      month: 9,
    });
    expect(latestPeriod('year', [], '2026-10-23')).toEqual({ kind: 'year', year: 2026 });
  });
});

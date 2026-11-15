import { periodModel } from './periodModel';

const daily = [
  { date: '2026-10-02', totalMinor: 100000 },
  { date: '2026-10-05', totalMinor: 620000 },
  { date: '2026-10-28', totalMinor: 50000 },
];
const october = { start: '2026-10-01', end: '2026-10-31' };

describe('periodModel', () => {
  it('names a month, counts its days, and counts spending only up to today', () => {
    const model = periodModel({
      cursor: { granularity: 'month', offset: 0 },
      range: october,
      daily,
      today: '2026-10-20',
      expenseMinor: 770000,
    });
    expect(model).toMatchObject({ custom: false, isYear: false, daysInPeriod: 31, byMonth: false });
    // 5,000 dated after today is in the total but not in the days so far.
    expect(model.facts).toMatchObject({ countedDays: 20, spendDays: 2, laterMinor: 50000 });
    expect(model.facts.perDayMinor).toBe(Math.round(720000 / 20));
  });

  it('reads a year, and a custom range longer than a month grid holds, by month', () => {
    const year = periodModel({
      cursor: { granularity: 'year', offset: 0 },
      range: { start: '2026-01-01', end: '2026-12-31' },
      daily: [],
      today: '2026-10-20',
      expenseMinor: 0,
    });
    expect(year).toMatchObject({ isYear: true, byMonth: true, daysInPeriod: 365 });
    const long = periodModel({
      cursor: { granularity: 'custom', start: '2026-01-01', end: '2026-09-30' },
      range: { start: '2026-01-01', end: '2026-09-30' },
      daily: [],
      today: '2026-10-20',
      expenseMinor: 0,
    });
    expect(long).toMatchObject({ custom: true, byMonth: true });
    const short = periodModel({
      cursor: { granularity: 'custom', start: '2026-10-01', end: '2026-10-10' },
      range: { start: '2026-10-01', end: '2026-10-10' },
      daily: [],
      today: '2026-10-20',
      expenseMinor: 0,
    });
    expect(short).toMatchObject({ custom: true, byMonth: false, daysInPeriod: 10 });
  });
});

import { Transaction } from '@/types';
import { sevenDaysEndingOn, previousRangeFor, groupByDate, periodHeading } from './transactions.helpers';

describe('Activity helpers', () => {
  it('builds the 7 days ending on the anchor, oldest first, across a month edge', () => {
    const days = sevenDaysEndingOn(new Date(2026, 9, 3)); // Sat Oct 3
    expect(days.map((d) => d.iso)).toEqual([
      '2026-09-27',
      '2026-09-28',
      '2026-09-29',
      '2026-09-30',
      '2026-10-01',
      '2026-10-02',
      '2026-10-03',
    ]);
    expect(days[0]).toEqual({ iso: '2026-09-27', day: 27, month: 8, year: 2026 });
  });

  it('finds the prior week, and the whole prior month', () => {
    expect(previousRangeFor({ fromDate: '2026-09-20', toDate: '2026-09-26' }, 'week')).toEqual({
      fromDate: '2026-09-13',
      toDate: '2026-09-19',
    });
    expect(previousRangeFor({ fromDate: '2026-03-01', toDate: '2026-03-31' }, 'month')).toEqual({
      fromDate: '2026-02-01',
      toDate: '2026-02-28',
    });
    expect(previousRangeFor({ fromDate: '2026-01-01', toDate: '2026-01-31' }, 'month')).toEqual({
      fromDate: '2025-12-01',
      toDate: '2025-12-31',
    });
  });

  it('groups consecutive same-date transactions, keeping order', () => {
    const tx = (id: string, date: string) => ({ id, date }) as Transaction;
    const groups = groupByDate([tx('a', '2026-09-26'), tx('b', '2026-09-26'), tx('c', '2026-09-25')]);
    expect(groups.map((g) => [g.date, g.items.map((t) => t.id)])).toEqual([
      ['2026-09-26', ['a', 'b']],
      ['2026-09-25', ['c']],
    ]);
  });
});

describe('periodHeading', () => {
  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const today = new Date(2026, 8, 26);

  it('calls the current 7 days "This week" and shows their dates', () => {
    expect(
      periodHeading({
        scope: 'week',
        days: sevenDaysEndingOn(today),
        anchor: today,
        today,
        monthNames: MONTHS,
      })
    ).toEqual({ title: 'This week', sub: '20–26 Sep' });
  });

  it('leads a past week with its dates, across a month boundary too', () => {
    const anchor = new Date(2026, 9, 4);
    expect(
      periodHeading({
        scope: 'week',
        days: sevenDaysEndingOn(anchor),
        anchor,
        today: new Date(2026, 9, 20),
        monthNames: MONTHS,
      })
    ).toEqual({ title: '28 Sep – 4 Oct', sub: '' });
  });

  it("adds the year only when it isn't this year", () => {
    const anchor = new Date(2025, 11, 31);
    expect(
      periodHeading({ scope: 'week', days: sevenDaysEndingOn(anchor), anchor, today, monthNames: MONTHS }).sub
    ).toBe('2025');
    expect(periodHeading({ scope: 'month', days: [], anchor, today, monthNames: MONTHS }).sub).toBe('2025');
    expect(periodHeading({ scope: 'month', days: [], anchor: today, today, monthNames: MONTHS }).sub).toBe(
      ''
    );
  });
});

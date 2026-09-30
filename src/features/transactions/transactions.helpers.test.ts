import { Transaction } from '@/types';
import {
  weekContaining,
  stepWeekAnchor,
  weekCompareLabel,
  previousRangeFor,
  groupByDate,
  periodHeading,
  filterActivity,
} from './transactions.helpers';
import { dayMonth } from '@/lib/dateLabels';
import { toLocalIsoDate } from '@/lib/date';
import type { ActivityFilter } from './FilterModal';

describe('Activity helpers', () => {
  it('holds a week inside its month, Sunday to Saturday, cut at both ends', () => {
    // 1 Oct 2026 is a Thursday: the first week is just Thu–Sat.
    const first = weekContaining(new Date(2026, 9, 1));
    expect(first).toMatchObject({ start: '2026-10-01', end: '2026-10-03', index: 0 });
    expect(first.ranges).toHaveLength(5);
    expect(weekContaining(new Date(2026, 9, 14))).toMatchObject({
      start: '2026-10-11',
      end: '2026-10-17',
      index: 2,
    });
    // September ends on a Wednesday: its last week is Sun–Wed, never running into October.
    expect(weekContaining(new Date(2026, 8, 30))).toMatchObject({
      start: '2026-09-27',
      end: '2026-09-30',
      index: 4,
    });
    expect(weekContaining(new Date(2026, 8, 1))).toMatchObject({
      start: '2026-09-01',
      end: '2026-09-05',
      index: 0,
    });
  });

  it('steps a week at a time, hops to the neighbouring month at an edge, and stops at today', () => {
    const today = new Date(2026, 9, 1);
    const iso = (d: Date) => toLocalIsoDate(d);
    expect(iso(stepWeekAnchor(new Date(2026, 8, 14), 1, today))).toBe('2026-09-20');
    expect(iso(stepWeekAnchor(new Date(2026, 8, 28), 1, today))).toBe('2026-10-01');
    expect(iso(stepWeekAnchor(new Date(2026, 9, 1), -1, today))).toBe('2026-09-27');
    expect(iso(stepWeekAnchor(new Date(2026, 8, 1), -1, today))).toBe('2026-08-30');
    expect(iso(stepWeekAnchor(new Date(2026, 8, 28), 1, new Date(2026, 8, 29)))).toBe('2026-09-29');
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

  it('compares a part-week with the same weekdays of the week before', () => {
    expect(previousRangeFor({ fromDate: '2026-10-01', toDate: '2026-10-03' }, 'week')).toEqual({
      fromDate: '2026-09-24',
      toDate: '2026-09-26',
    });
    // Mid-week: only up to the same day last week, not its whole length.
    expect(previousRangeFor({ fromDate: '2026-09-20', toDate: '2026-09-26' }, 'week', '2026-09-23')).toEqual({
      fromDate: '2026-09-13',
      toDate: '2026-09-16',
    });
  });

  it('says "same days" unless the week is whole and over', () => {
    expect(weekCompareLabel({ start: '2026-10-01', end: '2026-10-03' }, '2026-10-20')).toBe(
      'same days last week'
    );
    expect(weekCompareLabel({ start: '2026-09-20', end: '2026-09-26' }, '2026-09-23')).toBe(
      'same days last week'
    );
    expect(weekCompareLabel({ start: '2026-09-20', end: '2026-09-26' }, '2026-10-01')).toBe('last week');
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
  const today = new Date(2026, 9, 1);

  it('calls the week holding today "This week" and shows its dates', () => {
    expect(periodHeading({ scope: 'week', week: weekContaining(today), anchor: today, today })).toEqual({
      title: 'This week',
      sub: `1–${dayMonth('2026-10-03')}`,
    });
  });

  it('leads any other week with its dates and its place in the month', () => {
    const anchor = new Date(2026, 8, 20);
    expect(periodHeading({ scope: 'week', week: weekContaining(anchor), anchor, today })).toEqual({
      title: `20–${dayMonth('2026-09-26')}`,
      sub: 'Week 4 of 5',
    });
  });

  it("adds the year only when it isn't this year", () => {
    const anchor = new Date(2025, 11, 31);
    expect(periodHeading({ scope: 'week', week: weekContaining(anchor), anchor, today }).sub).toBe(
      'Week 5 of 5 · 2025'
    );
    expect(periodHeading({ scope: 'month', week: weekContaining(anchor), anchor, today }).sub).toBe('2025');
    expect(periodHeading({ scope: 'month', week: weekContaining(today), anchor: today, today }).sub).toBe('');
  });
});

describe('filterActivity', () => {
  const tx = (
    id: string,
    type: 'expense' | 'income' | 'transfer',
    accountId: string,
    categoryId: string | null,
    toAccountId: string | null = null
  ) =>
    ({ id, type, accountId, toAccountId, categoryId, amountMinor: 100, date: '2026-09-10', note: '' }) as any;
  const cats = [
    { id: 'food', parentId: null },
    { id: 'zomato', parentId: 'food' },
    { id: 'travel', parentId: null },
  ] as any[];
  const list = [
    tx('lunch', 'expense', 'sbi', 'food'),
    tx('order', 'expense', 'hdfc', 'zomato'),
    tx('cab', 'expense', 'sbi', 'travel'),
    tx('move', 'transfer', 'savings', null, 'sbi'),
  ];
  const none: ActivityFilter = { type: 'all', categoryIds: [], accountIds: [] };
  const ids = (f: Partial<ActivityFilter>) => filterActivity(list, { ...none, ...f }, cats).map((t) => t.id);

  it('keeps everything with no filter', () => {
    expect(ids({})).toEqual(['lunch', 'order', 'cab', 'move']);
  });

  it('matches an account on either side of a transfer', () => {
    expect(ids({ accountIds: ['sbi'] })).toEqual(['lunch', 'cab', 'move']);
    expect(ids({ accountIds: ['savings'] })).toEqual(['move']);
  });

  it("matches a parent category's subcategories too", () => {
    expect(ids({ categoryIds: ['food'] })).toEqual(['lunch', 'order']);
  });

  it('needs every kind of filter to match', () => {
    expect(ids({ categoryIds: ['food'], accountIds: ['hdfc'] })).toEqual(['order']);
    expect(ids({ type: 'transfer', accountIds: ['sbi'] })).toEqual(['move']);
  });
});

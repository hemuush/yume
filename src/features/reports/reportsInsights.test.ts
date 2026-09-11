import {
  heatLevel,
  baselineFromTrend,
  recurringVsDiscretionary,
  categoryDeltas,
  describeSpendingPattern,
  summariseDayTotal,
} from './reportsInsights';
import type { CategoryBreakdownItem } from '@/db/reports';
import { parseLocalIsoDate } from '@/lib/date';

const cat = (id: string, name: string, totalMinor: number): CategoryBreakdownItem => ({
  categoryId: id,
  name,
  color: '#000',
  totalMinor,
  hasSubcategories: false,
  isSensitive: false,
});

describe('heatLevel', () => {
  it('is 0 for no spend', () => {
    expect(heatLevel(0, 10000)).toBe(0);
  });
  it('scales with the fraction of the heaviest day', () => {
    expect(heatLevel(10000, 10000)).toBe(4);
    expect(heatLevel(5000, 10000)).toBe(3);
    expect(heatLevel(2000, 10000)).toBe(2);
    expect(heatLevel(500, 10000)).toBe(1);
  });
});

describe('baselineFromTrend', () => {
  it('averages the prior months, excluding the current (last) point', () => {
    const t = [
      { label: 'Apr', totalMinor: 30000 },
      { label: 'May', totalMinor: 40000 },
      { label: 'Jun', totalMinor: 50000 },
      { label: 'Jul', totalMinor: 999999 }, // current — ignored
    ];
    expect(baselineFromTrend(t)).toBe(40000);
  });
  it('is null without at least two prior months', () => {
    expect(
      baselineFromTrend([
        { label: 'Jun', totalMinor: 1 },
        { label: 'Jul', totalMinor: 2 },
      ])
    ).toBeNull();
  });
});

describe('recurringVsDiscretionary', () => {
  it('splits by the fixed-category name set', () => {
    const bd = [cat('a', 'Loan EMI', 2000000), cat('b', 'Rent', 700000), cat('c', 'Food & Dining', 500000)];
    expect(recurringVsDiscretionary(bd)).toEqual({
      recurringMinor: 2700000,
      discretionaryMinor: 500000,
    });
  });
});

describe('categoryDeltas', () => {
  it('is a percentage vs the same category last period, null when it is new', () => {
    const cur = [cat('a', 'Food', 2000), cat('b', 'Fuel', 1000)];
    const prev = [cat('a', 'Food', 1000)];
    const d = categoryDeltas(cur, prev);
    expect(d.get('a')).toBe(100);
    expect(d.get('b')).toBeNull();
  });
});

describe('describeSpendingPattern', () => {
  it('returns nothing for a near-empty month', () => {
    expect(describeSpendingPattern([{ date: '2026-09-03', totalMinor: 500 }], 30)).toEqual([]);
  });
  it('calls out a dominant single day', () => {
    const daily = [
      { date: '2026-09-01', totalMinor: 100000 },
      { date: '2026-09-05', totalMinor: 2000 },
      { date: '2026-09-09', totalMinor: 2000 },
      { date: '2026-09-15', totalMinor: 2000 },
    ];
    const lines = describeSpendingPattern(daily, 30);
    // Built via the same `toLocaleDateString(undefined, ...)` call the
    // production code uses, rather than a hardcoded "1 Sep" literal — the
    // default locale's day/month order differs by environment (e.g. "1 Sept"
    // on a machine defaulting to a day-first locale vs "Sep 1" on one
    // defaulting to en-US), so a hardcoded order passed locally but failed
    // in CI.
    const expectedDate = parseLocalIsoDate('2026-09-01').toLocaleDateString(undefined, {
      day: 'numeric',
      month: 'short',
    });
    expect(lines.some((l) => l.includes('Heaviest day') && l.includes(expectedDate))).toBe(true);
  });
});

describe('summariseDayTotal', () => {
  it('shows total spent when the day has only expenses', () => {
    expect(
      summariseDayTotal([
        { type: 'expense', amountMinor: 12000 },
        { type: 'expense', amountMinor: 8000 },
      ])
    ).toEqual({ label: 'Total spent', amountMinor: 20000, sign: '−' });
  });

  it('shows a positive net when income outweighs spend that day', () => {
    expect(
      summariseDayTotal([
        { type: 'income', amountMinor: 8600000 },
        { type: 'expense', amountMinor: 50000 },
      ])
    ).toEqual({ label: 'Net this day', amountMinor: 8550000, sign: '+' });
  });

  it('shows a negative net when spend outweighs income that day', () => {
    expect(
      summariseDayTotal([
        { type: 'income', amountMinor: 10000 },
        { type: 'expense', amountMinor: 25000 },
      ])
    ).toEqual({ label: 'Net this day', amountMinor: 15000, sign: '−' });
  });

  it('ignores transfers between the user’s own accounts', () => {
    expect(
      summariseDayTotal([
        { type: 'transfer', amountMinor: 500000 },
        { type: 'expense', amountMinor: 3000 },
      ])
    ).toEqual({ label: 'Total spent', amountMinor: 3000, sign: '−' });
  });

  it('handles a day with no countable movement', () => {
    expect(summariseDayTotal([{ type: 'transfer', amountMinor: 500000 }])).toEqual({
      label: 'Total spent',
      amountMinor: 0,
      sign: '',
    });
  });
});

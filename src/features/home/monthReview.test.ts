import { buildMonthReview, monthReviewWindow, MONTH_REVIEW_LAST_DAY } from './monthReview';
import type { PeriodComparison, CategoryBreakdownItem } from '@/db/reports';

const cat = (name: string, totalMinor: number): CategoryBreakdownItem => ({
  categoryId: name,
  name,
  color: '#000',
  totalMinor,
  hasSubcategories: false,
  isSensitive: false,
});

const comparison = (over: {
  income?: number;
  expense?: number;
  current?: CategoryBreakdownItem[];
  previous?: CategoryBreakdownItem[];
}): PeriodComparison => ({
  period: 'month',
  current: {
    incomeMinor: over.income ?? 5000000,
    expenseMinor: over.expense ?? 3842000,
    netMinor: 0,
    savingsContributionMinor: 0,
    categoryBreakdown: over.current ?? [cat('Food', 980000), cat('Rent', 900000)],
  },
  previous: {
    incomeMinor: 0,
    expenseMinor: 0,
    netMinor: 0,
    savingsContributionMinor: 0,
    categoryBreakdown: over.previous ?? [cat('Food', 740000), cat('Rent', 900000)],
  },
  incomeChangePct: null,
  expenseChangePct: null,
});

const oct3 = new Date(2026, 9, 3);

describe('monthReviewWindow', () => {
  it('is open on days 1 to 7 and reviews the month that just ended', () => {
    expect(monthReviewWindow(new Date(2026, 9, 1))).toMatchObject({ open: true, monthKey: '2026-09' });
    expect(monthReviewWindow(new Date(2026, 9, MONTH_REVIEW_LAST_DAY)).open).toBe(true);
    expect(monthReviewWindow(new Date(2026, 9, MONTH_REVIEW_LAST_DAY + 1)).open).toBe(false);
  });

  it('crosses the year boundary: early January reviews last December', () => {
    expect(monthReviewWindow(new Date(2027, 0, 3)).monthKey).toBe('2026-12');
  });
});

describe('buildMonthReview', () => {
  it('summarises last month: spent, kept, top category, and its biggest mover', () => {
    const review = buildMonthReview({ today: oct3, comparison: comparison({}), dismissedMonthKey: null });
    expect(review).toEqual({
      monthKey: '2026-09',
      monthLabel: new Date(2026, 8, 1).toLocaleDateString(undefined, { month: 'long' }),
      spentMinor: 3842000,
      keptLabel: '23%',
      topCategoryName: 'Food',
      line: `Food was up 32% on ${new Date(2026, 7, 1).toLocaleDateString(undefined, { month: 'long' })}.`,
    });
  });

  it('is hidden outside the window, once dismissed for that month, and for a month with no spending', () => {
    expect(
      buildMonthReview({ today: new Date(2026, 9, 12), comparison: comparison({}), dismissedMonthKey: null })
    ).toBeNull();
    expect(
      buildMonthReview({ today: oct3, comparison: comparison({}), dismissedMonthKey: '2026-09' })
    ).toBeNull();
    expect(
      buildMonthReview({ today: oct3, comparison: comparison({ expense: 0 }), dismissedMonthKey: null })
    ).toBeNull();
  });

  it('a dismissal from an earlier month does not hide this one', () => {
    expect(
      buildMonthReview({ today: oct3, comparison: comparison({}), dismissedMonthKey: '2026-08' })
    ).not.toBeNull();
  });

  it('leaves kept blank without income, and the line out without a mover', () => {
    const review = buildMonthReview({
      today: oct3,
      comparison: comparison({ income: 0, previous: [cat('Food', 980000), cat('Rent', 900000)] }),
      dismissedMonthKey: null,
    });
    expect(review).toMatchObject({ keptLabel: null, line: null });
  });
});

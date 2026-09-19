import { buildDailySpendBars, buildWeeklySpendBars, weekRangesInMonth, legendForBars } from './spendChart';
import type { Category, Transaction } from '@/types';

const cat = (id: string, name: string, color: string, parentId: string | null = null): Category => ({
  id,
  name,
  kind: 'expense',
  parentId,
  icon: 'tag',
  color,
  archived: false,
  sortOrder: 0,
  isSensitive: false,
  isSystem: false,
});

const tx = (over: Partial<Transaction>): Transaction => ({
  id: over.id ?? 'tx',
  type: 'expense',
  accountId: 'acc',
  toAccountId: null,
  categoryId: null,
  amountMinor: 0,
  date: '2026-09-10',
  note: '',
  tags: [],
  paymentMode: null,
  loanPaymentId: null,
  createdAt: '2026-09-10 10:00:00',
  ...over,
});

describe('buildDailySpendBars', () => {
  it('is expense-only — income and transfers never appear in the stack', () => {
    const categories = [cat('food', 'Food & Dining', '#FF9E7D')];
    const transactions = [
      tx({ id: 'a', type: 'expense', categoryId: 'food', amountMinor: 5000, date: '2026-09-10' }),
      tx({ id: 'b', type: 'income', categoryId: 'food', amountMinor: 999999, date: '2026-09-10' }),
      tx({ id: 'c', type: 'transfer', categoryId: null, amountMinor: 888888, date: '2026-09-10' }),
    ];
    const bars = buildDailySpendBars(transactions, categories, ['2026-09-10'], '2026-09-10');
    expect(bars[0].totalMinor).toBe(5000);
    expect(bars[0].segments).toHaveLength(1);
  });

  it('counts an expense with no category toward the total — e.g. a loan EMI payment, written directly via SQL with no categoryId requirement', () => {
    const categories = [cat('food', 'Food & Dining', '#FF9E7D')];
    const transactions = [
      tx({ id: 'a', categoryId: 'food', amountMinor: 5000, date: '2026-09-10' }),
      tx({ id: 'b', categoryId: null, amountMinor: 180700, date: '2026-09-10', note: 'EMI #1' }),
    ];
    const bars = buildDailySpendBars(transactions, categories, ['2026-09-10'], '2026-09-10');
    expect(bars[0].totalMinor).toBe(185700);
    expect(bars[0].segments).toHaveLength(2);
    const uncategorized = bars[0].segments.find((s) => s.name === 'Uncategorized');
    expect(uncategorized?.amountMinor).toBe(180700);
    // Segments must always sum to the same total the bar itself reports —
    // otherwise the stacked-segment heights in the chart wouldn't add up to
    // the bar's own visible height.
    expect(bars[0].segments.reduce((sum, s) => sum + s.amountMinor, 0)).toBe(bars[0].totalMinor);
  });

  it("rolls a subcategory's spend up into its parent's segment", () => {
    const categories = [cat('food', 'Food & Dining', '#FF9E7D'), cat('zomato', 'Zomato', '#FF9E7D', 'food')];
    const transactions = [
      tx({ id: 'a', categoryId: 'food', amountMinor: 2000, date: '2026-09-10' }),
      tx({ id: 'b', categoryId: 'zomato', amountMinor: 3000, date: '2026-09-10' }),
    ];
    const bars = buildDailySpendBars(transactions, categories, ['2026-09-10'], '2026-09-10');
    expect(bars[0].segments).toHaveLength(1);
    expect(bars[0].segments[0].categoryId).toBe('food');
    expect(bars[0].segments[0].amountMinor).toBe(5000);
  });

  it('gives a day with no expenses a zero-total, empty-segment bar rather than omitting it', () => {
    const bars = buildDailySpendBars([], [], ['2026-09-10', '2026-09-11'], '2026-09-10');
    expect(bars).toEqual([
      { key: '2026-09-10', label: 'T', totalMinor: 0, segments: [], isCurrent: true },
      { key: '2026-09-11', label: 'F', totalMinor: 0, segments: [], isCurrent: false },
    ]);
  });

  it('orders segments largest-amount-first, for a stable stacking order', () => {
    const categories = [cat('a', 'A', '#111'), cat('b', 'B', '#222'), cat('c', 'C', '#333')];
    const transactions = [
      tx({ id: '1', categoryId: 'a', amountMinor: 1000, date: '2026-09-10' }),
      tx({ id: '2', categoryId: 'b', amountMinor: 5000, date: '2026-09-10' }),
      tx({ id: '3', categoryId: 'c', amountMinor: 3000, date: '2026-09-10' }),
    ];
    const bars = buildDailySpendBars(transactions, categories, ['2026-09-10'], '2026-09-10');
    expect(bars[0].segments.map((s) => s.categoryId)).toEqual(['b', 'c', 'a']);
    expect(bars[0].totalMinor).toBe(9000);
  });

  it("only counts a day's own date, not the whole range", () => {
    const categories = [cat('food', 'Food & Dining', '#FF9E7D')];
    const transactions = [
      tx({ id: 'a', categoryId: 'food', amountMinor: 1000, date: '2026-09-10' }),
      tx({ id: 'b', categoryId: 'food', amountMinor: 2000, date: '2026-09-11' }),
    ];
    const bars = buildDailySpendBars(transactions, categories, ['2026-09-10', '2026-09-11'], '2026-09-10');
    expect(bars[0].totalMinor).toBe(1000);
    expect(bars[1].totalMinor).toBe(2000);
  });

  it('flags only the bar matching todayIso as current', () => {
    const bars = buildDailySpendBars([], [], ['2026-09-09', '2026-09-10', '2026-09-11'], '2026-09-10');
    expect(bars.map((b) => b.isCurrent)).toEqual([false, true, false]);
  });
});

describe('weekRangesInMonth', () => {
  it('splits September 2026 (starts on a Tuesday) into 5 Sunday–Saturday buckets, first and last partial', () => {
    const ranges = weekRangesInMonth('2026-09-01', '2026-09-30');
    expect(ranges).toEqual([
      { start: '2026-09-01', end: '2026-09-05' },
      { start: '2026-09-06', end: '2026-09-12' },
      { start: '2026-09-13', end: '2026-09-19' },
      { start: '2026-09-20', end: '2026-09-26' },
      { start: '2026-09-27', end: '2026-09-30' },
    ]);
  });

  it('covers every day of the month exactly once, with no gaps or overlaps', () => {
    const ranges = weekRangesInMonth('2026-02-01', '2026-02-28');
    // Every range's end is one day before the next range's start.
    for (let i = 1; i < ranges.length; i++) {
      expect(ranges[i].start > ranges[i - 1].end).toBe(true);
    }
    expect(ranges[0].start).toBe('2026-02-01');
    expect(ranges[ranges.length - 1].end).toBe('2026-02-28');
  });

  it('is a single bucket for a month that fits inside one calendar week', () => {
    // Not realistic for a real month, but exercises the loop's edge case.
    expect(weekRangesInMonth('2026-09-02', '2026-09-04')).toEqual([
      { start: '2026-09-02', end: '2026-09-04' },
    ]);
  });
});

describe('buildWeeklySpendBars', () => {
  it('sums expenses per calendar week, labelling each with its day range', () => {
    const categories = [cat('food', 'Food & Dining', '#FF9E7D')];
    const transactions = [
      tx({ id: 'a', categoryId: 'food', amountMinor: 1000, date: '2026-09-02' }), // week 1 (Sep 1-5)
      tx({ id: 'b', categoryId: 'food', amountMinor: 2000, date: '2026-09-08' }), // week 2 (Sep 6-12)
    ];
    const bars = buildWeeklySpendBars(transactions, categories, '2026-09-01', '2026-09-30', '2026-09-10');
    expect(bars[0]).toMatchObject({ key: '2026-09-01', label: '1–5', totalMinor: 1000 });
    expect(bars[1]).toMatchObject({ key: '2026-09-06', label: '6–12', totalMinor: 2000, isCurrent: true });
    expect(bars[2].totalMinor).toBe(0);
  });

  it('labels a single-day bucket with just that day, not a range', () => {
    const bars = buildWeeklySpendBars([], [], '2026-09-27', '2026-09-27', '2026-09-27');
    expect(bars).toEqual([{ key: '2026-09-27', label: '27', totalMinor: 0, segments: [], isCurrent: true }]);
  });

  it('rolls subcategory spend up to the parent, same as the daily builder', () => {
    const categories = [cat('food', 'Food & Dining', '#FF9E7D'), cat('zomato', 'Zomato', '#FF9E7D', 'food')];
    const transactions = [tx({ id: 'a', categoryId: 'zomato', amountMinor: 4000, date: '2026-09-03' })];
    const bars = buildWeeklySpendBars(transactions, categories, '2026-09-01', '2026-09-30', '2026-09-10');
    expect(bars[0].segments).toEqual([
      { categoryId: 'food', name: 'Food & Dining', color: '#FF9E7D', amountMinor: 4000 },
    ]);
  });
});

describe('legendForBars', () => {
  it('lists only categories actually present in the bars, each once', () => {
    const bars = buildDailySpendBars(
      [
        tx({ id: 'a', categoryId: 'food', amountMinor: 1000, date: '2026-09-10' }),
        tx({ id: 'b', categoryId: 'food', amountMinor: 500, date: '2026-09-11' }),
        tx({ id: 'c', categoryId: 'fuel', amountMinor: 700, date: '2026-09-11' }),
      ],
      [cat('food', 'Food & Dining', '#FF9E7D'), cat('fuel', 'Fuel', '#A8B8FF')],
      ['2026-09-10', '2026-09-11'],
      '2026-09-10'
    );
    const legend = legendForBars(bars);
    expect(legend).toEqual([
      { categoryId: 'food', name: 'Food & Dining', color: '#FF9E7D' },
      { categoryId: 'fuel', name: 'Fuel', color: '#A8B8FF' },
    ]);
  });

  it('is empty when nothing was spent', () => {
    const bars = buildDailySpendBars([], [], ['2026-09-10'], '2026-09-10');
    expect(legendForBars(bars)).toEqual([]);
  });
});

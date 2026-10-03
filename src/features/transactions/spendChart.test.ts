import { buildWeekSpendBars, buildWeeklySpendBars, weekRangesInMonth, legendForBars } from './spendChart';
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
  paymentMode: null,
  loanPaymentId: null,
  splitId: null,
  isRefund: false,
  createdAt: '2026-09-10 10:00:00',
  ...over,
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

  it('counts an uncategorised expense (e.g. a loan EMI) in the total and an Uncategorized segment', () => {
    const transactions = [
      tx({ id: 'a', categoryId: 'food', amountMinor: 5000, date: '2026-09-10' }),
      tx({ id: 'b', categoryId: null, amountMinor: 180700, date: '2026-09-10' }),
    ];
    const bars = buildWeeklySpendBars(
      transactions,
      [cat('food', 'Food & Dining', '#FF9E7D')],
      '2026-09-10',
      '2026-09-10',
      '2026-09-10'
    );
    expect(bars[0].totalMinor).toBe(185700);
    expect(bars[0].segments.find((x) => x.name === 'Uncategorized')?.amountMinor).toBe(180700);
  });

  it('rolls subcategory spend up to the parent', () => {
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
    const bars = buildWeeklySpendBars(
      [
        tx({ id: 'a', categoryId: 'food', amountMinor: 1000, date: '2026-09-10' }),
        tx({ id: 'b', categoryId: 'food', amountMinor: 500, date: '2026-09-11' }),
        tx({ id: 'c', categoryId: 'fuel', amountMinor: 700, date: '2026-09-11' }),
      ],
      [cat('food', 'Food & Dining', '#FF9E7D'), cat('fuel', 'Fuel', '#A8B8FF')],
      '2026-09-10',
      '2026-09-11',
      '2026-09-10'
    );
    const legend = legendForBars(bars);
    expect(legend).toEqual([
      { categoryId: 'food', name: 'Food & Dining', color: '#FF9E7D' },
      { categoryId: 'fuel', name: 'Fuel', color: '#A8B8FF' },
    ]);
  });

  it('puts the biggest spend first', () => {
    const bars = buildWeeklySpendBars(
      [
        tx({ id: 'a', categoryId: 'food', amountMinor: 300, date: '2026-09-10' }),
        tx({ id: 'b', categoryId: 'fuel', amountMinor: 700, date: '2026-09-11' }),
      ],
      [cat('food', 'Food & Dining', '#FF9E7D'), cat('fuel', 'Fuel', '#A8B8FF')],
      '2026-09-10',
      '2026-09-11',
      '2026-09-10'
    );
    expect(legendForBars(bars).map((l) => l.categoryId)).toEqual(['fuel', 'food']);
  });

  it('is empty when nothing was spent', () => {
    const bars = buildWeeklySpendBars([], [], '2026-09-10', '2026-09-10', '2026-09-10');
    expect(legendForBars(bars)).toEqual([]);
  });
});

describe('buildWeekSpendBars', () => {
  const expense = (date: string, amountMinor: number) =>
    ({ id: date, type: 'expense', date, amountMinor, categoryId: null, isRefund: false }) as never;

  it('keeps seven Sun–Sat columns for the short first week, with September as placeholders', () => {
    const bars = buildWeekSpendBars(
      [expense('2026-10-01', 500)],
      [],
      { start: '2026-10-01', end: '2026-10-03' },
      '2026-10-01'
    );
    expect(bars.map((b) => b.label).join('')).toBe('SMTWTFS');
    expect(bars.map((b) => b.key)).toEqual([
      '2026-09-27',
      '2026-09-28',
      '2026-09-29',
      '2026-09-30',
      '2026-10-01',
      '2026-10-02',
      '2026-10-03',
    ]);
    expect(bars.map((b) => b.state)).toEqual([
      'outside',
      'outside',
      'outside',
      'outside',
      undefined,
      'future',
      'future',
    ]);
    expect(bars[4]).toMatchObject({ totalMinor: 500, isCurrent: true });
  });

  it('does not count spend from a neighbouring month into the placeholders', () => {
    const bars = buildWeekSpendBars(
      [expense('2026-09-30', 900)],
      [],
      { start: '2026-10-01', end: '2026-10-03' },
      '2026-10-03'
    );
    expect(bars.every((b) => b.totalMinor === 0)).toBe(true);
  });

  it('gives a whole past week seven real days', () => {
    const bars = buildWeekSpendBars([], [], { start: '2026-09-20', end: '2026-09-26' }, '2026-10-01');
    expect(bars.every((b) => b.state === undefined)).toBe(true);
    expect(bars[0].key).toBe('2026-09-20');
  });
});

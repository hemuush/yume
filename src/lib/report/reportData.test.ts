import { computeReport, ReportInput } from './reportData';
import type { Account, Category, Transaction } from '@/types';

const acct = (o: Partial<Account>): Account => ({
  id: 'a1',
  name: 'HDFC',
  type: 'bank',
  currency: 'INR',
  openingBalanceMinor: 0,
  currentBalanceMinor: 100000,
  creditLimitMinor: null,
  statementDay: null,
  dueDay: null,
  interestRateAnnualBp: null,
  archived: false,
  createdAt: '2026-01-01',
  ...o,
});
const cat = (o: Partial<Category>): Category => ({
  id: 'c1',
  name: 'Food',
  kind: 'expense',
  parentId: null,
  icon: 'x',
  color: '#F97316',
  archived: false,
  sortOrder: 0,
  isSensitive: false,
  isSystem: false,
  ...o,
});
let n = 0;
const tx = (o: Partial<Transaction>): Transaction => ({
  id: `t${++n}`,
  type: 'expense',
  accountId: 'a1',
  toAccountId: null,
  categoryId: 'c1',
  amountMinor: 10000,
  date: '2026-09-10',
  note: '',
  paymentMode: null,
  loanPaymentId: null,
  splitId: null,
  isRefund: false,
  createdAt: '2026-09-10',
  ...o,
});

const base = (
  transactions: Transaction[],
  period: ReportInput['period'],
  today = '2026-10-23'
): ReportInput => ({
  currency: 'INR',
  accounts: [acct({}), acct({ id: 'usd', name: 'Wise', currency: 'USD' })],
  categories: [
    cat({}),
    cat({ id: 'c2', name: 'Eating out', parentId: 'c1' }),
    cat({ id: 'inc', name: 'Salary', kind: 'income' }),
  ],
  transactions,
  loans: [],
  people: [],
  period,
  today,
});
const sep = { kind: 'month', year: 2026, month: 9 } as const;

describe('computeReport', () => {
  it('totals the period only, refunds lowering spending rather than adding income', () => {
    const r = computeReport(
      base(
        [
          tx({ amountMinor: 50000 }),
          tx({ type: 'income', categoryId: 'inc', amountMinor: 200000 }),
          tx({ type: 'income', amountMinor: 10000, isRefund: true }),
          tx({ date: '2026-08-31', amountMinor: 99999 }),
        ],
        sep
      )
    );
    expect(r.spentMinor).toBe(40000);
    expect(r.incomeMinor).toBe(200000);
    expect(r.netMinor).toBe(160000);
    expect(r.savedShare).toBeCloseTo(0.8);
    expect(r.entryCount).toBe(2);
    expect(r.previous).toMatchObject({ label: 'Aug 2026', spentMinor: 99999 });
  });

  it('keeps other currencies out of the totals but in the entries', () => {
    const r = computeReport(
      base([tx({ amountMinor: 1000 }), tx({ accountId: 'usd', amountMinor: 777777 })], sep)
    );
    expect(r.spentMinor).toBe(1000);
    expect(r.otherCurrencyCount).toBe(1);
    expect(r.entries).toHaveLength(2);
  });

  it('averages a finished month over all its days, a running one over the days so far', () => {
    const done = computeReport(base([tx({ amountMinor: 30000 })], sep, '2026-10-23'));
    expect(done.elapsedDays).toBe(30);
    expect(done.avgPerDayMinor).toBe(1000);
    const running = computeReport(
      base([tx({ amountMinor: 30000 })], { kind: 'month', year: 2026, month: 10 }, '2026-10-10')
    );
    expect(running.elapsedDays).toBe(10);
  });

  it('counts no-spend days and finds the busiest day', () => {
    const r = computeReport(
      base([tx({ date: '2026-09-01', amountMinor: 100 }), tx({ date: '2026-09-02', amountMinor: 900 })], sep)
    );
    expect(r.noSpendDays).toBe(28);
    expect(r.biggestDay).toEqual({ date: '2026-09-02', spentMinor: 900 });
  });

  it('rolls subcategories into their parent and shares add to one', () => {
    const r = computeReport(
      base(
        [
          tx({ amountMinor: 3000 }),
          tx({ categoryId: 'c2', amountMinor: 1000 }),
          tx({ categoryId: 'c2', amountMinor: 1000 }),
        ],
        sep
      )
    );
    expect(r.spendByCategory).toHaveLength(1);
    expect(r.spendByCategory[0]).toMatchObject({ name: 'Food', totalMinor: 5000, count: 3, share: 1 });
    expect(r.spendByCategory[0].subs).toEqual([{ name: 'Eating out', totalMinor: 2000, count: 2 }]);
  });

  it('builds a day series for a month, months for a year, years for all time', () => {
    const t = [tx({ date: '2026-09-03', amountMinor: 500 }), tx({ date: '2025-04-03', amountMinor: 700 })];
    const m = computeReport(base(t, sep));
    expect(m.series.kind).toBe('days');
    expect(m.series.points).toHaveLength(30);
    expect(m.series.points[2].spentMinor).toBe(500);
    const y = computeReport(base(t, { kind: 'year', year: 2025 }));
    expect(y.series.points).toHaveLength(12);
    expect(y.series.points[3].spentMinor).toBe(700);
    const all = computeReport(base(t, { kind: 'all' }));
    expect(all.series.points.map((p) => p.label)).toEqual(['2025', '2026']);
    expect(all.previous).toBeNull();
    expect(all.months.map((x) => x.label)).toEqual(['Apr 2025', 'Sep 2026']);
  });

  it('lists the biggest expenses and repeated notes', () => {
    const r = computeReport(
      base(
        [
          tx({ amountMinor: 900, note: 'Zomato' }),
          tx({ amountMinor: 300, note: 'zomato' }),
          tx({ amountMinor: 5000, note: 'Rent' }),
        ],
        sep
      )
    );
    expect(r.topExpenses[0].title).toBe('Rent');
    expect(r.frequent).toEqual([{ label: 'Zomato', count: 2, totalMinor: 1200 }]);
  });

  it('describes a transfer by its two accounts and keeps it out of the totals', () => {
    const r = computeReport(
      base([tx({ type: 'transfer', categoryId: null, toAccountId: 'usd', amountMinor: 5000 })], sep)
    );
    expect(r.spentMinor).toBe(0);
    expect(r.transferCount).toBe(1);
    expect(r.entries[0].detail).toBe('Transfer · HDFC → Wise');
  });

  it('is empty and safe with no entries', () => {
    const r = computeReport(base([], sep));
    expect(r).toMatchObject({ spentMinor: 0, incomeMinor: 0, savedShare: null, biggestDay: null });
    expect(r.spendByCategory).toEqual([]);
  });
});

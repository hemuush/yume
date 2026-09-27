/**
 * getCategoryOverview against a real SQLite engine, with made-up figures:
 * subcategories roll up into the parent's total (matching Reports), the
 * split names the parent's own entries "Other …", the monthly run fills
 * empty months with zero, and other currencies and types are left out.
 */
import { createRealDataTestDb } from '@/test-support/realDataTestDb';

const mockTestDb = createRealDataTestDb();
jest.mock('@/db/client', () => ({
  getDb: async () => mockTestDb,
}));
jest.mock('@/lib/notifications', () => ({ notifyOverspend: async () => {}, notifyBudget: async () => {} }));

import { CREATE_TABLES_SQL } from '@/db/schema';
import { createAccount, createCategory, createTransaction } from '@/db/ledger';
import { getCategoryOverview, getPeriodSummary, usualMonthly } from '@/db/reports';

const september = { start: '2026-09-01', end: '2026-09-30' };
let food: string;

beforeAll(async () => {
  await mockTestDb.execAsync(CREATE_TABLES_SQL);
  const bank = (await createAccount({ name: 'Bank', type: 'bank', currency: 'INR', openingBalanceMinor: 0 }))
    .id;
  const usd = (await createAccount({ name: 'Card', type: 'bank', currency: 'USD', openingBalanceMinor: 0 }))
    .id;
  food = (await createCategory({ name: 'Food', kind: 'expense' })).id;
  const bistro = (await createCategory({ name: 'Bistro', kind: 'expense', parentId: food })).id;
  const cafe = (await createCategory({ name: 'Cafe', kind: 'expense', parentId: food })).id;
  const spend = (accountId: string, categoryId: string, amountMinor: number, date: string) =>
    createTransaction({ type: 'expense', accountId, categoryId, amountMinor, date });
  await spend(bank, food, 10000, '2026-09-02');
  await spend(bank, bistro, 30000, '2026-09-10');
  await spend(bank, bistro, 20000, '2026-09-20');
  await spend(bank, cafe, 5000, '2026-09-21');
  await spend(bank, food, 40000, '2026-07-15'); // July; August has nothing
  await spend(usd, food, 99900, '2026-09-05'); // another currency
});

describe('getCategoryOverview', () => {
  it('totals the category with its subcategories, the same as Reports', async () => {
    const overview = await getCategoryOverview(food, 'expense', september);
    expect(overview.totalMinor).toBe(65000);
    expect(overview.count).toBe(4);
    const reports = await getPeriodSummary(september);
    expect(reports.categoryBreakdown.find((c) => c.categoryId === food)?.totalMinor).toBe(65000);
  });

  it('splits it by subcategory, largest first, with the parent’s own entries as "Other"', async () => {
    const { split } = await getCategoryOverview(food, 'expense', september);
    expect(split.map((s) => [s.name, s.totalMinor])).toEqual([
      ['Bistro', 50000],
      ['Other Food', 10000],
      ['Cafe', 5000],
    ]);
  });

  it('runs six months back from the period, with empty months as zero', async () => {
    const { months } = await getCategoryOverview(food, 'expense', september);
    expect(months).toEqual([
      { month: '2026-04', totalMinor: 0 },
      { month: '2026-05', totalMinor: 0 },
      { month: '2026-06', totalMinor: 0 },
      { month: '2026-07', totalMinor: 40000 },
      { month: '2026-08', totalMinor: 0 },
      { month: '2026-09', totalMinor: 65000 },
    ]);
  });
});

describe('usualMonthly', () => {
  it('averages the three months before the last, only when all three had spending', () => {
    const run = (...totals: number[]) => totals.map((totalMinor) => ({ totalMinor }));
    expect(usualMonthly(run(0, 0, 300, 600, 900, 5000))).toBe(600);
    expect(usualMonthly(run(0, 0, 0, 600, 900, 5000))).toBeNull(); // one of the three was empty
    expect(usualMonthly(run(900, 5000))).toBeNull();
  });
});

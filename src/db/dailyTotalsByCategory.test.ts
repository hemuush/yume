/**
 * The Reports heatmap narrowed to one category: its days, with its
 * subcategories' spending counted in, and nothing from other categories.
 * All figures are made up.
 */
import { createRealDataTestDb } from '@/test-support/realDataTestDb';

const mockTestDb = createRealDataTestDb();
jest.mock('@/db/client', () => ({
  getDb: async () => mockTestDb,
}));
jest.mock('@/lib/notifications', () => ({ rebuildNotifications: async () => {} }));

import { CREATE_TABLES_SQL } from '@/db/schema';
import { createAccount, createCategory, createTransaction } from '@/db/ledger';
import { getDailyExpenseTotals } from './reports';

const SEPT = { start: '2026-09-01', end: '2026-09-30' };

describe('getDailyExpenseTotals for one category', () => {
  let bank: string;
  let food: string;
  let eatingOut: string;
  let rent: string;

  beforeAll(async () => {
    await mockTestDb.execAsync(CREATE_TABLES_SQL);
    bank = (await createAccount({ name: 'Bank', type: 'bank', currency: 'INR', openingBalanceMinor: 0 })).id;
    food = (await createCategory({ name: 'Food', kind: 'expense' })).id;
    eatingOut = (await createCategory({ name: 'Eating out', kind: 'expense', parentId: food })).id;
    rent = (await createCategory({ name: 'Rent', kind: 'expense' })).id;
    const spend = (categoryId: string, amountMinor: number, date: string) =>
      createTransaction({ type: 'expense', accountId: bank, categoryId, amountMinor, date });
    await spend(food, 20_000, '2026-09-03');
    await spend(eatingOut, 15_000, '2026-09-03');
    await spend(eatingOut, 9_000, '2026-09-10');
    await spend(rent, 1_800_000, '2026-09-01');
  });

  it('counts every category when none is given', async () => {
    const days = await getDailyExpenseTotals(SEPT);
    expect(days.map((d) => d.date)).toEqual(['2026-09-01', '2026-09-03', '2026-09-10']);
  });

  it("keeps only that category's days, subcategories included", async () => {
    expect(await getDailyExpenseTotals(SEPT, false, food)).toEqual([
      { date: '2026-09-03', totalMinor: 35_000 },
      { date: '2026-09-10', totalMinor: 9_000 },
    ]);
  });

  it('a subcategory on its own is just its own days', async () => {
    expect(await getDailyExpenseTotals(SEPT, false, eatingOut)).toEqual([
      { date: '2026-09-03', totalMinor: 15_000 },
      { date: '2026-09-10', totalMinor: 9_000 },
    ]);
  });
});

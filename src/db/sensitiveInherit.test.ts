/**
 * "Hide savings & investment amounts" covers a subcategory of a hidden category too: "My SIP" under
 * Investments is hidden with it everywhere, without being flagged on its own.
 */
import { createRealDataTestDb } from '@/test-support/realDataTestDb';

const mockTestDb = createRealDataTestDb();
jest.mock('@/db/client', () => ({ getDb: async () => mockTestDb }));
jest.mock('@/lib/notifications', () => ({ rebuildNotifications: async () => {} }));

import { CREATE_TABLES_SQL } from '@/db/schema';
import { createAccount, createCategory, createTransaction, listCategories } from '@/db/ledger';
import { getPeriodSummary, getDailyExpenseTotals } from '@/db/reports';
import { createBudget, listBudgetsForMonth } from '@/db/budgets';
import { setDefaultCurrency } from '@/db/settings';
import { privateSummary } from '@/lib/privateSummary';

const month = { start: '2026-09-01', end: '2026-09-30' };
let invest: string;
let sip: string;

beforeAll(async () => {
  await mockTestDb.execAsync(CREATE_TABLES_SQL);
  await setDefaultCurrency('INR');
  const bank = (await createAccount({ name: 'Bank', type: 'bank', currency: 'INR', openingBalanceMinor: 0 }))
    .id;
  const food = (await createCategory({ name: 'Food', kind: 'expense' })).id;
  invest = (await createCategory({ name: 'Investments', kind: 'expense', isSensitive: true })).id;
  sip = (await createCategory({ name: 'My SIP', kind: 'expense', parentId: invest })).id;
  const spend = (categoryId: string, amountMinor: number) =>
    createTransaction({ type: 'expense', accountId: bank, categoryId, amountMinor, date: '2026-09-10' });
  await spend(food, 200000);
  await spend(sip, 1000000);
  await createBudget({ categoryId: sip, limitAmountMinor: 1500000, rollover: false, periodMonth: '2026-09' });
});

describe('a subcategory of a hidden category', () => {
  it('is hidden in the category list, while its own flag stays its own', async () => {
    const mine = (await listCategories()).find((c) => c.id === sip)!;
    expect(mine.isSensitive).toBe(true);
    expect(mine.ownIsSensitive).toBe(false);
  });

  it('leaves the month totals and breakdown with its parent while hiding is on', async () => {
    const summary = await getPeriodSummary(month);
    expect(summary.categoryBreakdown.find((c) => c.categoryId === invest)?.isSensitive).toBe(true);
    const hidden = privateSummary(summary, true);
    expect(hidden.expenseMinor).toBe(200000);
    expect(hidden.categoryBreakdown.map((c) => c.name)).toEqual(['Food']);
  });

  it('leaves daily spending and budgets while hiding is on', async () => {
    expect((await getDailyExpenseTotals(month, true))[0].totalMinor).toBe(200000);
    expect(await listBudgetsForMonth('2026-09', true)).toEqual([]);
    expect(await listBudgetsForMonth('2026-09', false)).toHaveLength(1);
  });
});

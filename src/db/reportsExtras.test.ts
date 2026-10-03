/**
 * Reports: the period's biggest single expenses and the by-account breakdown.
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
import { getAccountBreakdown, getLargestExpenses } from './reports';

const SEPT = { start: '2026-09-01', end: '2026-09-30' };

describe('Reports extras', () => {
  let bank: string;
  let card: string;
  let usd: string;
  let food: string;
  let eatingOut: string;
  let rent: string;
  let invest: string;
  let salary: string;

  beforeAll(async () => {
    await mockTestDb.execAsync(CREATE_TABLES_SQL);
    bank = (await createAccount({ name: 'Bank', type: 'bank', currency: 'INR', openingBalanceMinor: 0 })).id;
    card = (
      await createAccount({ name: 'Card', type: 'credit_card', currency: 'INR', openingBalanceMinor: 0 })
    ).id;
    usd = (await createAccount({ name: 'Travel', type: 'bank', currency: 'USD', openingBalanceMinor: 0 })).id;
    food = (await createCategory({ name: 'Food', kind: 'expense' })).id;
    eatingOut = (await createCategory({ name: 'Eating out', kind: 'expense', parentId: food })).id;
    rent = (await createCategory({ name: 'Rent', kind: 'expense' })).id;
    invest = (await createCategory({ name: 'Investing', kind: 'expense', isSensitive: true })).id;
    salary = (await createCategory({ name: 'Salary', kind: 'income' })).id;

    const spend = (accountId: string, categoryId: string, amountMinor: number, date: string) =>
      createTransaction({ type: 'expense', accountId, categoryId, amountMinor, date });
    await spend(bank, rent, 1_800_000, '2026-09-01');
    await spend(bank, food, 20_000, '2026-09-03');
    await spend(card, eatingOut, 15_000, '2026-09-03');
    await spend(card, eatingOut, 9_000, '2026-09-10');
    await spend(bank, invest, 500_000, '2026-09-05');
    await spend(usd, food, 99_999_999, '2026-09-06');
    await createTransaction({
      type: 'income',
      accountId: bank,
      categoryId: salary,
      amountMinor: 5_000_000,
      date: '2026-09-02',
    });
    await createTransaction({
      type: 'income',
      accountId: card,
      categoryId: food,
      amountMinor: 4_000,
      date: '2026-09-11',
      isRefund: true,
    });
  });

  describe('getLargestExpenses', () => {
    it('lists single entries largest first and ignores other currencies', async () => {
      const top = await getLargestExpenses(SEPT, 3);
      expect(top.map((t) => t.amountMinor)).toEqual([1_800_000, 500_000, 20_000]);
    });

    it('leaves savings & investment entries out when asked to', async () => {
      const top = await getLargestExpenses(SEPT, 5, true);
      expect(top.map((t) => t.amountMinor)).toEqual([1_800_000, 20_000, 15_000, 9_000]);
    });

    it("narrows to a category and its subcategories' entries", async () => {
      const top = await getLargestExpenses(SEPT, 5, false, food);
      expect(top.map((t) => t.amountMinor)).toEqual([20_000, 15_000, 9_000]);
    });

    it('stays inside the range', async () => {
      const top = await getLargestExpenses({ start: '2026-09-04', end: '2026-09-30' }, 5);
      expect(top.map((t) => t.date)).not.toContain('2026-09-01');
    });
  });

  describe('getAccountBreakdown', () => {
    it('totals spending by account, largest first, refunds taken off', async () => {
      const rows = await getAccountBreakdown(SEPT, 'expense');
      expect(rows.map((r) => [r.name, r.totalMinor])).toEqual([
        ['Bank', 2_320_000],
        ['Card', 20_000],
      ]);
    });

    it('names each account’s biggest categories, subcategories rolled into the parent', async () => {
      const rows = await getAccountBreakdown(SEPT, 'expense');
      const bankRow = rows.find((r) => r.accountId === bank)!;
      expect(bankRow.topCategories.map((c) => c.name)).toEqual(['Rent', 'Investing', 'Food']);
      const cardRow = rows.find((r) => r.accountId === card)!;
      expect(cardRow.topCategories.map((c) => [c.name, c.totalMinor])).toEqual([['Food', 20_000]]);
    });

    it('drops savings & investment spending when asked to', async () => {
      const rows = await getAccountBreakdown(SEPT, 'expense', true);
      expect(rows.find((r) => r.accountId === bank)!.totalMinor).toBe(1_820_000);
    });

    it('shows where income landed', async () => {
      const rows = await getAccountBreakdown(SEPT, 'income');
      expect(rows.map((r) => [r.name, r.totalMinor])).toEqual([['Bank', 5_000_000]]);
    });

    it('is empty for a quiet month', async () => {
      expect(await getAccountBreakdown({ start: '2026-01-01', end: '2026-01-31' })).toEqual([]);
    });
  });
});

/**
 * getSurplusTrend groups the same income/expense/savings-contribution
 * figures getPeriodSummary computes for one range, by calendar month
 * instead — the one thing worth pinning down is that a month with a real
 * savings transfer nets out exactly like getPeriodSummary's own `netMinor`
 * would for that same range, not just income minus expense.
 */
import { createRealDataTestDb } from '@/test-support/realDataTestDb';

const mockTestDb = createRealDataTestDb();
jest.mock('@/db/client', () => ({
  getDb: async () => mockTestDb,
}));

import { CREATE_TABLES_SQL } from '@/db/schema';
import { createAccount, createCategory, createTransaction } from '@/db/ledger';
import { setDefaultCurrency } from '@/db/settings';
import { getSurplusTrend } from '@/db/reports';

describe('getSurplusTrend', () => {
  let bankId: string;
  let savingsId: string;
  let incomeCat: string;
  let expenseCat: string;

  beforeAll(async () => {
    await mockTestDb.execAsync(CREATE_TABLES_SQL);
    await setDefaultCurrency('INR');
    bankId = (
      await createAccount({ name: 'SurplusBank', type: 'bank', currency: 'INR', openingBalanceMinor: 0 })
    ).id;
    savingsId = (
      await createAccount({
        name: 'SurplusSavings',
        type: 'savings',
        currency: 'INR',
        openingBalanceMinor: 0,
      })
    ).id;
    incomeCat = (await createCategory({ name: 'SurplusIncome', kind: 'income' })).id;
    expenseCat = (await createCategory({ name: 'SurplusExpense', kind: 'expense' })).id;
  });

  it('a month with income, expense and a savings transfer nets to income − expense − savings contribution, not just income − expense', async () => {
    await createTransaction({
      type: 'income',
      accountId: bankId,
      categoryId: incomeCat,
      amountMinor: 100000,
      date: '2030-06-05',
    });
    await createTransaction({
      type: 'expense',
      accountId: bankId,
      categoryId: expenseCat,
      amountMinor: 40000,
      date: '2030-06-10',
    });
    // Money moved into savings this period is no longer free surplus — it's
    // already been acted on. Without subtracting it, June would read as
    // ₹60,000 kept instead of the true ₹35,000 still sitting unallocated.
    await createTransaction({
      type: 'transfer',
      accountId: bankId,
      toAccountId: savingsId,
      amountMinor: 25000,
      date: '2030-06-15',
    });

    const points = await getSurplusTrend(3, new Date(2030, 5, 30)); // Apr, May, Jun 2030
    expect(points.map((p) => p.surplusMinor)).toEqual([0, 0, 35000]);
  });
});

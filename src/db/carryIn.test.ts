/**
 * What rolls over from earlier months into the one on screen — checked against
 * a real SQLite engine, and against each month's own free-to-use figure so the
 * running total can never drift from what each month shows.
 */
import { createRealDataTestDb } from '@/test-support/realDataTestDb';

const mockTestDb = createRealDataTestDb();
jest.mock('@/db/client', () => ({
  getDb: async () => mockTestDb,
}));

import { CREATE_TABLES_SQL } from '@/db/schema';
import { createAccount, createCategory, createTransaction } from '@/db/ledger';
import { getCarryInMinor, getPeriodSummary } from '@/db/reports';
import { setDefaultCurrency } from '@/db/settings';

describe('getCarryInMinor', () => {
  let bank: string;
  let savings: string;
  let usd: string;
  let salary: string;
  let food: string;
  let invest: string;

  beforeAll(async () => {
    await mockTestDb.execAsync(CREATE_TABLES_SQL);
    await setDefaultCurrency('INR');
    bank = (await createAccount({ name: 'Bank', type: 'bank', currency: 'INR', openingBalanceMinor: 0 })).id;
    savings = (await createAccount({ name: 'Pot', type: 'savings', currency: 'INR', openingBalanceMinor: 0 }))
      .id;
    usd = (await createAccount({ name: 'Dollar', type: 'bank', currency: 'USD', openingBalanceMinor: 0 })).id;
    salary = (await createCategory({ name: 'Salary', kind: 'income' })).id;
    food = (await createCategory({ name: 'Food', kind: 'expense' })).id;
    invest = (await createCategory({ name: 'Stocks', kind: 'expense', isSensitive: true })).id;

    const tx = createTransaction;
    await tx({
      type: 'income',
      accountId: bank,
      categoryId: salary,
      amountMinor: 100000,
      date: '2026-08-01',
    });
    await tx({ type: 'expense', accountId: bank, categoryId: food, amountMinor: 40000, date: '2026-08-10' });
    await tx({ type: 'income', accountId: bank, categoryId: salary, amountMinor: 50000, date: '2026-09-01' });
    await tx({ type: 'expense', accountId: bank, categoryId: food, amountMinor: 10000, date: '2026-09-12' });
    await tx({ type: 'expense', accountId: bank, categoryId: invest, amountMinor: 7000, date: '2026-09-15' });
    await tx({
      type: 'transfer',
      accountId: bank,
      toAccountId: savings,
      amountMinor: 5000,
      date: '2026-09-20',
    });
    // Another currency never counts toward the default currency's running total.
    await tx({ type: 'income', accountId: usd, categoryId: salary, amountMinor: 999999, date: '2026-08-02' });
  });

  it('is zero before anything was recorded', async () => {
    expect(await getCarryInMinor('2026-08-01')).toBe(0);
  });

  it("carries a month's leftover into the next", async () => {
    // August: 1,000 in, 400 out.
    expect(await getCarryInMinor('2026-09-01')).toBe(60000);
  });

  it('keeps adding up month after month, savings moved out of the pool', async () => {
    // + September: 500 in, 100 + 70 out, 50 set aside.
    expect(await getCarryInMinor('2026-10-01')).toBe(60000 + 50000 - 10000 - 7000 - 5000);
  });

  it("matches each month's own free-to-use figure plus what came before it", async () => {
    const aug = await getPeriodSummary({ start: '2026-08-01', end: '2026-08-31' });
    const sep = await getPeriodSummary({ start: '2026-09-01', end: '2026-09-30' });
    expect(await getCarryInMinor('2026-09-01')).toBe(aug.netMinor);
    expect(await getCarryInMinor('2026-10-01')).toBe(aug.netMinor + sep.netMinor);
  });

  it('leaves the savings and investment categories out when asked', async () => {
    expect(await getCarryInMinor('2026-10-01', true)).toBe(60000 + 50000 - 10000 - 5000);
  });

  it('carries a shortfall forward as a negative', async () => {
    await createTransaction({
      type: 'expense',
      accountId: bank,
      categoryId: food,
      amountMinor: 500000,
      date: '2026-10-05',
    });
    expect(await getCarryInMinor('2026-11-01')).toBeLessThan(0);
  });

  it('counts a refund as money back on spending, not as income', async () => {
    const before = await getCarryInMinor('2026-12-01');
    await createTransaction({
      type: 'income',
      accountId: bank,
      categoryId: food,
      amountMinor: 2500,
      date: '2026-11-03',
      isRefund: true,
    });
    expect(await getCarryInMinor('2026-12-01')).toBe(before + 2500);
  });
});

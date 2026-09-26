/**
 * The data behind Add Transaction's speed-ups, against a real SQLite engine:
 * the "Recent" category row, the remembered per-type defaults, and the
 * transaction count Home's backup reminder waits on.
 */
import { createRealDataTestDb } from '@/test-support/realDataTestDb';

const mockTestDb = createRealDataTestDb();
jest.mock('@/db/client', () => ({
  getDb: async () => mockTestDb,
}));
jest.mock('@/lib/notifications', () => ({ notifyOverspend: async () => {} }));

import { CREATE_TABLES_SQL } from '@/db/schema';
import {
  createAccount,
  createCategory,
  createTransaction,
  archiveCategory,
  getRecentCategoryIds,
  countTransactions,
  getRepeatEntries,
} from '@/db/ledger';
import { createRecurringRule } from '@/db/recurring';
import { getAddDefaults, setAddDefaults, setDefaultCurrency } from '@/db/settings';

describe('Add Transaction helpers', () => {
  let bank: string;
  const cat: Record<string, string> = {};

  beforeAll(async () => {
    await mockTestDb.execAsync(CREATE_TABLES_SQL);
    await setDefaultCurrency('INR');
    bank = (await createAccount({ name: 'Bank', type: 'bank', currency: 'INR', openingBalanceMinor: 0 })).id;
    for (const name of ['Transport', 'Food', 'Groceries', 'Old Hobby', 'Rent']) {
      cat[name] = (await createCategory({ name, kind: 'expense' })).id;
    }
    cat['Loan EMI'] = (await createCategory({ name: 'Loan EMI', kind: 'expense' })).id;
    await mockTestDb.runAsync('UPDATE categories SET is_system = 1 WHERE id = ?', [cat['Loan EMI']]);
    cat['Salary'] = (await createCategory({ name: 'Salary', kind: 'income' })).id;

    const log = async (name: string, date: string, type: 'expense' | 'income' = 'expense') =>
      createTransaction({ type, accountId: bank, categoryId: cat[name], amountMinor: 1000, date });
    // Transport ×3, Food ×2 (one more recent than Groceries' single), Groceries ×1.
    await log('Transport', '2026-09-01');
    await log('Transport', '2026-09-10');
    await log('Transport', '2026-09-20');
    await log('Food', '2026-09-05');
    await log('Food', '2026-09-22');
    await log('Groceries', '2026-09-21');
    await log('Rent', '2026-01-01'); // outside the 90-day window
    await log('Loan EMI', '2026-09-05'); // system category
    await log('Loan EMI', '2026-09-15');
    await log('Loan EMI', '2026-09-25');
    await log('Loan EMI', '2026-09-24');
    await log('Old Hobby', '2026-09-23');
    await archiveCategory(cat['Old Hobby']);
    await log('Salary', '2026-09-01', 'income');
  });

  it('ranks recent expense categories by how often they are used, then how recently', async () => {
    const ids = await getRecentCategoryIds('expense', 5, '2026-09-25');
    expect(ids).toEqual([cat['Transport'], cat['Food'], cat['Groceries']]);
  });

  it('leaves out system, archived, out-of-window and other-kind categories', async () => {
    const ids = await getRecentCategoryIds('expense', 10, '2026-09-25');
    expect(ids).not.toContain(cat['Loan EMI']);
    expect(ids).not.toContain(cat['Old Hobby']);
    expect(ids).not.toContain(cat['Rent']);
    expect(ids).not.toContain(cat['Salary']);
    expect(await getRecentCategoryIds('income', 5, '2026-09-25')).toEqual([cat['Salary']]);
  });

  it('respects the limit', async () => {
    expect(await getRecentCategoryIds('expense', 2, '2026-09-25')).toEqual([cat['Transport'], cat['Food']]);
  });

  it('counts every transaction', async () => {
    expect(await countTransactions()).toBe(13);
  });

  it('remembers Add defaults per type, and treats anything unreadable as "none"', async () => {
    expect(await getAddDefaults()).toEqual({});
    await setAddDefaults({
      expense: { accountId: bank, categoryId: cat['Food'] },
      transfer: { accountId: bank, toAccountId: null },
    });
    expect(await getAddDefaults()).toEqual({
      expense: { accountId: bank, categoryId: cat['Food'] },
      transfer: { accountId: bank, toAccountId: null },
    });
    for (const bad of ['not json', '[]', 'null', '42']) {
      await mockTestDb.runAsync(`UPDATE settings SET value = ? WHERE key = 'add_defaults'`, [bad]);
      expect(await getAddDefaults()).toEqual({});
    }
  });

  it('offers entries logged at least twice, most repeated first, excluding system, archived and one-offs', async () => {
    const entries = await getRepeatEntries(3, '2026-09-25');
    expect(entries.map((e) => [e.categoryName, e.timesLogged, e.amountMinor])).toEqual([
      ['Transport', 3, 1000],
      ['Food', 2, 1000],
    ]);
    expect(entries[0]).toMatchObject({ type: 'expense', accountId: bank, accountCurrency: 'INR' });
  });

  it('leaves out anything an active recurring rule already posts, so a tap never doubles it', async () => {
    await createRecurringRule({
      type: 'expense',
      accountId: bank,
      categoryId: cat['Food'],
      amountMinor: 1000,
      frequency: 'monthly',
      intervalCount: 1,
      nextRunDate: '2027-01-01',
    });
    const entries = await getRepeatEntries(3, '2026-09-25');
    expect(entries.map((e) => e.categoryName)).toEqual(['Transport']);
  });
});

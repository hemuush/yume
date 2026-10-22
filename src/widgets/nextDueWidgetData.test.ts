/**
 * The Next Due widget prints amounts in the default currency, so a recurring rule on another currency's account
 * must not be picked, as on Home, Plan and Recurring.
 */
import { createRealDataTestDb } from '@/test-support/realDataTestDb';

const mockTestDb = createRealDataTestDb();
jest.mock('@/db/client', () => ({
  getDb: async () => mockTestDb,
}));
jest.mock('@/lib/notifications', () => ({ rebuildNotifications: async () => {} }));

import { CREATE_TABLES_SQL } from '@/db/schema';
import { createAccount, createCategory } from '@/db/ledger';
import { createRecurringRule } from '@/db/recurring';
import { setDefaultCurrency } from '@/db/settings';
import { getNextDueWidgetData } from './data';

it('leaves out a rule on a foreign-currency account and shows the next default-currency rule', async () => {
  await mockTestDb.execAsync(CREATE_TABLES_SQL);
  await setDefaultCurrency('INR');
  const inr = await createAccount({ name: 'Bank', type: 'bank', currency: 'INR', openingBalanceMinor: 0 });
  const usd = await createAccount({ name: 'Travel', type: 'bank', currency: 'USD', openingBalanceMinor: 0 });
  const food = await createCategory({ name: 'Food', kind: 'expense' });
  const rule = (accountId: string, note: string, amountMinor: number, nextRunDate: string) =>
    createRecurringRule({
      type: 'expense',
      accountId,
      categoryId: food.id,
      amountMinor,
      note,
      frequency: 'monthly',
      intervalCount: 1,
      nextRunDate,
    });
  await rule(usd.id, 'Dollar plan', 999, '2099-01-05');
  await rule(inr.id, 'Rupee plan', 50000, '2099-01-20');

  const data = await getNextDueWidgetData();
  expect(data?.title).toBe('Rupee plan');
  expect(data?.amountMinor).toBe(50000);
});

import { createRealDataTestDb } from '@/test-support/realDataTestDb';

const mockTestDb = createRealDataTestDb();
jest.mock('@/db/client', () => ({ getDb: async () => mockTestDb }));
jest.mock('@/lib/notifications', () => ({ rebuildNotifications: async () => {} }));

import { CREATE_TABLES_SQL } from '@/db/schema';
import { createAccount, createCategory, createTransaction } from '@/db/ledger';
import { listEntryMonths } from '@/db/exportSummary';
import { previewFor } from '@/features/export/exportChoice';

beforeAll(async () => {
  await mockTestDb.execAsync(CREATE_TABLES_SQL);
});
beforeEach(async () => {
  await mockTestDb.execAsync('DELETE FROM transactions; DELETE FROM accounts; DELETE FROM categories;');
});

it('preserves a refund-only month when building a multi-month preview', async () => {
  const accountId = (await createAccount({ name: 'Refund bank', type: 'bank', currency: 'EUR' })).id;
  const categoryId = (await createCategory({ name: 'Refunded purchase', kind: 'expense' })).id;
  await createTransaction({ type: 'expense', accountId, categoryId, amountMinor: 10000, date: '2024-01-01' });
  await createTransaction({
    type: 'income',
    isRefund: true,
    accountId,
    categoryId,
    amountMinor: 5000,
    date: '2024-02-01',
  });
  const months = await listEntryMonths('EUR');
  expect(months.find((m) => m.month === '2024-02')?.spentMinor).toBe(-5000);
  expect(previewFor(months, { kind: 'year', year: 2024 }).spentMinor).toBe(5000);
});

it('lists months with entries, newest first, with spending in the default currency only', async () => {
  const inr = (await createAccount({ name: 'Bank', type: 'bank', currency: 'INR', openingBalanceMinor: 0 }))
    .id;
  const usd = (await createAccount({ name: 'Wise', type: 'bank', currency: 'USD', openingBalanceMinor: 0 }))
    .id;
  const food = (await createCategory({ name: 'Food', kind: 'expense' })).id;
  const spend = (accountId: string, amountMinor: number, date: string) =>
    createTransaction({ type: 'expense', accountId, categoryId: food, amountMinor, date });
  await spend(inr, 5000, '2026-09-03');
  await spend(inr, 2500, '2026-09-20');
  await spend(usd, 9999, '2026-09-21');
  await spend(inr, 700, '2026-07-01');
  expect(await listEntryMonths('INR')).toEqual([
    { month: '2026-09', count: 3, spentMinor: 7500 },
    { month: '2026-07', count: 1, spentMinor: 700 },
  ]);
});

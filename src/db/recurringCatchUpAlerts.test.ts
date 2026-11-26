/**
 * Catching up a rule's missed entries checks budgets and spending jumps once, after the last one: per entry, a
 * month away meant a budget read, two month summaries and a full reminder rebuild for every day of it.
 */
import { createRealDataTestDb } from '@/test-support/realDataTestDb';

const mockTestDb = createRealDataTestDb();
jest.mock('@/db/client', () => ({
  getDb: async () => mockTestDb,
}));
jest.mock('@/lib/notifications', () => ({ rebuildNotifications: async () => true }));
const mockQueueSpendAlerts = jest.fn(async (_categoryId: string) => {});
jest.mock('@/db/spendAlerts', () => ({
  queueSpendAlerts: (categoryId: string) => mockQueueSpendAlerts(categoryId),
}));

import { CREATE_TABLES_SQL } from '@/db/schema';
import { createAccount, createCategory, listTransactions } from '@/db/ledger';
import { createRecurringRule, runDueRecurringRules } from '@/db/recurring';

beforeAll(async () => {
  // Only the clock is fixed (to 26 Nov), so "this month" is the same on every machine; the database still runs.
  jest.useFakeTimers({
    now: new Date(2026, 10, 26, 12),
    doNotFake: ['setTimeout', 'setInterval', 'setImmediate', 'queueMicrotask', 'nextTick'],
  });
  await mockTestDb.execAsync(CREATE_TABLES_SQL);
});
afterAll(() => jest.useRealTimers());

it('posts every missed day but checks the alerts once', async () => {
  const accountId = (await createAccount({ name: 'Bank', type: 'bank', currency: 'INR' })).id;
  const categoryId = (await createCategory({ name: 'Metro', kind: 'expense' })).id;
  await createRecurringRule({
    type: 'expense',
    accountId,
    categoryId,
    amountMinor: 5000,
    frequency: 'daily',
    intervalCount: 1,
    nextRunDate: '2026-11-20',
  });
  mockQueueSpendAlerts.mockClear();

  expect(await runDueRecurringRules('2026-11-26')).toBe(7);
  expect(await listTransactions({ fromDate: '2026-11-20', toDate: '2026-11-26' })).toHaveLength(7);
  expect(mockQueueSpendAlerts).toHaveBeenCalledTimes(1);
  expect(mockQueueSpendAlerts).toHaveBeenCalledWith(categoryId);
});

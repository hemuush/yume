/**
 * Subscriptions and bills against a real SQLite engine: what running rules
 * cost a month, Subscriptions entries without a rule, charges seen once a
 * month for three months, and hiding one with ✕. All figures are made up.
 */
import { createRealDataTestDb } from '@/test-support/realDataTestDb';

const mockTestDb = createRealDataTestDb();
jest.mock('@/db/client', () => ({
  getDb: async () => mockTestDb,
}));
jest.mock('@/lib/notifications', () => ({ rebuildNotifications: async () => {} }));

import { CREATE_TABLES_SQL } from '@/db/schema';
import { createAccount, createCategory, createTransaction } from '@/db/ledger';
import { createRecurringRule } from '@/db/recurring';
import {
  subscriptionTotals,
  findUnscheduledSubscriptions,
  findMonthlyPatterns,
  getSubscriptionSuggestions,
} from '@/db/subscriptions';
import { RecurringRule } from '@/types';

const TODAY = '2026-09-26';

const rule = (over: Partial<RecurringRule>): RecurringRule => ({
  id: 'r',
  type: 'expense',
  accountId: 'a',
  toAccountId: null,
  categoryId: 'c',
  amountMinor: 10000,
  note: '',
  paymentMode: null,
  frequency: 'monthly',
  intervalCount: 1,
  nextRunDate: TODAY,
  endDate: null,
  active: true,
  ...over,
});

describe('subscriptionTotals', () => {
  it('adds running expense rules at their monthly share, and the year', () => {
    const totals = subscriptionTotals([
      rule({ amountMinor: 29900 }),
      rule({ amountMinor: 120000, frequency: 'yearly' }), // 10,000 a month
      rule({ amountMinor: 70000, intervalCount: 2 }), // every 2 months: 35,000
      rule({ amountMinor: 50000, active: false }),
      rule({ amountMinor: 9000000, type: 'income' }),
      rule({ amountMinor: 100000, type: 'transfer' }),
    ]);
    expect(totals).toEqual({ monthlyMinor: 74900, yearlyMinor: 898800, count: 3 });
  });

  it('counts a weekly rule about 4.35 times a month', () => {
    expect(subscriptionTotals([rule({ amountMinor: 7000, frequency: 'weekly' })]).monthlyMinor).toBe(
      Math.round((7000 * 30.44) / 7)
    );
  });

  it('is zero with nothing running', () => {
    expect(subscriptionTotals([])).toEqual({ monthlyMinor: 0, yearlyMinor: 0, count: 0 });
  });
});

describe('suggestions', () => {
  let bank: string;
  let streamA: string;
  let streamB: string;
  let wifi: string;
  let power: string;
  let snacks: string;

  const spend = (categoryId: string, amountMinor: number, date: string) =>
    createTransaction({ type: 'expense', accountId: bank, categoryId, amountMinor, date });

  beforeAll(async () => {
    await mockTestDb.execAsync(CREATE_TABLES_SQL);
    bank = (await createAccount({ name: 'Bank', type: 'bank', currency: 'INR', openingBalanceMinor: 0 })).id;
    const subs = (await createCategory({ name: 'Subscriptions', kind: 'expense' })).id;
    streamA = (await createCategory({ name: 'Stream A', kind: 'expense', parentId: subs })).id;
    streamB = (await createCategory({ name: 'Stream B', kind: 'expense', parentId: subs })).id;
    const oldOne = (await createCategory({ name: 'Old app', kind: 'expense', parentId: subs })).id;
    const bills = (await createCategory({ name: 'Bills', kind: 'expense' })).id;
    wifi = (await createCategory({ name: 'Wifi', kind: 'expense', parentId: bills })).id;
    power = (await createCategory({ name: 'Power', kind: 'expense', parentId: bills })).id;
    snacks = (await createCategory({ name: 'Snacks', kind: 'expense' })).id;

    // Subscriptions: Stream A has no rule, Stream B does, Old app is too old.
    await spend(streamA, 199900, '2026-09-09');
    await spend(streamA, 199900, '2026-08-09');
    await spend(streamB, 29900, '2026-09-01');
    await createRecurringRule({
      type: 'expense',
      accountId: bank,
      categoryId: streamB,
      amountMinor: 29900,
      frequency: 'monthly',
      intervalCount: 1,
      nextRunDate: '2026-10-01',
    });
    await spend(oldOne, 50000, '2026-06-01');
    // A one-off on the parent itself, which has subcategories: not a service.
    await spend(subs, 25000, '2026-09-05');

    // Wifi: three months running, amounts within 10%, days within a few.
    await spend(wifi, 64900, '2026-07-01');
    await spend(wifi, 64900, '2026-08-02');
    await spend(wifi, 72000, '2026-09-01');
    // Power: only two months so far.
    await spend(power, 135000, '2026-08-01');
    await spend(power, 135000, '2026-09-01');
    // Snacks: every month, but the amount jumps around.
    await spend(snacks, 10000, '2026-07-05');
    await spend(snacks, 30000, '2026-08-05');
    await spend(snacks, 12000, '2026-09-05');
  });

  it('finds Subscriptions entries with no rule, but not one-offs on the parent', async () => {
    const found = await findUnscheduledSubscriptions(60, TODAY);
    expect(found.map((s) => [s.categoryName, s.amountMinor, s.date, s.source])).toEqual([
      ['Stream A', 199900, '2026-09-09', 'subscriptions'],
    ]);
  });

  it('spots a charge seen once a month for three months, and nothing shorter or uneven', async () => {
    const found = await findMonthlyPatterns(TODAY);
    // Stream A is only two months old; Power is two months; Snacks jumps around.
    expect(found.map((s) => [s.categoryName, s.months, s.amountMinor])).toEqual([['Wifi', 3, 72000]]);
  });

  it('stops spotting a charge once it has a rule', async () => {
    await createRecurringRule({
      type: 'expense',
      accountId: bank,
      categoryId: wifi,
      amountMinor: 72000,
      frequency: 'monthly',
      intervalCount: 1,
      nextRunDate: '2026-10-01',
    });
    expect(await findMonthlyPatterns(TODAY)).toEqual([]);
  });

  it('forgets a monthly charge that stopped two months ago', async () => {
    expect(await findMonthlyPatterns('2026-11-26')).toEqual([]);
  });

  it('leaves out what was hidden with ✕', async () => {
    const all = await getSubscriptionSuggestions([], TODAY);
    expect(all.map((s) => s.categoryName)).toEqual(['Stream A']);
    const key = all[0].key;
    expect(await getSubscriptionSuggestions([key], TODAY)).toEqual([]);
  });
});

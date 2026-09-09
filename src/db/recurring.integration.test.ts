/**
 * Recurring rules against a real SQLite engine — same realDataTestDb
 * harness as transactionSafety.test.ts, isolated to its own file so this
 * describe block gets a fresh in-memory database (recurring.ts's
 * runDueRecurringRules mutates next_run_date/active as a side effect, which
 * would otherwise interact with loan/person tests sharing one DB).
 */
import { createRealDataTestDb } from '@/test-support/realDataTestDb';

const mockTestDb = createRealDataTestDb();
jest.mock('@/db/client', () => ({
  getDb: async () => mockTestDb,
}));
jest.mock('@/lib/notifications', () => ({
  notifyOverspend: async () => {},
}));

import { CREATE_TABLES_SQL } from '@/db/schema';
import { createAccount, createCategory, listTransactions } from '@/db/ledger';
import {
  createRecurringRule,
  listRecurringRules,
  updateRecurringRule,
  setRecurringRuleActive,
  deleteRecurringRule,
  runDueRecurringRules,
} from '@/db/recurring';

describe('recurring rules', () => {
  let accountId: string;
  let expenseCategoryId: string;

  beforeAll(async () => {
    await mockTestDb.execAsync(CREATE_TABLES_SQL);
    const account = await createAccount({
      name: 'Bank',
      type: 'bank',
      currency: 'INR',
      openingBalanceMinor: 100000,
    });
    accountId = account.id;
    expenseCategoryId = (await createCategory({ name: 'Subscriptions', kind: 'expense' })).id;
  });

  it('creates a rule and validates the same way createTransaction does', async () => {
    await expect(
      createRecurringRule({
        type: 'expense',
        accountId,
        amountMinor: 0,
        frequency: 'monthly',
        intervalCount: 1,
        nextRunDate: '2026-01-01',
      })
    ).rejects.toThrow('positive number');

    await expect(
      createRecurringRule({
        type: 'expense',
        accountId,
        categoryId: expenseCategoryId,
        amountMinor: 1000,
        frequency: 'monthly',
        intervalCount: 0,
        nextRunDate: '2026-01-01',
      })
    ).rejects.toThrow('interval');

    const rule = await createRecurringRule({
      type: 'expense',
      accountId,
      categoryId: expenseCategoryId,
      amountMinor: 49900,
      note: 'Netflix',
      frequency: 'monthly',
      intervalCount: 1,
      nextRunDate: '2026-01-01',
    });
    expect(rule.active).toBe(true);
    expect(rule.nextRunDate).toBe('2026-01-01');
  });

  it('runDueRecurringRules creates one transaction per missed occurrence and advances next_run_date past today', async () => {
    const rule = await createRecurringRule({
      type: 'expense',
      accountId,
      categoryId: expenseCategoryId,
      amountMinor: 20000,
      note: 'Catch-up Rent',
      frequency: 'monthly',
      intervalCount: 1,
      nextRunDate: '2026-01-01',
    });

    // Four occurrences (Jan 1, Feb 1, Mar 1, Apr 1) should have run by the
    // time "today" is April 1st — the shared DB also has the "Netflix" rule
    // from the previous test still due, so `created` covers both rather
    // than being asserted on directly here.
    const created = await runDueRecurringRules('2026-04-01');
    expect(created).toBeGreaterThanOrEqual(4);

    const txs = await listTransactions({ limit: 1000 });
    const rentTxs = txs.filter((t) => t.note === 'Catch-up Rent');
    expect(rentTxs).toHaveLength(4);
    expect(rentTxs.map((t) => t.date).sort()).toEqual([
      '2026-01-01',
      '2026-02-01',
      '2026-03-01',
      '2026-04-01',
    ]);

    const [refreshed] = (await listRecurringRules()).filter((r) => r.id === rule.id);
    expect(refreshed.nextRunDate).toBe('2026-05-01');
    expect(refreshed.active).toBe(true);

    // Running again the same day must not create duplicates.
    const createdAgain = await runDueRecurringRules('2026-04-01');
    expect(createdAgain).toBe(0);
  });

  it('deactivates a rule once its occurrences pass the end date', async () => {
    const rule = await createRecurringRule({
      type: 'expense',
      accountId,
      categoryId: expenseCategoryId,
      amountMinor: 5000,
      note: 'Short Trial',
      frequency: 'monthly',
      intervalCount: 1,
      nextRunDate: '2026-06-01',
      endDate: '2026-07-15',
    });
    await runDueRecurringRules('2026-09-01');
    const [refreshed] = (await listRecurringRules()).filter((r) => r.id === rule.id);
    expect(refreshed.active).toBe(false);

    const txs = (await listTransactions({ limit: 1000 })).filter((t) => t.note === 'Short Trial');
    // June 1 and July 1 are on/before the end date; August 1 would be past it.
    expect(txs).toHaveLength(2);
  });

  it('setRecurringRuleActive pauses a rule so runDueRecurringRules skips it', async () => {
    const rule = await createRecurringRule({
      type: 'expense',
      accountId,
      categoryId: expenseCategoryId,
      amountMinor: 3000,
      note: 'Paused Rule',
      frequency: 'weekly',
      intervalCount: 1,
      nextRunDate: '2026-01-01',
    });
    await setRecurringRuleActive(rule.id, false);
    await runDueRecurringRules('2026-12-01');
    const txs = (await listTransactions({ limit: 1000 })).filter((t) => t.note === 'Paused Rule');
    expect(txs).toHaveLength(0);
  });

  it('updateRecurringRule changes the amount/cadence and deleteRecurringRule removes it', async () => {
    const rule = await createRecurringRule({
      type: 'expense',
      accountId,
      categoryId: expenseCategoryId,
      amountMinor: 1000,
      frequency: 'daily',
      intervalCount: 1,
      nextRunDate: '2026-01-01',
    });
    const updated = await updateRecurringRule(rule.id, {
      type: 'expense',
      accountId,
      categoryId: expenseCategoryId,
      amountMinor: 2000,
      frequency: 'weekly',
      intervalCount: 2,
      nextRunDate: '2026-01-01',
    });
    expect(updated.amountMinor).toBe(2000);
    expect(updated.frequency).toBe('weekly');
    expect(updated.intervalCount).toBe(2);

    await deleteRecurringRule(rule.id);
    const remaining = (await listRecurringRules()).filter((r) => r.id === rule.id);
    expect(remaining).toHaveLength(0);
  });

  it('isolates a single rule failure so it does not abort the rest of the batch', async () => {
    // A rule whose category was removed out from under it via raw SQL,
    // bypassing deleteCategory's own in-use checks — the FK's ON DELETE SET
    // NULL leaves the rule with categoryId null, which createTransaction
    // rejects for a non-transfer type. This is the real scenario the fix
    // guards against: one rule failing must not abort the whole batch.
    const doomedCategory = await createCategory({ name: 'Doomed Category', kind: 'expense' });
    const poisoned = await createRecurringRule({
      type: 'expense',
      accountId,
      categoryId: doomedCategory.id,
      amountMinor: 4000,
      note: 'Poisoned Rule',
      frequency: 'monthly',
      intervalCount: 1,
      nextRunDate: '2027-01-01',
    });
    await mockTestDb.runAsync('DELETE FROM categories WHERE id = ?', [doomedCategory.id]);

    const healthy = await createRecurringRule({
      type: 'expense',
      accountId,
      categoryId: expenseCategoryId,
      amountMinor: 6000,
      note: 'Healthy Rule',
      frequency: 'monthly',
      intervalCount: 1,
      nextRunDate: '2027-01-01',
    });

    const created = await runDueRecurringRules('2027-01-01');
    expect(created).toBeGreaterThanOrEqual(1);

    // The healthy rule still ran despite the poisoned one failing first.
    const healthyTxs = (await listTransactions({ limit: 1000 })).filter((t) => t.note === 'Healthy Rule');
    expect(healthyTxs).toHaveLength(1);
    const [refreshedHealthy] = (await listRecurringRules()).filter((r) => r.id === healthy.id);
    expect(refreshedHealthy.active).toBe(true);

    // The poisoned rule was deactivated rather than retried forever.
    const poisonedTxs = (await listTransactions({ limit: 1000 })).filter((t) => t.note === 'Poisoned Rule');
    expect(poisonedTxs).toHaveLength(0);
    const [refreshedPoisoned] = (await listRecurringRules()).filter((r) => r.id === poisoned.id);
    expect(refreshedPoisoned.active).toBe(false);
  });

  it('a transfer rule requires a distinct destination account, matching createTransaction', async () => {
    await expect(
      createRecurringRule({
        type: 'transfer',
        accountId,
        toAccountId: accountId,
        amountMinor: 1000,
        frequency: 'monthly',
        intervalCount: 1,
        nextRunDate: '2026-01-01',
      })
    ).rejects.toThrow('same account');
  });
});

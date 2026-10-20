import { createRealDataTestDb } from '@/test-support/realDataTestDb';
const mockTestDb = createRealDataTestDb();
jest.mock('@/db/client', () => ({ getDb: async () => mockTestDb }));
jest.mock('@/lib/notifications', () => ({ rebuildNotifications: async () => {} }));
import { getStillToPayThisMonth } from './reports';
import { CREATE_TABLES_SQL } from './schema';
import { createAccount, createCategory, listTransactions, createTransaction } from './ledger';
import {
  createRecurringRule,
  listRecurringRules,
  runDueRecurringRules,
  updateRecurringRule,
} from './recurring';
import { changeNextOccurrence } from './recurringOccurrence';
import { createSavingsGoal, contributeToGoal, deleteSavingsGoal } from './savingsGoals';
import { listGoalActivity } from './goalHistory';
import { buildBackupSnapshot, restoreFromSnapshot } from '@/lib/backup';
import { paymentMethodTotals } from './paymentMethods';
import { getMonthlyPlanIncome, setMonthlyPlanIncome } from './monthlyPlan';

let accountId: string;
let categoryId: string;
beforeAll(async () => {
  await mockTestDb.execAsync(CREATE_TABLES_SQL);
  accountId = (
    await createAccount({ name: 'Bank', type: 'bank', currency: 'INR', openingBalanceMinor: 1000000 })
  ).id;
  categoryId = (await createCategory({ name: 'Bills', kind: 'expense' })).id;
});
const ruleInput = () => ({
  type: 'expense' as const,
  accountId,
  categoryId,
  amountMinor: 10000,
  frequency: 'monthly' as const,
  intervalCount: 1,
  nextRunDate: '2026-01-31',
});
it('posts a changed amount once and returns to the original monthly anchor', async () => {
  const rule = await createRecurringRule(ruleInput());
  await changeNextOccurrence(rule.id, rule.nextRunDate, {
    kind: 'change',
    date: '2026-02-02',
    amountMinor: 15000,
  });
  await runDueRecurringRules('2026-02-28');
  const entries = (await listTransactions({ limit: 100 })).filter(
    (t) => t.date === '2026-02-02' || t.date === '2026-02-28'
  );
  expect(entries.map((t) => t.amountMinor).sort((a, b) => a - b)).toEqual([10000, 15000]);
  expect((await listRecurringRules()).find((r) => r.id === rule.id)).toMatchObject({
    nextRunDate: '2026-03-31',
    nextAmountMinor: null,
    scheduledDate: null,
  });
});
it('keeps confirm-first entries out of automatic posting and rejects a repeated confirmation', async () => {
  const rule = await createRecurringRule({ ...ruleInput(), postingMode: 'confirm' });
  const before = (await listTransactions({ limit: 100 })).length;
  await runDueRecurringRules('2026-01-31');
  expect((await listTransactions({ limit: 100 })).length).toBe(before);
  await changeNextOccurrence(rule.id, rule.nextRunDate, {
    kind: 'confirm',
    date: '2026-01-31',
    amountMinor: 9000,
  });
  await expect(
    changeNextOccurrence(rule.id, rule.nextRunDate, {
      kind: 'confirm',
      date: '2026-01-31',
      amountMinor: 9000,
    })
  ).rejects.toThrow('changed');
  expect((await listTransactions({ limit: 100 })).length).toBe(before + 1);
});
it('skips without a ledger entry and preserves one-off changes during a label edit', async () => {
  const rule = await createRecurringRule({ ...ruleInput(), postingMode: 'confirm' });
  await changeNextOccurrence(rule.id, rule.nextRunDate, {
    kind: 'change',
    date: '2026-02-01',
    amountMinor: 12000,
  });
  const edited = await updateRecurringRule(rule.id, {
    ...ruleInput(),
    nextRunDate: '2026-02-01',
    note: 'Edited',
  });
  expect(edited).toMatchObject({
    nextAmountMinor: 12000,
    scheduledDate: '2026-01-31',
    postingMode: 'confirm',
  });
  const before = (await listTransactions({ limit: 100 })).length;
  await changeNextOccurrence(rule.id, edited.nextRunDate, { kind: 'skip' });
  expect((await listTransactions({ limit: 100 })).length).toBe(before);
  expect((await listRecurringRules()).find((r) => r.id === rule.id)?.nextRunDate).toBe('2026-02-28');
});
it('rejects postponement into the next cycle without changing the rule', async () => {
  const rule = await createRecurringRule(ruleInput());
  await expect(
    changeNextOccurrence(rule.id, rule.nextRunDate, {
      kind: 'change',
      date: '2026-03-01',
      amountMinor: 10000,
    })
  ).rejects.toThrow('within this cycle');
  expect((await listRecurringRules()).find((r) => r.id === rule.id)?.nextRunDate).toBe(rule.nextRunDate);
});
it('records manual progress atomically, preserves history at zero and round-trips a backup', async () => {
  const goal = await createSavingsGoal({
    name: 'Trip',
    targetAmountMinor: 100000,
    targetDate: null,
    linkedAccountId: null,
  });
  await contributeToGoal(goal.id, 50000);
  await contributeToGoal(goal.id, -50000);
  await expect(contributeToGoal(goal.id, -1)).rejects.toThrow();
  expect((await listGoalActivity(goal.id)).map((r) => r.balance_after_minor)).toEqual([0, 50000]);
  await expect(deleteSavingsGoal(goal.id)).rejects.toThrow('history');
  const backup = await buildBackupSnapshot();
  expect(backup.formatVersion).toBe(4);
  expect(backup.tables.goal_activity).toHaveLength(2);
  await restoreFromSnapshot(backup);
  expect(await listGoalActivity(goal.id)).toHaveLength(2);
});
it('reports recorded methods and net refunds, and scopes income estimates by currency', async () => {
  await createTransaction({
    type: 'expense',
    accountId,
    categoryId,
    amountMinor: 5000,
    date: '2026-09-01',
    paymentMode: 'upi',
  });
  await createTransaction({
    type: 'income',
    isRefund: true,
    accountId,
    categoryId,
    amountMinor: 1000,
    date: '2026-09-02',
    paymentMode: 'upi',
  });
  const rows = await paymentMethodTotals({ start: '2026-09-01', end: '2026-09-30' }, false);
  expect(rows.find((r) => r.method === 'upi')?.totalMinor).toBe(4000);
  await setMonthlyPlanIncome('INR', 12300);
  expect(await getMonthlyPlanIncome('INR')).toBe(12300);
  expect(await getMonthlyPlanIncome('USD')).toBeNull();
  await expect(setMonthlyPlanIncome('INR', -1)).rejects.toThrow();
  await setMonthlyPlanIncome('INR', null);
  expect(await getMonthlyPlanIncome('INR')).toBeNull();
});

it('paginates journal changes made in the same second without duplicates', async () => {
  const goal = await createSavingsGoal({
    name: 'History',
    targetAmountMinor: 100000,
    targetDate: null,
    linkedAccountId: null,
  });
  for (let i = 0; i < 25; i++) await contributeToGoal(goal.id, 100);
  const first = await listGoalActivity(goal.id);
  const second = await listGoalActivity(goal.id, first.at(-1)!.sequence);
  expect(first).toHaveLength(20);
  expect(second).toHaveLength(5);
  expect(new Set([...first, ...second].map((r) => r.id)).size).toBe(25);
});
it('rejects invalid restored journal rows before changing the ledger', async () => {
  const snapshot = await buildBackupSnapshot();
  const malformed = {
    ...snapshot,
    tables: {
      ...snapshot.tables,
      goal_activity: [{ ...snapshot.tables.goal_activity[0], goal_id: 'missing' }],
    },
  };
  const before = await listTransactions({ limit: 100 });
  await expect(restoreFromSnapshot(malformed)).rejects.toThrow('history');
  expect(await listTransactions({ limit: 100 })).toEqual(before);
});
it('restores old backups with automatic posting and no invented history', async () => {
  const snapshot = await buildBackupSnapshot();
  const legacy = { ...snapshot, formatVersion: 3, tables: { ...snapshot.tables } };
  delete legacy.tables.goal_activity;
  legacy.tables.recurring_rules = legacy.tables.recurring_rules.map((row) => {
    const copy = { ...row };
    delete copy.posting_mode;
    delete copy.next_amount_minor;
    delete copy.scheduled_date;
    return copy;
  });
  await restoreFromSnapshot(legacy);
  expect((await buildBackupSnapshot()).tables.goal_activity).toEqual([]);
  expect((await listRecurringRules()).every((r) => r.postingMode === 'automatic')).toBe(true);
});

it('keeps overdue confirm-first bills inside remaining commitments until recorded', async () => {
  await mockTestDb.runAsync('UPDATE recurring_rules SET active = 0');
  await createRecurringRule({ ...ruleInput(), nextRunDate: '2026-10-01', postingMode: 'confirm' });
  expect(await getStillToPayThisMonth('2026-10-20')).toBe(10000);
});

it('clears a one-off postponement when the regular cadence is changed', async () => {
  const rule = await createRecurringRule({ ...ruleInput(), postingMode: 'confirm' });
  await changeNextOccurrence(rule.id, rule.nextRunDate, {
    kind: 'change',
    date: '2026-02-02',
    amountMinor: 12000,
  });
  const updated = await updateRecurringRule(rule.id, {
    ...ruleInput(),
    frequency: 'daily',
    nextRunDate: '2026-02-02',
  });
  expect(updated).toMatchObject({ scheduledDate: null, nextAmountMinor: null });
  await changeNextOccurrence(updated.id, updated.nextRunDate, { kind: 'skip' });
  expect((await listRecurringRules()).find((r) => r.id === updated.id)?.nextRunDate).toBe('2026-02-03');
});

it('rolls back goal progress if its journal cannot be saved', async () => {
  const goal = await createSavingsGoal({
    name: 'Atomic',
    targetAmountMinor: 100000,
    targetDate: null,
    linkedAccountId: null,
  });
  await mockTestDb.execAsync(
    "CREATE TRIGGER reject_goal_history BEFORE INSERT ON goal_activity BEGIN SELECT RAISE(ABORT, 'journal unavailable'); END;"
  );
  try {
    await expect(contributeToGoal(goal.id, 1000)).rejects.toThrow('journal unavailable');
  } finally {
    await mockTestDb.execAsync('DROP TRIGGER reject_goal_history');
  }
  expect(
    await mockTestDb.getFirstAsync('SELECT current_amount_minor FROM savings_goals WHERE id = ?', [goal.id])
  ).toEqual({ current_amount_minor: 0 });
  expect(await listGoalActivity(goal.id)).toEqual([]);
});
it('excludes an entire private category family and other currencies from method totals', async () => {
  const parent = await createCategory({ name: 'Private family', kind: 'expense' });
  const child = await createCategory({ name: 'Private child', kind: 'expense', parentId: parent.id });
  await mockTestDb.runAsync('UPDATE categories SET is_sensitive = 1 WHERE id = ?', [child.id]);
  await createTransaction({
    type: 'expense',
    accountId,
    categoryId: parent.id,
    amountMinor: 1000,
    date: '2026-11-01',
    paymentMode: 'cash',
  });
  await createTransaction({
    type: 'expense',
    accountId,
    categoryId: child.id,
    amountMinor: 2000,
    date: '2026-11-01',
    paymentMode: 'cash',
  });
  const usd = await createAccount({ name: 'USD', type: 'bank', currency: 'USD', openingBalanceMinor: 10000 });
  await createTransaction({
    type: 'expense',
    accountId: usd.id,
    categoryId,
    amountMinor: 3000,
    date: '2026-11-01',
    paymentMode: 'cash',
  });
  expect(await paymentMethodTotals({ start: '2026-11-01', end: '2026-11-30' }, true)).toEqual([]);
  expect((await paymentMethodTotals({ start: '2026-11-01', end: '2026-11-30' }, false))[0].totalMinor).toBe(
    3000
  );
});

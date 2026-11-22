/**
 * Guards, atomicity fixes and validation added to the data core (src/db). Runs on real SQLite through a
 * serialising wrapper that mimics client.ts's statement queue (one transaction = one queue entry), so
 * overlapping calls interleave the way two quick taps do on a phone.
 */
import { createRealDataTestDb } from '@/test-support/realDataTestDb';

const mockRaw = createRealDataTestDb();
// client.ts runs every statement, and every whole transaction, as one entry of a single queue.
let mockChain: Promise<unknown> = Promise.resolve();
function mockSerialize<T>(fn: () => Promise<T>): Promise<T> {
  const run = mockChain.then(fn, fn);
  mockChain = run.then(
    () => {},
    () => {}
  );
  return run;
}
const mockTestDb = {
  getFirstAsync: <T>(sql: string, p?: any[]) => mockSerialize(() => mockRaw.getFirstAsync<T>(sql, p)),
  getAllAsync: <T>(sql: string, p?: any[]) => mockSerialize(() => mockRaw.getAllAsync<T>(sql, p)),
  runAsync: (sql: string, p?: any[]) => mockSerialize(() => mockRaw.runAsync(sql, p)),
  execAsync: (sql: string) => mockSerialize(() => mockRaw.execAsync(sql)),
  withTransactionAsync: (fn: (tx: typeof mockRaw) => Promise<void>) =>
    mockSerialize(() => mockRaw.withTransactionAsync(fn)),
  exclusiveAsync: <T>(fn: (db: typeof mockRaw) => Promise<T>) => mockSerialize(() => fn(mockRaw)),
};
jest.mock('@/db/client', () => ({ getDb: async () => mockTestDb }));
jest.mock('@/lib/notifications', () => ({ rebuildNotifications: async () => {} }));

import { CREATE_TABLES_SQL } from '@/db/schema';
import {
  createAccount,
  createCategory,
  createTransaction,
  deleteAccount,
  restoreAccount,
  updateAccount,
  deleteCategory,
  restoreCategory,
  updateCategory,
  archiveCategory,
  unarchiveCategory,
} from '@/db/ledger';
import { createLoan, getLoanSchedule, payInstallment, applyRateChange } from '@/db/loans';
import { addValuation } from '@/db/valuations';
import { restoreRow } from '@/db/undoSnapshot';
import { listDeletedEntries, restoreDeletedEntry } from '@/db/recentlyDeleted';
import {
  getBackupFrequency,
  getBudgetNudgesSent,
  getDailySpendingGoal,
  markMilestonesSeen,
  getMilestonesSeen,
  resetSettingsCache,
  setDailySpendingGoal,
  addQueuedAlerts,
  getAlertQueue,
} from '@/db/settings';
import { keepRepeatGroup, keepAsIncome } from '@/db/tidyUp';
import { createBudget } from '@/db/budgets';
import { createSavingsGoal, contributeToGoal } from '@/db/savingsGoals';
import { createRecurringRule } from '@/db/recurring';
import { createPerson, addLedgerEntry } from '@/db/people';
import * as settingsModule from '@/db/settings';
import { queueSpendAlerts } from '@/db/spendAlerts';

const run = (sql: string, params: any[] = []) => mockTestDb.runAsync(sql, params);
const one = <T>(sql: string, params: any[] = []) => mockTestDb.getFirstAsync<T>(sql, params);

let bank: string;
let food: string;
let salary: string;

beforeAll(async () => {
  await mockTestDb.execAsync(CREATE_TABLES_SQL);
  bank = (await createAccount({ name: 'Bank', type: 'bank', currency: 'INR', openingBalanceMinor: 0 })).id;
  food = (await createCategory({ name: 'Food', kind: 'expense' })).id;
  salary = (await createCategory({ name: 'Salary', kind: 'income' })).id;
});

beforeEach(() => {
  resetSettingsCache();
});

describe('a double-tapped loan payment pays once', () => {
  it('two overlapping payInstallment calls leave exactly one EMI entry', async () => {
    const emi = (await createCategory({ name: 'Loan EMI', kind: 'expense' })).id;
    const loan = await createLoan({
      direction: 'borrowed',
      counterparty: 'HDFC',
      principalMinor: 1200000,
      interestRateAnnualBp: 900,
      tenureMonths: 12,
      startDate: '2026-01-01',
    });
    const [first] = await getLoanSchedule(loan.id);
    const results = await Promise.allSettled([
      payInstallment(first.id, { accountId: bank, categoryId: emi, paidDate: '2026-01-01' }),
      payInstallment(first.id, { accountId: bank, categoryId: emi, paidDate: '2026-01-01' }),
    ]);
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    const rejected = results.find((r) => r.status === 'rejected') as PromiseRejectedResult;
    expect(String(rejected.reason.message)).toContain('already been paid');
    const linked = await one<{ n: number }>(
      'SELECT COUNT(*) AS n FROM loan_payments WHERE id = ? AND transaction_id IS NOT NULL',
      [first.id]
    );
    expect(linked?.n).toBe(1);
    const emiEntries = await one<{ n: number }>(
      'SELECT COUNT(*) AS n FROM transactions WHERE category_id = ?',
      [emi]
    );
    expect(emiEntries?.n).toBe(1);
  });
});

describe('paying an EMI', () => {
  it('debits a whole rupee even when the saved schedule carries paise, and the loan balance still follows the schedule', async () => {
    const emi = (await createCategory({ name: 'Home loan EMI', kind: 'expense' })).id;
    const loan = await createLoan({
      direction: 'borrowed',
      counterparty: 'HDFC',
      principalMinor: 1200000,
      interestRateAnnualBp: 900,
      tenureMonths: 12,
      startDate: '2026-01-01',
    });
    const [first] = await getLoanSchedule(loan.id);
    // A loan saved before schedules were built in whole rupees.
    await run('UPDATE loan_payments SET emi_amount_minor = 1819684 WHERE id = ?', [first.id]);
    await payInstallment(first.id, { accountId: bank, categoryId: emi, paidDate: '2026-01-01' });
    const entry = await one<{ amount_minor: number }>(
      'SELECT amount_minor FROM transactions WHERE category_id = ?',
      [emi]
    );
    expect(entry?.amount_minor).toBe(1819700);
    const owed = await one<{ outstanding_principal_minor: number }>(
      'SELECT outstanding_principal_minor FROM loans WHERE id = ?',
      [loan.id]
    );
    expect(owed?.outstanding_principal_minor).toBe(first.outstandingAfterMinor);
  });
});

describe('updateAccount to savings', () => {
  it('refuses an account with spending on it, which a savings account could not hold', async () => {
    const acct = (
      await createAccount({ name: 'Daily', type: 'bank', currency: 'INR', openingBalanceMinor: 0 })
    ).id;
    await createTransaction({
      type: 'expense',
      accountId: acct,
      categoryId: food,
      amountMinor: 5000,
      date: '2026-09-01',
    });
    await expect(
      updateAccount(acct, { name: 'Daily', type: 'savings', openingBalanceMinor: 0 })
    ).rejects.toThrow('only takes transfers');
    // A plain rename keeps working.
    await expect(
      updateAccount(acct, { name: 'Daily spend', type: 'bank', openingBalanceMinor: 0 })
    ).resolves.toMatchObject({
      name: 'Daily spend',
    });
  });
});

describe('deleteAccount', () => {
  it('refuses an account a repeating rule still points at, instead of silently cascading the rule away', async () => {
    const acct = (
      await createAccount({ name: 'Wallet', type: 'cash', currency: 'INR', openingBalanceMinor: 0 })
    ).id;
    await createRecurringRule({
      type: 'expense',
      accountId: acct,
      categoryId: food,
      amountMinor: 5000,
      frequency: 'monthly',
      intervalCount: 1,
      nextRunDate: '2026-12-01',
    });
    await expect(deleteAccount(acct)).rejects.toThrow('repeating');
    expect(
      (await one<{ n: number }>('SELECT COUNT(*) AS n FROM recurring_rules WHERE account_id = ?', [acct]))?.n
    ).toBe(1);
    expect(await one('SELECT id FROM accounts WHERE id = ?', [acct])).not.toBeNull();
  });

  it('still deletes a never-used account and returns its snapshot', async () => {
    const acct = (
      await createAccount({ name: 'Unused', type: 'cash', currency: 'INR', openingBalanceMinor: 0 })
    ).id;
    const snapshot = await deleteAccount(acct);
    expect(snapshot.table).toBe('accounts');
    expect(snapshot.row.id).toBe(acct);
    expect(await one('SELECT id FROM accounts WHERE id = ?', [acct])).toBeNull();
  });

  it('Undo puts back the links a loan and a goal had to the account', async () => {
    const acct = (
      await createAccount({ name: 'Linked', type: 'bank', currency: 'INR', openingBalanceMinor: 0 })
    ).id;
    const loan = await createLoan({
      direction: 'borrowed',
      counterparty: 'Linked Bank',
      principalMinor: 100000,
      interestRateAnnualBp: 900,
      tenureMonths: 6,
      startDate: '2026-01-01',
      linkedAccountId: acct,
    });
    const goal = await createSavingsGoal({
      name: 'Trip',
      targetAmountMinor: 50000,
      targetDate: null,
      linkedAccountId: acct,
    });
    const snapshot = await deleteAccount(acct);
    const linkOf = async (table: string, id: string) =>
      (await one<{ a: string | null }>(`SELECT linked_account_id AS a FROM ${table} WHERE id = ?`, [id]))?.a;
    expect(await linkOf('loans', loan.id)).toBeNull();
    await restoreAccount(snapshot);
    expect(await linkOf('loans', loan.id)).toBe(acct);
    expect(await linkOf('savings_goals', goal.id)).toBe(acct);
  });

  it('Undo puts back the funding link an investment had to the account', async () => {
    const bank = (await createAccount({ name: 'Pays', type: 'bank', currency: 'INR' })).id;
    const inv = (
      await createAccount({
        name: 'Fund',
        type: 'savings',
        currency: 'INR',
        tracked: true,
        fundingAccountId: bank,
      })
    ).id;
    const snapshot = await deleteAccount(bank);
    const fundingOf = async () =>
      (await one<{ f: string | null }>('SELECT funding_account_id AS f FROM accounts WHERE id = ?', [inv]))
        ?.f;
    expect(await fundingOf()).toBeNull();
    await restoreAccount(snapshot);
    expect(await fundingOf()).toBe(bank);
  });
});

describe('unarchiveCategory', () => {
  it('brings a subcategory back with its archived parent, so it is reachable in pickers', async () => {
    const parent = (await createCategory({ name: 'Hobbies', kind: 'expense' })).id;
    const child = (await createCategory({ name: 'Guitar', kind: 'expense', parentId: parent })).id;
    await archiveCategory(parent);
    await unarchiveCategory(child);
    const archivedOf = async (id: string) =>
      (await one<{ archived: number }>('SELECT archived FROM categories WHERE id = ?', [id]))?.archived;
    expect(await archivedOf(child)).toBe(0);
    expect(await archivedOf(parent)).toBe(0);
  });
});

describe('restoreRow only writes to real columns', () => {
  it('rejects a column the table does not have', async () => {
    await expect(
      restoreRow(mockTestDb as any, {
        table: 'budgets',
        row: { id: 'x', 'nope) VALUES (1); DROP TABLE budgets; --': 1 },
      })
    ).rejects.toThrow('can no longer be restored');
  });

  it('rejects a table name that is not a plain identifier', async () => {
    await expect(
      restoreRow(mockTestDb as any, { table: 'budgets; DROP TABLE accounts', row: { id: 'x' } })
    ).rejects.toThrow('can no longer be restored');
    expect(await one('SELECT id FROM accounts LIMIT 1')).not.toBeNull();
  });
});

describe('Recently deleted with a damaged snapshot', () => {
  it('restoring one reports it clearly, and keeps it listed-or-purgeable instead of throwing a parse error', async () => {
    await run("INSERT INTO deleted_entries (id, snapshot, deleted_at) VALUES ('bad1', '{not json', ?)", [
      new Date().toISOString(),
    ]);
    await expect(restoreDeletedEntry('bad1')).rejects.toThrow('damaged');
    expect(await one("SELECT id FROM deleted_entries WHERE id = 'bad1'")).not.toBeNull();
  });

  it('a snapshot that parses to null or a list is skipped by the listing, not crashed on', async () => {
    const now = new Date().toISOString();
    await run("INSERT INTO deleted_entries (id, snapshot, deleted_at) VALUES ('bad2', 'null', ?)", [now]);
    await run("INSERT INTO deleted_entries (id, snapshot, deleted_at) VALUES ('bad3', '[1,2]', ?)", [now]);
    const listed = await listDeletedEntries();
    expect(listed.some((e) => e.id === 'bad2' || e.id === 'bad3')).toBe(false);
  });
});

describe('overlapping saves', () => {
  it('two value updates for the same day leave a single row', async () => {
    const tracked = (
      await createAccount({ name: 'Fund', type: 'savings', currency: 'INR', openingBalanceMinor: 0 })
    ).id;
    await run('UPDATE accounts SET tracked = 1 WHERE id = ?', [tracked]);
    await Promise.all([
      addValuation(tracked, { date: '2026-05-01', valueMinor: 100000 }),
      addValuation(tracked, { date: '2026-05-01', valueMinor: 120000 }),
    ]);
    const n = await one<{ n: number }>('SELECT COUNT(*) AS n FROM account_valuations WHERE account_id = ?', [
      tracked,
    ]);
    expect(n?.n).toBe(1);
  });

  it('two "seen" notes marked at once are both kept', async () => {
    await markMilestonesSeen(['goal:a']);
    resetSettingsCache();
    await Promise.all([markMilestonesSeen(['goal:b']), markMilestonesSeen(['goal:c'])]);
    expect([...(await getMilestonesSeen())].sort()).toEqual(['goal:a', 'goal:b', 'goal:c']);
  });

  it('two queued alerts added at once are both queued', async () => {
    const at = new Date().toISOString();
    const alert = (id: string) => ({ id, queuedAt: at, route: '/budgets', title: id, body: id }) as any;
    await Promise.all([addQueuedAlerts([alert('q1')]), addQueuedAlerts([alert('q2')])]);
    expect((await getAlertQueue()).map((a) => a.id).sort()).toEqual(['q1', 'q2']);
  });

  it("two Tidy up 'keep' taps at once are both remembered", async () => {
    await Promise.all([keepRepeatGroup('k1'), keepRepeatGroup('k2'), keepAsIncome('i1')]);
    const row = await one<{ value: string }>("SELECT value FROM settings WHERE key = 'tidy_kept_repeats'");
    expect(JSON.parse(row!.value).sort()).toEqual(['k1', 'k2']);
    const inc = await one<{ value: string }>(
      "SELECT value FROM settings WHERE key = 'tidy_kept_starting_income'"
    );
    expect(JSON.parse(inc!.value)).toEqual(['i1']);
  });
});

describe('settings reads and writes are validated', () => {
  it('an unknown stored backup frequency reads as daily', async () => {
    await run(
      "INSERT INTO settings (key, value) VALUES ('backup_frequency', 'hourly') ON CONFLICT(key) DO UPDATE SET value = excluded.value"
    );
    expect(await getBackupFrequency()).toBe('daily');
    await run("DELETE FROM settings WHERE key = 'backup_frequency'");
  });

  it('a damaged daily goal reads as off, not NaN', async () => {
    await run(
      "INSERT INTO settings (key, value) VALUES ('daily_spending_goal_minor', 'abc') ON CONFLICT(key) DO UPDATE SET value = excluded.value"
    );
    expect(await getDailySpendingGoal()).toBeNull();
    await run("DELETE FROM settings WHERE key = 'daily_spending_goal_minor'");
  });

  it('a daily goal that is not a whole number is refused', async () => {
    await expect(setDailySpendingGoal(NaN)).rejects.toThrow();
    await expect(setDailySpendingGoal(2 ** 60)).rejects.toThrow();
    await setDailySpendingGoal(50000);
    resetSettingsCache();
    expect(await getDailySpendingGoal()).toBe(50000);
    await setDailySpendingGoal(null);
  });
});

describe('categories', () => {
  it('refuses a blank name and trims a padded one', async () => {
    await expect(createCategory({ name: '   ', kind: 'expense' })).rejects.toThrow('name');
    const padded = await createCategory({ name: '  Travel  ', kind: 'expense' });
    expect(padded.name).toBe('Travel');
    await expect(updateCategory(padded.id, { name: ' ', icon: 'tag', color: '#fff' })).rejects.toThrow(
      'name'
    );
  });

  it('delete and restore round-trip a parent with its subcategory', async () => {
    const parent = await createCategory({ name: 'Pets', kind: 'expense' });
    await createCategory({ name: 'Vet', kind: 'expense', parentId: parent.id });
    const snapshots = await deleteCategory(parent.id);
    expect(snapshots).toHaveLength(2);
    expect(snapshots[0].row.id).toBe(parent.id);
    await restoreCategory(snapshots);
    expect(
      (await one<{ n: number }>('SELECT COUNT(*) AS n FROM categories WHERE name IN (?, ?)', ['Pets', 'Vet']))
        ?.n
    ).toBe(2);
  });
});

describe('amounts must be safe whole numbers', () => {
  const huge = 2 ** 60;

  it('budgets, goals, repeating rules and Friends & Family entries refuse an unsafe amount', async () => {
    await expect(
      createBudget({ categoryId: food, limitAmountMinor: huge, rollover: false })
    ).rejects.toThrow();
    await expect(
      createBudget({ categoryId: food, limitAmountMinor: 1.5, rollover: false })
    ).rejects.toThrow();
    const goal = await createSavingsGoal({ name: 'Trip', targetAmountMinor: 100000 } as any);
    await expect(contributeToGoal(goal.id, huge)).rejects.toThrow();
    await expect(contributeToGoal(goal.id, 10.5)).rejects.toThrow();
    await expect(
      createRecurringRule({
        type: 'expense',
        accountId: bank,
        categoryId: food,
        amountMinor: huge,
        frequency: 'monthly',
        intervalCount: 1,
        nextRunDate: '2026-12-01',
      })
    ).rejects.toThrow();
    const person = await createPerson({ name: 'Sam' } as any);
    await expect(
      addLedgerEntry({ personId: person.id, amountMinor: huge, date: '2026-01-01', note: '' } as any)
    ).rejects.toThrow();
  });
});

describe('spend alerts', () => {
  it('records a budget nudge as sent only once its alert is safely queued', async () => {
    const cat = (await createCategory({ name: 'Eating out', kind: 'expense' })).id;
    await createBudget({ categoryId: cat, limitAmountMinor: 100000, rollover: false });
    await run(
      `INSERT INTO transactions (id, type, account_id, category_id, amount_minor, date)
               VALUES ('nudge-tx', 'expense', ?, ?, 90000, ?)`,
      [bank, cat, new Date().toISOString().slice(0, 10)]
    );
    const spy = jest.spyOn(settingsModule, 'addQueuedAlerts').mockRejectedValueOnce(new Error('disk full'));
    await expect(queueSpendAlerts(cat)).rejects.toThrow('disk full');
    spy.mockRestore();
    expect(await getBudgetNudgesSent()).toEqual([]);
    // The next expense retries, and this time the alert is queued and the nudge recorded.
    await queueSpendAlerts(cat);
    expect((await getAlertQueue()).some((a) => a.id.startsWith('budget:'))).toBe(true);
    expect((await getBudgetNudgesSent()).length).toBeGreaterThan(0);
  });
});

describe('a saved entry is never reported as failed by what runs after it', () => {
  it('createTransaction resolves', async () => {
    const t = await createTransaction({
      type: 'income',
      accountId: bank,
      categoryId: salary,
      amountMinor: 5000,
      date: '2026-06-01',
    });
    expect(t.id).toBeTruthy();
  });
});

describe('loan inputs stay inside what the EMI maths can handle', () => {
  const base = {
    direction: 'borrowed' as const,
    counterparty: 'Test Lender',
    principalMinor: 1200000,
    interestRateAnnualBp: 900,
    tenureMonths: 12,
    startDate: '2026-01-01',
  };

  it('createLoan refuses a rate above 100% a year, a fractional tenure and a tenure past 50 years', async () => {
    await expect(createLoan({ ...base, interestRateAnnualBp: 10001 })).rejects.toThrow(/at most 100%/);
    await expect(createLoan({ ...base, tenureMonths: 12.5 })).rejects.toThrow(/whole number of months/);
    await expect(createLoan({ ...base, tenureMonths: 601 })).rejects.toThrow(/whole number of months/);
  });

  it('createLoan still accepts the edges', async () => {
    const loan = await createLoan({ ...base, interestRateAnnualBp: 10000, tenureMonths: 600 });
    expect((await getLoanSchedule(loan.id)).at(-1)?.outstandingAfterMinor).toBe(0);
  });

  it('applyRateChange refuses a rate above 100% a year', async () => {
    const loan = await createLoan({ ...base, rateType: 'floating' });
    await expect(
      applyRateChange(loan.id, { newAnnualRateBp: 10001, effectiveDate: '2026-03-01' })
    ).rejects.toThrow(/at most 100%/);
  });
});

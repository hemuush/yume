/**
 * A property test on real SQLite: a few hundred random operations (entries, transfers, edits, deletes with and without
 * undo, loans and their EMIs, repeating rules posting their catch-up, budgets), then the same questions every time.
 * Do the books balance? Is the database whole (integrity, foreign keys)? Does a backup restored over the same data
 * come back identical? The sequence for each seed is fixed, so a failure names a seed that reproduces it.
 */
import { createRealDataTestDb, type AsyncDb } from '@/test-support/realDataTestDb';

jest.setTimeout(120000);

let mockDb: AsyncDb;
jest.mock('@/db/client', () => ({ getDb: async () => mockDb }));
jest.mock('@/lib/notifications', () => ({ rebuildNotifications: async () => true }));

import { CREATE_TABLES_SQL } from '@/db/schema';
import {
  createAccount,
  createCategory,
  createTransaction,
  deleteTransaction,
  getAccountBalance,
  listAccounts,
  restoreTransaction,
  updateTransaction,
} from '@/db/ledger';
import { createBudget } from '@/db/budgets';
import { archiveAccount } from '@/db/accounts';
import { archiveCategory, deleteCategory, restoreCategory, unarchiveCategory } from '@/db/categories';
import {
  addLedgerEntry,
  createPerson,
  listPeople,
  recordMoneyGivenToPerson,
  recordMoneyReceivedFromPerson,
  undoPersonTransaction,
} from '@/db/people';
import { closeExpectedRefund, expectRefund, receiveRefund, undoRefundReceipt } from '@/db/refundTracking';
import {
  archiveSavingsGoal,
  contributeToGoal,
  createSavingsGoal,
  deleteSavingsGoal,
  restoreSavingsGoal,
} from '@/db/savingsGoals';
import { deleteSplit, restoreSplit, saveSplit } from '@/db/splits';
import { getAccountBreakdown, getDailyExpenseTotals, getRangeComparison } from '@/db/reports';
import { createLoan, getLoanSchedule, payInstallment, undoInstallmentPayment } from '@/db/loans';
import { createRecurringRule, runDueRecurringRules } from '@/db/recurring';
import { clearReadCache } from '@/db/readCache';
import { resetSettingsCache, setDefaultCurrency } from '@/db/settings';
import { addDaysToIsoDate, addMonthsToIsoDate, toLocalIsoDate } from '@/lib/date';
import { buildBackupSnapshot, restoreFromSnapshot } from '@/lib/backup';
import { normalizeCategoryIcon } from '@/lib/categoryIcon';
import type { RowSnapshot } from '@/db/undoSnapshot';

/** A small deterministic generator (mulberry32): the same seed always gives the same run. */
function random(seed: number) {
  let a = seed >>> 0;
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    next,
    int: (min: number, max: number) => min + Math.floor(next() * (max - min + 1)),
    pick: <T>(items: readonly T[]) => items[Math.floor(next() * items.length)],
  };
}

const today = toLocalIsoDate(new Date());
const daysAgo = (n: number) => addDaysToIsoDate(today, -n);

interface World {
  banks: string[];
  /** Every account, the savings pot included (it takes transfers but is not spent from). */
  all: string[];
  people: string[];
  friendExpense: string;
  friendIncome: string;
  expenseCategories: string[];
  incomeCategories: string[];
  loanEmiCategory: string;
  openingMinor: Map<string, number>;
}

async function seedWorld(): Promise<World> {
  mockDb = createRealDataTestDb();
  await mockDb.execAsync(CREATE_TABLES_SQL);
  resetSettingsCache();
  clearReadCache();
  await setDefaultCurrency('INR');
  const openingMinor = new Map<string, number>();
  const banks: string[] = [];
  for (const [name, type, opening] of [
    ['Bank', 'bank', 2_000_000],
    ['Cash', 'cash', 300_000],
    ['Wallet', 'wallet', 50_000],
  ] as const) {
    const id = (await createAccount({ name, type, currency: 'INR', openingBalanceMinor: opening })).id;
    banks.push(id);
    openingMinor.set(id, opening);
  }
  const expenseCategories: string[] = [];
  // A built-in name, one the picker no longer lists, an emoji and a joined emoji: every shape an icon can have.
  const icons = ['silverware-fork-knife', 'gas-station', '\u2615', '\u{1F468}\u200D\u{1F469}\u200D\u{1F467}'];
  for (const [i, name] of ['Food', 'Rent', 'Transport', 'Fun'].entries()) {
    expenseCategories.push((await createCategory({ name, kind: 'expense', icon: icons[i] })).id);
  }
  const incomeCategories = [(await createCategory({ name: 'Salary', kind: 'income', icon: '\u{1F4B0}' })).id];
  const pot = (
    await createAccount({ name: 'Pot', type: 'savings', currency: 'INR', openingBalanceMinor: 80_000 })
  ).id;
  openingMinor.set(pot, 80_000);
  const people = [(await createPerson({ name: 'Aarav' })).id, (await createPerson({ name: 'Diya' })).id];
  // The built-in categories money to and from friends is filed under (seeded and flagged on a real install).
  const friendExpense = (await createCategory({ name: 'Friends & Family', kind: 'expense' })).id;
  const friendIncome = (await createCategory({ name: 'Friends & Family', kind: 'income' })).id;
  await mockDb.runAsync("UPDATE categories SET is_system = 1 WHERE name = 'Friends & Family'");
  const loanEmiCategory = (await createCategory({ name: 'Loan EMI', kind: 'expense' })).id;
  // As on a real install, where the built-in categories are seeded flagged (a restore flags them by name).
  await mockDb.runAsync("UPDATE categories SET is_system = 1 WHERE name = 'Loan EMI'");
  return {
    banks,
    all: [...banks, pot],
    people,
    friendExpense,
    friendIncome,
    expenseCategories,
    incomeCategories,
    loanEmiCategory,
    openingMinor,
  };
}

interface Tx {
  id: string;
  type: string;
  account_id: string;
  to_account_id: string | null;
  amount_minor: number;
  loan_payment_id: string | null;
  loan_id: string | null;
  split_id: string | null;
}

const rows = () =>
  mockDb.getAllAsync<Tx>(
    'SELECT id, type, account_id, to_account_id, amount_minor, loan_payment_id, loan_id, split_id FROM transactions'
  );

/** Entries that stand alone: not part of a loan, a person's ledger, a refund or a split, which have their own undo. */
async function plainRows() {
  const linked = new Set(
    (
      await mockDb.getAllAsync<{ id: string }>(
        `SELECT transaction_id AS id FROM loan_payments WHERE transaction_id IS NOT NULL
         UNION SELECT transaction_id FROM person_ledger_entries
         UNION SELECT transaction_id FROM refund_receipts
         UNION SELECT transaction_id FROM refund_expectations`
      )
    ).map((r) => r.id)
  );
  return (await rows()).filter((t) => !linked.has(t.id) && !t.loan_payment_id && !t.loan_id && !t.split_id);
}

/** Every account's balance worked out again from the rows, never from the code under test. */
async function expectedBalances(world: World) {
  const balance = new Map(world.openingMinor);
  for (const t of await rows()) {
    if (t.type === 'income') balance.set(t.account_id, (balance.get(t.account_id) ?? 0) + t.amount_minor);
    if (t.type === 'expense') balance.set(t.account_id, (balance.get(t.account_id) ?? 0) - t.amount_minor);
    if (t.type === 'transfer') {
      balance.set(t.account_id, (balance.get(t.account_id) ?? 0) - t.amount_minor);
      if (t.to_account_id) balance.set(t.to_account_id, (balance.get(t.to_account_id) ?? 0) + t.amount_minor);
    }
  }
  return balance;
}

async function expectBooksBalance(world: World, where: string) {
  const expected = await expectedBalances(world);
  const listed = new Map((await listAccounts(true)).map((a) => [a.id, a.currentBalanceMinor]));
  for (const id of world.all) {
    expect({ where, id, listed: listed.get(id) }).toEqual({ where, id, listed: expected.get(id) });
    expect({ where, id, single: await getAccountBalance(id) }).toEqual({
      where,
      id,
      single: expected.get(id),
    });
  }
}

async function expectDatabaseWhole(where: string) {
  const integrity = await mockDb.getAllAsync<{ integrity_check: string }>('PRAGMA integrity_check');
  expect({ where, integrity }).toEqual({ where, integrity: [{ integrity_check: 'ok' }] });
  const broken = await mockDb.getAllAsync('PRAGMA foreign_key_check');
  expect({ where, broken }).toEqual({ where, broken: [] });
}

async function expectPeopleMatchTheirLedgers(where: string) {
  for (const person of await listPeople(true)) {
    const ledger = (await mockDb.getFirstAsync<{ n: number }>(
      'SELECT COALESCE(SUM(amount_minor), 0) AS n FROM person_ledger_entries WHERE person_id = ?',
      [person.id]
    ))!.n;
    expect({ where, person: person.id, balance: person.balanceMinor }).toEqual({
      where,
      person: person.id,
      balance: ledger,
    });
  }
}

async function expectNoRefundOverReceived(where: string) {
  const over = await mockDb.getAllAsync(
    `SELECT e.id, e.expected_amount_minor AS expected, COALESCE(SUM(t.amount_minor), 0) AS received
     FROM refund_expectations e
     LEFT JOIN refund_receipts rr ON rr.expectation_id = e.id
     LEFT JOIN transactions t ON t.id = rr.transaction_id
     GROUP BY e.id HAVING received > expected`
  );
  expect({ where, over }).toEqual({ where, over: [] });
}

/** Everything that must hold after any sequence of operations. */
/** Every category's icon is a built-in name or one emoji, whatever happened to it (edits, undo, restore). */
async function expectIconsAreIcons(where: string) {
  const rows = await mockDb.getAllAsync<{ name: string; icon: string }>('SELECT name, icon FROM categories');
  expect(rows.length).toBeGreaterThan(0);
  for (const row of rows)
    expect({ where, name: row.name, icon: normalizeCategoryIcon(row.icon) }).toEqual({
      where,
      name: row.name,
      icon: row.icon,
    });
}

async function expectEverythingHolds(world: World, where: string) {
  await expectIconsAreIcons(where);
  await expectBooksBalance(world, where);
  await expectPeopleMatchTheirLedgers(where);
  await expectNoRefundOverReceived(where);
  await expectDatabaseWhole(where);
}

/** The backup as the settings-independent tables, so two of them can be compared. */
async function tablesOf() {
  const snapshot = await buildBackupSnapshot();
  return snapshot.tables;
}

async function expectBackupRoundTrips(where: string) {
  const before = await tablesOf();
  await restoreFromSnapshot(await buildBackupSnapshot());
  const after = await tablesOf();
  expect(Object.keys(after).sort()).toEqual(Object.keys(before).sort());
  for (const table of Object.keys(before)) {
    const key = (row: Record<string, unknown>) => String(row.id ?? row.key ?? JSON.stringify(row));
    const sorted = (list: Record<string, unknown>[]) => [...list].sort((a, b) => (key(a) < key(b) ? -1 : 1));
    expect({ where, table, rows: sorted(after[table]) }).toEqual({
      where,
      table,
      rows: sorted(before[table]),
    });
  }
}

async function operate(
  world: World,
  r: ReturnType<typeof random>,
  kept: RowSnapshot[],
  step: number,
  stats: { deleted: number }
) {
  const spendable = world.banks;
  const roll = r.next();
  const date = daysAgo(r.int(0, 70));
  if (roll < 0.3) {
    await createTransaction({
      type: 'expense',
      accountId: r.pick(spendable),
      categoryId: r.pick(world.expenseCategories),
      amountMinor: r.int(1, 4_000) * 100,
      date,
      note: `e${step}`,
    });
  } else if (roll < 0.4) {
    await createTransaction({
      type: 'income',
      accountId: r.pick(spendable),
      categoryId: r.pick(world.incomeCategories),
      amountMinor: r.int(1, 9_000) * 100,
      date,
      note: `i${step}`,
    });
  } else if (roll < 0.5) {
    const from = r.pick(spendable);
    const to = r.pick(spendable.filter((id) => id !== from));
    await createTransaction({
      type: 'transfer',
      accountId: from,
      toAccountId: to,
      amountMinor: r.int(1, 2_000) * 100,
      date,
    });
  } else if (roll < 0.62) {
    const plain = (await plainRows()).filter((t) => t.type === 'expense');
    if (plain.length === 0) return;
    const target = r.pick(plain);
    await updateTransaction(target.id, {
      type: 'expense',
      accountId: r.pick(spendable),
      categoryId: r.pick(world.expenseCategories),
      amountMinor: r.int(1, 4_000) * 100,
      date,
      note: `edited ${step}`,
    });
  } else if (roll < 0.74) {
    const plain = await plainRows();
    if (plain.length === 0) return;
    const gone = await deleteTransaction(r.pick(plain).id);
    stats.deleted++;
    // Half of the deleted entries are taken back at once, as Undo does; the rest wait in Recently deleted.
    if (r.next() < 0.5) await restoreTransaction(gone);
    else kept.push(gone);
  } else if (roll < 0.8) {
    if (kept.length === 0) return;
    await restoreTransaction(kept.splice(r.int(0, kept.length - 1), 1)[0]);
  } else if (roll < 0.86) {
    const account = r.pick(spendable);
    const loan = await createLoan({
      direction: 'borrowed',
      counterparty: `Loan ${step}`,
      principalMinor: r.int(10, 200) * 10_000,
      interestRateAnnualBp: r.int(0, 2_400),
      tenureMonths: r.int(3, 36),
      startDate: daysAgo(r.int(40, 200)),
      alreadyPaidInstallments: r.int(0, 2),
      linkedAccountId: account,
    });
    const schedule = await getLoanSchedule(loan.id);
    const unpaid = schedule.filter((p) => p.status !== 'paid');
    for (const p of unpaid.slice(0, r.int(0, 2))) {
      await payInstallment(p.id, { accountId: account, categoryId: world.loanEmiCategory, paidDate: today });
    }
  } else if (roll < 0.9) {
    const paid = await mockDb.getAllAsync<{ id: string }>(
      "SELECT id FROM loan_payments WHERE status = 'paid' AND id IN (SELECT loan_payment_id FROM transactions WHERE loan_payment_id IS NOT NULL)"
    );
    if (paid.length > 0) await undoInstallmentPayment(r.pick(paid).id);
  } else if (roll < 0.95) {
    await createRecurringRule({
      type: 'expense',
      accountId: r.pick(spendable),
      categoryId: r.pick(world.expenseCategories),
      amountMinor: r.int(1, 500) * 100,
      note: `rule ${step}`,
      frequency: r.pick(['daily', 'weekly', 'monthly'] as const),
      intervalCount: r.int(1, 3),
      nextRunDate: daysAgo(r.int(1, 45)),
    });
    await runDueRecurringRules(today);
  } else {
    await createBudget({
      categoryId: r.pick(world.expenseCategories),
      limitAmountMinor: r.int(10, 100) * 10_000,
      rollover: r.next() < 0.5,
    }).catch(() => undefined); // a second budget for the same category and month is refused, which is right
  }
}

/** What the runs together exercised: the rarer flows must each have run somewhere. */
const seen = {
  transfers: 0,
  byRules: 0,
  loans: 0,
  emisPaid: 0,
  deleted: 0,
  budgets: 0,
  ledgerEntries: 0,
  splitParts: 0,
  refundsExpected: 0,
  refundsReceived: 0,
  goals: 0,
  goalActivity: 0,
};
afterAll(() => {
  for (const [flow, times] of Object.entries(seen))
    expect({ flow, ran: times > 0 }).toEqual({ flow, ran: true });
});

// More seeds on demand, to hunt for a rare failure: FUZZ_SEEDS=200 npx jest src/db/integrityFuzz.test.ts
const SEEDS = Array.from({ length: Number(process.env.FUZZ_SEEDS) || 8 }, (_, i) => i + 1);

/** The less common flows, each with its own undo: people, splits, refunds, goals, categories, accounts. */
async function operateExtra(
  world: World,
  r: ReturnType<typeof random>,
  step: number,
  memory: {
    splits: string[];
    goals: string[];
    goneSplits: Awaited<ReturnType<typeof deleteSplit>>[];
    goneGoals: RowSnapshot[];
  }
) {
  const roll = r.next();
  const date = daysAgo(r.int(0, 60));
  if (roll < 0.16) {
    await recordMoneyGivenToPerson({
      personId: r.pick(world.people),
      accountId: r.pick(world.banks),
      categoryId: world.friendExpense,
      amountMinor: r.int(1, 1_500) * 100,
      date,
    });
  } else if (roll < 0.28) {
    await recordMoneyReceivedFromPerson({
      personId: r.pick(world.people),
      accountId: r.pick(world.banks),
      categoryId: world.friendIncome,
      amountMinor: r.int(1, 1_500) * 100,
      date,
    });
  } else if (roll < 0.34) {
    await addLedgerEntry({
      personId: r.pick(world.people),
      amountMinor: r.pick([-1, 1]) * r.int(1, 800) * 100,
      date,
      note: `adjust ${step}`,
    });
  } else if (roll < 0.4) {
    const linked = await mockDb.getAllAsync<{ transaction_id: string }>(
      'SELECT transaction_id FROM person_ledger_entries WHERE transaction_id IS NOT NULL'
    );
    if (linked.length > 0) await undoPersonTransaction(r.pick(linked).transaction_id);
  } else if (roll < 0.5) {
    memory.splits.push(
      await saveSplit({
        accountId: r.pick(world.banks),
        date,
        note: `split ${step}`,
        parts: [
          { categoryId: world.expenseCategories[0], amountMinor: r.int(1, 900) * 100 },
          { categoryId: world.expenseCategories[1], amountMinor: r.int(1, 900) * 100 },
          ...(r.next() < 0.4
            ? [{ categoryId: world.expenseCategories[2], amountMinor: r.int(1, 900) * 100 }]
            : []),
        ],
      })
    );
  } else if (roll < 0.56) {
    if (memory.splits.length === 0) return;
    const id = memory.splits.splice(r.int(0, memory.splits.length - 1), 1)[0];
    const gone = await deleteSplit(id);
    if (r.next() < 0.5) {
      await restoreSplit(gone);
      memory.splits.push(id);
    }
  } else if (roll < 0.68) {
    const candidates = (await plainRows()).filter((t) => t.type === 'expense');
    if (candidates.length === 0) return;
    const purchase = r.pick(candidates);
    const pending = await mockDb.getFirstAsync(
      'SELECT id FROM refund_expectations WHERE transaction_id = ?',
      [purchase.id]
    );
    if (!pending)
      await expectRefund(
        purchase.id,
        r.int(1, Math.max(1, Math.floor(purchase.amount_minor / 100))) * 100,
        null
      );
  } else if (roll < 0.78) {
    const open = await mockDb.getAllAsync<{ transaction_id: string; expected_amount_minor: number }>(
      'SELECT transaction_id, expected_amount_minor FROM refund_expectations WHERE closed = 0'
    );
    if (open.length === 0) return;
    const target = r.pick(open);
    const received = (await mockDb.getFirstAsync<{ n: number }>(
      `SELECT COALESCE(SUM(t.amount_minor), 0) AS n FROM refund_receipts rr JOIN refund_expectations e ON e.id = rr.expectation_id
         JOIN transactions t ON t.id = rr.transaction_id WHERE e.transaction_id = ?`,
      [target.transaction_id]
    ))!.n;
    const room = target.expected_amount_minor - received;
    if (room >= 100)
      await receiveRefund(target.transaction_id, {
        amountMinor: r.int(1, Math.floor(room / 100)) * 100,
        date: today,
        accountId: r.pick(world.banks),
      });
  } else if (roll < 0.83) {
    const receipts = await mockDb.getAllAsync<{ id: string }>('SELECT id FROM refund_receipts');
    if (receipts.length > 0) await undoRefundReceipt(r.pick(receipts.map((x) => x.id)));
  } else if (roll < 0.86) {
    const open = await mockDb.getAllAsync<{ transaction_id: string }>(
      'SELECT transaction_id FROM refund_expectations WHERE closed = 0'
    );
    if (open.length > 0) await closeExpectedRefund(r.pick(open).transaction_id);
  } else if (roll < 0.91) {
    const goal = await createSavingsGoal({
      name: `Goal ${step}`,
      targetAmountMinor: r.int(10, 500) * 10_000,
      targetDate: null,
      linkedAccountId: null,
    });
    memory.goals.push(goal.id);
  } else if (roll < 0.95) {
    if (memory.goals.length === 0) return;
    await contributeToGoal(r.pick(memory.goals), r.int(1, 500) * 100);
  } else if (roll < 0.97) {
    if (memory.goals.length === 0) return;
    const id = memory.goals.splice(r.int(0, memory.goals.length - 1), 1)[0];
    if (r.next() < 0.5) await archiveSavingsGoal(id);
    else {
      // A goal with money saved toward it is archived, never deleted (the app refuses, to keep its progress).
      const saved = await mockDb.getFirstAsync<{ n: number }>(
        `SELECT (SELECT COUNT(*) FROM goal_activity WHERE goal_id = ?) + (SELECT current_amount_minor FROM savings_goals WHERE id = ?) AS n`,
        [id, id]
      );
      if ((saved?.n ?? 0) > 0) await archiveSavingsGoal(id);
      else memory.goneGoals.push(await deleteSavingsGoal(id));
    }
  } else if (roll < 0.98) {
    if (memory.goneGoals.length > 0) await restoreSavingsGoal(memory.goneGoals.pop()!);
  } else {
    // An unused category goes through every state; an unused account is archived.
    const category = await createCategory({
      name: `Temp ${step}`,
      kind: 'expense',
      icon: step % 2 === 0 ? '\u{1F355}' : 'airplane',
    });
    await archiveCategory(category.id);
    await unarchiveCategory(category.id);
    if (r.next() < 0.5) await restoreCategory(await deleteCategory(category.id));
    else await deleteCategory(category.id);
    const spare = await createAccount({
      name: `Spare ${step}`,
      type: 'cash',
      currency: 'INR',
      openingBalanceMinor: 0,
    });
    await archiveAccount(spare.id);
  }
}

/** One seeded run of the random operations; the checks that follow read what it left. */
async function runWorkload(seed: number, steps: number, world: World, checkpoints = true) {
  const r = random(seed);
  const kept: RowSnapshot[] = [];
  const stats = { deleted: 0 };
  const memory = {
    splits: [] as string[],
    goals: [] as string[],
    goneSplits: [],
    goneGoals: [] as RowSnapshot[],
  };
  for (let step = 1; step <= steps; step++) {
    if (r.next() < 0.3) await operateExtra(world, r, step, memory);
    else await operate(world, r, kept, step, stats);
    if (checkpoints && step % 55 === 0) {
      await expectEverythingHolds(world, `seed ${seed} step ${step}`);
    }
  }
  return stats;
}

describe.each(SEEDS)('random operations, seed %i', (seed) => {
  it('keeps the books balanced and the database whole, and a restored backup is identical', async () => {
    const world = await seedWorld();
    const stats = await runWorkload(seed, 220, world);
    // What the run really did, so a run that quietly skipped most of its operations cannot pass.
    const count = async (sql: string) => (await mockDb.getFirstAsync<{ n: number }>(sql))!.n;
    expect(await count('SELECT COUNT(*) n FROM transactions')).toBeGreaterThan(80);
    seen.transfers += await count("SELECT COUNT(*) n FROM transactions WHERE type = 'transfer'");
    seen.byRules += await count('SELECT COUNT(*) n FROM transactions WHERE rule_id IS NOT NULL');
    seen.loans += await count('SELECT COUNT(*) n FROM loans');
    seen.emisPaid += await count("SELECT COUNT(*) n FROM loan_payments WHERE status = 'paid'");
    seen.deleted += stats.deleted;
    seen.budgets += await count('SELECT COUNT(*) n FROM budgets');
    seen.ledgerEntries += await count('SELECT COUNT(*) n FROM person_ledger_entries');
    seen.splitParts += await count('SELECT COUNT(*) n FROM transactions WHERE split_id IS NOT NULL');
    seen.refundsExpected += await count('SELECT COUNT(*) n FROM refund_expectations');
    seen.refundsReceived += await count('SELECT COUNT(*) n FROM refund_receipts');
    seen.goals += await count('SELECT COUNT(*) n FROM savings_goals');
    seen.goalActivity += await count('SELECT COUNT(*) n FROM goal_activity');
    expect(await count('SELECT COUNT(*) n FROM budgets')).toBeGreaterThan(0);
    await expectEverythingHolds(world, `seed ${seed} end`);
    await expectBackupRoundTrips(`seed ${seed}`);
    // Restoring changes no figure either.
    await expectEverythingHolds(world, `seed ${seed} after restore`);
  });
});

describe('the checks themselves', () => {
  it('notice a database with an entry on an account that does not exist', async () => {
    const world = await seedWorld();
    await createTransaction({
      type: 'expense',
      accountId: world.banks[0],
      categoryId: world.expenseCategories[0],
      amountMinor: 10_000,
      date: today,
    });
    await expectDatabaseWhole('before the damage');
    await mockDb.execAsync('PRAGMA foreign_keys = OFF');
    await mockDb.runAsync('UPDATE transactions SET account_id = ?', ['no-such-account']);
    await expect(expectDatabaseWhole('after the damage')).rejects.toThrow();
  });

  it('notice a balance that does not match the entries', async () => {
    const world = await seedWorld();
    await createTransaction({
      type: 'income',
      accountId: world.banks[0],
      categoryId: world.incomeCategories[0],
      amountMinor: 50_000,
      date: today,
    });
    await expectBooksBalance(world, 'before the change');
    await mockDb.runAsync(
      'UPDATE accounts SET opening_balance_minor = opening_balance_minor + 100 WHERE id = ?',
      [world.banks[0]]
    );
    await expect(expectBooksBalance(world, 'after the change')).rejects.toThrow();
  });
});

/** The first and last day of the month `back` months before this one. */
function monthRange(back: number) {
  const first = addMonthsToIsoDate(`${today.slice(0, 7)}-01`, -back);
  return { start: first, end: addDaysToIsoDate(addMonthsToIsoDate(first, 1), -1) };
}

describe.each(SEEDS.slice(0, Number(process.env.FUZZ_SEEDS) ? undefined : 4))(
  'the reports agree with the entries, seed %i',
  (seed) => {
    it('gives the same spending and income for a month from every report that shows it', async () => {
      const world = await seedWorld();
      await runWorkload(seed, 220, world, false);
      let spendSeen = 0;
      let incomeSeen = 0;
      for (const back of [0, 1, 2]) {
        const range = monthRange(back);
        const direct = (await mockDb.getFirstAsync<{ spend: number; income: number }>(
          `SELECT COALESCE(SUM(CASE WHEN t.type = 'expense' THEN t.amount_minor
                                  WHEN t.type = 'income' AND t.is_refund = 1 THEN -t.amount_minor ELSE 0 END), 0) AS spend,
                COALESCE(SUM(CASE WHEN t.type = 'income' AND t.is_refund = 0 THEN t.amount_minor ELSE 0 END), 0) AS income
         FROM transactions t JOIN accounts a ON a.id = t.account_id
         WHERE a.currency = 'INR' AND t.date >= ? AND t.date <= ?`,
          [range.start, range.end]
        ))!;
        spendSeen += direct.spend;
        incomeSeen += direct.income;
        const sum = (list: { totalMinor: number }[]) =>
          list.reduce((total, item) => total + item.totalMinor, 0);
        // A category's row, an account's row and a day's bar cannot go below zero: when refunds outweigh what was spent in one, it shows
        // nothing (and the period's total, which is exact, still takes the refund off).
        const positiveSum = async (groupBy: string) =>
          (
            await mockDb.getAllAsync<{ net: number }>(
              `SELECT SUM(CASE WHEN t.type = 'expense' THEN t.amount_minor ELSE -t.amount_minor END) AS net
             FROM transactions t JOIN accounts a ON a.id = t.account_id
             WHERE a.currency = 'INR' AND t.date >= ? AND t.date <= ?
               AND (t.type = 'expense' OR (t.type = 'income' AND t.is_refund = 1))
             GROUP BY ${groupBy}`,
              [range.start, range.end]
            )
          ).reduce((total, row) => total + Math.max(0, row.net), 0);
        const comparison = await getRangeComparison(range, monthRange(back + 1), 'month');
        const reported = {
          range,
          spendByComparison: comparison.current.expenseMinor,
          incomeByComparison: comparison.current.incomeMinor,
          spendByCategory: sum(comparison.current.categoryBreakdown),
          incomeByCategory: sum(comparison.current.incomeBreakdown),
          spendByDay: sum(await getDailyExpenseTotals(range)),
          spendByAccount: sum(await getAccountBreakdown(range, 'expense')),
          incomeByAccount: sum(await getAccountBreakdown(range, 'income')),
        };
        expect(reported).toEqual({
          range,
          spendByComparison: direct.spend,
          incomeByComparison: direct.income,
          spendByCategory: await positiveSum('t.category_id'),
          incomeByCategory: direct.income,
          spendByDay: await positiveSum('t.date'),
          spendByAccount: await positiveSum('t.account_id'),
          incomeByAccount: direct.income,
        });
      }
      // The months held real figures, so agreeing is not the same as everything being zero.
      expect(spendSeen).toBeGreaterThan(0);
      expect(incomeSeen).toBeGreaterThan(0);
    });
  }
);

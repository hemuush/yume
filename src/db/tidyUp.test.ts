/**
 * Tidy up on real SQLite: repeat pairs ("Keep both" hides; deleting the newer is undoable), loan/person entries
 * skipped; old balances logged as income move to opening balance (balance kept, income lowered, undoable).
 */
import { createRealDataTestDb } from '@/test-support/realDataTestDb';

const mockTestDb = createRealDataTestDb();
jest.mock('@/db/client', () => ({
  getDb: async () => mockTestDb,
}));
jest.mock('@/lib/notifications', () => ({ rebuildNotifications: async () => {} }));

import { CREATE_TABLES_SQL } from '@/db/schema';
import { createAccount, createCategory, createTransaction, getAccountBalance } from '@/db/ledger';
import { getPeriodSummary } from '@/db/reports';
import {
  getTidyUpReport,
  tidyUpCount,
  keepRepeatGroup,
  keepAsIncome,
  deleteNewestOfGroup,
  undoDeleteNewestOfGroup,
  moveToOpeningBalance,
  undoMoveToOpeningBalance,
} from '@/db/tidyUp';

const run = (sql: string, params: any[] = []) => mockTestDb.runAsync(sql, params);
const september = { start: '2026-09-01', end: '2026-09-30' };

let bank: string;
let savings: string;
let food: string;
let previous: string;

beforeAll(async () => {
  await mockTestDb.execAsync(CREATE_TABLES_SQL);
  bank = (await createAccount({ name: 'Bank', type: 'bank', currency: 'INR', openingBalanceMinor: 0 })).id;
  savings = (
    await createAccount({ name: 'Savings', type: 'savings', currency: 'INR', openingBalanceMinor: 0 })
  ).id;
  food = (await createCategory({ name: 'Food', kind: 'expense' })).id;
  previous = (await createCategory({ name: 'Previous', kind: 'income' })).id;
  const salary = (await createCategory({ name: 'Salary', kind: 'income' })).id;

  const expense = (amountMinor: number, date: string) =>
    createTransaction({ type: 'expense', accountId: bank, categoryId: food, amountMinor, date });
  await expense(5000, '2026-09-23');
  await expense(5000, '2026-09-23'); // a pair
  await expense(4000, '2026-09-21');
  await expense(4000, '2026-09-21'); // another pair
  await expense(4000, '2026-09-22'); // same amount, different day: not a pair
  const move = {
    type: 'transfer' as const,
    accountId: savings,
    toAccountId: bank,
    amountMinor: 200000,
    date: '2026-09-20',
  };
  await createTransaction(move);
  await createTransaction(move); // a transfer pair

  // A pair where one side is a Friends & Family entry's cash: not a plain pair.
  const linked = await expense(7000, '2026-09-10');
  await expense(7000, '2026-09-10');
  await run(`INSERT INTO people (id, name) VALUES ('p1', 'A friend')`);
  await run(
    `INSERT INTO person_ledger_entries (id, person_id, amount_minor, date, transaction_id) VALUES ('e1', 'p1', 7000, '2026-09-10', ?)`,
    [linked.id]
  );

  await createTransaction({
    type: 'income',
    accountId: bank,
    categoryId: previous,
    amountMinor: 1_000_000,
    date: '2026-09-01',
  });
  // The same "old money" category used again in an earlier month: one group, not two items.
  await createTransaction({
    type: 'income',
    accountId: bank,
    categoryId: previous,
    amountMinor: 200_000,
    date: '2026-08-01',
  });
  await createTransaction({
    type: 'income',
    accountId: bank,
    categoryId: salary,
    amountMinor: 8_000_000,
    date: '2026-09-01',
  });
});

describe('tidy up', () => {
  it('finds each kind of thing, and counts them', async () => {
    const report = await getTidyUpReport();
    expect(report.repeats.map((g) => [g.type, g.amountMinor, g.date, g.ids.length])).toEqual([
      ['expense', 5000, '2026-09-23', 2],
      ['expense', 4000, '2026-09-21', 2],
      ['transfer', 200000, '2026-09-20', 2],
    ]);
    expect(report.repeats[2]).toMatchObject({ accountName: 'Savings', toAccountName: 'Bank' });
    expect(
      report.startingBalances.map((g) => [
        g.categoryName,
        g.ids.length,
        g.totalMinor,
        g.firstDate,
        g.lastDate,
      ])
    ).toEqual([['Previous', 2, 1_200_000, '2026-08-01', '2026-09-01']]);
    expect(tidyUpCount(report)).toBe(3 + 1);
  });

  it('forgets a pair you keep', async () => {
    const [first] = (await getTidyUpReport()).repeats;
    await keepRepeatGroup(first.key);
    expect((await getTidyUpReport()).repeats.map((g) => g.key)).not.toContain(first.key);
  });

  it('deletes the newer entry of a pair, and can put it back', async () => {
    const group = (await getTidyUpReport()).repeats.find((g) => g.amountMinor === 4000)!;
    const before = await getAccountBalance(bank);
    const snapshot = await deleteNewestOfGroup(group);
    expect(await getAccountBalance(bank)).toBe(before + 4000);
    expect((await getTidyUpReport()).repeats.some((g) => g.amountMinor === 4000)).toBe(false);

    await undoDeleteNewestOfGroup(snapshot);
    expect(await getAccountBalance(bank)).toBe(before);
  });

  it('moves a group of old balances into the opening balance: same balance, less income — and back', async () => {
    const [group] = (await getTidyUpReport()).startingBalances;
    const august = { start: '2026-08-01', end: '2026-08-31' };
    const balanceBefore = await getAccountBalance(bank);
    const septemberBefore = (await getPeriodSummary(september)).incomeMinor;
    const augustBefore = (await getPeriodSummary(august)).incomeMinor;

    const move = await moveToOpeningBalance(group);
    expect(await getAccountBalance(bank)).toBe(balanceBefore);
    expect((await getPeriodSummary(september)).incomeMinor).toBe(septemberBefore - 1_000_000);
    expect((await getPeriodSummary(august)).incomeMinor).toBe(augustBefore - 200_000);
    expect((await getTidyUpReport()).startingBalances).toEqual([]);

    await undoMoveToOpeningBalance(move);
    expect(await getAccountBalance(bank)).toBe(balanceBefore);
    expect((await getPeriodSummary(september)).incomeMinor).toBe(septemberBefore);
    expect((await getPeriodSummary(august)).incomeMinor).toBe(augustBefore);
  });

  it('leaves an old balance you say is real income', async () => {
    const [group] = (await getTidyUpReport()).startingBalances;
    await keepAsIncome(group.key);
    expect((await getTidyUpReport()).startingBalances).toEqual([]);
  });
});

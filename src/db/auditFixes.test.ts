import { createRealDataTestDb } from '@/test-support/realDataTestDb';
import type { AppDb } from './client';

let mockTestDb = createRealDataTestDb();
let mockBeforeTransaction: (() => Promise<void>) | null = null;
jest.mock('./client', () => ({
  getDb: async () => ({
    ...mockTestDb,
    withTransactionAsync: async (task: (tx: AppDb) => Promise<void>) => {
      if (mockBeforeTransaction) await mockBeforeTransaction();
      return mockTestDb.withTransactionAsync(task);
    },
  }),
}));
jest.mock('@/lib/notifications', () => ({ rebuildNotifications: async () => {} }));

import { CREATE_TABLES_SQL } from './schema';
import {
  createAccount,
  createCategory,
  createTransaction,
  listTransactions,
  listCategories,
  archiveCategory,
  getRepeatEntries,
  getFrequentAmountsForCategory,
} from './ledger';
import { primeCurrencyCache, setDefaultCurrency, getDefaultCurrency } from './settings';
import { createRecurringRule, runDueRecurringRules } from './recurring';
import { createLoan, getLoanSchedule, payInstallment, applyPrepayment, updateLoanAccount } from './loans';
import {
  createPerson,
  recordMoneyGivenToPerson,
  listPeople,
  getPersonLedger,
  addLedgerEntry,
} from './people';
import { createSavingsGoal, listSavingsGoals } from './savingsGoals';

let bank: string;
let foreign: string;
let food: string;
beforeEach(async () => {
  mockBeforeTransaction = null;
  mockTestDb = createRealDataTestDb();
  await mockTestDb.execAsync(CREATE_TABLES_SQL);
  primeCurrencyCache('INR');
  bank = (await createAccount({ name: 'Bank', type: 'bank', currency: 'INR', openingBalanceMinor: 0 })).id;
  foreign = (await createAccount({ name: 'USD', type: 'bank', currency: 'USD', openingBalanceMinor: 0 })).id;
  food = (await createCategory({ name: 'Food', kind: 'expense' })).id;
});

it('retains inherited sensitivity for shortcuts and archived historical categories', async () => {
  const parent = await createCategory({ name: 'Investments', kind: 'expense', isSensitive: true });
  const child = await createCategory({ name: 'Fund', kind: 'expense', parentId: parent.id });
  for (const date of ['2026-01-01', '2026-01-02']) {
    await createTransaction({
      type: 'expense',
      accountId: bank,
      categoryId: child.id,
      amountMinor: 123400,
      date,
    });
  }
  const entries = await getRepeatEntries(3, '2026-01-03');
  expect(entries[0].isSensitive).toBe(true);
  expect(await getFrequentAmountsForCategory(child.id, 4, '2026-01-03', true)).toEqual([]);
  await archiveCategory(parent.id);
  expect((await listCategories(true)).find((c) => c.id === child.id)?.isSensitive).toBe(true);
});

it('currency-scoped history retains only accounts in the requested currency, including archived ones', async () => {
  for (const accountId of [bank, foreign]) {
    await createTransaction({
      type: 'expense',
      accountId,
      categoryId: food,
      amountMinor: accountId === foreign ? 2000 : 1000,
      date: '2026-01-01',
    });
  }
  await mockTestDb.runAsync('UPDATE accounts SET archived = 1 WHERE id = ?', [bank]);
  expect((await listTransactions({ currency: 'INR' })).map((t) => t.accountId)).toEqual([bank]);
  expect(await listTransactions()).toHaveLength(2);
  expect(await getFrequentAmountsForCategory(food, 4, '2026-01-03', false, 'USD')).toEqual([2000]);
});

it.each(['pause', 'delete', 'edit'])(
  'stops a captured recurring rule after a concurrent %s',
  async (action) => {
    const rule = await createRecurringRule({
      type: 'expense',
      accountId: bank,
      categoryId: food,
      amountMinor: 1000,
      frequency: 'daily',
      intervalCount: 1,
      nextRunDate: '2026-01-01',
    });
    mockBeforeTransaction = async () => {
      mockBeforeTransaction = null;
      if (action === 'delete')
        await mockTestDb.runAsync('DELETE FROM recurring_rules WHERE id = ?', [rule.id]);
      else
        await mockTestDb.runAsync(
          action === 'pause'
            ? 'UPDATE recurring_rules SET active = 0 WHERE id = ?'
            : 'UPDATE recurring_rules SET amount_minor = 9000 WHERE id = ?',
          [rule.id]
        );
    };
    expect(await runDueRecurringRules('2026-01-03')).toBe(0);
    expect(await listTransactions()).toEqual([]);
    const current = await mockTestDb.getFirstAsync<{ active: number; amount_minor: number }>(
      'SELECT * FROM recurring_rules WHERE id = ?',
      [rule.id]
    );
    if (action === 'pause') expect(current?.active).toBe(0);
    if (action === 'edit') expect(current?.amount_minor).toBe(9000);
    if (action === 'delete') expect(current).toBeNull();
  }
);

it('stops catch-up after a pause between two occurrences', async () => {
  const rule = await createRecurringRule({
    type: 'expense',
    accountId: bank,
    categoryId: food,
    amountMinor: 1000,
    frequency: 'daily',
    intervalCount: 1,
    nextRunDate: '2026-01-01',
  });
  let attempts = 0;
  mockBeforeTransaction = async () => {
    if (++attempts === 2)
      await mockTestDb.runAsync('UPDATE recurring_rules SET active = 0 WHERE id = ?', [rule.id]);
  };
  expect(await runDueRecurringRules('2026-01-03')).toBe(1);
  expect(await listTransactions()).toHaveLength(1);
  expect(
    (
      await mockTestDb.getFirstAsync<{ active: number }>('SELECT active FROM recurring_rules WHERE id = ?', [
        rule.id,
      ])
    )?.active
  ).toBe(0);
});

it('rejects foreign accounts for goals, IOUs, disbursements, installments and prepayments without partial writes', async () => {
  await expect(
    createSavingsGoal({
      name: 'Goal',
      targetAmountMinor: 10000,
      linkedAccountId: foreign,
      targetDate: null,
      tracksAccount: true,
    })
  ).rejects.toThrow('use INR');
  const person = await createPerson({ name: 'Friend' });
  await expect(
    recordMoneyGivenToPerson({
      personId: person.id,
      accountId: foreign,
      categoryId: food,
      amountMinor: 1000,
      date: '2026-01-01',
    })
  ).rejects.toThrow('use INR');
  const input = {
    direction: 'borrowed' as const,
    counterparty: 'Bank',
    principalMinor: 100000,
    interestRateAnnualBp: 0,
    tenureMonths: 12,
    startDate: '2026-01-01',
  };
  await expect(
    createLoan({ ...input, disbursement: { accountId: foreign, categoryId: food } })
  ).rejects.toThrow('use INR');
  const loan = await createLoan(input);
  const schedule = await getLoanSchedule(loan.id);
  await expect(updateLoanAccount(loan.id, foreign)).rejects.toThrow('use INR');
  await expect(
    payInstallment(schedule[0].id, { accountId: foreign, categoryId: food, paidDate: '2026-01-01' })
  ).rejects.toThrow('use INR');
  await expect(
    applyPrepayment(loan.id, { accountId: foreign, categoryId: food, amountMinor: 1000, date: '2026-01-01' })
  ).rejects.toThrow('use INR');
  expect(await listTransactions()).toEqual([]);
  expect((await listPeople())[0].balanceMinor).toBe(0);
});

it('blocks relabelling existing default-currency goals but permits a currency choice before records exist', async () => {
  await setDefaultCurrency('USD');
  expect(await getDefaultCurrency()).toBe('USD');
  await createSavingsGoal({
    name: 'Goal',
    targetAmountMinor: 10000,
    linkedAccountId: foreign,
    targetDate: null,
    tracksAccount: true,
  });
  await expect(setDefaultCurrency('INR')).rejects.toThrow('cannot change');
  expect(await getDefaultCurrency()).toBe('USD');
});

it('does not compare a legacy foreign account balance with a default-currency goal target', async () => {
  await mockTestDb.runAsync(
    `INSERT INTO savings_goals (id, name, target_amount_minor, current_amount_minor, linked_account_id, track_account) VALUES ('legacy', 'Legacy', 10000, 2500, ?, 1)`,
    [foreign]
  );
  expect((await listSavingsGoals())[0]).toMatchObject({ tracksAccount: false, currentAmountMinor: 2500 });
});

it('preserves a legacy foreign IOU entry in its own currency without adding it to INR totals', async () => {
  const person = await createPerson({ name: 'Legacy friend' });
  const payment = await createTransaction({
    type: 'expense',
    accountId: foreign,
    categoryId: food,
    amountMinor: 1000,
    date: '2026-01-01',
  });
  await expect(
    addLedgerEntry({ personId: person.id, transactionId: payment.id, amountMinor: 1000, date: '2026-01-01' })
  ).rejects.toThrow('use INR');
  await mockTestDb.runAsync(
    `INSERT INTO person_ledger_entries (id, person_id, transaction_id, amount_minor, date) VALUES ('legacy', ?, ?, 1000, '2026-01-01')`,
    [person.id, payment.id]
  );
  expect((await listPeople())[0].balanceMinor).toBe(0);
  expect((await getPersonLedger(person.id))[0]).toMatchObject({ amountMinor: 1000, currency: 'USD' });
});

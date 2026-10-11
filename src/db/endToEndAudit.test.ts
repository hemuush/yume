import { createRealDataTestDb } from '@/test-support/realDataTestDb';
let mockDb = createRealDataTestDb();
jest.mock('./client', () => ({ getDb: async () => mockDb }));
jest.mock('@/lib/notifications', () => ({ rebuildNotifications: async () => {} }));

import { CREATE_TABLES_SQL } from './schema';
import {
  createAccount,
  createCategory,
  createTransaction,
  updateTransaction,
  updateAccount,
  listTransactions,
} from './ledger';
import { createPerson, recordMoneyGivenToPerson, getPersonLedger, addLedgerEntry } from './people';
import { createLoan, getLoanSchedule, payInstallment } from './loans';
import { saveSplit, getSplitParts } from './splits';
import { createRecurringRule, listRecurringRules } from './recurring';
import { createSavingsGoal } from './savingsGoals';
import { addValuation } from './valuations';
import { createBudget } from './budgets';
import { MAX_AMOUNT_MINOR } from '@/lib/amountLimits';
import { buildBackupSnapshot, restoreFromSnapshot, summarizeSnapshot } from '@/lib/backup';

let bank: string;
let food: string;
let salary: string;
beforeEach(async () => {
  mockDb = createRealDataTestDb();
  await mockDb.execAsync(CREATE_TABLES_SQL);
  bank = (await createAccount({ name: 'Bank', type: 'bank' })).id;
  food = (await createCategory({ name: 'Food', kind: 'expense' })).id;
  salary = (await createCategory({ name: 'Salary', kind: 'income' })).id;
});
const expense = (amountMinor = 100) => ({
  type: 'expense' as const,
  accountId: bank,
  categoryId: food,
  amountMinor,
  date: '2026-10-11',
});
const loanInput = () => ({
  direction: 'borrowed' as const,
  counterparty: 'Bank loan',
  principalMinor: 120000,
  interestRateAnnualBp: 0,
  tenureMonths: 12,
  startDate: '2026-01-01',
});
const parts = () => [
  { categoryId: food, amountMinor: 40 },
  { categoryId: food, amountMinor: 60 },
];

it('rejects fractional minor units on create and edit without changing balances', async () => {
  await expect(createTransaction(expense(1.5))).rejects.toThrow('whole number');
  const entry = await createTransaction(expense());
  await expect(updateTransaction(entry.id, expense(1.5))).rejects.toThrow('whole number');
  expect((await listTransactions())[0].amountMinor).toBe(100);
});

it.each([NaN, Infinity, 1.5])('rejects an invalid opening balance (%s)', async (openingBalanceMinor) => {
  await expect(createAccount({ name: 'Bad account', type: 'bank', openingBalanceMinor })).rejects.toThrow(
    'whole number'
  );
});

it('rejects fractional opening balance and credit limit on account edit', async () => {
  await expect(updateAccount(bank, { name: 'Bank', type: 'bank', openingBalanceMinor: 0.5 })).rejects.toThrow(
    'valid number'
  );
  await expect(
    updateAccount(bank, { name: 'Bank', type: 'credit_card', openingBalanceMinor: 0, creditLimitMinor: 1.5 })
  ).rejects.toThrow('non-negative');
});

it('cannot edit or split a friend-linked payment and change one side of its balance', async () => {
  const person = await createPerson({ name: 'Asha' });
  await recordMoneyGivenToPerson({ ...expense(), personId: person.id });
  const [entry] = await getPersonLedger(person.id);
  await expect(updateTransaction(entry.transactionId!, expense(500))).rejects.toThrow('linked');
  await expect(
    saveSplit({ ...expense(), replacesEntryId: entry.transactionId, parts: parts() })
  ).rejects.toThrow('linked');
  expect((await getPersonLedger(person.id))[0].amountMinor).toBe(100);
  expect((await listTransactions())[0].amountMinor).toBe(100);
});

it('cannot edit or split an EMI or a loan disbursement', async () => {
  const loan = await createLoan({ ...loanInput(), disbursement: { accountId: bank, categoryId: salary } });
  const [first] = await getLoanSchedule(loan.id);
  await payInstallment(first.id, { accountId: bank, categoryId: food, paidDate: '2026-01-01' });
  for (const entry of await listTransactions()) {
    await expect(updateTransaction(entry.id, expense(500))).rejects.toThrow('linked');
    await expect(saveSplit({ ...expense(), replacesEntryId: entry.id, parts: parts() })).rejects.toThrow(
      'linked'
    );
  }
  expect(await listTransactions()).toHaveLength(2);
});

it('refuses to edit a single split part through the ordinary transaction writer', async () => {
  const splitId = await saveSplit({ ...expense(), parts: parts() });
  const [part] = await getSplitParts(splitId);
  await expect(updateTransaction(part.id, expense(500))).rejects.toThrow('whole split');
  expect((await getSplitParts(splitId)).reduce((sum, entry) => sum + entry.amountMinor, 0)).toBe(100);
});

it('refuses a split replacement after the original payment was deleted', async () => {
  await expect(saveSplit({ ...expense(), replacesEntryId: 'missing', parts: parts() })).rejects.toThrow(
    'entry'
  );
  await expect(saveSplit({ ...expense(), splitId: 'missing', parts: parts() })).rejects.toThrow(
    'no longer exists'
  );
  expect(await listTransactions()).toHaveLength(0);
});

it('refuses to split an income payment', async () => {
  const entry = await createTransaction({ ...expense(), type: 'income', categoryId: salary });
  await expect(saveSplit({ ...expense(), replacesEntryId: entry.id, parts: parts() })).rejects.toThrow(
    'Only an expense'
  );
  expect((await listTransactions())[0].type).toBe('income');
});

it('requires installments to be paid in order, preserving the loan on rejection', async () => {
  const loan = await createLoan(loanInput());
  const schedule = await getLoanSchedule(loan.id);
  await expect(
    payInstallment(schedule[1].id, { accountId: bank, categoryId: food, paidDate: '2026-02-01' })
  ).rejects.toThrow('earlier installments');
  expect((await getLoanSchedule(loan.id)).every((entry) => entry.status === 'pending')).toBe(true);
  expect(await listTransactions()).toHaveLength(0);
});

it('rejects impossible loan and payment dates, and fractional installment counts', async () => {
  await expect(createLoan({ ...loanInput(), startDate: '2026-02-30' })).rejects.toThrow('valid date');
  await expect(createLoan({ ...loanInput(), alreadyPaidInstallments: 1.5 })).rejects.toThrow('whole number');
  const loan = await createLoan(loanInput());
  const [first] = await getLoanSchedule(loan.id);
  await expect(
    payInstallment(first.id, { accountId: bank, categoryId: food, paidDate: '2026-02-30' })
  ).rejects.toThrow('valid date');
});

it('rejects invalid recurring dates and amounts before creating a doomed rule', async () => {
  const rule = { ...expense(), frequency: 'monthly' as const, intervalCount: 1, nextRunDate: '2026-10-11' };
  await expect(createRecurringRule({ ...rule, nextRunDate: '2026-02-30' })).rejects.toThrow('valid date');
  await expect(createRecurringRule({ ...rule, endDate: '2026-13-11' })).rejects.toThrow('valid date');
  await expect(createRecurringRule({ ...rule, amountMinor: MAX_AMOUNT_MINOR + 100 })).rejects.toThrow(
    'too large'
  );
  expect(await listRecurringRules()).toHaveLength(0);
});

it('rejects impossible IOU dates and blank person names', async () => {
  await expect(createPerson({ name: '   ' })).rejects.toThrow('name');
  const person = await createPerson({ name: 'Asha' });
  await expect(addLedgerEntry({ personId: person.id, amountMinor: 100, date: '2026-02-30' })).rejects.toThrow(
    'valid date'
  );
  await expect(
    recordMoneyGivenToPerson({ ...expense(), personId: person.id, date: '2026-02-30' })
  ).rejects.toThrow('valid date');
  expect(await getPersonLedger(person.id)).toHaveLength(0);
  expect(await listTransactions()).toHaveLength(0);
});

it('rejects invalid goal, valuation, and budget dates', async () => {
  await expect(
    createSavingsGoal({
      name: 'Trip',
      targetAmountMinor: 10000,
      targetDate: '2026-02-30',
      linkedAccountId: null,
    })
  ).rejects.toThrow('valid date');
  const tracked = await createAccount({ name: 'Fund', type: 'savings', tracked: true });
  await expect(addValuation(tracked.id, { date: '2026-02-30', valueMinor: 100 })).rejects.toThrow(
    'valid date'
  );
  await expect(
    createBudget({ categoryId: food, limitAmountMinor: 100, rollover: false, periodMonth: '2026-13' })
  ).rejects.toThrow('valid budget month');
});

it('rejects empty, malformed, and invalid-date backups without changing the current data', async () => {
  await createTransaction(expense());
  const snapshot = await buildBackupSnapshot();
  await expect(restoreFromSnapshot({ ...snapshot, tables: {} })).rejects.toThrow('damaged');
  await expect(restoreFromSnapshot({ ...snapshot, formatVersion: NaN })).rejects.toThrow('damaged');
  const damaged = {
    ...snapshot,
    tables: {
      ...snapshot.tables,
      transactions: snapshot.tables.transactions.map((entry) => ({ ...entry, date: '2026-02-30' })),
    },
  };
  await expect(restoreFromSnapshot(damaged)).rejects.toThrow('valid date');
  expect((await listTransactions())[0].amountMinor).toBe(100);
  expect(summarizeSnapshot({ ...snapshot, tables: { ...snapshot.tables, transactions: [null] } })).toBeNull();
});

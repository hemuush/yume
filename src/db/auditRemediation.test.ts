import { createRealDataTestDb } from '@/test-support/realDataTestDb';
const mockDb = createRealDataTestDb();
jest.mock('@/db/client', () => ({ getDb: async () => mockDb }));
jest.mock('@/lib/notifications', () => ({ rebuildNotifications: async () => {} }));
import { CREATE_TABLES_SQL } from './schema';
import {
  createAccount,
  createCategory,
  createTransaction,
  deleteTransaction,
  updateAccount,
  listTransactions,
} from './ledger';
import { createLoan, getLoanSchedule, payInstallment, listLoans, listPendingLoanPayments } from './loans';
import { computeTrackedBalance } from './reports';
import { createPerson, recordMoneyGivenToPerson, getPersonLedger } from './people';
import { roundLedgerAmountsToWholeRupees } from './maintenance';
import { restoreDeletedEntry, countDeletedEntries } from './recentlyDeleted';
beforeAll(async () => {
  await mockDb.execAsync(CREATE_TABLES_SQL);
});
afterEach(async () => {
  for (const table of [
    'deleted_entries',
    'person_ledger_entries',
    'people',
    'loan_payments',
    'transactions',
    'loans',
    'categories',
    'accounts',
  ])
    await mockDb.runAsync(`DELETE FROM ${table}`);
});
async function setup() {
  const account = await createAccount({ name: 'Bank', type: 'bank', openingBalanceMinor: 10000 });
  const category = await createCategory({ name: 'Expense', kind: 'expense' });
  return { account, category };
}
it('retains the financed asset after final payment closes its loan', async () => {
  const { account, category } = await setup();
  const loan = await createLoan({
    direction: 'borrowed',
    counterparty: 'Mortgage',
    principalMinor: 10000,
    interestRateAnnualBp: 0,
    tenureMonths: 1,
    startDate: '2026-11-01',
    assetValueMinor: 70000000,
    assetLabel: 'Home',
  });
  await payInstallment((await getLoanSchedule(loan.id))[0].id, {
    accountId: account.id,
    categoryId: category.id,
    paidDate: '2026-11-01',
  });
  expect(
    computeTrackedBalance({ accounts: [], loans: await listLoans(), people: [], defaultCurrency: 'INR' })
  ).toBe(70000000);
});
it('preserves linked sub-rupee friend movements through rounding and Undo', async () => {
  const { account, category } = await setup();
  const person = await createPerson({ name: 'Sam' });
  await recordMoneyGivenToPerson({
    personId: person.id,
    accountId: account.id,
    categoryId: category.id,
    amountMinor: 40,
    date: '2026-11-01',
  });
  const outcome = await roundLedgerAmountsToWholeRupees();
  await outcome.undo();
  expect((await listTransactions())[0].amountMinor).toBe(40);
  expect((await getPersonLedger(person.id))[0].amountMinor).toBe(40);
});
it('rejects a restore after bank becomes savings and retains the recovery record', async () => {
  const { account, category } = await setup();
  const tx = await createTransaction({
    type: 'expense',
    accountId: account.id,
    categoryId: category.id,
    amountMinor: 100,
    date: '2026-11-01',
  });
  await deleteTransaction(tx.id);
  await updateAccount(account.id, { name: 'Savings', type: 'savings', openingBalanceMinor: 10000 });
  await expect(restoreDeletedEntry(tx.id)).rejects.toThrow(/savings/);
  expect(await listTransactions()).toHaveLength(0);
  expect(await countDeletedEntries()).toBe(1);
});
it('queries all unpaid EMIs within the horizon including overdue installments', async () => {
  await setup();
  const loan = await createLoan({
    direction: 'borrowed',
    counterparty: 'Mortgage',
    principalMinor: 20000,
    interestRateAnnualBp: 0,
    tenureMonths: 2,
    startDate: '2026-10-01',
  });
  const schedule = await getLoanSchedule(loan.id);
  await mockDb.runAsync("UPDATE loan_payments SET status = 'overdue' WHERE id = ?", [schedule[0].id]);
  expect((await listPendingLoanPayments('2026-12-04')).map((p) => p.id)).toEqual(schedule.map((p) => p.id));
  expect((await listPendingLoanPayments(schedule[0].dueDate)).map((p) => p.id)).toEqual([schedule[0].id]);
});

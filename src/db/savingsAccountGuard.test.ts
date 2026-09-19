/**
 * Savings accounts aren't spendable in place — money has to be transferred
 * out to a bank/cash/wallet account before it can be logged as income or an
 * expense (see assertSpendableAccount in src/db/ledger.ts). This file checks
 * that rule holds at every write path that can produce an income/expense
 * transaction, not just the add-transaction screen: direct transactions,
 * recurring rules, the friend ledger, and every loan money-movement
 * function. Transfers into/out of savings must keep working everywhere,
 * since that's the only legal way money enters or leaves one.
 */
import { createRealDataTestDb } from '@/test-support/realDataTestDb';

const mockTestDb = createRealDataTestDb();
jest.mock('@/db/client', () => ({
  getDb: async () => mockTestDb,
}));
jest.mock('@/lib/notifications', () => ({
  scheduleLoanDueReminder: async () => {},
  cancelLoanDueReminder: async () => {},
  notifyOverspend: async () => {},
}));

import { CREATE_TABLES_SQL } from '@/db/schema';
import { createAccount, createCategory, createTransaction, updateTransaction } from '@/db/ledger';
import { createRecurringRule, updateRecurringRule } from '@/db/recurring';
import { createPerson, recordMoneyGivenToPerson, recordMoneyReceivedFromPerson } from '@/db/people';
import { createLoan, payInstallment, applyPrepayment, getLoanSchedule } from '@/db/loans';

const SAVINGS_ERROR = "Savings accounts can’t be used for income or expenses";

describe('savings accounts are never a valid income/expense account', () => {
  let bankId: string;
  let savingsId: string;
  let expenseCategoryId: string;
  let incomeCategoryId: string;
  let personId: string;

  beforeAll(async () => {
    await mockTestDb.execAsync(CREATE_TABLES_SQL);
    bankId = (await createAccount({ name: 'Bank', type: 'bank', currency: 'INR', openingBalanceMinor: 0 })).id;
    savingsId = (
      await createAccount({ name: 'Savings', type: 'savings', currency: 'INR', openingBalanceMinor: 0 })
    ).id;
    expenseCategoryId = (await createCategory({ name: 'Food', kind: 'expense' })).id;
    incomeCategoryId = (await createCategory({ name: 'Salary', kind: 'income' })).id;
    personId = (await createPerson({ name: 'Alex' })).id;
  });

  it('createTransaction rejects an expense or income against a savings account', async () => {
    await expect(
      createTransaction({
        type: 'expense',
        accountId: savingsId,
        categoryId: expenseCategoryId,
        amountMinor: 500,
        date: '2026-01-01',
      })
    ).rejects.toThrow(SAVINGS_ERROR);
    await expect(
      createTransaction({
        type: 'income',
        accountId: savingsId,
        categoryId: incomeCategoryId,
        amountMinor: 500,
        date: '2026-01-01',
      })
    ).rejects.toThrow(SAVINGS_ERROR);
  });

  it('createTransaction allows a transfer into and out of a savings account', async () => {
    const into = await createTransaction({
      type: 'transfer',
      accountId: bankId,
      toAccountId: savingsId,
      amountMinor: 1000,
      date: '2026-01-01',
    });
    expect(into.toAccountId).toBe(savingsId);

    const outOf = await createTransaction({
      type: 'transfer',
      accountId: savingsId,
      toAccountId: bankId,
      amountMinor: 400,
      date: '2026-01-02',
    });
    expect(outOf.accountId).toBe(savingsId);
  });

  it('updateTransaction rejects editing a transaction to point an expense/income at savings', async () => {
    const tx = await createTransaction({
      type: 'expense',
      accountId: bankId,
      categoryId: expenseCategoryId,
      amountMinor: 300,
      date: '2026-01-03',
    });
    await expect(
      updateTransaction(tx.id, {
        type: 'expense',
        accountId: savingsId,
        categoryId: expenseCategoryId,
        amountMinor: 300,
        date: '2026-01-03',
      })
    ).rejects.toThrow(SAVINGS_ERROR);
  });

  it('recordMoneyGivenToPerson and recordMoneyReceivedFromPerson reject a savings account', async () => {
    await expect(
      recordMoneyGivenToPerson({
        personId,
        accountId: savingsId,
        categoryId: expenseCategoryId,
        amountMinor: 200,
        date: '2026-01-04',
      })
    ).rejects.toThrow(SAVINGS_ERROR);
    await expect(
      recordMoneyReceivedFromPerson({
        personId,
        accountId: savingsId,
        categoryId: incomeCategoryId,
        amountMinor: 200,
        date: '2026-01-04',
      })
    ).rejects.toThrow(SAVINGS_ERROR);
  });

  it('recordMoneyGivenToPerson succeeds against a spendable account', async () => {
    await expect(
      recordMoneyGivenToPerson({
        personId,
        accountId: bankId,
        categoryId: expenseCategoryId,
        amountMinor: 200,
        date: '2026-01-04',
      })
    ).resolves.not.toThrow();
  });

  it('createRecurringRule and updateRecurringRule reject savings for expense/income but allow transfer', async () => {
    await expect(
      createRecurringRule({
        type: 'expense',
        accountId: savingsId,
        categoryId: expenseCategoryId,
        amountMinor: 100,
        frequency: 'monthly',
        intervalCount: 1,
        nextRunDate: '2026-02-01',
      })
    ).rejects.toThrow(SAVINGS_ERROR);

    const rule = await createRecurringRule({
      type: 'expense',
      accountId: bankId,
      categoryId: expenseCategoryId,
      amountMinor: 100,
      frequency: 'monthly',
      intervalCount: 1,
      nextRunDate: '2026-02-01',
    });
    await expect(
      updateRecurringRule(rule.id, {
        type: 'income',
        accountId: savingsId,
        categoryId: incomeCategoryId,
        amountMinor: 100,
        frequency: 'monthly',
        intervalCount: 1,
        nextRunDate: '2026-02-01',
      })
    ).rejects.toThrow(SAVINGS_ERROR);

    const transferRule = await createRecurringRule({
      type: 'transfer',
      accountId: bankId,
      toAccountId: savingsId,
      amountMinor: 100,
      frequency: 'monthly',
      intervalCount: 1,
      nextRunDate: '2026-02-01',
    });
    expect(transferRule.toAccountId).toBe(savingsId);
  });

  it('createLoan rejects a savings disbursement account for both loan directions', async () => {
    await expect(
      createLoan({
        direction: 'borrowed',
        counterparty: 'Bank A',
        principalMinor: 100000,
        interestRateAnnualBp: 900,
        tenureMonths: 12,
        startDate: '2026-01-01',
        disbursement: { accountId: savingsId, categoryId: incomeCategoryId },
      })
    ).rejects.toThrow(SAVINGS_ERROR);

    await expect(
      createLoan({
        direction: 'lent',
        counterparty: 'Friend B',
        principalMinor: 100000,
        interestRateAnnualBp: 0,
        tenureMonths: 12,
        startDate: '2026-01-01',
        disbursement: { accountId: savingsId, categoryId: expenseCategoryId },
      })
    ).rejects.toThrow(SAVINGS_ERROR);
  });

  it('createLoan rejects a savings account when a processing fee is charged, even though disbursement itself is income', async () => {
    // Borrowed disbursement is type 'income' (passes the income-only check on
    // its own) but the processing fee always posts as 'expense' on that same
    // account — this is the case the two-part check in loans.ts exists for.
    await expect(
      createLoan({
        direction: 'borrowed',
        counterparty: 'Bank C',
        principalMinor: 100000,
        interestRateAnnualBp: 900,
        tenureMonths: 12,
        startDate: '2026-01-01',
        disbursement: { accountId: savingsId, categoryId: incomeCategoryId, feeAmountMinor: 500 },
      })
    ).rejects.toThrow(SAVINGS_ERROR);
  });

  it('payInstallment and applyPrepayment reject a savings account', async () => {
    const loan = await createLoan({
      direction: 'borrowed',
      counterparty: 'Bank D',
      principalMinor: 120000,
      interestRateAnnualBp: 900,
      tenureMonths: 6,
      startDate: '2026-01-01',
      disbursement: { accountId: bankId, categoryId: incomeCategoryId },
    });
    const schedule = await getLoanSchedule(loan.id);

    await expect(
      payInstallment(schedule[0].id, { accountId: savingsId, categoryId: expenseCategoryId, paidDate: '2026-02-01' })
    ).rejects.toThrow(SAVINGS_ERROR);

    await expect(
      applyPrepayment(loan.id, { amountMinor: 10000, accountId: savingsId, categoryId: expenseCategoryId, date: '2026-01-15' })
    ).rejects.toThrow(SAVINGS_ERROR);

    // Sanity: the same calls succeed against a spendable account.
    await expect(
      payInstallment(schedule[0].id, { accountId: bankId, categoryId: expenseCategoryId, paidDate: '2026-02-01' })
    ).resolves.not.toThrow();
  });
});

/**
 * Coverage for the one write path flagged as completely untested:
 * updateTransaction, deleteTransaction, and getTransactionLink — the whole
 * edit/delete-guard system behind every transaction row's tap target.
 * Covers every linkage kind (plain, loan-EMI, person-ledger,
 * loan-disbursement/prepayment) and every type-conversion a plain edit can
 * make (expense↔income↔transfer), since a category left over from before a
 * type switch attaching to the wrong kind of transaction was a real bug
 * fixed earlier in this app's history.
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
import {
  createAccount,
  createCategory,
  createTransaction,
  updateTransaction,
  deleteTransaction,
  getTransactionLink,
} from '@/db/ledger';
import { createLoan, getLoanSchedule, payInstallment } from '@/db/loans';
import { createPerson, recordMoneyGivenToPerson, getPersonLedger } from '@/db/people';

describe('transaction edit/delete/link — every linkage kind and every type conversion', () => {
  let accountId: string;
  let toAccountId: string;
  let expenseCategoryId: string;
  let incomeCategoryId: string;

  beforeAll(async () => {
    await mockTestDb.execAsync(CREATE_TABLES_SQL);
    accountId = (
      await createAccount({ name: 'EditAccount', type: 'bank', currency: 'INR', openingBalanceMinor: 0 })
    ).id;
    toAccountId = (
      await createAccount({ name: 'EditAccountB', type: 'bank', currency: 'INR', openingBalanceMinor: 0 })
    ).id;
    expenseCategoryId = (await createCategory({ name: 'EditExpense', kind: 'expense' })).id;
    incomeCategoryId = (await createCategory({ name: 'EditIncome', kind: 'income' })).id;
  });

  it('getTransactionLink returns null for a plain transaction, and it is freely editable and deletable', async () => {
    const tx = await createTransaction({
      type: 'expense',
      accountId,
      categoryId: expenseCategoryId,
      amountMinor: 5000,
      date: '2026-01-01',
    });
    expect(await getTransactionLink(tx.id)).toBeNull();

    const edited = await updateTransaction(tx.id, {
      type: 'expense',
      accountId,
      categoryId: expenseCategoryId,
      amountMinor: 7500,
      date: '2026-01-02',
    });
    expect(edited.amountMinor).toBe(7500);
    expect(edited.date).toBe('2026-01-02');

    await deleteTransaction(tx.id);
    expect(await getTransactionLink(tx.id)).toBeNull(); // gone entirely, not just unlinked
  });

  const CONVERSIONS: { from: 'expense' | 'income' | 'transfer'; to: 'expense' | 'income' | 'transfer' }[] = [
    { from: 'expense', to: 'income' },
    { from: 'income', to: 'expense' },
    { from: 'expense', to: 'transfer' },
    { from: 'transfer', to: 'expense' },
    { from: 'income', to: 'transfer' },
    { from: 'transfer', to: 'income' },
  ];

  for (const { from, to } of CONVERSIONS) {
    it(`updateTransaction converts ${from} → ${to} cleanly, with no leftover cross-kind category`, async () => {
      const initial = await createTransaction(
        from === 'transfer'
          ? { type: 'transfer', accountId, toAccountId, amountMinor: 1000, date: '2026-01-05' }
          : {
              type: from,
              accountId,
              categoryId: from === 'income' ? incomeCategoryId : expenseCategoryId,
              amountMinor: 1000,
              date: '2026-01-05',
            }
      );

      const updated = await updateTransaction(
        initial.id,
        to === 'transfer'
          ? { type: 'transfer', accountId, toAccountId, amountMinor: 1000, date: '2026-01-05' }
          : {
              type: to,
              accountId,
              categoryId: to === 'income' ? incomeCategoryId : expenseCategoryId,
              amountMinor: 1000,
              date: '2026-01-05',
            }
      );

      expect(updated.type).toBe(to);
      if (to === 'transfer') {
        expect(updated.categoryId).toBeNull();
        expect(updated.toAccountId).toBe(toAccountId);
      } else {
        expect(updated.categoryId).toBe(to === 'income' ? incomeCategoryId : expenseCategoryId);
        expect(updated.toAccountId).toBeNull();
      }
    });
  }

  it('updateTransaction rejects a transfer with no destination account', async () => {
    const tx = await createTransaction({
      type: 'expense',
      accountId,
      categoryId: expenseCategoryId,
      amountMinor: 1000,
      date: '2026-01-06',
    });
    await expect(
      updateTransaction(tx.id, {
        type: 'transfer',
        accountId,
        toAccountId: null,
        amountMinor: 1000,
        date: '2026-01-06',
      })
    ).rejects.toThrow();
  });

  it('updateTransaction rejects a transfer to the same account', async () => {
    const tx = await createTransaction({
      type: 'expense',
      accountId,
      categoryId: expenseCategoryId,
      amountMinor: 1000,
      date: '2026-01-06',
    });
    await expect(
      updateTransaction(tx.id, {
        type: 'transfer',
        accountId,
        toAccountId: accountId,
        amountMinor: 1000,
        date: '2026-01-06',
      })
    ).rejects.toThrow();
  });

  it('updateTransaction rejects a non-positive amount', async () => {
    const tx = await createTransaction({
      type: 'expense',
      accountId,
      categoryId: expenseCategoryId,
      amountMinor: 1000,
      date: '2026-01-06',
    });
    await expect(
      updateTransaction(tx.id, {
        type: 'expense',
        accountId,
        categoryId: expenseCategoryId,
        amountMinor: 0,
        date: '2026-01-06',
      })
    ).rejects.toThrow();
  });

  it('a loan EMI payment is linked as kind "loan" and blocked from raw edit/delete', async () => {
    const loan = await createLoan({
      direction: 'borrowed',
      counterparty: 'LinkTest Bank',
      principalMinor: 60000,
      interestRateAnnualBp: 900,
      tenureMonths: 6,
      startDate: '2026-01-01',
      disbursement: { accountId, categoryId: incomeCategoryId },
    });
    const schedule = await getLoanSchedule(loan.id);
    await payInstallment(schedule[0].id, {
      accountId,
      categoryId: expenseCategoryId,
      paidDate: '2026-02-01',
    });

    const txs = await mockTestDb.getAllAsync<{ id: string }>(
      `SELECT transaction_id as id FROM loan_payments WHERE loan_id = ? AND status = 'paid'`,
      [loan.id]
    );
    const txId = txs[0].id;
    const link = await getTransactionLink(txId);
    expect(link).toEqual({ kind: 'loan', loanPaymentId: schedule[0].id });
    await expect(deleteTransaction(txId)).rejects.toThrow('undo it from there');
  });

  it('a Friends & Family entry is linked as kind "person" and blocked from raw edit/delete', async () => {
    const person = await createPerson({ name: 'LinkTest Friend' });
    await recordMoneyGivenToPerson({
      personId: person.id,
      accountId,
      categoryId: expenseCategoryId,
      amountMinor: 2000,
      date: '2026-01-10',
    });
    const ledger = await getPersonLedger(person.id);
    const link = await getTransactionLink(ledger[0].transactionId!);
    expect(link).toEqual({ kind: 'person' });
    await expect(deleteTransaction(ledger[0].transactionId!)).rejects.toThrow('undo it from there');
  });

  it('a loan disbursement is linked as kind "loan-unlinked" (recognized via transactions.loan_id) and blocked from raw edit/delete', async () => {
    await createLoan({
      direction: 'borrowed',
      counterparty: 'DisbursementTest',
      principalMinor: 40000,
      interestRateAnnualBp: 0,
      tenureMonths: 4,
      startDate: '2026-01-01',
      disbursement: { accountId, categoryId: incomeCategoryId },
    });
    const disb = await mockTestDb.getFirstAsync<{ id: string }>(
      `SELECT id FROM transactions WHERE note = ?`,
      ['Loan disbursement — DisbursementTest']
    );
    expect(disb).not.toBeNull();
    const link = await getTransactionLink(disb!.id);
    expect(link).toEqual({ kind: 'loan-unlinked' });
    await expect(deleteTransaction(disb!.id)).rejects.toThrow('undo it from there');
  });
});

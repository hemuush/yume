/**
 * getOutstandingLoanTrend reconstructs a borrowed loan's balance history from
 * loan_payments.outstanding_after_minor rather than any stored history table
 * — the cases worth pinning down are exactly the edges that logic could get
 * wrong: a loan not yet started by a given month-end, one started but with
 * no payment yet, a paid installment landing the balance in between two
 * month-ends, and a lent loan (a receivable, not debt) staying excluded.
 */
import { createRealDataTestDb } from '@/test-support/realDataTestDb';

const mockTestDb = createRealDataTestDb();
jest.mock('@/db/client', () => ({
  getDb: async () => mockTestDb,
}));
jest.mock('@/lib/notifications', () => ({
  scheduleLoanDueReminder: async () => {},
  cancelLoanDueReminder: async () => {},
}));

import { CREATE_TABLES_SQL } from '@/db/schema';
import { createAccount, createCategory } from '@/db/ledger';
import { createLoan, getLoanSchedule, payInstallment, getOutstandingLoanTrend } from '@/db/loans';

describe('getOutstandingLoanTrend', () => {
  let accountId: string;
  let incomeCat: string;
  let expenseCat: string;

  beforeAll(async () => {
    await mockTestDb.execAsync(CREATE_TABLES_SQL);
    accountId = (
      await createAccount({ name: 'TrendAccount', type: 'bank', currency: 'INR', openingBalanceMinor: 0 })
    ).id;
    incomeCat = (await createCategory({ name: 'TrendIncome', kind: 'income' })).id;
    expenseCat = (await createCategory({ name: 'TrendExpense', kind: 'expense' })).id;
  });

  it('with no loans at all, every month reads exactly zero', async () => {
    const points = await getOutstandingLoanTrend(3, new Date(2027, 5, 15));
    expect(points.map((p) => p.outstandingMinor)).toEqual([0, 0, 0]);
  });

  it('a lent loan never counts — it is money owed to the user, not debt', async () => {
    await createLoan({
      direction: 'lent',
      counterparty: 'Trend Borrower',
      principalMinor: 50000,
      interestRateAnnualBp: 0,
      tenureMonths: 6,
      startDate: '2028-01-01',
      disbursement: { accountId, categoryId: expenseCat },
    });
    const points = await getOutstandingLoanTrend(2, new Date(2028, 1, 28)); // Jan, Feb 2028
    expect(points.every((p) => p.outstandingMinor === 0)).toBe(true);
  });

  it('a borrowed loan contributes full principal before any month-end it started before, zero before it existed, and the paid-down balance after an installment', async () => {
    const loan = await createLoan({
      direction: 'borrowed',
      counterparty: 'Trend Lender',
      principalMinor: 120000,
      interestRateAnnualBp: 1200,
      tenureMonths: 12,
      startDate: '2029-02-15',
      disbursement: { accountId, categoryId: incomeCat },
    });
    const schedule = await getLoanSchedule(loan.id);
    // Paid on the 20th, inside March — so March's month-end should already
    // reflect the paid-down balance, not the full principal.
    await payInstallment(schedule[0].id, { accountId, categoryId: expenseCat, paidDate: '2029-03-20' });
    const paidDownBalance = schedule[0].outstandingAfterMinor;
    expect(paidDownBalance).toBeLessThan(120000);

    // Jan (before the loan existed), Feb (started, nothing paid yet), Mar (one installment paid).
    const points = await getOutstandingLoanTrend(3, new Date(2029, 2, 31));
    expect(points.map((p) => p.outstandingMinor)).toEqual([0, 120000, paidDownBalance]);
  });
});

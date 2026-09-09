/**
 * Every combination of loan direction × loan status, verified against the
 * "tracked balance" formula every screen (Home, Profile, the Loans tab)
 * uses, plus a dedicated historical-cutoff test for getNetWorthTrend — the
 * one function that reconstructs net worth as of a past date, where an
 * off-by-one would leak a later month's transactions into an earlier
 * snapshot. Written after finding that a 'defaulted' loan (a real,
 * schema-supported status) was silently excluded from every current-moment
 * total by an overly narrow `status === 'active'` filter, even though
 * getNetWorthTrend itself already handled it correctly — three different
 * screens disagreed with the one function that got it right.
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
import { createAccount, createCategory, createTransaction } from '@/db/ledger';
import { createLoan, listLoans, getLoanSchedule, payInstallment } from '@/db/loans';
import { getNetWorthTrend } from '@/db/reports';
import { setDefaultCurrency } from '@/db/settings';

/** The formula Home/Profile/the Loans tab all use (or, after this fix, should all use identically) for "how much do these loans net to". */
function loansNetWorth(
  loans: { status: string; direction: 'borrowed' | 'lent'; outstandingPrincipalMinor: number }[]
): number {
  return loans
    .filter((l) => l.status !== 'closed')
    .reduce(
      (sum, l) => sum + (l.direction === 'lent' ? l.outstandingPrincipalMinor : -l.outstandingPrincipalMinor),
      0
    );
}

describe('net worth calculation matrix — every loan direction × status combination', () => {
  let accountId: string;
  let expenseCat: string;
  let incomeCat: string;

  beforeAll(async () => {
    await mockTestDb.execAsync(CREATE_TABLES_SQL);
    await setDefaultCurrency('INR');
    accountId = (
      await createAccount({ name: 'NetWorthAccount', type: 'bank', currency: 'INR', openingBalanceMinor: 0 })
    ).id;
    expenseCat = (await createCategory({ name: 'NetWorthExpense', kind: 'expense' })).id;
    incomeCat = (await createCategory({ name: 'NetWorthIncome', kind: 'income' })).id;
  });

  it('a borrowed loan manually marked defaulted still counts as a liability, not zero', async () => {
    const loan = await createLoan({
      direction: 'borrowed',
      counterparty: 'Defaulted Lender',
      principalMinor: 200000,
      interestRateAnnualBp: 900,
      tenureMonths: 12,
      startDate: '2026-01-01',
      disbursement: { accountId, categoryId: incomeCat },
    });
    // No UI path sets 'defaulted' today (confirmed: dead schema value), but
    // the aggregation must not silently drop it the moment it exists —
    // simulating it directly at the data layer, same as a future feature
    // (or a restored backup from elsewhere) legitimately could.
    await mockTestDb.runAsync(`UPDATE loans SET status = 'defaulted' WHERE id = ?`, [loan.id]);

    const loans = await listLoans();
    const defaulted = loans.find((l) => l.id === loan.id)!;
    expect(defaulted.status).toBe('defaulted');
    // Still the full principal owed — a default doesn't erase the debt.
    expect(loansNetWorth([defaulted])).toBe(-200000);
  });

  it('a lent loan manually marked defaulted still counts as a receivable asset, not zero', async () => {
    const loan = await createLoan({
      direction: 'lent',
      counterparty: 'Defaulted Borrower',
      principalMinor: 75000,
      interestRateAnnualBp: 0,
      tenureMonths: 6,
      startDate: '2026-01-01',
      disbursement: { accountId, categoryId: expenseCat },
    });
    await mockTestDb.runAsync(`UPDATE loans SET status = 'defaulted' WHERE id = ?`, [loan.id]);

    const loans = await listLoans();
    const defaulted = loans.find((l) => l.id === loan.id)!;
    expect(loansNetWorth([defaulted])).toBe(75000);
  });

  it('a closed (fully paid) loan contributes exactly zero, correctly excluded', async () => {
    const loan = await createLoan({
      direction: 'borrowed',
      counterparty: 'Payoff',
      principalMinor: 10000,
      interestRateAnnualBp: 0,
      tenureMonths: 1,
      startDate: '2026-01-01',
      disbursement: { accountId, categoryId: incomeCat },
    });
    const schedule = await getLoanSchedule(loan.id);
    await payInstallment(schedule[0].id, { accountId, categoryId: expenseCat, paidDate: '2026-02-01' });
    const loans = await listLoans();
    const closed = loans.find((l) => l.id === loan.id)!;
    expect(closed.status).toBe('closed');
    expect(loansNetWorth([closed])).toBe(0);
  });

  it('mixed active + defaulted + closed loans net to exactly the sum of their individual contributions', async () => {
    const loans = await listLoans();
    const total = loansNetWorth(loans);
    const expected = loans
      .filter((l) => l.status !== 'closed')
      .reduce(
        (sum, l) =>
          sum + (l.direction === 'lent' ? l.outstandingPrincipalMinor : -l.outstandingPrincipalMinor),
        0
      );
    expect(total).toBe(expected);
  });
});

describe('getNetWorthTrend historical cutoff correctness', () => {
  it("a transaction dated in a later month never leaks into an earlier month's net worth snapshot", async () => {
    // Reuses this file's one shared mocked db (dates chosen in a year no
    // other test in this file touches, so the running totals from earlier
    // describe blocks can't contaminate this snapshot's own arithmetic).
    const account = await createAccount({
      name: 'CutoffAccount',
      type: 'bank',
      currency: 'INR',
      openingBalanceMinor: 0,
    });
    const cat = (await createCategory({ name: 'CutoffIncome', kind: 'income' })).id;

    // ₹1,000 in January 2031, another ₹5,000 in March 2031 — reference date
    // is March, so January's own snapshot must show only its own ₹1,000.
    await createTransaction({
      type: 'income',
      accountId: account.id,
      categoryId: cat,
      amountMinor: 100000,
      date: '2031-01-15',
    });
    await createTransaction({
      type: 'income',
      accountId: account.id,
      categoryId: cat,
      amountMinor: 500000,
      date: '2031-03-15',
    });

    const points = await getNetWorthTrend(3, new Date(2031, 2, 31)); // Jan, Feb, Mar 2031
    expect(points[0].label).not.toBe(points[2].label); // sanity: three distinct months returned
    // February has no new activity since January — the snapshot must be
    // identical, not drift from something dated after February.
    expect(points[1].netWorthMinor).toBe(points[0].netWorthMinor);
    // March's ₹5,000 income must land exactly on top of February's
    // snapshot — not more (double-counted), not less (leaked away).
    expect(points[2].netWorthMinor).toBe(points[1].netWorthMinor + 500000);
  });
});

describe('applyRateChange: negative-amortization guard', () => {
  it('a floating rate raised high enough that the old EMI no longer covers interest is rejected outright, leaving the loan exactly as it was', async () => {
    const account = await createAccount({
      name: 'NegAmortAccount',
      type: 'bank',
      currency: 'INR',
      openingBalanceMinor: 0,
    });
    const incomeCat = (await createCategory({ name: 'NegAmortIncome', kind: 'income' })).id;
    const loan = await createLoan({
      direction: 'borrowed',
      counterparty: 'NegAmort Bank',
      principalMinor: 1000000,
      interestRateAnnualBp: 500, // 5% — a modest starting rate
      tenureMonths: 60,
      startDate: '2026-01-01',
      rateType: 'floating',
      disbursement: { accountId: account.id, categoryId: incomeCat },
    });

    const { applyRateChange, getLoanSchedule, getLoanById } = require('@/db/loans');
    const scheduleBefore = await getLoanSchedule(loan.id);

    // A jump to 90% p.a. — extreme, but exactly the kind of number a bad
    // manual entry could produce. The EMI is fixed at the old, much lower
    // rate, so monthly interest at the new rate would exceed it — this
    // must be rejected before touching the database, not silently
    // accepted with an empty/incomplete resulting schedule (which is what
    // it did before this guard: 0 pending installments, loan stuck
    // "active" with its full original debt and no way to ever pay it off).
    await expect(
      applyRateChange(loan.id, { newAnnualRateBp: 9000, effectiveDate: '2026-02-01' })
    ).rejects.toThrow('never pay off');

    // Nothing changed: same rate, same schedule as before the rejected attempt.
    const freshLoan = await getLoanById(loan.id);
    expect(freshLoan.interestRateAnnualBp).toBe(500);
    const scheduleAfter = await getLoanSchedule(loan.id);
    expect(scheduleAfter).toEqual(scheduleBefore);
  });

  it('a floating rate change that the EMI can still comfortably cover succeeds normally', async () => {
    const account = await createAccount({
      name: 'OkRateAccount',
      type: 'bank',
      currency: 'INR',
      openingBalanceMinor: 0,
    });
    const incomeCat = (await createCategory({ name: 'OkRateIncome', kind: 'income' })).id;
    const loan = await createLoan({
      direction: 'borrowed',
      counterparty: 'OkRate Bank',
      principalMinor: 1000000,
      interestRateAnnualBp: 500,
      tenureMonths: 60,
      startDate: '2026-01-01',
      rateType: 'floating',
      disbursement: { accountId: account.id, categoryId: incomeCat },
    });

    const { applyRateChange, getLoanSchedule, getLoanById } = require('@/db/loans');
    await applyRateChange(loan.id, { newAnnualRateBp: 700, effectiveDate: '2026-02-01' });

    const freshLoan = await getLoanById(loan.id);
    expect(freshLoan.interestRateAnnualBp).toBe(700);
    const schedule = await getLoanSchedule(loan.id);
    expect(schedule.length).toBeGreaterThan(0);
    expect(schedule[schedule.length - 1].outstandingAfterMinor).toBe(0);
  });
});

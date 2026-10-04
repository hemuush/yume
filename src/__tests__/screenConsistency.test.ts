/**
 * Replays a typical sequence (two accounts, a mis-entered loan deleted via the guard, a second loan with a
 * disbursement, one payment and a heavy prepayment), then runs the Promise.all batches Profile, Loans and
 * Home run on focus. Every figure is checked against an independent hand calculation from the loan's own
 * schedule, not just against another screen's output. All names and amounts are synthetic.
 */
import { createRealDataTestDb } from '@/test-support/realDataTestDb';

const mockTestDb = createRealDataTestDb();
jest.mock('@/db/client', () => ({
  getDb: async () => mockTestDb,
}));
jest.mock('@/lib/notifications', () => ({ rebuildNotifications: async () => {} }));

import { CREATE_TABLES_SQL } from '@/db/schema';
import { createAccount, createCategory, listAccounts } from '@/db/ledger';
import {
  createLoan,
  listLoans,
  getLoanSchedule,
  payInstallment,
  applyPrepayment,
  deleteLoan,
  getNextDueInstallment,
} from '@/db/loans';
import { listPeople } from '@/db/people';
import { getUserName, getMemberSinceYear, getDefaultCurrency } from '@/db/settings';
import { getRangeComparison, computeTrackedBalance } from '@/db/reports';

const PRINCIPAL = 220_000_000; // minor units: a large loan, so a rounding drift would show
const PREPAYMENT = 215_123_059;

describe('Profile / Loans tab / Home all agree after a realistic create-delete-prepay sequence', () => {
  let accountId: string;
  let savingsAccountId: string;
  let loanId: string;
  /** The surviving loan's schedule, read after the prepayment. */
  let schedule: Awaited<ReturnType<typeof getLoanSchedule>>;
  let firstEmi: number;

  beforeAll(async () => {
    await mockTestDb.execAsync(CREATE_TABLES_SQL);
    accountId = (
      await createAccount({ name: 'Test Bank', type: 'bank', currency: 'INR', openingBalanceMinor: 0 })
    ).id;
    savingsAccountId = (
      await createAccount({
        name: 'Test Bank Savings',
        type: 'savings',
        currency: 'INR',
        openingBalanceMinor: 0,
      })
    ).id;
    const expenseCategoryId = (await createCategory({ name: 'Loan EMI', kind: 'expense' })).id;
    const incomeCategoryId = (await createCategory({ name: 'Salary', kind: 'income' })).id;

    // A mis-entered loan, created then deleted before it ever had a real payment.
    const misEntered = await createLoan({
      direction: 'borrowed',
      counterparty: 'Mis-entered',
      principalMinor: 4_000_000,
      interestRateAnnualBp: 760,
      tenureMonths: 240,
      startDate: '2025-09-05',
      alreadyPaidInstallments: 50,
    });
    await deleteLoan(misEntered.id);

    // The real loan: a disbursement, one payment, then a heavy prepayment.
    const real = await createLoan({
      direction: 'borrowed',
      counterparty: 'Test loan B',
      principalMinor: PRINCIPAL,
      interestRateAnnualBp: 760,
      tenureMonths: 240,
      startDate: '2026-08-05',
      disbursement: { accountId, categoryId: incomeCategoryId },
    });
    loanId = real.id;
    const initial = await getLoanSchedule(loanId);
    firstEmi = initial[0].emiAmountMinor;
    await payInstallment(initial[0].id, {
      accountId,
      categoryId: expenseCategoryId,
      paidDate: '2026-09-05',
    });
    await applyPrepayment(loanId, {
      amountMinor: PREPAYMENT,
      accountId,
      categoryId: expenseCategoryId,
      date: '2026-09-05',
    });
    schedule = await getLoanSchedule(loanId);
  });

  it('listAccounts (Profile + Home) returns both accounts with balances worked out from the money that moved', async () => {
    const accounts = await listAccounts();
    expect(accounts).toHaveLength(2);
    expect(accounts.find((a) => a.id === accountId)?.currentBalanceMinor).toBe(
      PRINCIPAL - firstEmi - PREPAYMENT
    );
    expect(accounts.find((a) => a.id === savingsAccountId)?.currentBalanceMinor).toBe(0);
  });

  it('listLoans (the Loans tab) returns only the surviving loan, and Home points at its next unpaid installment', async () => {
    const loans = await listLoans();
    expect(loans.map((l) => l.counterparty)).toEqual(['Test loan B']);

    // The prepayment shortens the schedule but leaves later installments pending, so Home must have a next
    // due, and it must be the first pending one of the loan the Loans tab shows.
    const firstPending = schedule.find((i) => i.status === 'pending');
    expect(firstPending).toBeDefined();
    const nextDue = await getNextDueInstallment();
    expect(nextDue).toEqual({
      loanId,
      counterparty: 'Test loan B',
      emiAmountMinor: firstPending!.emiAmountMinor,
      dueDate: firstPending!.dueDate,
    });

    // What the Loans tab calls outstanding is exactly the principal still to be repaid in the schedule.
    const remaining = schedule
      .filter((i) => i.status === 'pending')
      .reduce((sum, i) => sum + i.principalComponentMinor, 0);
    expect(loans[0].outstandingPrincipalMinor).toBe(remaining);
  });

  it("every screen's Promise.all batch (Profile's YouSection, and Home's) resolves and lands on the hand-calculated total", async () => {
    // The core of YouSection's load() (accounts/loans/people/currency, feeding computeTrackedBalance): if any
    // call throws, Promise.all rejects and the screen silently keeps its zero/empty defaults.
    const [profileAccounts, profileLoans, profilePeople, , , currency] = await Promise.all([
      listAccounts(),
      listLoans(),
      listPeople(),
      getUserName(),
      getMemberSinceYear(),
      getDefaultCurrency(),
    ]);
    expect(currency).toBe('INR');

    // Home's own load() shape. September holds the payment and the prepayment; August the disbursement.
    const september = { start: '2026-09-01', end: '2026-09-30' };
    const august = { start: '2026-08-01', end: '2026-08-31' };
    const [homeAccounts, homeLoans, homePeople, comparison] = await Promise.all([
      listAccounts(),
      listLoans(),
      listPeople(),
      getRangeComparison(september, august, 'month'),
    ]);
    expect(comparison.current.expenseMinor).toBe(firstEmi + PREPAYMENT);
    expect(comparison.current.incomeMinor).toBe(0);
    expect(comparison.previous.incomeMinor).toBe(PRINCIPAL);

    // Tracked balance by hand: the bank account's cash, less the borrowed loan's remaining principal (no
    // asset recorded, so the loan counts as pure debt), no one owing anything.
    const remaining = schedule
      .filter((i) => i.status === 'pending')
      .reduce((sum, i) => sum + i.principalComponentMinor, 0);
    const expected = PRINCIPAL - firstEmi - PREPAYMENT - remaining;

    const home = computeTrackedBalance({
      accounts: homeAccounts,
      loans: homeLoans,
      people: homePeople,
      defaultCurrency: currency,
    });
    const profile = computeTrackedBalance({
      accounts: profileAccounts,
      loans: profileLoans,
      people: profilePeople,
      defaultCurrency: currency,
    });
    expect(home).toBe(expected);
    expect(profile).toBe(expected);
  });
});

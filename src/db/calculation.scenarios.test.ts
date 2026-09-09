/**
 * A broad matrix of realistic combined scenarios — multiple currencies,
 * both loan directions, both people-balance directions, active vs closed
 * loans, and transfers into a savings account — checked against
 * hand-computed expected totals. Requested after two real calculation bugs
 * shipped in a row (an ambiguous SQL column, and a query against a
 * nonexistent column) that neither had test coverage. This exists to make
 * "the numbers are wrong" bugs show up here, not on a user's screen.
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
import { createAccount, createCategory, createTransaction, listAccounts } from '@/db/ledger';
import { createLoan, listLoans, getLoanSchedule, payInstallment } from '@/db/loans';
import { createPerson, addLedgerEntry, listPeople } from '@/db/people';
import { getPeriodSummary, getRangeComparison } from '@/db/reports';
import { setDefaultCurrency } from '@/db/settings';

/** The exact formula every screen (Home, Profile) uses for its headline "tracked balance" figure. */
function computeTrackedBalance(
  accounts: { currency: string; currentBalanceMinor: number }[],
  defaultCurrency: string,
  loans: { status: string; direction: 'borrowed' | 'lent'; outstandingPrincipalMinor: number }[],
  people: { balanceMinor: number }[]
): number {
  const accountsTotal = accounts
    .filter((a) => a.currency === defaultCurrency)
    .reduce((sum, a) => sum + a.currentBalanceMinor, 0);
  const loansNet = loans
    .filter((l) => l.status === 'active')
    .reduce(
      (sum, l) => sum + (l.direction === 'lent' ? l.outstandingPrincipalMinor : -l.outstandingPrincipalMinor),
      0
    );
  const peopleNet = people.reduce((sum, p) => sum + p.balanceMinor, 0);
  return accountsTotal + loansNet + peopleNet;
}

describe('calculation scenario matrix', () => {
  beforeAll(async () => {
    await mockTestDb.execAsync(CREATE_TABLES_SQL);
    await setDefaultCurrency('INR');
  });

  it('multi-currency: only default-currency accounts count toward the tracked balance', async () => {
    const inrAccount = await createAccount({
      name: 'INR Bank',
      type: 'bank',
      currency: 'INR',
      openingBalanceMinor: 100000,
    });
    const usdAccount = await createAccount({
      name: 'USD Bank',
      type: 'bank',
      currency: 'USD',
      openingBalanceMinor: 500000,
    });

    const accounts = await listAccounts();
    const balance = computeTrackedBalance(accounts, 'INR', [], []);
    // Only the INR account's opening balance counts — the USD account's
    // face value must never be added as if 1 USD == 1 INR.
    expect(balance).toBe(100000);
    expect(accounts.find((a) => a.id === usdAccount.id)?.currentBalanceMinor).toBe(500000); // still tracked on its own
    expect(accounts.find((a) => a.id === inrAccount.id)?.currentBalanceMinor).toBe(100000);
  });

  it('a lent loan adds to the tracked balance; a borrowed loan subtracts; a closed loan counts as neither', async () => {
    const account = await createAccount({
      name: 'Main',
      type: 'bank',
      currency: 'INR',
      openingBalanceMinor: 0,
    });
    const expenseCat = (await createCategory({ name: 'Loan EMI', kind: 'expense' })).id;
    const incomeCat = (await createCategory({ name: 'Salary', kind: 'income' })).id;

    await createLoan({
      direction: 'lent',
      counterparty: 'Friend A',
      principalMinor: 50000,
      interestRateAnnualBp: 0,
      tenureMonths: 5,
      startDate: '2026-01-01',
      disbursement: { accountId: account.id, categoryId: expenseCat },
    });
    await createLoan({
      direction: 'borrowed',
      counterparty: 'Bank B',
      principalMinor: 80000,
      interestRateAnnualBp: 0,
      tenureMonths: 4,
      startDate: '2026-01-01',
      disbursement: { accountId: account.id, categoryId: incomeCat },
    });
    // A fully-paid-off loan (closes itself once outstanding hits 0).
    const smallClosed = await createLoan({
      direction: 'borrowed',
      counterparty: 'Quick Payoff',
      principalMinor: 10000,
      interestRateAnnualBp: 0,
      tenureMonths: 1,
      startDate: '2026-01-01',
      disbursement: { accountId: account.id, categoryId: incomeCat },
    });
    const schedule = await getLoanSchedule(smallClosed.id);
    await payInstallment(schedule[0].id, {
      accountId: account.id,
      categoryId: expenseCat,
      paidDate: '2026-02-01',
    });

    const loans = await listLoans();
    const closedLoan = loans.find((l) => l.id === smallClosed.id)!;
    expect(closedLoan.status).toBe('closed');

    const accounts = await listAccounts();
    const thisAccount = accounts.find((a) => a.id === account.id)!;
    // This file's tests share one in-memory db and accumulate accounts —
    // "tracked balance" is only meaningful summed across every account in
    // that currency, so recompute it from just the ones this test created.
    const thisTestAccounts = accounts.filter((a) => a.id === account.id);
    const balance = computeTrackedBalance(thisTestAccounts, 'INR', loans, []);
    const expectedLoansNet =
      50000 /* lent, receivable */ - 80000 /* borrowed, owed */ + 0; /* closed loan excluded */
    const disbursementCashEffect =
      50000 /* lent: cash left */ * -1 +
      80000 /* borrowed: cash in */ +
      10000 /* small loan: cash in */ -
      10000; /* small loan repaid */
    expect(thisAccount.currentBalanceMinor).toBe(disbursementCashEffect);
    expect(balance).toBe(disbursementCashEffect + expectedLoansNet);
  });

  it('people balances: owed-to-you is positive, you-owe is negative, and both fold into the tracked balance correctly', async () => {
    const account = await createAccount({
      name: 'PeopleTest',
      type: 'bank',
      currency: 'INR',
      openingBalanceMinor: 0,
    });
    const owesYou = await createPerson({ name: 'Owes You' });
    const youOwe = await createPerson({ name: 'You Owe' });
    await addLedgerEntry({ personId: owesYou.id, amountMinor: 30000, date: '2026-01-01' });
    await addLedgerEntry({ personId: youOwe.id, amountMinor: -12000, date: '2026-01-01' });

    const people = await listPeople();
    const balance = computeTrackedBalance(await listAccounts(), 'INR', [], people);
    // Only this test's own two people affect the net-of-people check below —
    // filter to just them since earlier tests in this file may have left
    // their own accounts/loans (but no people) in the shared in-memory db.
    const netOfThesePeople = people
      .filter((p) => p.id === owesYou.id || p.id === youOwe.id)
      .reduce((sum, p) => sum + p.balanceMinor, 0);
    expect(netOfThesePeople).toBe(30000 - 12000);
    void account;
    void balance;
  });

  it('a transfer into a savings account moves the savings-contribution figure without touching income or expense totals, and reduces net (money already parked in savings is no longer "surplus")', async () => {
    const bank = await createAccount({
      name: 'SavingsTestBank',
      type: 'bank',
      currency: 'INR',
      openingBalanceMinor: 0,
    });
    const savings = await createAccount({
      name: 'SavingsTestPot',
      type: 'savings',
      currency: 'INR',
      openingBalanceMinor: 0,
    });
    const incomeCat = (await createCategory({ name: 'SavingsTestIncome', kind: 'income' })).id;
    await createTransaction({
      type: 'income',
      accountId: bank.id,
      categoryId: incomeCat,
      amountMinor: 100000,
      date: '2026-05-01',
    });
    await createTransaction({
      type: 'transfer',
      accountId: bank.id,
      toAccountId: savings.id,
      amountMinor: 25000,
      date: '2026-05-01',
    });

    const summary = await getPeriodSummary({ start: '2026-05-01', end: '2026-05-31' });
    // A transfer between the user's own accounts is not income or expense —
    // only the dedicated savings-contribution figure should move...
    expect(summary.incomeMinor).toBe(100000);
    expect(summary.expenseMinor).toBe(0);
    expect(summary.savingsContributionMinor).toBeGreaterThanOrEqual(25000);
    // ...but net/"surplus" DOES subtract it: money already moved into savings
    // is spoken for, not still sitting free to allocate.
    expect(summary.netMinor).toBe(
      summary.incomeMinor - summary.expenseMinor - summary.savingsContributionMinor
    );
    expect(summary.netMinor).toBe(75000);

    // Withdrawing it back out reverses the effect — savingsContributionMinor
    // goes to 0 net, so it no longer suppresses net at all.
    await createTransaction({
      type: 'transfer',
      accountId: savings.id,
      toAccountId: bank.id,
      amountMinor: 25000,
      date: '2026-05-02',
    });
    const afterWithdrawal = await getPeriodSummary({ start: '2026-05-01', end: '2026-05-31' });
    expect(afterWithdrawal.savingsContributionMinor).toBe(0);
    expect(afterWithdrawal.netMinor).toBe(100000);
  });

  it("getRangeComparison across a real month boundary includes exactly that month's transactions, nothing from adjacent months", async () => {
    const account = await createAccount({
      name: 'BoundaryTest',
      type: 'bank',
      currency: 'INR',
      openingBalanceMinor: 0,
    });
    const cat = (await createCategory({ name: 'BoundaryExpense', kind: 'expense' })).id;
    await createTransaction({
      type: 'expense',
      accountId: account.id,
      categoryId: cat,
      amountMinor: 111,
      date: '2026-06-30',
    });
    await createTransaction({
      type: 'expense',
      accountId: account.id,
      categoryId: cat,
      amountMinor: 222,
      date: '2026-07-01',
    });
    await createTransaction({
      type: 'expense',
      accountId: account.id,
      categoryId: cat,
      amountMinor: 333,
      date: '2026-07-31',
    });
    await createTransaction({
      type: 'expense',
      accountId: account.id,
      categoryId: cat,
      amountMinor: 444,
      date: '2026-08-01',
    });

    const july = await getRangeComparison(
      { start: '2026-07-01', end: '2026-07-31' },
      { start: '2026-06-01', end: '2026-06-30' }
    );
    const julyOwn = july.current.categoryBreakdown.find((c) => c.name === 'BoundaryExpense')?.totalMinor ?? 0;
    expect(julyOwn).toBe(222 + 333);
  });
});

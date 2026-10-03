/**
 * Replays a real on-device sequence (accounts, a mis-entered loan deleted via the guard, a second loan
 * prepaid heavily), then runs the Promise.all batches Profile, Loans and Home run on focus; they must agree.
 */
import { createRealDataTestDb } from '@/test-support/realDataTestDb';

const mockTestDb = createRealDataTestDb();
jest.mock('@/db/client', () => ({
  getDb: async () => mockTestDb,
}));
jest.mock('@/lib/notifications', () => ({ rebuildNotifications: async () => {} }));

import { CREATE_TABLES_SQL } from '@/db/schema';
import { createAccount, createCategory, listAccounts, listTransactions } from '@/db/ledger';
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
import { periodRange, CURRENT_PERIOD } from '@/lib/period';

describe('Profile / Loans tab / Home all agree after a realistic create-delete-prepay sequence', () => {
  let accountId: string;
  let savingsAccountId: string;
  let expenseCategoryId: string;
  let incomeCategoryId: string;

  beforeAll(async () => {
    await mockTestDb.execAsync(CREATE_TABLES_SQL);
    accountId = (await createAccount({ name: 'Hdfc', type: 'bank', currency: 'INR', openingBalanceMinor: 0 }))
      .id;
    savingsAccountId = (
      await createAccount({ name: 'HDFC Bank', type: 'savings', currency: 'INR', openingBalanceMinor: 0 })
    ).id;
    expenseCategoryId = (await createCategory({ name: 'Loan EMI', kind: 'expense' })).id;
    incomeCategoryId = (await createCategory({ name: 'Salary', kind: 'income' })).id;

    // A mis-entered loan (the "Hdfc" scenario) — created, then deleted before it ever had a real payment.
    const misEntered = await createLoan({
      direction: 'borrowed',
      counterparty: 'Mis-entered',
      principalMinor: 4000000,
      interestRateAnnualBp: 760,
      tenureMonths: 240,
      startDate: '2025-09-05',
      alreadyPaidInstallments: 50,
    });
    await deleteLoan(misEntered.id);

    // A second, real loan ("Test 2") with a real disbursement and a real payment, then a heavy prepayment.
    const testTwo = await createLoan({
      direction: 'borrowed',
      counterparty: 'Test 2',
      principalMinor: 220000000, // ₹22,00,000 in minor units — the on-device Hdfc/Test 2 loan was this scale, not ₹22,000
      interestRateAnnualBp: 760,
      tenureMonths: 240,
      startDate: '2026-08-05',
      disbursement: { accountId, categoryId: incomeCategoryId },
    });
    const schedule = await getLoanSchedule(testTwo.id);
    await payInstallment(schedule[0].id, {
      accountId,
      categoryId: expenseCategoryId,
      paidDate: '2026-09-05',
    });
    await applyPrepayment(testTwo.id, {
      amountMinor: 215123059, // ~₹21,51,230.59 in minor units, matching the on-device scenario
      accountId,
      categoryId: expenseCategoryId,
      date: '2026-09-05',
    });
  });

  it('listAccounts (Profile + Home) returns both accounts with correct balances', async () => {
    const accounts = await listAccounts();
    expect(accounts).toHaveLength(2);
    const hdfc = accounts.find((a) => a.id === accountId);
    const savings = accounts.find((a) => a.id === savingsAccountId);
    expect(hdfc).toBeDefined();
    expect(savings).toBeDefined();
    expect(savings!.currentBalanceMinor).toBe(0);
  });

  it('listLoans (the Loans tab) returns the surviving loan, not the deleted one, and matches getNextDueInstallment (Home)', async () => {
    const loans = await listLoans();
    expect(loans).toHaveLength(1);
    expect(loans[0].counterparty).toBe('Test 2');
    expect(loans.some((l) => l.counterparty === 'Mis-entered')).toBe(false);

    const nextDue = await getNextDueInstallment();
    // After a heavy prepayment a next installment may or may not remain, but if so it must belong to the
    // surviving loan: Home must never point at a loan the Loans tab doesn't know about.
    if (nextDue) {
      expect(nextDue.counterparty).toBe('Test 2');
    }
  });

  it("every screen's Promise.all batch (Profile's YouSection, and Home's) resolves without throwing and agrees on totals", async () => {
    // The core subset of YouSection's load() (accounts/loans/people/currency, feeding computeTrackedBalance):
    // if any call throws, Promise.all rejects and the screen silently keeps zero/empty defaults, no error.
    const [accs, txs, loans, people, userName, since, currency] = await Promise.all([
      listAccounts(),
      listTransactions({ limit: 100000 }),
      listLoans(),
      listPeople(),
      getUserName(),
      getMemberSinceYear(),
      getDefaultCurrency(),
    ]);
    expect(accs).toHaveLength(2);
    expect(loans).toHaveLength(1);
    expect(currency).toBe('INR');
    void txs;
    void people;
    void userName;
    void since;

    // Exactly Home's own load() shape for the current-month batch.
    const range = periodRange(CURRENT_PERIOD);
    const [homeAccounts, homeLoans, homePeople, comparison] = await Promise.all([
      listAccounts(),
      listLoans(),
      listPeople(),
      getRangeComparison(range, range, 'month'),
    ]);
    expect(homeAccounts).toHaveLength(2);
    expect(homeLoans).toHaveLength(1);

    // Both screens feed their fetched data through the shared computeTrackedBalance, so each screen's
    // Promise.all output must land on the same number; the hand-calc stops the helper drifting under both.
    const homeTrackedBalance = computeTrackedBalance({
      accounts: homeAccounts,
      loans: homeLoans,
      people: homePeople,
      defaultCurrency: currency,
    });
    const profileTrackedBalance = computeTrackedBalance({
      accounts: accs,
      loans,
      people,
      defaultCurrency: currency,
    });
    expect(profileTrackedBalance).toBe(homeTrackedBalance);

    const handAccounts = homeAccounts
      .filter((a) => a.currency === currency)
      .reduce((sum, a) => sum + a.currentBalanceMinor, 0);
    const handLoans = homeLoans
      .filter((l) => l.status !== 'closed')
      .reduce((sum, l) => {
        const outstanding = l.outstandingPrincipalMinor;
        if (l.direction === 'lent') return sum + outstanding;
        return sum + ((l.assetValueMinor ?? 0) - outstanding);
      }, 0);
    const handPeople = homePeople.reduce((sum, p) => sum + p.balanceMinor, 0);
    expect(homeTrackedBalance).toBe(handAccounts + handLoans + handPeople);
    void comparison;
  });
});

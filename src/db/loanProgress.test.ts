/**
 * getLoanProgress against a real SQLite engine — same reasoning as
 * reportsLiveQueries.test.ts.
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
import { createAccount, createCategory } from '@/db/ledger';
import { createLoan, getLoanProgress, getLoanSchedule, payInstallment } from '@/db/loans';

describe('getLoanProgress', () => {
  let accountId: string;
  let emiCategoryId: string;

  beforeAll(async () => {
    await mockTestDb.execAsync(CREATE_TABLES_SQL);
    accountId = (await createAccount({ name: 'Bank', type: 'bank', currency: 'INR', openingBalanceMinor: 0 }))
      .id;
    emiCategoryId = (await createCategory({ name: 'Loan EMI', kind: 'expense' })).id;
  });

  it('counts paid installments, including ones paid before the loan was entered, and finds the next EMI', async () => {
    const loan = await createLoan({
      direction: 'borrowed',
      counterparty: 'Bank A',
      principalMinor: 12000000,
      interestRateAnnualBp: 900,
      tenureMonths: 24,
      startDate: '2026-01-05',
      alreadyPaidInstallments: 3,
    });
    const schedule = await getLoanSchedule(loan.id);
    await payInstallment(schedule[3].id, { accountId, categoryId: emiCategoryId, paidDate: '2026-04-05' });

    const p = (await getLoanProgress()).find((x) => x.loanId === loan.id)!;
    expect(p.paidCount).toBe(4);
    expect(p.totalCount).toBe(schedule.length);
    expect(p.nextDueDate).toBe(schedule[4].dueDate);
    expect(p.nextEmiMinor).toBe(schedule[4].emiAmountMinor);
  });

  it('reports no next EMI once every installment is paid', async () => {
    const loan = await createLoan({
      direction: 'lent',
      counterparty: 'A friend',
      principalMinor: 300000,
      interestRateAnnualBp: 0,
      tenureMonths: 3,
      startDate: '2026-01-01',
      alreadyPaidInstallments: 3,
    });
    const p = (await getLoanProgress()).find((x) => x.loanId === loan.id)!;
    expect(p).toEqual({
      loanId: loan.id,
      paidCount: 3,
      totalCount: 3,
      nextDueDate: null,
      nextEmiMinor: null,
    });
  });
});

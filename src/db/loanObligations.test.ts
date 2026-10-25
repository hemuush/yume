import { createRealDataTestDb } from '@/test-support/realDataTestDb';

let mockTestDb: ReturnType<typeof createRealDataTestDb>;
jest.mock('@/db/client', () => ({ getDb: async () => mockTestDb }));
jest.mock('@/lib/notifications', () => ({ rebuildNotifications: async () => true }));

import { CREATE_TABLES_SQL } from './schema';
import { createAccount, createCategory, getAccountBalance } from './ledger';
import {
  createLoan,
  getLoanProgress,
  getLoanSchedule,
  getNextDueInstallment,
  payInstallment,
  applyRateChange,
} from './loans';
import { listLoansDue } from './notificationData';
import { getMonthPaceInputs, getStillToPayThisMonth } from './reports';
import { estimatePurchase } from './purchaseAffordability';

beforeEach(async () => {
  jest.useFakeTimers().setSystemTime(new Date(2026, 9, 5, 12));
  mockTestDb = createRealDataTestDb();
  await mockTestDb.execAsync(CREATE_TABLES_SQL);
});
afterEach(() => jest.useRealTimers());

async function setup(startDate: string) {
  const account = await createAccount({
    name: 'Bank',
    type: 'bank',
    currency: 'INR',
    openingBalanceMinor: 15000,
  });
  const category = await createCategory({ name: 'EMI', kind: 'expense' });
  const loan = await createLoan({
    direction: 'borrowed',
    counterparty: 'Bank loan',
    principalMinor: 120000,
    interestRateAnnualBp: 0,
    tenureMonths: 12,
    startDate,
    linkedAccountId: account.id,
    rateType: 'floating',
  });
  return { account, category, loan };
}

it('keeps a defaulted loan in month bills, purchase estimates, next due and reminders', async () => {
  const { account, loan } = await setup('2026-10-10');
  await mockTestDb.runAsync("UPDATE loans SET status = 'defaulted' WHERE id = ?", [loan.id]);
  expect(await getStillToPayThisMonth('2026-10-05')).toBe(10000);
  expect((await getMonthPaceInputs('2026-10-05')).dueRestOfMonthMinor).toBe(10000);
  expect((await getNextDueInstallment())?.loanId).toBe(loan.id);
  expect((await listLoansDue()).map((row) => row.id)).toContain(loan.id);
  expect((await estimatePurchase(account.id, 10000, '2026-10-05')).shortfallMinor).toBe(5000);
  await mockTestDb.runAsync("UPDATE loans SET status = 'closed' WHERE id = ?", [loan.id]);
  expect(await getStillToPayThisMonth('2026-10-05')).toBe(0);
  expect(await getNextDueInstallment()).toBeNull();
});

it('keeps a stored overdue installment next in line and blocks paying a later installment first', async () => {
  const { account, category, loan } = await setup('2026-10-01');
  const [first, second] = await getLoanSchedule(loan.id);
  await mockTestDb.runAsync("UPDATE loan_payments SET status = 'overdue' WHERE id = ?", [first.id]);
  expect((await getLoanProgress()).find((row) => row.loanId === loan.id)?.nextDueDate).toBe(first.dueDate);
  expect((await getNextDueInstallment())?.dueDate).toBe(first.dueDate);
  expect((await listLoansDue())[0].dueDate).toBe(first.dueDate);
  expect(await getStillToPayThisMonth('2026-10-05')).toBe(10000);
  await expect(
    payInstallment(second.id, { accountId: account.id, categoryId: category.id, paidDate: '2026-10-05' })
  ).rejects.toThrow('earlier');
  expect(await getAccountBalance(account.id)).toBe(15000);
});

it('replaces overdue rows when recalculating a schedule instead of leaving duplicate installments', async () => {
  const { loan } = await setup('2026-10-01');
  const [first] = await getLoanSchedule(loan.id);
  await mockTestDb.runAsync("UPDATE loan_payments SET status = 'overdue' WHERE id = ?", [first.id]);
  await applyRateChange(loan.id, { newAnnualRateBp: 100, effectiveDate: '2026-10-05', mode: 'keepTenure' });
  const schedule = await getLoanSchedule(loan.id);
  expect(schedule).toHaveLength(12);
  expect(new Set(schedule.map((row) => row.installmentNumber)).size).toBe(12);
});

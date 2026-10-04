/**
 * What runs after a committed save (rebuilding reminders) must never turn the save into an error: the
 * row is already written, so a thrown rebuild would make the user retry and double-enter it.
 */
import { createRealDataTestDb } from '@/test-support/realDataTestDb';

const mockTestDb = createRealDataTestDb();
jest.mock('@/db/client', () => ({ getDb: async () => mockTestDb }));
jest.mock('@/lib/notifications', () => ({
  rebuildNotifications: jest.fn(async () => {
    throw new Error('scheduler unavailable');
  }),
}));

import { CREATE_TABLES_SQL } from '@/db/schema';
import { createAccount, createCategory } from '@/db/ledger';
import { createLoan, getLoanSchedule, payInstallment, undoInstallmentPayment } from '@/db/loans';
import { rebuildNotificationsAfterCommit } from '@/db/afterCommit';
import { rebuildNotifications } from '@/lib/notifications';

let warn: jest.SpyInstance;
beforeAll(async () => {
  await mockTestDb.execAsync(CREATE_TABLES_SQL);
  warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
});
afterAll(() => warn.mockRestore());

it('the helper swallows a rejecting rebuild', async () => {
  await expect(rebuildNotificationsAfterCommit()).resolves.toBeUndefined();
  expect(rebuildNotifications).toHaveBeenCalled();
});

it('paying and undoing an instalment still succeed when the reminder rebuild throws', async () => {
  const bank = (await createAccount({ name: 'Bank', type: 'bank', currency: 'INR', openingBalanceMinor: 0 }))
    .id;
  const emi = (await createCategory({ name: 'Loan EMI', kind: 'expense' })).id;
  const loan = await createLoan({
    direction: 'borrowed',
    counterparty: 'HDFC',
    principalMinor: 1200000,
    interestRateAnnualBp: 900,
    tenureMonths: 12,
    startDate: '2026-01-01',
  });
  const [first] = await getLoanSchedule(loan.id);
  await expect(
    payInstallment(first.id, { accountId: bank, categoryId: emi, paidDate: '2026-01-01' })
  ).resolves.not.toThrow();
  await expect(undoInstallmentPayment(first.id)).resolves.not.toThrow();
  const row = await mockTestDb.getFirstAsync<{ transaction_id: string | null }>(
    'SELECT transaction_id FROM loan_payments WHERE id = ?',
    [first.id]
  );
  expect(row?.transaction_id).toBeNull();
});

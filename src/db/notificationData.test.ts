import { createRealDataTestDb } from '@/test-support/realDataTestDb';
const mockDb = createRealDataTestDb();
jest.mock('@/db/client', () => ({ getDb: async () => mockDb }));
const mockRebuild = jest.fn(async () => true);
jest.mock('@/lib/notifications', () => ({ rebuildNotifications: () => mockRebuild() }));
import { updateTransaction, deleteTransaction, restoreTransaction } from './transactions';
import { CREATE_TABLES_SQL } from './schema';
import { getNotificationPrefs } from './settings';
import { hasLoggedOn } from './notificationData';

it('round-trips optional attention preferences and rejects non-boolean restored values', async () => {
  const base = await getNotificationPrefs();
  await mockDb.runAsync("INSERT OR REPLACE INTO settings (key,value) VALUES ('notification_prefs',?)", [
    JSON.stringify({ ...base, recurringAlerts: true, refundAlerts: true }),
  ]);
  expect(await getNotificationPrefs()).toMatchObject({ recurringAlerts: true, refundAlerts: true });
  await mockDb.runAsync("UPDATE settings SET value=? WHERE key='notification_prefs'", [
    JSON.stringify({ ...base, recurringAlerts: 'true', refundAlerts: 1 }),
  ]);
  expect(await getNotificationPrefs()).toMatchObject({ recurringAlerts: false, refundAlerts: false });
});

beforeAll(async () => {
  await mockDb.execAsync(CREATE_TABLES_SQL);
  await mockDb.runAsync(
    "INSERT INTO accounts (id, name, type, currency, opening_balance_minor) VALUES ('bank', 'Bank', 'bank', 'INR', 0)"
  );
  await mockDb.runAsync("INSERT INTO categories (id, name, kind) VALUES ('emi', 'Loan EMI', 'expense')");
  await mockDb.runAsync(
    "INSERT INTO loans (id, direction, counterparty, principal_minor, interest_rate_annual_bp, tenure_months, start_date, emi_amount_minor, outstanding_principal_minor) VALUES ('loan', 'borrowed', 'Home', 10000, 100, 1, '2026-10-01', 10000, 0)"
  );
  await mockDb.runAsync(
    "INSERT INTO transactions (id, type, account_id, category_id, amount_minor, date) VALUES ('payment', 'expense', 'bank', 'emi', 10000, '2026-10-13')"
  );
  await mockDb.runAsync(
    "INSERT INTO loan_payments (id, loan_id, installment_number, due_date, emi_amount_minor, principal_component_minor, interest_component_minor, outstanding_after_minor, status, transaction_id) VALUES ('p', 'loan', 1, '2026-10-13', 10000, 10000, 0, 0, 'paid', 'payment')"
  );
});

it('an EMI linked from the payment record does not suppress the manual logging reminder', async () => {
  expect(await hasLoggedOn('2026-10-13')).toBe(false);
});

it('a manual entry still suppresses that day, while other days remain unaffected', async () => {
  await mockDb.runAsync(
    "INSERT INTO transactions (id, type, account_id, category_id, amount_minor, date) VALUES ('manual', 'expense', 'bank', 'emi', 100, '2026-10-14')"
  );
  expect(await hasLoggedOn('2026-10-14')).toBe(true);
  expect(await hasLoggedOn('2026-10-15')).toBe(false);
});

it('editing, deleting and undoing a manual entry renew reminders only after the ledger is committed', async () => {
  await mockDb.runAsync(
    "INSERT INTO transactions (id, type, account_id, category_id, amount_minor, date) VALUES ('editing', 'expense', 'bank', 'emi', 100, '2026-10-16')"
  );
  const observed: boolean[] = [];
  mockRebuild.mockImplementation(async () => {
    observed.push(await hasLoggedOn('2026-10-17'));
    return true;
  });
  await updateTransaction('editing', {
    type: 'expense',
    accountId: 'bank',
    categoryId: 'emi',
    amountMinor: 100,
    date: '2026-10-17',
  });
  const removed = await deleteTransaction('editing');
  await restoreTransaction(removed);
  expect(observed).toEqual([true, false, true]);
});

it('malformed restored notification fields fall back safely instead of scheduling NaN dates', async () => {
  const defaults = await getNotificationPrefs();
  await mockDb.runAsync("INSERT OR REPLACE INTO settings (key, value) VALUES ('notification_prefs', ?)", [
    JSON.stringify({
      morningHour: 'bad',
      morningMinute: null,
      eveningHour: 99,
      eveningMinute: -10,
      morningEnabled: 'false',
      eveningEnabled: false,
    }),
  ]);
  const prefs = await getNotificationPrefs();
  expect(prefs.morningHour).toBe(defaults.morningHour);
  expect(prefs.morningMinute).toBe(defaults.morningMinute);
  expect(prefs.eveningHour).toBe(defaults.eveningHour);
  expect(prefs.eveningMinute).toBe(defaults.eveningMinute);
  expect(prefs.morningEnabled).toBe(defaults.morningEnabled);
  expect(prefs.eveningEnabled).toBe(false);
});

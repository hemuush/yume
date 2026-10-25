import { createRealDataTestDb } from '@/test-support/realDataTestDb';
const mockDb = createRealDataTestDb();
jest.mock('./client', () => ({ getDb: async () => mockDb }));
import { CREATE_TABLES_SQL } from './schema';
import { listReminderAttention } from './notificationData';
import * as settings from './settings';

beforeAll(async () => {
  jest.spyOn(settings, 'getHideSensitiveAmounts').mockResolvedValue(true);
  await mockDb.execAsync(CREATE_TABLES_SQL);
  await mockDb.runAsync(
    "INSERT INTO accounts (id,name,type) VALUES ('bank','Bank','bank'),('savings','Savings','savings')"
  );
  await mockDb.runAsync(
    "INSERT INTO categories (id,name,kind,is_sensitive) VALUES ('food','Food','expense',0),('private','Private','expense',1)"
  );
  for (const [id, type, active, category, account, end] of [
    ['bill', 'expense', 1, 'food', 'bank', null],
    ['paused', 'expense', 0, 'food', 'bank', null],
    ['salary', 'income', 1, 'food', 'bank', null],
    ['ended', 'expense', 1, 'food', 'bank', '2026-10-14'],
    ['hidden', 'expense', 1, 'private', 'bank', null],
    ['saved', 'expense', 1, 'food', 'savings', null],
  ] as const) {
    await mockDb.runAsync(
      "INSERT INTO recurring_rules (id,type,active,category_id,account_id,end_date,amount_minor,frequency,next_run_date,note) VALUES (?,?,?,?,?,?,1000,'monthly','2026-10-16',?)",
      [id, type, active, category, account, end, id]
    );
  }
  for (const [id, closed, date, category] of [
    ['pending', 0, '2026-10-15', 'food'],
    ['closed', 1, '2026-10-15', 'food'],
    ['settled', 0, '2026-10-15', 'food'],
    ['undated', 0, null, 'food'],
    ['private-refund', 0, '2026-10-15', 'private'],
  ] as const) {
    await mockDb.runAsync(
      "INSERT INTO transactions (id,type,account_id,category_id,amount_minor,date,note) VALUES (?,'expense','bank',?,1000,'2026-10-01',?)",
      [id, category, id]
    );
    await mockDb.runAsync(
      'INSERT INTO refund_expectations (id,transaction_id,expected_amount_minor,due_date,closed) VALUES (?,?,1000,?,?)',
      [id, id, date, closed]
    );
  }
  await mockDb.runAsync(
    "INSERT INTO transactions (id,type,account_id,category_id,amount_minor,date,is_refund) VALUES ('receipt','income','bank','food',1000,'2026-10-15',1)"
  );
  await mockDb.runAsync(
    "INSERT INTO refund_receipts (id,expectation_id,transaction_id) VALUES ('receipt','settled','receipt')"
  );
  await mockDb.runAsync(
    "INSERT INTO transactions (id,type,account_id,category_id,amount_minor,date,is_refund) VALUES ('partial','income','bank','food',400,'2026-10-15',1)"
  );
  await mockDb.runAsync(
    "INSERT INTO refund_receipts (id,expectation_id,transaction_id) VALUES ('partial','pending','partial')"
  );
});
afterAll(() => jest.restoreAllMocks());

it('includes active upcoming expenses and pending dated refunds, excluding paused/ended/private/settled entries', async () => {
  const rows = await listReminderAttention('2026-10-15', true, true);
  expect(rows).toEqual([
    { kind: 'bill', id: 'bill', label: 'bill', date: '2026-10-16' },
    { kind: 'refund', id: 'pending', label: 'pending', date: '2026-10-15' },
  ]);
  expect(await listReminderAttention('2026-10-15', false, false)).toEqual([]);
});

it('removes paused bills and closed refunds after changes, without creating ledger entries', async () => {
  const before = await mockDb.getFirstAsync<{ n: number }>('SELECT COUNT(*) n FROM transactions');
  await mockDb.runAsync("UPDATE recurring_rules SET active=0 WHERE id='bill'");
  await mockDb.runAsync("UPDATE refund_expectations SET closed=1 WHERE id='pending'");
  expect(await listReminderAttention('2026-10-15', true, true)).toEqual([]);
  expect(await mockDb.getFirstAsync('SELECT COUNT(*) n FROM transactions')).toEqual(before);
});

it('omits an active recurring child of an archived category and includes it after the parent is restored', async () => {
  await mockDb.runAsync(
    "INSERT INTO categories (id,name,kind,archived) VALUES ('archived-parent','Archived','expense',1)"
  );
  await mockDb.runAsync(
    "INSERT INTO categories (id,name,kind,parent_id) VALUES ('active-child','Active child','expense','archived-parent')"
  );
  await mockDb.runAsync(
    "INSERT INTO recurring_rules (id,type,active,category_id,account_id,amount_minor,frequency,next_run_date,note) VALUES ('child-bill','expense',1,'active-child','bank',1000,'monthly','2026-10-16','Child bill')"
  );
  expect(await listReminderAttention('2026-10-15', true, false)).toEqual([]);
  await mockDb.runAsync("UPDATE categories SET archived=0 WHERE id='archived-parent'");
  expect(await listReminderAttention('2026-10-15', true, false)).toEqual([
    { kind: 'bill', id: 'child-bill', label: 'Child bill', date: '2026-10-16' },
  ]);
});

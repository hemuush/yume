import { createRealDataTestDb } from '@/test-support/realDataTestDb';
import type { AppDb, SqlParam } from '@/db/dbTypes';

const mockRaw = createRealDataTestDb();
let mockQueue: Promise<unknown> = Promise.resolve();
function mockSerialize<T>(operation: () => Promise<T>): Promise<T> {
  const result = mockQueue.then(operation, operation);
  mockQueue = result.then(
    () => undefined,
    () => undefined
  );
  return result;
}

// Match the native boundary: each statement/whole transaction occupies one queue entry.
const mockDb: AppDb = {
  getFirstAsync: <T>(sql: string, params?: SqlParam[]) =>
    mockSerialize(() => mockRaw.getFirstAsync<T>(sql, params)),
  getAllAsync: <T>(sql: string, params?: SqlParam[]) =>
    mockSerialize(() => mockRaw.getAllAsync<T>(sql, params)),
  runAsync: (sql, params) => mockSerialize(() => mockRaw.runAsync(sql, params)),
  execAsync: (sql) => mockSerialize(() => mockRaw.execAsync(sql)),
  withTransactionAsync: (operation) => mockSerialize(() => mockRaw.withTransactionAsync(operation)),
  exclusiveAsync: (operation) => mockSerialize(() => operation(mockRaw)),
};
jest.mock('@/db/client', () => ({ getDb: async () => mockDb }));
jest.mock('@/lib/notifications', () => ({ rebuildNotifications: jest.fn(async () => true) }));

import { CREATE_TABLES_SQL } from '@/db/schema';
import { createAccount, getAccountBalance } from '@/db/accounts';
import { createCategory } from '@/db/categories';
import { createTransaction, type CreateTransactionInput } from '@/db/transactions';
import { rebuildNotifications } from '@/lib/notifications';
import { toLocalIsoDate } from '@/lib/date';

let input: CreateTransactionInput;
let destinationId: string;

beforeAll(async () => {
  await mockDb.execAsync(CREATE_TABLES_SQL);
  const account = await createAccount({ name: 'Bank', type: 'bank', currency: 'INR' });
  destinationId = (await createAccount({ name: 'Cash', type: 'cash', currency: 'INR' })).id;
  const category = await createCategory({ name: 'Food', kind: 'expense' });
  input = {
    type: 'expense',
    accountId: account.id,
    categoryId: category.id,
    amountMinor: 12500,
    date: '2020-01-01',
    note: 'Lunch',
  };
});

beforeEach(async () => {
  await mockDb.runAsync('DELETE FROM transactions');
});

afterEach(() => jest.restoreAllMocks());

async function entryCount(): Promise<number> {
  const row = await mockDb.getFirstAsync<{ count: number }>('SELECT COUNT(*) AS count FROM transactions');
  if (!row) throw new Error('Count query returned no row');
  return row.count;
}

function failResultRead(): void {
  const original = mockRaw.getFirstAsync.bind(mockRaw);
  jest.spyOn(mockRaw, 'getFirstAsync').mockImplementation(async (sql, params) => {
    if (sql === 'SELECT * FROM transactions WHERE id = ?') throw new Error('Result read failed');
    return original(sql, params);
  });
}

it('leaves no entry or balance change when reading the saved entry fails', async () => {
  failResultRead();
  await expect(createTransaction(input)).rejects.toThrow('Result read failed');
  expect(await entryCount()).toBe(0);
  expect(await getAccountBalance(input.accountId)).toBe(0);
  expect(rebuildNotifications).not.toHaveBeenCalled();
});

it('leaves no entry when the inserted row cannot be found', async () => {
  const original = mockRaw.getFirstAsync.bind(mockRaw);
  jest.spyOn(mockRaw, 'getFirstAsync').mockImplementation(async (sql, params) => {
    if (sql === 'SELECT * FROM transactions WHERE id = ?') return null;
    return original(sql, params);
  });
  await expect(createTransaction(input)).rejects.toThrow('This entry no longer exists');
  expect(await entryCount()).toBe(0);
});

it('saves exactly one entry when retrying after a failed result read', async () => {
  failResultRead();
  await expect(createTransaction(input)).rejects.toThrow('Result read failed');
  jest.restoreAllMocks();
  const saved = await createTransaction(input);
  expect(saved).toMatchObject(input);
  expect(await entryCount()).toBe(1);
  expect(await getAccountBalance(input.accountId)).toBe(-input.amountMinor);
});

it('saves overlapping entries without blocking the database queue', async () => {
  const saved = await Promise.all([
    createTransaction(input),
    createTransaction({ ...input, note: 'Dinner' }),
  ]);
  expect(new Set(saved.map((entry) => entry.id)).size).toBe(2);
  expect(await entryCount()).toBe(2);
  expect(await getAccountBalance(input.accountId)).toBe(-2 * input.amountMinor);
});

it('returns a transfer and updates both account balances together', async () => {
  const transfer: CreateTransactionInput = {
    type: 'transfer',
    accountId: input.accountId,
    toAccountId: destinationId,
    amountMinor: input.amountMinor,
    date: input.date,
  };
  expect(await createTransaction(transfer)).toMatchObject(transfer);
  expect(await getAccountBalance(input.accountId)).toBe(-input.amountMinor);
  expect(await getAccountBalance(destinationId)).toBe(input.amountMinor);
});

it('keeps a committed income save successful when reminder refresh fails', async () => {
  const category = await createCategory({ name: 'Salary', kind: 'income' });
  const income: CreateTransactionInput = {
    ...input,
    type: 'income',
    categoryId: category.id,
    date: toLocalIsoDate(new Date()),
  };
  let savedWhenReminderRuns: number | null = null;
  const reminderError = new Error('Reminder unavailable');
  jest.mocked(rebuildNotifications).mockImplementationOnce(async () => {
    savedWhenReminderRuns = await entryCount();
    throw reminderError;
  });
  const warning = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
  await expect(createTransaction(income)).resolves.toMatchObject(income);
  expect(savedWhenReminderRuns).toBe(1);
  expect(rebuildNotifications).toHaveBeenCalledTimes(1);
  expect(warning).toHaveBeenCalledWith('Post-save notification check failed:', reminderError);
  expect(await getAccountBalance(input.accountId)).toBe(input.amountMinor);
});

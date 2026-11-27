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
import { archiveAccount, createAccount, getAccountBalance, updateAccount } from '@/db/accounts';
import { createCategory } from '@/db/categories';
import { createTransaction, updateTransaction, type CreateTransactionInput } from '@/db/transactions';
import { readEntryDraft, writeEntryDraft, writeEntryDraftOn } from '@/db/entryDraft';
import { createRecurringRule, runDueRecurringRules, setRecurringRuleActive } from '@/db/recurring';
import type { EntryDraft } from '@/features/add/entryDraft';
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

it('rolls back an edit when reading its saved result fails', async () => {
  const saved = await createTransaction(input);
  const original = mockRaw.getFirstAsync.bind(mockRaw);
  let entryReads = 0;
  jest.spyOn(mockRaw, 'getFirstAsync').mockImplementation(async (sql, params) => {
    if (sql === 'SELECT * FROM transactions WHERE id = ?' && ++entryReads === 2) {
      throw new Error('Edited result read failed');
    }
    return original(sql, params);
  });

  await expect(updateTransaction(saved.id, { ...input, amountMinor: 90 })).rejects.toThrow(
    'Edited result read failed'
  );
  expect(await getAccountBalance(input.accountId)).toBe(-input.amountMinor);
});

it('rejects conversion to savings when a concurrent expense commits first', async () => {
  const original = mockDb.withTransactionAsync.bind(mockDb);
  jest.spyOn(mockDb, 'withTransactionAsync').mockImplementationOnce(async (operation) => {
    await createTransaction(input);
    return original(operation);
  });

  await expect(
    updateAccount(input.accountId, { name: 'Savings', type: 'savings', openingBalanceMinor: 0 })
  ).rejects.toThrow('a savings account only takes transfers');
  expect(await entryCount()).toBe(1);
});

it('rejects resuming a recurring rule on an archived account and blocks stale active rules', async () => {
  const account = await createAccount({ name: 'Recurring bank', type: 'bank', currency: 'INR' });
  const rule = await createRecurringRule({
    ...input,
    accountId: account.id,
    frequency: 'monthly',
    intervalCount: 1,
    nextRunDate: input.date,
  });
  await archiveAccount(account.id);
  await expect(setRecurringRuleActive(rule.id, true, input.date)).rejects.toThrow(/Unarchive/);

  await mockDb.runAsync('UPDATE recurring_rules SET active = 1 WHERE id = ?', [rule.id]);
  expect(await runDueRecurringRules(input.date)).toBe(0);
  expect(await entryCount()).toBe(0);
});

it('commits a draft checkpoint with each entry and rolls both back if the checkpoint fails', async () => {
  const draft: EntryDraft = {
    type: 'expense',
    expr: '90',
    accountId: input.accountId,
    toAccountId: null,
    categoryId: input.categoryId ?? null,
    note: '',
    paymentMode: null,
    date: input.date,
    personId: null,
    friendSign: 1,
    friendAccountId: null,
    refund: false,
    rows: [],
    splitParts: null,
  };
  await writeEntryDraft({ ...draft, expr: '125' });
  await createTransaction({ ...input, afterWrite: (tx) => writeEntryDraftOn(tx, draft) });
  expect(await readEntryDraft()).toEqual(draft);
  await expect(
    createTransaction({
      ...input,
      amountMinor: 9000,
      afterWrite: async (tx) => {
        await writeEntryDraftOn(tx, null);
        throw new Error('Checkpoint failed');
      },
    })
  ).rejects.toThrow('Checkpoint failed');
  expect(await entryCount()).toBe(1);
  expect(await readEntryDraft()).toEqual(draft);
  await createTransaction({ ...input, amountMinor: 9000, afterWrite: (tx) => writeEntryDraftOn(tx, null) });
  expect(await entryCount()).toBe(2);
  expect(await readEntryDraft()).toBeNull();
});

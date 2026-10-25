import { createRealDataTestDb } from '@/test-support/realDataTestDb';

let mockTestDb: ReturnType<typeof createRealDataTestDb>;
jest.mock('@/db/client', () => ({ getDb: async () => mockTestDb }));
jest.mock('@/lib/notifications', () => ({ rebuildNotifications: async () => true }));

import { CREATE_TABLES_SQL } from './schema';
import { createAccount, createCategory } from './ledger';
import { addLedgerEntry, createPerson } from './people';
import { createLoan } from './loans';
import { createRecurringRule } from './recurring';

beforeEach(() => {
  mockTestDb = createRealDataTestDb();
  return mockTestDb.execAsync(CREATE_TABLES_SQL);
});
afterEach(() => jest.restoreAllMocks());

it.each(['person_ledger_entries', 'recurring_rules'])('rolls back a failed %s result read', async (table) => {
  const personId = (await createPerson({ name: `Friend for ${table}` })).id;
  const accountId = (await createAccount({ name: 'Rule bank', type: 'bank', currency: 'INR' })).id;
  const categoryId = (await createCategory({ name: `Category for ${table}`, kind: 'expense' })).id;
  const create =
    table === 'person_ledger_entries'
      ? () => addLedgerEntry({ personId, amountMinor: 1000, date: '2026-10-01' })
      : () =>
          createRecurringRule({
            type: 'expense',
            accountId,
            categoryId,
            amountMinor: 1000,
            frequency: 'monthly',
            intervalCount: 1,
            nextRunDate: '2026-11-01',
          });
  const read = mockTestDb.getFirstAsync.bind(mockTestDb);
  const spy = jest.spyOn(mockTestDb, 'getFirstAsync').mockImplementation(async (sql, params) => {
    if (sql === `SELECT * FROM ${table} WHERE id = ?`) throw new Error('Read failed');
    return read(sql, params);
  });
  await expect(create()).rejects.toThrow('Read failed');
  spy.mockRestore();
  expect(await mockTestDb.getFirstAsync(`SELECT COUNT(*) AS n FROM ${table}`)).toEqual({ n: 0 });
  await create();
  expect(await mockTestDb.getFirstAsync(`SELECT COUNT(*) AS n FROM ${table}`)).toEqual({ n: 1 });
});

it.each([
  ['accounts', () => createAccount({ name: 'Bank', type: 'bank', currency: 'INR' })],
  ['people', () => createPerson({ name: 'Friend' })],
] as const)(
  'rolls back %s creation if its result cannot be read, so retry creates once',
  async (table, create) => {
    const read = mockTestDb.getFirstAsync.bind(mockTestDb);
    const spy = jest.spyOn(mockTestDb, 'getFirstAsync').mockImplementation(async (sql, params) => {
      if (sql === `SELECT * FROM ${table} WHERE id = ?`) throw new Error('Read failed');
      return read(sql, params);
    });
    await expect(create()).rejects.toThrow('Read failed');
    spy.mockRestore();
    expect(await mockTestDb.getFirstAsync(`SELECT COUNT(*) AS n FROM ${table}`)).toEqual({ n: 0 });
    await create();
    expect(await mockTestDb.getFirstAsync(`SELECT COUNT(*) AS n FROM ${table}`)).toEqual({ n: 1 });
  }
);

it('rolls back the loan, schedule and disbursement together if the result read fails', async () => {
  const accountId = (await createAccount({ name: 'Loan bank', type: 'bank', currency: 'INR' })).id;
  const categoryId = (await createCategory({ name: 'Loan received', kind: 'income' })).id;
  const input = {
    direction: 'borrowed' as const,
    counterparty: 'Test lender',
    principalMinor: 120000,
    interestRateAnnualBp: 0,
    tenureMonths: 12,
    startDate: '2026-10-01',
    disbursement: { accountId, categoryId },
  };
  const read = mockTestDb.getFirstAsync.bind(mockTestDb);
  const spy = jest.spyOn(mockTestDb, 'getFirstAsync').mockImplementation(async (sql, params) => {
    if (sql === 'SELECT * FROM loans WHERE id = ?') throw new Error('Read failed');
    return read(sql, params);
  });
  await expect(createLoan(input)).rejects.toThrow('Read failed');
  spy.mockRestore();
  for (const table of ['loans', 'loan_payments', 'transactions']) {
    expect(await mockTestDb.getFirstAsync(`SELECT COUNT(*) AS n FROM ${table}`)).toEqual({ n: 0 });
  }
  await createLoan(input);
  expect(await mockTestDb.getFirstAsync('SELECT COUNT(*) AS n FROM loans')).toEqual({ n: 1 });
  expect(await mockTestDb.getFirstAsync('SELECT COUNT(*) AS n FROM loan_payments')).toEqual({ n: 12 });
  expect(await mockTestDb.getFirstAsync('SELECT COUNT(*) AS n FROM transactions')).toEqual({ n: 1 });
});

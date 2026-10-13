import { createRealDataTestDb } from '@/test-support/realDataTestDb';
const mockDb = createRealDataTestDb();
jest.mock('@/db/client', () => ({ getDb: async () => mockDb }));
import { CREATE_TABLES_SQL } from './schema';
import { createAccount, createCategory, createTransaction, listTransactions } from './ledger';
import { expenseLabelTotals, listExpenseLabels } from './expenseLabels';
import { setDefaultCurrency } from './settings';

beforeAll(async () => {
  await mockDb.execAsync(CREATE_TABLES_SQL);
  await setDefaultCurrency('INR');
  const bank = (
    await createAccount({ name: 'Bank', type: 'bank', currency: 'INR', openingBalanceMinor: 100000 })
  ).id;
  const usd = (await createAccount({ name: 'US', type: 'bank', currency: 'USD', openingBalanceMinor: 0 })).id;
  const food = (await createCategory({ name: 'Food', kind: 'expense' })).id;
  const privateId = (await createCategory({ name: 'Private', kind: 'expense', isSensitive: true })).id;
  for (const row of [
    { accountId: bank, categoryId: food, amountMinor: 1000, note: 'Lunch', date: '2026-10-01' },
    { accountId: bank, categoryId: food, amountMinor: 2000, note: 'Lunch', date: '2026-10-02' },
    { accountId: bank, categoryId: food, amountMinor: 500, note: '', date: '2026-10-03' },
    { accountId: bank, categoryId: privateId, amountMinor: 900, note: 'Secret', date: '2026-10-03' },
    { accountId: usd, categoryId: food, amountMinor: 5000, note: 'Foreign', date: '2026-10-03' },
  ])
    await createTransaction({ type: 'expense', ...row });
  await createTransaction({
    type: 'income',
    isRefund: true,
    accountId: bank,
    categoryId: food,
    amountMinor: 400,
    note: 'Lunch',
    date: '2026-10-04',
  });
  const parent = (await createCategory({ name: 'Group', kind: 'expense' })).id;
  await createCategory({ name: 'Hidden child', kind: 'expense', parentId: parent, isSensitive: true });
  const sibling = (await createCategory({ name: 'Sibling', kind: 'expense', parentId: parent })).id;
  await createTransaction({
    type: 'expense',
    accountId: bank,
    categoryId: sibling,
    amountMinor: 700,
    note: 'Hidden sibling',
    date: '2026-10-03',
  });
  const salary = (await createCategory({ name: 'Salary', kind: 'income' })).id;
  await createTransaction({
    type: 'income',
    accountId: bank,
    categoryId: salary,
    amountMinor: 1000,
    note: 'Salary',
    date: '2026-10-04',
  });
});
it('reuses old expense text, without including unrelated income/currencies', async () => {
  expect(await listExpenseLabels('', true)).toEqual(['Lunch']);
  expect(await listExpenseLabels('un', true)).toEqual(['Lunch']);
  expect(await listExpenseLabels('%', true)).toEqual([]);
});
it('totals labels net of refunds, preserves unlabeled entries and privacy', async () => {
  const rows = await expenseLabelTotals('2026-10-01', '2026-10-04', true);
  expect(rows).toEqual([
    { label: 'Lunch', totalMinor: 2600, count: 2 },
    { label: '', totalMinor: 500, count: 1 },
  ]);
  expect((await listTransactions()).filter((tx) => tx.note === 'Lunch')).toHaveLength(3);
});
it('uses the selected date range and retains sensitive labels when allowed', async () => {
  expect(await expenseLabelTotals('2026-10-04', '2026-10-04', false)).toEqual([
    { label: 'Lunch', totalMinor: -400, count: 0 },
  ]);
  expect(await listExpenseLabels('', false)).toContain('Secret');
});

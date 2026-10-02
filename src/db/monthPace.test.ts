/**
 * getMonthPaceInputs against a real SQLite engine: everyday spending leaves
 * out system categories, other months and other currencies; "still due"
 * counts pending EMIs and active recurring expenses after today and before
 * the month ends — and nothing else.
 */
import { createRealDataTestDb } from '@/test-support/realDataTestDb';

const mockTestDb = createRealDataTestDb();
jest.mock('@/db/client', () => ({
  getDb: async () => mockTestDb,
}));
jest.mock('@/lib/notifications', () => ({
  notifyOverspend: async () => {},
}));

import { CREATE_TABLES_SQL } from '@/db/schema';
import { createAccount, createCategory, createTransaction } from '@/db/ledger';
import { getMonthPaceInputs, getStillToPayThisMonth } from '@/db/reports';

const run = (sql: string, params: any[] = []) => mockTestDb.runAsync(sql, params);

beforeAll(async () => {
  await mockTestDb.execAsync(CREATE_TABLES_SQL);
  const bank = (await createAccount({ name: 'Bank', type: 'bank', currency: 'INR', openingBalanceMinor: 0 }))
    .id;
  const usd = (await createAccount({ name: 'Card', type: 'bank', currency: 'USD', openingBalanceMinor: 0 }))
    .id;
  const food = (await createCategory({ name: 'Food', kind: 'expense' })).id;
  await run(`INSERT INTO categories (id, name, kind, is_system) VALUES ('emi', 'Loan EMI', 'expense', 1)`);

  const spend = (accountId: string, categoryId: string, amountMinor: number, date: string) =>
    createTransaction({ type: 'expense', accountId, categoryId, amountMinor, date });
  await spend(bank, food, 30000, '2026-09-02');
  await spend(bank, food, 20000, '2026-09-26');
  await spend(bank, 'emi', 1800000, '2026-09-05'); // system: not everyday
  await spend(bank, food, 99900, '2026-08-30'); // last month
  await spend(usd, food, 5000, '2026-09-10'); // another currency
  await spend(bank, food, 7000, '2026-09-28'); // after today

  await run(
    `INSERT INTO loans (id, direction, counterparty, principal_minor, interest_rate_annual_bp, tenure_months,
       start_date, emi_amount_minor, outstanding_principal_minor)
     VALUES ('l1', 'borrowed', 'Home', 1000000, 900, 12, '2026-01-01', 90000, 800000)`
  );
  const installment = (n: number, due: string, status = 'pending') =>
    run(
      `INSERT INTO loan_payments (id, loan_id, installment_number, due_date, emi_amount_minor,
         principal_component_minor, interest_component_minor, outstanding_after_minor, status)
       VALUES (?, 'l1', ?, ?, 90000, 80000, 10000, 0, ?)`,
      [`p${n}`, n, due, status]
    );
  await installment(1, '2026-09-10', 'paid');
  await installment(2, '2026-09-29'); // still due this month
  await installment(3, '2026-10-29'); // next month

  const rule = (id: string, type: string, amountMinor: number, next: string, active = 1) =>
    run(
      `INSERT INTO recurring_rules (id, type, account_id, category_id, amount_minor, frequency, next_run_date, active)
       VALUES (?, ?, ?, ?, ?, 'monthly', ?, ?)`,
      [id, type, bank, food, amountMinor, next, active]
    );
  await rule('r1', 'expense', 29900, '2026-09-30'); // due this month
  await rule('r2', 'expense', 50000, '2026-09-30', 0); // paused
  await rule('r3', 'income', 100000, '2026-09-30'); // income, not a bill
  await rule('r4', 'expense', 11100, '2026-10-01'); // next month
});

it('adds up everyday spending so far, and what is still due this month', async () => {
  expect(await getMonthPaceInputs('2026-09-26')).toEqual({
    everydaySpentMinor: 50000,
    dueRestOfMonthMinor: 90000 + 29900,
  });
});

it('counts nothing as still due on the last day of the month', async () => {
  expect((await getMonthPaceInputs('2026-09-30')).dueRestOfMonthMinor).toBe(0);
});

describe('getStillToPayThisMonth', () => {
  it('adds pending EMIs this month and recurring bills still ahead', async () => {
    expect(await getStillToPayThisMonth('2026-09-26')).toBe(90000 + 29900);
  });

  it('counts an EMI due today', async () => {
    expect(await getStillToPayThisMonth('2026-09-29')).toBe(90000 + 29900);
  });

  it('counts an overdue pending EMI from earlier this month, but not a recurring bill due today (already posted)', async () => {
    expect(await getStillToPayThisMonth('2026-09-30')).toBe(90000);
  });

  it('only looks at the month it is given', async () => {
    expect(await getStillToPayThisMonth('2026-10-05')).toBe(90000);
  });
});

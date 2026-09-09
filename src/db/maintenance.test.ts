/**
 * `roundLedgerAmountsToWholeRupees` (the Settings "Round off amounts" action)
 * against a real SQLite engine: it rounds stored ledger amounts to whole
 * rupees, leaves the loan tables and loan-linked transactions exactly as
 * they were, respects the `amount_minor > 0` CHECK, and runs atomically.
 */
import { createRealDataTestDb } from '@/test-support/realDataTestDb';

const mockTestDb = createRealDataTestDb();
jest.mock('@/db/client', () => ({
  getDb: async () => mockTestDb,
}));

import { CREATE_TABLES_SQL } from '@/db/schema';
import { countFractionalLedgerAmounts, roundLedgerAmountsToWholeRupees } from '@/db/maintenance';

const run = (sql: string, params: any[] = []) => mockTestDb.runAsync(sql, params);

/** Read a single numeric column from a single row. */
async function col(table: string, column: string, id: string): Promise<number> {
  const row = await mockTestDb.getFirstAsync<Record<string, number>>(
    `SELECT ${column} AS v FROM ${table} WHERE id = ?`,
    [id]
  );
  return row!.v;
}

beforeAll(async () => {
  await mockTestDb.execAsync(CREATE_TABLES_SQL);

  await run(`INSERT INTO accounts (id, name, type, currency, opening_balance_minor, credit_limit_minor)
             VALUES ('acc1', 'Bank', 'bank', 'INR', 500055, NULL)`);
  await run(`INSERT INTO accounts (id, name, type, currency, opening_balance_minor, credit_limit_minor)
             VALUES ('acc2', 'Card', 'credit_card', 'INR', 0, 2500049)`);
  await run(`INSERT INTO categories (id, name, kind) VALUES ('cat1', 'Food', 'expense')`);

  // plain transactions with paise
  await run(`INSERT INTO transactions (id, type, account_id, category_id, amount_minor, date)
             VALUES ('t1', 'expense', 'acc1', 'cat1', 20555, '2026-01-01')`); // ₹205.55 -> ₹206
  await run(`INSERT INTO transactions (id, type, account_id, category_id, amount_minor, date)
             VALUES ('t2', 'expense', 'acc1', 'cat1', 40, '2026-01-02')`); // 40 paise -> clamped to ₹1
  await run(`INSERT INTO transactions (id, type, account_id, category_id, amount_minor, date)
             VALUES ('t3', 'income', 'acc1', 'cat1', 100000, '2026-01-03')`); // already whole -> untouched

  // a loan + its disbursement transaction: both must stay exact
  await run(`INSERT INTO loans (id, direction, counterparty, principal_minor, interest_rate_annual_bp,
               tenure_months, start_date, emi_amount_minor, outstanding_principal_minor)
             VALUES ('loan1', 'borrowed', 'HDFC', 12411433, 760, 216, '2026-01-01', 107472, 12411433)`);
  await run(`INSERT INTO transactions (id, type, account_id, category_id, amount_minor, date, loan_id)
             VALUES ('t4', 'income', 'acc1', 'cat1', 12411433, '2026-01-01', 'loan1')`);
  await run(`INSERT INTO loan_payments (id, loan_id, installment_number, due_date, emi_amount_minor,
               principal_component_minor, interest_component_minor, outstanding_after_minor)
             VALUES ('lp1', 'loan1', 1, '2026-02-01', 107472, 28850, 78622, 12382583)`);

  // person ledger entry with paise, and a negative one
  await run(`INSERT INTO people (id, name) VALUES ('p1', 'Sam')`);
  await run(`INSERT INTO person_ledger_entries (id, person_id, amount_minor, date)
             VALUES ('ple1', 'p1', 75033, '2026-01-01')`); // ₹750.33 -> ₹750
  await run(`INSERT INTO person_ledger_entries (id, person_id, amount_minor, date)
             VALUES ('ple2', 'p1', -25099, '2026-01-02')`); // -₹250.99 -> -₹251
});

it('counts every stored amount that still carries paise (loan tables excluded)', async () => {
  const counts = await countFractionalLedgerAmounts();
  expect(counts.transactions).toBe(2); // t1, t2 — not t3 (whole), not t4 (loan-linked)
  expect(counts.accounts).toBe(2); // acc1 opening, acc2 credit limit
  expect(counts.personLedgerEntries).toBe(2);
  expect(counts.total).toBe(6);
});

it('rounds ledger amounts to whole rupees and reports the count changed', async () => {
  const changed = await roundLedgerAmountsToWholeRupees();
  expect(changed.total).toBe(6);

  expect(await col('transactions', 'amount_minor', 't1')).toBe(20600);
  expect(await col('transactions', 'amount_minor', 't2')).toBe(100); // CHECK guard: not 0
  expect(await col('transactions', 'amount_minor', 't3')).toBe(100000);

  expect(await col('accounts', 'opening_balance_minor', 'acc1')).toBe(500100);
  expect(await col('accounts', 'credit_limit_minor', 'acc2')).toBe(2500000);

  expect(await col('person_ledger_entries', 'amount_minor', 'ple1')).toBe(75000);
  expect(await col('person_ledger_entries', 'amount_minor', 'ple2')).toBe(-25100);
});

it('never touches the loan tables or loan-linked transactions', async () => {
  expect(await col('transactions', 'amount_minor', 't4')).toBe(12411433);
  expect(await col('loans', 'principal_minor', 'loan1')).toBe(12411433);
  expect(await col('loan_payments', 'principal_component_minor', 'lp1')).toBe(28850);
  expect(await col('loan_payments', 'interest_component_minor', 'lp1')).toBe(78622);
  expect(await col('loan_payments', 'outstanding_after_minor', 'lp1')).toBe(12382583);
});

it('is idempotent — a second run changes nothing', async () => {
  const again = await roundLedgerAmountsToWholeRupees();
  expect(again.total).toBe(0);
  expect((await countFractionalLedgerAmounts()).total).toBe(0);
});

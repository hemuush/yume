/**
 * getLoanPaymentContext against a real SQLite engine: the next pending EMI,
 * the loan's own account (or the first one if it's gone), and the "Loan EMI"
 * category — the same choices the loan's screen makes.
 */
import { createRealDataTestDb } from '@/test-support/realDataTestDb';

const mockTestDb = createRealDataTestDb();
jest.mock('@/db/client', () => ({ getDb: async () => mockTestDb }));
jest.mock('@/lib/notifications', () => ({ rebuildNotifications: async () => {} }));

import { CREATE_TABLES_SQL } from '@/db/schema';
import { createAccount, createCategory } from '@/db/ledger';
import { getLoanPaymentContext } from '@/db/loans';

const run = (sql: string, params: any[] = []) => mockTestDb.runAsync(sql, params);
let first: string;
let linked: string;
let emi: string;

beforeAll(async () => {
  await mockTestDb.execAsync(CREATE_TABLES_SQL);
  first = (await createAccount({ name: 'First', type: 'bank', currency: 'INR', openingBalanceMinor: 0 })).id;
  linked = (await createAccount({ name: 'Linked', type: 'bank', currency: 'INR', openingBalanceMinor: 0 }))
    .id;
  await createCategory({ name: 'Food', kind: 'expense' });
  emi = (await createCategory({ name: 'Loan EMI', kind: 'expense' })).id;
  await run(
    `INSERT INTO loans (id, direction, counterparty, principal_minor, interest_rate_annual_bp, tenure_months,
       start_date, emi_amount_minor, outstanding_principal_minor, linked_account_id)
     VALUES ('l1', 'borrowed', 'Home', 1000000, 900, 12, '2026-01-01', 90000, 800000, ?)`,
    [linked]
  );
  const installment = (n: number, due: string, status: string) =>
    run(
      `INSERT INTO loan_payments (id, loan_id, installment_number, due_date, emi_amount_minor,
         principal_component_minor, interest_component_minor, outstanding_after_minor, status)
       VALUES (?, 'l1', ?, ?, 90000, 80000, 10000, 0, ?)`,
      [`p${n}`, n, due, status]
    );
  await installment(1, '2026-09-05', 'paid');
  await installment(2, '2026-10-05', 'pending');
  await installment(3, '2026-11-05', 'pending');
});

it("finds the next EMI, the loan's own account and the Loan EMI category", async () => {
  const ctx = await getLoanPaymentContext('l1');
  expect(ctx?.installment).toMatchObject({
    installmentNumber: 2,
    dueDate: '2026-10-05',
    emiAmountMinor: 90000,
  });
  expect(ctx?.account).toEqual({ id: linked, name: 'Linked' });
  expect(ctx?.categoryId).toBe(emi);
});

it('falls back to the first account when the linked one is archived', async () => {
  await run('UPDATE accounts SET archived = 1 WHERE id = ?', [linked]);
  expect((await getLoanPaymentContext('l1'))?.account?.id).toBe(first);
});

it('has nothing to pay once every EMI is paid, or for an unknown loan', async () => {
  await run(`UPDATE loan_payments SET status = 'paid'`);
  expect(await getLoanPaymentContext('l1')).toBeNull();
  expect(await getLoanPaymentContext('nope')).toBeNull();
});

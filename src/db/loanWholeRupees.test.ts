/** The one-time move of loans saved with paise to whole rupees: balance, EMI, schedule and paid entries. */
import { createRealDataTestDb } from '@/test-support/realDataTestDb';

const mockDb: any = createRealDataTestDb();
jest.mock('@/db/client', () => ({ getDb: async () => mockDb }));
jest.mock('@/lib/notifications', () => ({ rebuildNotifications: async () => {} }));

import { CREATE_TABLES_SQL } from '@/db/schema';
import { convertLoansToWholeRupees } from '@/db/loanWholeRupees';

const run = (sql: string, p: unknown[] = []) => mockDb.runAsync(sql, p);
const one = <T>(sql: string, p: unknown[] = []) => mockDb.getFirstAsync(sql, p) as Promise<T | null>;
const all = <T>(sql: string, p: unknown[] = []) => mockDb.getAllAsync(sql, p) as Promise<T[]>;

beforeAll(async () => {
  await mockDb.execAsync(CREATE_TABLES_SQL);
  await run(
    "INSERT INTO accounts (id, name, type, currency, opening_balance_minor) VALUES ('a','Bank','bank','INR',0)"
  );
  await run("INSERT INTO categories (id, name, kind) VALUES ('c','EMI','expense')");
});

/** A loan the way an older version saved it: paise EMI, one EMI paid, the rest pending. */
async function oldLoan(id: string, status = 'active') {
  await run(
    `INSERT INTO loans (id, direction, counterparty, principal_minor, interest_rate_annual_bp, tenure_months, start_date,
       emi_amount_minor, outstanding_principal_minor, status)
     VALUES (?, 'borrowed', ?, 1000000, 0, 10, '2026-01-01', 100050, 900050, ?)`,
    [id, id, status]
  );
  await run(
    "INSERT INTO transactions (id, type, account_id, category_id, amount_minor, date) VALUES (?, 'expense', 'a', 'c', 100050, '2026-01-01')",
    [`${id}-tx`]
  );
  await run(
    `INSERT INTO loan_payments (id, loan_id, installment_number, due_date, emi_amount_minor, principal_component_minor,
       interest_component_minor, outstanding_after_minor, status, paid_date, transaction_id)
     VALUES (?, ?, 1, '2026-01-01', 100050, 100050, 0, 900050, 'paid', '2026-01-01', ?)`,
    [`${id}-p1`, id, `${id}-tx`]
  );
  let left = 900050;
  for (let n = 2; n <= 10; n++) {
    const principal = n === 10 ? left : 100050;
    left -= principal;
    await run(
      `INSERT INTO loan_payments (id, loan_id, installment_number, due_date, emi_amount_minor, principal_component_minor,
         interest_component_minor, outstanding_after_minor, status)
       VALUES (?, ?, ?, ?, ?, ?, 0, ?, 'pending')`,
      [`${id}-p${n}`, id, n, `2026-${String(n).padStart(2, '0')}-01`, principal, principal, left]
    );
  }
}

it('brings an active loan, its pending schedule and its paid entry to whole rupees, once', async () => {
  await oldLoan('L1');
  expect(await convertLoansToWholeRupees()).toBe(1);
  const loan = await one<{ emi_amount_minor: number; outstanding_principal_minor: number }>(
    "SELECT * FROM loans WHERE id = 'L1'"
  );
  expect(loan).toMatchObject({ emi_amount_minor: 100100, outstanding_principal_minor: 900100 });
  const pending = await all<{
    emi_amount_minor: number;
    principal_component_minor: number;
    outstanding_after_minor: number;
  }>("SELECT * FROM loan_payments WHERE loan_id = 'L1' AND status = 'pending' ORDER BY installment_number");
  expect(pending.length).toBeLessThanOrEqual(9);
  expect(pending.every((p) => p.emi_amount_minor % 100 === 0 && p.outstanding_after_minor % 100 === 0)).toBe(
    true
  );
  expect(pending[pending.length - 1].outstanding_after_minor).toBe(0);
  expect(pending.reduce((s, p) => s + p.principal_component_minor, 0)).toBe(900100);
  const entry = await one<{ amount_minor: number }>(
    "SELECT amount_minor FROM transactions WHERE id = 'L1-tx'"
  );
  expect(entry?.amount_minor).toBe(100100);
  expect(await convertLoansToWholeRupees()).toBe(0);
});

it('leaves a closed loan as it was', async () => {
  await run("DELETE FROM settings WHERE key = 'loans_whole_rupees_v1'");
  await oldLoan('L2', 'closed');
  expect(await convertLoansToWholeRupees()).toBe(0);
  const loan = await one<{ emi_amount_minor: number }>("SELECT * FROM loans WHERE id = 'L2'");
  expect(loan?.emi_amount_minor).toBe(100050);
});

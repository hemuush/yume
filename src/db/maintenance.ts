import { getDb } from './client';

/**
 * One-off data hygiene the user triggers from Settings.
 *
 * The app now quantizes every newly entered amount to a whole rupee (see
 * `toMinor` in src/lib/money.ts), but a ledger built before that change can
 * still hold sub-rupee paise from `toMinor(parseFloat(...))` — which is what
 * made on-screen totals disagree with their parts by a rupee or two.
 * `roundLedgerAmountsToWholeRupees` rounds those stored values to whole
 * rupees in one pass.
 *
 * Deliberately NOT touched: `loans`, `loan_payments`, `loan_rate_changes`.
 * Their paise are load-bearing — an amortization schedule's principal
 * components sum to the principal exactly and the balance lands on exactly
 * zero only because each row keeps its exact paise. Rounding them would
 * break those invariants. Loan-linked transactions (disbursement, fees,
 * prepayments, EMI transfers) are skipped for the same reason: their amount
 * must keep matching the loan math.
 */

// SQLite ROUND is half-away-from-zero, matching how amounts are displayed.
const ROUND_TO_RUPEE = (col: string) => `CAST(ROUND(${col} / 100.0) AS INTEGER) * 100`;

export interface RoundAmountsResult {
  transactions: number;
  accounts: number;
  personLedgerEntries: number;
  recurringRules: number;
  savingsGoals: number;
  budgets: number;
  /** Total rows changed across every table. */
  total: number;
}

export interface RoundAmountsOutcome extends RoundAmountsResult {
  /** Puts every rounded amount back to what it was (rows that have since been deleted are skipped). */
  undo: () => Promise<void>;
}

/** Which rows each table's rounding touches, and the columns it rewrites there. */
const ROUNDED_ROWS: {
  key: keyof RoundAmountsResult;
  table: string;
  columns: string[];
  where: string;
}[] = [
  {
    key: 'transactions',
    table: 'transactions',
    columns: ['amount_minor'],
    where: 'amount_minor % 100 != 0 AND loan_id IS NULL AND loan_payment_id IS NULL',
  },
  {
    key: 'accounts',
    table: 'accounts',
    columns: ['opening_balance_minor', 'credit_limit_minor'],
    where: `opening_balance_minor % 100 != 0
             OR (credit_limit_minor IS NOT NULL AND credit_limit_minor % 100 != 0)`,
  },
  {
    key: 'personLedgerEntries',
    table: 'person_ledger_entries',
    columns: ['amount_minor'],
    where: 'amount_minor % 100 != 0',
  },
  {
    key: 'recurringRules',
    table: 'recurring_rules',
    columns: ['amount_minor'],
    where: 'amount_minor % 100 != 0',
  },
  {
    key: 'savingsGoals',
    table: 'savings_goals',
    columns: ['target_amount_minor', 'current_amount_minor'],
    where: 'target_amount_minor % 100 != 0 OR current_amount_minor % 100 != 0',
  },
  {
    key: 'budgets',
    table: 'budgets',
    columns: ['limit_amount_minor'],
    where: 'limit_amount_minor % 100 != 0',
  },
];

/**
 * How many stored amounts still carry sub-rupee paise — used to show the
 * count on the Settings button and to decide whether to offer it at all.
 */
export async function countFractionalLedgerAmounts(): Promise<RoundAmountsResult> {
  const db = await getDb();
  const result: RoundAmountsResult = {
    transactions: 0,
    accounts: 0,
    personLedgerEntries: 0,
    recurringRules: 0,
    savingsGoals: 0,
    budgets: 0,
    total: 0,
  };
  for (const { key, table, where } of ROUNDED_ROWS) {
    const row = await db.getFirstAsync<{ n: number }>(`SELECT COUNT(*) AS n FROM ${table} WHERE ${where}`);
    const n = row?.n ?? 0;
    result[key] = n;
    result.total += n;
  }
  return result;
}

/**
 * Round every stored ledger amount (excluding the loan tables — see the file
 * header) to a whole rupee. Runs in a single transaction so it either fully
 * applies or not at all. Returns the per-table count of rows changed.
 *
 * Note: account balances are derived from opening balance + transactions, so
 * a balance can shift by a few rupees after this runs — that is the point,
 * and the user is warned before triggering it.
 */
export async function roundLedgerAmountsToWholeRupees(): Promise<RoundAmountsOutcome> {
  const db = await getDb();
  const before = await countFractionalLedgerAmounts();
  const originals: { table: string; columns: string[]; rows: Record<string, number | null>[] }[] = [];

  await db.withTransactionAsync(async (tx) => {
    for (const { table, columns, where } of ROUNDED_ROWS) {
      const rows = await tx.getAllAsync<Record<string, number | null>>(
        `SELECT id, ${columns.join(', ')} FROM ${table} WHERE ${where}`
      );
      originals.push({ table, columns, rows });
    }
    // amount_minor has a CHECK (> 0); MAX(100, …) keeps a sub-rupee amount
    // from rounding down to an illegal zero.
    await tx.runAsync(
      `UPDATE transactions
         SET amount_minor = MAX(100, ${ROUND_TO_RUPEE('amount_minor')})
       WHERE amount_minor % 100 != 0 AND loan_id IS NULL AND loan_payment_id IS NULL`
    );
    await tx.runAsync(
      `UPDATE accounts
         SET opening_balance_minor = ${ROUND_TO_RUPEE('opening_balance_minor')}
       WHERE opening_balance_minor % 100 != 0`
    );
    await tx.runAsync(
      `UPDATE accounts
         SET credit_limit_minor = ${ROUND_TO_RUPEE('credit_limit_minor')}
       WHERE credit_limit_minor IS NOT NULL AND credit_limit_minor % 100 != 0`
    );
    await tx.runAsync(
      `UPDATE person_ledger_entries
         SET amount_minor = ${ROUND_TO_RUPEE('amount_minor')}
       WHERE amount_minor % 100 != 0`
    );
    await tx.runAsync(
      `UPDATE recurring_rules
         SET amount_minor = MAX(100, ${ROUND_TO_RUPEE('amount_minor')})
       WHERE amount_minor % 100 != 0`
    );
    await tx.runAsync(
      `UPDATE savings_goals
         SET target_amount_minor = ${ROUND_TO_RUPEE('target_amount_minor')},
             current_amount_minor = ${ROUND_TO_RUPEE('current_amount_minor')}
       WHERE target_amount_minor % 100 != 0 OR current_amount_minor % 100 != 0`
    );
    await tx.runAsync(
      `UPDATE budgets
         SET limit_amount_minor = ${ROUND_TO_RUPEE('limit_amount_minor')}
       WHERE limit_amount_minor % 100 != 0`
    );
  });

  const undo = async () => {
    await db.withTransactionAsync(async (tx) => {
      for (const { table, columns, rows } of originals) {
        for (const row of rows) {
          await tx.runAsync(`UPDATE ${table} SET ${columns.map((c) => `${c} = ?`).join(', ')} WHERE id = ?`, [
            ...columns.map((c) => row[c]),
            row.id,
          ]);
        }
      }
    });
  };
  return { ...before, undo };
}

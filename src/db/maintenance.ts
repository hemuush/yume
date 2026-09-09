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

const FRACTIONAL_COUNT_QUERIES: { key: keyof RoundAmountsResult; sql: string }[] = [
  {
    key: 'transactions',
    sql: `SELECT COUNT(*) AS n FROM transactions
          WHERE amount_minor % 100 != 0 AND loan_id IS NULL AND loan_payment_id IS NULL`,
  },
  {
    key: 'accounts',
    sql: `SELECT COUNT(*) AS n FROM accounts
          WHERE opening_balance_minor % 100 != 0
             OR (credit_limit_minor IS NOT NULL AND credit_limit_minor % 100 != 0)`,
  },
  {
    key: 'personLedgerEntries',
    sql: `SELECT COUNT(*) AS n FROM person_ledger_entries WHERE amount_minor % 100 != 0`,
  },
  {
    key: 'recurringRules',
    sql: `SELECT COUNT(*) AS n FROM recurring_rules WHERE amount_minor % 100 != 0`,
  },
  {
    key: 'savingsGoals',
    sql: `SELECT COUNT(*) AS n FROM savings_goals
          WHERE target_amount_minor % 100 != 0 OR current_amount_minor % 100 != 0`,
  },
  {
    key: 'budgets',
    sql: `SELECT COUNT(*) AS n FROM budgets WHERE limit_amount_minor % 100 != 0`,
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
  for (const { key, sql } of FRACTIONAL_COUNT_QUERIES) {
    const row = await db.getFirstAsync<{ n: number }>(sql);
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
export async function roundLedgerAmountsToWholeRupees(): Promise<RoundAmountsResult> {
  const db = await getDb();
  const before = await countFractionalLedgerAmounts();

  await db.withTransactionAsync(async (tx) => {
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

  return before;
}

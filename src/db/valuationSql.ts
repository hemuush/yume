/**
 * SQL for a tracked account's value, derived: ledger balance (opening + income + transfers in − expenses −
 * transfers out) plus the latest valuation's gap against the ledger on its date; later entries then move it.
 */

/**
 * Every entry's effect on account `a` (the caller's accounts alias): income in, spending and transfers out,
 * transfers in. Two sums: entries from the account, and transfers into it. Each
 * runs on its own covering index (idx_transactions_account_flow / _to_account_flow), where one query with
 * "account_id = a OR to_account_id = a" had to look up every entry's row. `dateBound`, if given, is a SQL
 * expression the entry's date must be on or before (e.g. a valuation's date).
 */
export function ledgerFlowSql(a: string, dateBound?: string): string {
  const upTo = dateBound ? ` AND t.date <= ${dateBound}` : '';
  return `(COALESCE((SELECT SUM(CASE WHEN t.type = 'income' THEN t.amount_minor ELSE -t.amount_minor END)
       FROM transactions t WHERE t.account_id = ${a}.id${upTo}), 0)
     + COALESCE((SELECT SUM(t.amount_minor) FROM transactions t WHERE t.to_account_id = ${a}.id${upTo}), 0))`;
}

/** The tail of a "latest valuation of account `a`" query: newest date, then newest entry. */
function latestValuationFrom(a: string, cutoff: boolean): string {
  return `FROM account_valuations v
     WHERE v.account_id = ${a}.id${cutoff ? ' AND v.date <= ?' : ''}
     ORDER BY v.date DESC, v.created_at DESC, v.rowid DESC LIMIT 1`;
}

/**
 * The latest valuation's gap from the ledger on its own date: add it to the ledger balance for the value. 0 if
 * untracked/unvalued. With `cutoff` the SQL holds one `?` (ISO date, later valuations ignored) to bind.
 */
export function valuationAdjSql(a: string, cutoff = false): string {
  return `CASE WHEN ${a}.tracked = 1 THEN COALESCE((
    SELECT v.value_minor - ${a}.opening_balance_minor - ${ledgerFlowSql(a, 'v.date')}
    ${latestValuationFrom(a, cutoff)}
  ), 0) ELSE 0 END`;
}

/** The latest valuation's date, for the "updated 28 Sep" line. */
export function latestValuedAtSql(a: string): string {
  return `(SELECT v.date ${latestValuationFrom(a, false)})`;
}

/** The latest valuation's value. */
export function latestValueSql(a: string): string {
  return `(SELECT v.value_minor ${latestValuationFrom(a, false)})`;
}

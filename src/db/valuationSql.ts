/**
 * SQL for a tracked account's value. The balance stays derived: the ledger
 * balance (opening + income + transfers in − expenses − transfers out) plus
 * the gap the latest valuation left against the ledger on its own date.
 * Everything dated after that valuation then moves the value as normal.
 */

/** One transaction row's effect on account `a` (the caller's accounts alias). */
export function flowCase(t: string, a: string): string {
  return `CASE
    WHEN ${t}.type = 'income' AND ${t}.account_id = ${a}.id THEN ${t}.amount_minor
    WHEN ${t}.type = 'transfer' AND ${t}.to_account_id = ${a}.id THEN ${t}.amount_minor
    WHEN ${t}.type = 'expense' AND ${t}.account_id = ${a}.id THEN -${t}.amount_minor
    WHEN ${t}.type = 'transfer' AND ${t}.account_id = ${a}.id THEN -${t}.amount_minor
    ELSE 0
  END`;
}

/** The tail of a "latest valuation of account `a`" query: newest date, then newest entry. */
function latestValuationFrom(a: string, cutoff: boolean): string {
  return `FROM account_valuations v
     WHERE v.account_id = ${a}.id${cutoff ? ' AND v.date <= ?' : ''}
     ORDER BY v.date DESC, v.created_at DESC, v.rowid DESC LIMIT 1`;
}

/**
 * How far the latest valuation sat from the ledger on its own date: what to
 * add to the ledger balance to get the value. 0 for an untracked account or
 * one with no valuation yet. With `cutoff`, the SQL holds one `?` (an ISO
 * date, only valuations on or before it count) that the caller must bind.
 */
export function valuationAdjSql(a: string, cutoff = false): string {
  return `CASE WHEN ${a}.tracked = 1 THEN COALESCE((
    SELECT v.value_minor - ${a}.opening_balance_minor - COALESCE((
      SELECT SUM(${flowCase('t', a)}) FROM transactions t
      WHERE (t.account_id = ${a}.id OR t.to_account_id = ${a}.id) AND t.date <= v.date
    ), 0)
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

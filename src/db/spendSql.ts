/**
 * Refund SQL: a refund is stored as 'income' with `is_refund = 1` against its expense category, lowering that
 * category's spending and never counting as income. Every spend/income total uses these; alias entries as `t`.
 */

/** Rows that count toward spending: expenses, and refunds against them. */
export const SPEND_ROWS = `(t.type = 'expense' OR (t.type = 'income' AND t.is_refund = 1))`;

/** A spending row's effect: an expense adds, a refund takes away. */
export const SPEND_AMOUNT = `(CASE WHEN t.type = 'expense' THEN t.amount_minor ELSE -t.amount_minor END)`;

/**
 * Whether category alias `c` is hidden with "hide savings & investment amounts": its own flag, or its parent's
 * (a subcategory such as "My SIP" under Investments is hidden with it). 1 or 0.
 */
export const sensitiveOf = (c: string) =>
  `MAX(${c}.is_sensitive, COALESCE((SELECT ps.is_sensitive FROM categories ps WHERE ps.id = ${c}.parent_id), 0))`;

/** Rows outside the categories flagged "hide savings & investment amounts" (`is_sensitive`, or the parent's). */
export const NOT_SENSITIVE = `COALESCE((SELECT ${sensitiveOf('sc')} FROM categories sc WHERE sc.id = t.category_id), 0) = 0`;

/** Rows that count as income: money in that isn't a refund. */
export const INCOME_ROWS = `(t.type = 'income' AND t.is_refund = 0)`;

/** Which rows a category's totals take, by the category's kind. */
export function rowsOf(kind: 'expense' | 'income'): string {
  return kind === 'expense' ? SPEND_ROWS : INCOME_ROWS;
}

/** How a row adds to its kind's total. */
export function amountOf(kind: 'expense' | 'income'): string {
  return kind === 'expense' ? SPEND_AMOUNT : 't.amount_minor';
}

/** How many entries a total is made of: refunds are part of the sum, not extra entries. */
export function countOf(kind: 'expense' | 'income'): string {
  return kind === 'expense' ? `SUM(CASE WHEN t.type = 'expense' THEN 1 ELSE 0 END)` : 'COUNT(*)';
}

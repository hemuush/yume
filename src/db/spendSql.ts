/**
 * Refunds (the Missing pieces sign-off): money back on a purchase is stored
 * as money in (type 'income') with `is_refund = 1`, against the expense
 * category it came back to. It lowers that category's spending and never
 * counts as income. Every total that adds up spending or income builds its
 * SQL from these, so they all agree. They assume the entries table is
 * aliased `t`.
 */

/** Rows that count toward spending: expenses, and refunds against them. */
export const SPEND_ROWS = `(t.type = 'expense' OR (t.type = 'income' AND t.is_refund = 1))`;

/** A spending row's effect: an expense adds, a refund takes away. */
export const SPEND_AMOUNT = `(CASE WHEN t.type = 'expense' THEN t.amount_minor ELSE -t.amount_minor END)`;

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

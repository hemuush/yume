import { getDb, AppDb } from './client';
import { newId } from '@/lib/id';
import { getDefaultCurrency } from './settings';
import { captureRow, restoreRow, RowSnapshot } from './undoSnapshot';
import { Budget } from '@/types';

/**
 * A monthly spending limit for one category. `budgets` has one row per
 * (category, calendar month) — see schema's own `UNIQUE (category_id,
 * period_month)` — rather than a single "recurring" row, so a limit change
 * never rewrites history: last month's ₹5,000 grocery budget stays exactly
 * that even after this month's is raised to ₹6,000.
 *
 * That per-month shape means a category with `rollover` set doesn't
 * automatically grow a new row for the next month on its own — there's no
 * background job here (deliberately; see the app's own stance on keeping
 * background work on the user's device minimal). Instead, `listLapsedBudgets`
 * surfaces "you had a budget for this last month, want to continue it?" the
 * next time the Budgets screen is actually opened, and `createBudget` does
 * the one-tap continuation from there.
 */

function rowToBudget(row: any): Budget {
  return {
    id: row.id,
    categoryId: row.category_id,
    periodMonth: row.period_month,
    limitAmountMinor: row.limit_amount_minor,
    rollover: !!row.rollover,
  };
}

/** "YYYY-MM" for a date's local calendar month — the exact key `budgets.period_month` is stored under. */
export function periodMonthOf(d: Date = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function previousPeriodMonth(periodMonth: string): string {
  const [y, m] = periodMonth.split('-').map(Number);
  return periodMonthOf(new Date(y, m - 2, 1));
}

/** The calendar-month date range a `period_month` string covers, for querying that month's spend. */
function monthRange(periodMonth: string): { start: string; end: string } {
  const [y, m] = periodMonth.split('-').map(Number);
  const lastDay = new Date(y, m, 0).getDate();
  return { start: `${periodMonth}-01`, end: `${periodMonth}-${String(lastDay).padStart(2, '0')}` };
}

/**
 * Same-currency-only spend, matching how every other report figure in the
 * app is scoped. When `categoryId` is a top-level category, this also rolls
 * up every one of its subcategories' spend — the same grouping
 * `getRangeComparison`'s "Where it went" breakdown already does
 * (`JOIN categories top ON top.id = COALESCE(c.parent_id, c.id)`). Budgeting
 * "Food" and then logging everything under "Food > Groceries" used to leave
 * that budget's spend permanently at ₹0 — the exact-match-only query below
 * never saw a transaction actually tagged with the parent's own id.
 *
 * `c.parent_id = ?` only ever matches something when `categoryId` genuinely
 * is a parent (subcategories don't have their own children in this app's
 * two-level model), so this stays a no-op — exact match only — when
 * `categoryId` is itself a subcategory, which is exactly the scoping a
 * subcategory-specific budget should keep.
 */
async function categorySpend(
  db: AppDb,
  currency: string,
  categoryId: string,
  range: { start: string; end: string }
): Promise<number> {
  const row = await db.getFirstAsync<{ total: number }>(
    `SELECT COALESCE(SUM(t.amount_minor), 0) as total
     FROM transactions t
     JOIN accounts a ON a.id = t.account_id
     JOIN categories c ON c.id = t.category_id
     WHERE t.type = 'expense' AND a.currency = ?
       AND (t.category_id = ? OR c.parent_id = ?)
       AND t.date >= ? AND t.date <= ?`,
    [currency, categoryId, categoryId, range.start, range.end]
  );
  return row?.total ?? 0;
}

export interface BudgetProgress {
  budget: Budget;
  categoryName: string;
  categoryIcon: string;
  categoryColor: string;
  spentMinor: number;
  /** `limitAmountMinor`, plus last month's unspent carry when `rollover` is on and a prior budget exists. */
  effectiveLimitMinor: number;
  remainingMinor: number;
  /** 0-100+, deliberately uncapped — the caller decides how to clamp a bar vs. how it labels "over budget". */
  percentUsed: number;
  overBudget: boolean;
}

/** Every budget for one month, spend computed live, most-urgent (closest to or over its limit) first. */
export async function listBudgetsForMonth(periodMonth: string = periodMonthOf()): Promise<BudgetProgress[]> {
  const db = await getDb();
  const currency = await getDefaultCurrency();
  const rows = await db.getAllAsync<any>(
    `SELECT b.*, c.name as category_name, c.icon as category_icon, c.color as category_color
     FROM budgets b JOIN categories c ON c.id = b.category_id
     WHERE b.period_month = ?
     ORDER BY c.name ASC`,
    [periodMonth]
  );

  const range = monthRange(periodMonth);
  const result = await Promise.all(
    rows.map(async (row): Promise<BudgetProgress> => {
      const budget = rowToBudget(row);
      const spentMinor = await categorySpend(db, currency, budget.categoryId, range);

      let effectiveLimitMinor = budget.limitAmountMinor;
      if (budget.rollover) {
        const prevMonth = previousPeriodMonth(periodMonth);
        const prevBudget = await db.getFirstAsync<{ limit_amount_minor: number }>(
          'SELECT limit_amount_minor FROM budgets WHERE category_id = ? AND period_month = ?',
          [budget.categoryId, prevMonth]
        );
        if (prevBudget) {
          const prevSpent = await categorySpend(db, currency, budget.categoryId, monthRange(prevMonth));
          const carry = prevBudget.limit_amount_minor - prevSpent;
          if (carry > 0) effectiveLimitMinor += carry;
        }
      }

      return {
        budget,
        categoryName: row.category_name,
        categoryIcon: row.category_icon,
        categoryColor: row.category_color,
        spentMinor,
        effectiveLimitMinor,
        remainingMinor: effectiveLimitMinor - spentMinor,
        percentUsed: effectiveLimitMinor > 0 ? (spentMinor / effectiveLimitMinor) * 100 : 0,
        overBudget: spentMinor > effectiveLimitMinor,
      };
    })
  );

  return result.sort((a, b) => b.percentUsed - a.percentUsed);
}

export interface LapsedBudget {
  categoryId: string;
  categoryName: string;
  categoryIcon: string;
  categoryColor: string;
  limitAmountMinor: number;
  rollover: boolean;
}

/** Categories that had a budget last month but don't have one yet for `periodMonth` — the "continue?" prompt. */
export async function listLapsedBudgets(periodMonth: string = periodMonthOf()): Promise<LapsedBudget[]> {
  const db = await getDb();
  const prevMonth = previousPeriodMonth(periodMonth);
  const rows = await db.getAllAsync<any>(
    `SELECT b.category_id, b.limit_amount_minor, b.rollover,
            c.name as category_name, c.icon as category_icon, c.color as category_color
     FROM budgets b JOIN categories c ON c.id = b.category_id
     WHERE b.period_month = ? AND c.archived = 0
       AND NOT EXISTS (SELECT 1 FROM budgets b2 WHERE b2.category_id = b.category_id AND b2.period_month = ?)
     ORDER BY c.name ASC`,
    [prevMonth, periodMonth]
  );
  return rows.map((r) => ({
    categoryId: r.category_id,
    categoryName: r.category_name,
    categoryIcon: r.category_icon,
    categoryColor: r.category_color,
    limitAmountMinor: r.limit_amount_minor,
    rollover: !!r.rollover,
  }));
}

export interface BudgetInput {
  categoryId: string;
  limitAmountMinor: number;
  rollover: boolean;
  /** Defaults to the current month — only ever overridden by "continue this budget" carrying last month's category forward. */
  periodMonth?: string;
}

export async function createBudget(input: BudgetInput): Promise<Budget> {
  if (!Number.isFinite(input.limitAmountMinor) || input.limitAmountMinor <= 0) {
    throw new Error('Monthly limit must be a positive amount');
  }
  const db = await getDb();
  const periodMonth = input.periodMonth ?? periodMonthOf();
  const existing = await db.getFirstAsync<{ id: string }>(
    'SELECT id FROM budgets WHERE category_id = ? AND period_month = ?',
    [input.categoryId, periodMonth]
  );
  if (existing) {
    throw new Error('This category already has a budget for this month — edit it instead of adding another.');
  }
  const id = newId();
  await db.runAsync(
    'INSERT INTO budgets (id, category_id, period_month, limit_amount_minor, rollover) VALUES (?, ?, ?, ?, ?)',
    [id, input.categoryId, periodMonth, input.limitAmountMinor, input.rollover ? 1 : 0]
  );
  const row = await db.getFirstAsync<any>('SELECT * FROM budgets WHERE id = ?', [id]);
  return rowToBudget(row);
}

export async function updateBudget(
  id: string,
  input: { limitAmountMinor: number; rollover: boolean }
): Promise<void> {
  if (!Number.isFinite(input.limitAmountMinor) || input.limitAmountMinor <= 0) {
    throw new Error('Monthly limit must be a positive amount');
  }
  const db = await getDb();
  await db.runAsync('UPDATE budgets SET limit_amount_minor = ?, rollover = ? WHERE id = ?', [
    input.limitAmountMinor,
    input.rollover ? 1 : 0,
    id,
  ]);
}

/** Permanently removes one month's budget row — single row, no cascade, so instant-delete + undo like a transaction. */
export async function deleteBudget(id: string): Promise<RowSnapshot> {
  const db = await getDb();
  const snapshot = await captureRow(db, 'budgets', id);
  if (!snapshot) throw new Error('This budget is already deleted.');
  await db.runAsync('DELETE FROM budgets WHERE id = ?', [id]);
  return snapshot;
}

/** Undoes `deleteBudget` — re-inserts the exact row, never a fresh one. */
export async function restoreBudget(snapshot: RowSnapshot): Promise<void> {
  const db = await getDb();
  await restoreRow(db, snapshot);
}

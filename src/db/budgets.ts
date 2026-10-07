import { found } from './found';
import { BudgetRow } from './rows';
import { getDb, AppDb } from './client';
import { newId } from '@/lib/id';
import { getDefaultCurrency } from './settings';
import { captureRow, restoreRow, RowSnapshot } from './undoSnapshot';
import { Budget } from '@/types';
import { SPEND_ROWS, SPEND_AMOUNT, sensitiveOf } from './spendSql';
import { cachedRead } from './readCache';

/**
 * One row per (category, month), so changing a limit never rewrites history. No background job rolls over:
 * `listLapsedBudgets` offers "continue?" when Budgets opens; `createBudget` does the one-tap continuation.
 */

function rowToBudget(row: BudgetRow): Budget {
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
 * A month's same-currency spending per category, in one query for every budget at once (not one per budget,
 * each waiting its turn in the database queue). Returns the spend of a category as a budget counts it: a
 * top-level category also rolls up its subcategories (as getRangeComparison); a subcategory is exact-match.
 * What a category cost is spending less money that came back as refunds, never below zero.
 */
async function spendByCategory(
  db: AppDb,
  currency: string,
  range: { start: string; end: string }
): Promise<(categoryId: string) => number> {
  const rows = await db.getAllAsync<{ id: string; parent: string | null; total: number }>(
    `SELECT t.category_id AS id, c.parent_id AS parent, SUM(${SPEND_AMOUNT}) AS total
     FROM transactions t
     JOIN accounts a ON a.id = t.account_id
     JOIN categories c ON c.id = t.category_id
     WHERE ${SPEND_ROWS} AND a.currency = ? AND t.date >= ? AND t.date <= ?
     GROUP BY t.category_id`,
    [currency, range.start, range.end]
  );
  return (categoryId) =>
    Math.max(
      0,
      rows.reduce((sum, r) => (r.id === categoryId || r.parent === categoryId ? sum + r.total : sum), 0)
    );
}

export interface BudgetProgress {
  budget: Budget;
  categoryName: string;
  /** The parent's name when the budget is on a subcategory, so same-named subcategories can be told apart. */
  parentName?: string | null;
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

/**
 * Every budget for one month, spend computed live, most-urgent (closest to or over its limit) first.
 * `excludeSensitive` leaves out budgets on savings/investment categories (privacy mode).
 */
export function listBudgetsForMonth(
  periodMonth: string = periodMonthOf(),
  excludeSensitive = false
): Promise<BudgetProgress[]> {
  // Home and its Needs you list both ask for this month's; computed once per change.
  return cachedRead(`budgets:${periodMonth}:${excludeSensitive}`, () =>
    readBudgetsForMonth(periodMonth, excludeSensitive)
  );
}

async function readBudgetsForMonth(
  periodMonth: string,
  excludeSensitive: boolean
): Promise<BudgetProgress[]> {
  const db = await getDb();
  const currency = await getDefaultCurrency();
  const rows = await db.getAllAsync<
    BudgetRow & {
      category_name: string;
      parent_name: string | null;
      category_icon: string;
      category_color: string;
    }
  >(
    `SELECT b.*, c.name as category_name, pc.name as parent_name, c.icon as category_icon, c.color as category_color
     FROM budgets b JOIN categories c ON c.id = b.category_id
     LEFT JOIN categories pc ON pc.id = c.parent_id
     WHERE b.period_month = ?${excludeSensitive ? ` AND ${sensitiveOf('c')} = 0` : ''}
     ORDER BY c.name COLLATE NOCASE ASC`,
    [periodMonth]
  );

  if (rows.length === 0) return [];
  const spentIn = await spendByCategory(db, currency, monthRange(periodMonth));

  // Rollover: last month's budgets and spend, read once for all budgets, and only when one rolls over.
  const prevMonth = previousPeriodMonth(periodMonth);
  let prevLimitOf = new Map<string, number>();
  let prevSpentIn: (categoryId: string) => number = () => 0;
  if (rows.some((r) => r.rollover)) {
    const prevRows = await db.getAllAsync<{ category_id: string; limit_amount_minor: number }>(
      'SELECT category_id, limit_amount_minor FROM budgets WHERE period_month = ?',
      [prevMonth]
    );
    prevLimitOf = new Map(prevRows.map((r) => [r.category_id, r.limit_amount_minor]));
    if (rows.some((r) => r.rollover && prevLimitOf.has(r.category_id))) {
      prevSpentIn = await spendByCategory(db, currency, monthRange(prevMonth));
    }
  }

  const result = rows.map((row): BudgetProgress => {
    const budget = rowToBudget(row);
    const spentMinor = spentIn(budget.categoryId);

    let effectiveLimitMinor = budget.limitAmountMinor;
    const prevLimit = prevLimitOf.get(budget.categoryId);
    if (budget.rollover && prevLimit !== undefined) {
      const carry = prevLimit - prevSpentIn(budget.categoryId);
      if (carry > 0) effectiveLimitMinor += carry;
    }

    return {
      budget,
      categoryName: row.category_name,
      parentName: row.parent_name,
      categoryIcon: row.category_icon,
      categoryColor: row.category_color,
      spentMinor,
      effectiveLimitMinor,
      remainingMinor: effectiveLimitMinor - spentMinor,
      percentUsed: effectiveLimitMinor > 0 ? (spentMinor / effectiveLimitMinor) * 100 : 0,
      overBudget: spentMinor > effectiveLimitMinor,
    };
  });

  return result.sort((a, b) => b.percentUsed - a.percentUsed);
}

export interface LapsedBudget {
  categoryId: string;
  categoryName: string;
  parentName?: string | null;
  categoryIcon: string;
  categoryColor: string;
  limitAmountMinor: number;
  rollover: boolean;
}

/** Categories that had a budget last month but don't have one yet for `periodMonth` — the "continue?" prompt. */
export async function listLapsedBudgets(
  periodMonth: string = periodMonthOf(),
  excludeSensitive = false
): Promise<LapsedBudget[]> {
  const db = await getDb();
  const prevMonth = previousPeriodMonth(periodMonth);
  const rows = await db.getAllAsync<
    Pick<BudgetRow, 'category_id' | 'limit_amount_minor' | 'rollover'> & {
      category_name: string;
      parent_name: string | null;
      category_icon: string;
      category_color: string;
    }
  >(
    `SELECT b.category_id, b.limit_amount_minor, b.rollover,
            c.name as category_name, pc.name as parent_name, c.icon as category_icon, c.color as category_color
     FROM budgets b JOIN categories c ON c.id = b.category_id
     LEFT JOIN categories pc ON pc.id = c.parent_id
     WHERE b.period_month = ? AND c.archived = 0${excludeSensitive ? ` AND ${sensitiveOf('c')} = 0` : ''}
       AND NOT EXISTS (SELECT 1 FROM budgets b2 WHERE b2.category_id = b.category_id AND b2.period_month = ?)
     ORDER BY c.name COLLATE NOCASE ASC`,
    [prevMonth, periodMonth]
  );
  return rows.map((r) => ({
    categoryId: r.category_id,
    categoryName: r.category_name,
    parentName: r.parent_name,
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
  if (!Number.isSafeInteger(input.limitAmountMinor) || input.limitAmountMinor <= 0) {
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
  const row = await db.getFirstAsync<BudgetRow>('SELECT * FROM budgets WHERE id = ?', [id]);
  return rowToBudget(found(row, 'budget'));
}

export async function updateBudget(
  id: string,
  input: { limitAmountMinor: number; rollover: boolean }
): Promise<void> {
  if (!Number.isSafeInteger(input.limitAmountMinor) || input.limitAmountMinor <= 0) {
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

export type BudgetNudgeLevel = 'near' | 'over';
/** A budget at or past this share of its limit gets one "getting close" notification. */
export const BUDGET_NUDGE_PCT = 80;

/**
 * Which budget notification is due, given those already sent this month: one past BUDGET_NUDGE_PCT, one when
 * over, each at most once per budget per month.
 */
export function dueBudgetNudge(
  progress: { overBudget: boolean; percentUsed: number },
  sent: { near: boolean; over: boolean }
): BudgetNudgeLevel | null {
  if (progress.overBudget) return sent.over ? null : 'over';
  if (progress.percentUsed >= BUDGET_NUDGE_PCT) return sent.near ? null : 'near';
  return null;
}

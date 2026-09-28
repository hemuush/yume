import { getDb } from './client';
import {
  getNotificationPrefs,
  getLastOverspendNotified,
  setLastOverspendNotified,
  getBudgetNudgesSent,
  addBudgetNudgesSent,
} from './settings';
import { notifyOverspend, notifyBudget } from '@/lib/notifications';
import { budgetNudgeCopy } from '@/lib/notificationCopy';
import { listBudgetsForMonth, dueBudgetNudge, BudgetNudgeLevel } from './budgets';
import { formatMoney } from '@/lib/money';
import { getPeriodComparison, findTopGrowingCategory } from './reports';
import { toLocalIsoDate } from '@/lib/date';

/** Budget and overspend checks run right after an expense is saved (re-exported from ./ledger). */

/**
 * After an expense is recorded, checks whether that category's spend this
 * month has grown well past its total for the prior month and, if so, fires
 * an immediate local notification — a check done once at the moment spend
 * actually changes, rather than a periodic background poll.
 */
export async function checkOverspendAndNotify(categoryId: string): Promise<void> {
  const prefs = await getNotificationPrefs();
  if (!prefs.overspendAlerts) return;

  // getPeriodComparison's categoryBreakdown is rolled up to top-level
  // categories (a subcategory's spend is folded into its parent's row) —
  // resolving the transaction's own category to its top-level ancestor
  // here too, otherwise a subcategory-tagged expense (e.g. "Zomato") could
  // never match `top.categoryId` (always a parent id like "Food & Dining")
  // and this alert would silently stop firing for anything tagged with a
  // subcategory.
  const db = await getDb();
  const row = await db.getFirstAsync<{ parent_id: string | null }>(
    'SELECT parent_id FROM categories WHERE id = ?',
    [categoryId]
  );
  const topLevelCategoryId = row?.parent_id ?? categoryId;

  await checkBudgetNudge(categoryId, topLevelCategoryId).catch(() => {});

  const comparison = await getPeriodComparison('month');
  const top = findTopGrowingCategory(
    comparison.current.categoryBreakdown,
    comparison.previous.categoryBreakdown
  );
  if (!top || top.categoryId !== topLevelCategoryId) return;

  // Without this, the same category being "this month's top grower" fires a
  // fresh notification after every single transaction logged anywhere that
  // month — a real user reported this as spam. One alert per category per
  // calendar month is enough to be useful without being noisy.
  const monthKey = `${topLevelCategoryId}:${toLocalIsoDate(new Date()).slice(0, 7)}`;
  if ((await getLastOverspendNotified()) === monthKey) return;

  await notifyOverspend(top.name, top.pctChange);
  await setLastOverspendNotified(monthKey);
}

/**
 * One notification when this month's budget for the category passes 80% of
 * its limit, and one when it goes over — each at most once per budget per
 * month (see dueBudgetNudge). A budget on the category itself wins; otherwise
 * its parent's, which counts subcategory spending too. Called from
 * checkOverspendAndNotify, so it follows the same "Overspending alerts" switch.
 */
async function checkBudgetNudge(categoryId: string, topLevelCategoryId: string): Promise<void> {
  const budgets = await listBudgetsForMonth();
  const budget =
    budgets.find((b) => b.budget.categoryId === categoryId) ??
    budgets.find((b) => b.budget.categoryId === topLevelCategoryId);
  if (!budget) return;
  const sent = await getBudgetNudgesSent();
  const key = (level: BudgetNudgeLevel) => `${budget.budget.id}:${budget.budget.periodMonth}:${level}`;
  const level = dueBudgetNudge(budget, {
    near: sent.includes(key('near')),
    over: sent.includes(key('over')),
  });
  if (!level) return;
  await notifyBudget(
    budgetNudgeCopy(
      level,
      budget.categoryName,
      formatMoney(budget.spentMinor),
      formatMoney(budget.effectiveLimitMinor),
      formatMoney(Math.max(0, budget.remainingMinor))
    ),
    `${budget.budget.id}:${budget.budget.periodMonth}`
  );
  // Going straight past the limit counts as having had the 80% one too.
  await addBudgetNudgesSent(level === 'over' ? [key('near'), key('over')] : [key('near')]);
}

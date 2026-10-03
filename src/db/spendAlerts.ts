import { getDb } from './client';
import {
  getNotificationPrefs,
  getLastOverspendNotified,
  setLastOverspendNotified,
  getBudgetNudgesSent,
  addBudgetNudgesSent,
  addQueuedAlerts,
  getCachedHideSensitiveAmounts,
} from './settings';
import { rebuildNotifications } from '@/lib/notifications';
import { budgetAlertCopy, spikeCopy } from '@/lib/notificationCopy';
import type { QueuedAlert } from '@/lib/notificationPlan';
import { listBudgetsForMonth, dueBudgetNudge, BudgetNudgeLevel } from './budgets';
import { formatMoney } from '@/lib/money';
import { formatPctChange } from '@/lib/format';
import { getPeriodComparison, findTopGrowingCategory } from './reports';
import { privateComparison } from '@/lib/privateSummary';
import { toLocalIsoDate } from '@/lib/date';

/** Budget and spending-jump checks run right after an expense is saved (re-exported from ./ledger). */

/**
 * After an expense, checks its category's budget (80%/over) and month-over-month spend jump. Alerts are queued
 * for the next notification time, not sent immediately (see planNotifications); always rebuilds notifications.
 */
export async function queueSpendAlerts(categoryId: string): Promise<void> {
  try {
    const prefs = await getNotificationPrefs();
    if (!prefs.overspendAlerts) return;

    // getPeriodComparison's breakdown is rolled up to top-level categories, so resolve this category to its
    // top-level ancestor too, or a subcategory expense (e.g. "Zomato") would never match `top.categoryId`.
    const db = await getDb();
    const row = await db.getFirstAsync<{ parent_id: string | null }>(
      'SELECT parent_id FROM categories WHERE id = ?',
      [categoryId]
    );
    const topLevelCategoryId = row?.parent_id ?? categoryId;

    const queuedAt = new Date().toISOString();
    const alerts: QueuedAlert[] = [];

    const budgetAlert = await budgetAlertFor(categoryId, topLevelCategoryId, queuedAt).catch(() => null);
    if (budgetAlert) alerts.push(budgetAlert);

    const spike = await spikeAlertFor(topLevelCategoryId, queuedAt).catch(() => null);
    if (spike) alerts.push(spike);

    await addQueuedAlerts(alerts);
  } finally {
    await rebuildNotifications();
  }
}

/**
 * A budget passing 80% of its limit, and going over: each once per budget per month (see dueBudgetNudge).
 * A budget on the category itself wins; otherwise its parent's, which counts subcategory spending too.
 */
async function budgetAlertFor(
  categoryId: string,
  topLevelCategoryId: string,
  queuedAt: string
): Promise<QueuedAlert | null> {
  // A notification shows on the lock screen, so with privacy on it never speaks of a savings category.
  const budgets = await listBudgetsForMonth(undefined, getCachedHideSensitiveAmounts());
  const budget =
    budgets.find((b) => b.budget.categoryId === categoryId) ??
    budgets.find((b) => b.budget.categoryId === topLevelCategoryId);
  if (!budget) return null;
  const sent = await getBudgetNudgesSent();
  const key = (level: BudgetNudgeLevel) => `${budget.budget.id}:${budget.budget.periodMonth}:${level}`;
  const level = dueBudgetNudge(budget, {
    near: sent.includes(key('near')),
    over: sent.includes(key('over')),
  });
  if (!level) return null;
  // Going straight past the limit counts as having had the 80% one too.
  await addBudgetNudgesSent(level === 'over' ? [key('near'), key('over')] : [key('near')]);
  return {
    id: `budget:${key(level)}`,
    queuedAt,
    route: '/budgets',
    ...budgetAlertCopy(
      level,
      budget.categoryName,
      formatMoney(budget.spentMinor),
      formatMoney(budget.effectiveLimitMinor),
      formatMoney(Math.max(0, budget.remainingMinor))
    ),
  };
}

async function spikeAlertFor(topLevelCategoryId: string, queuedAt: string): Promise<QueuedAlert | null> {
  const comparison = privateComparison(await getPeriodComparison('month'), getCachedHideSensitiveAmounts());
  const top = findTopGrowingCategory(
    comparison.current.categoryBreakdown,
    comparison.previous.categoryBreakdown
  );
  if (!top || top.categoryId !== topLevelCategoryId) return null;

  // One alert per category per month: otherwise the same top grower would queue a fresh alert after every
  // transaction logged that month.
  const monthKey = `${topLevelCategoryId}:${toLocalIsoDate(new Date()).slice(0, 7)}`;
  if ((await getLastOverspendNotified()) === monthKey) return null;
  await setLastOverspendNotified(monthKey);
  return {
    id: `spike:${monthKey}`,
    queuedAt,
    route: '/reports',
    ...spikeCopy(top.name, formatPctChange(top.pctChange)),
  };
}

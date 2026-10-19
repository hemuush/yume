import { getHideSensitiveAmounts } from './settings';
import { listBudgetsForMonth } from './budgets';
import { listCategories } from './categories';
import { findTopGrowingCategory, getPeriodComparison } from './reports';
import { budgetAlertCopy, spikeCopy } from '@/lib/notificationCopy';
import { NOTIFICATION_ROUTES, type QueuedAlert } from '@/lib/notificationPlan';
import { formatMoney } from '@/lib/money';
import { formatPctChange } from '@/lib/format';
import { parseLocalIsoDate } from '@/lib/date';

/** Queued copy is a cache, never authority for today's privacy policy or financial figures. */
export async function resolveQueuedSpendAlerts(alerts: QueuedAlert[]): Promise<QueuedAlert[]> {
  if (alerts.length === 0) return [];
  const hide = await getHideSensitiveAmounts();
  const categories = hide ? await listCategories(true) : [];
  const hiddenFamilies = new Set(categories.filter((c) => c.isSensitive).map((c) => c.parentId ?? c.id));
  const categoriesById = new Map(categories.map((c) => [c.id, c]));
  const resolved: QueuedAlert[] = [];
  for (const alert of alerts) {
    const source = alert.source;
    if (!source) {
      // A legacy payload cannot prove which category/family its text describes. Drop it on hide.
      if (
        !hide &&
        [alert.title, alert.body, alert.extra].every((s) => typeof s === 'string') &&
        NOTIFICATION_ROUTES.includes(alert.route)
      )
        resolved.push(alert);
      continue;
    }
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(source.periodMonth)) continue;
    if (source.kind === 'budget' && (source.level === 'near' || source.level === 'over')) {
      const budget = (await listBudgetsForMonth(source.periodMonth, hide)).find(
        (b) => b.budget.id === source.budgetId
      );
      if (
        !budget ||
        (source.level === 'over' ? !budget.overBudget : budget.percentUsed < 80 || budget.overBudget)
      )
        continue;
      resolved.push({
        ...alert,
        route: '/budgets',
        ...budgetAlertCopy(
          source.level,
          budget.categoryName,
          formatMoney(budget.spentMinor),
          formatMoney(budget.effectiveLimitMinor),
          formatMoney(Math.max(0, budget.remainingMinor))
        ),
      });
    } else if (source.kind === 'spike') {
      const category = categoriesById.get(source.categoryId);
      if (hide && (!category || hiddenFamilies.has(category.parentId ?? category.id))) continue;
      const comparison = await getPeriodComparison('month', parseLocalIsoDate(`${source.periodMonth}-01`));
      const top = findTopGrowingCategory(
        comparison.current.categoryBreakdown.filter((c) => c.categoryId === source.categoryId),
        comparison.previous.categoryBreakdown
      );
      if (top)
        resolved.push({
          ...alert,
          route: '/reports',
          ...spikeCopy(top.name, formatPctChange(top.pctChange)),
        });
    }
  }
  return resolved;
}

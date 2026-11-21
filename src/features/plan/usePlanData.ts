import { useCallback, useEffect, useRef, useState } from 'react';
import { listBudgetsForMonth } from '@/db/budgets';
import { listCardCycles } from '@/db/cardCycles';
import { listAccounts, listCategories } from '@/db/ledger';
import { getLoanProgress, listLoans, listPendingLoanPayments } from '@/db/loans';
import { listPeople } from '@/db/people';
import { getCategoryMonthlyAverages, getDailyGoalStreakSeries } from '@/db/reports';
import { listRecurringRules } from '@/db/recurring';
import { listSavingsGoals } from '@/db/savingsGoals';
import { getDailySpendingGoal, getDefaultCurrency } from '@/db/settings';
import { keepFieldsIfEqual } from '@/lib/stableData';
import { useScreenLoad } from '@/hooks/useScreenLoad';
import { usePrivacy } from '@/theme/PrivacyContext';
import { buildPlanData, planWindow, type PlanData } from './planData';

/**
 * What the Plan page shows, and keeping it current (on focus after a write, on a new day, and on `reload`): everything it
 * reads, worked out by `buildPlanData`. Whatever a reload did not change stays the very same object, so the parts of
 * the page that compare their props redraw only for what moved; `version` still counts every load, for the parts that read
 * something of their own when the page reloads. `scoped` is the data when it was worked out for the privacy setting now
 * on, and null while it is for the other one.
 */
export function usePlanData() {
  const { hideAmounts } = usePrivacy();
  const [data, setData] = useState<PlanData | null>(null);
  const [version, setVersion] = useState(0);
  const request = useRef(0);
  const loadPlan = useCallback(async () => {
    const call = ++request.current;
    const { today, until } = planWindow();
    const dailyGoalRead = getDailySpendingGoal();
    const [
      budgets,
      goals,
      rules,
      loans,
      progress,
      people,
      categories,
      accounts,
      dailyGoal,
      averages,
      cardCycles,
      streak,
      currency,
      loanPayments,
    ] = await Promise.all([
      listBudgetsForMonth(undefined, hideAmounts),
      listSavingsGoals(),
      listRecurringRules(),
      listLoans(),
      getLoanProgress(),
      listPeople(),
      listCategories(true),
      listAccounts(),
      dailyGoalRead,
      getCategoryMonthlyAverages(3),
      listCardCycles(),
      // The streak only needs the goal value, so it chains off the same read instead of waiting for the batch.
      dailyGoalRead.then((goal) => (goal != null ? getDailyGoalStreakSeries(goal, 5) : null)),
      getDefaultCurrency(),
      listPendingLoanPayments(until),
    ]);
    if (call !== request.current) return;
    const next = buildPlanData({
      hideAmounts,
      budgets,
      goals,
      rules,
      loans,
      progress,
      people,
      categories,
      accounts,
      dailyGoal,
      averages,
      cardCycles,
      streak,
      currency,
      loanPayments,
      today,
    });
    setData((prev) => keepFieldsIfEqual(prev, next));
    setVersion((n) => n + 1);
  }, [hideAmounts]);
  // Time changes the 30-day window even when nobody writes to the ledger.
  const { loaded, loadError, reload } = useScreenLoad(loadPlan);
  useEffect(
    () => () => {
      request.current++;
    },
    []
  );
  return {
    hideAmounts,
    data,
    scoped: data?.hideAmounts === hideAmounts ? data : null,
    version,
    loaded,
    loadError,
    reload,
  };
}

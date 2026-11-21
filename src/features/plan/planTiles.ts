import { formatMaskableMoney, formatMoney } from '@/lib/money';
import type { PlanData } from './planData';

type Tile = {
  name: string;
  icon: string;
  id: 'budgets' | 'goals' | 'investments' | 'debt';
  subtitle: string;
  amount: string;
  /** 0–1 share shown as a bar under the figure; none when there is nothing to measure or amounts are hidden. */
  progress?: number;
  over?: boolean;
};

/**
 * The four "Plan at a glance" tiles: what each collection says in a figure, a line under it, and (where there is
 * something to measure) a bar. Amounts that privacy hides leave no figure and no bar, so neither gives them away.
 */
export function planTiles(
  data: Pick<PlanData, 'budgets' | 'goals' | 'investments' | 'loans' | 'hideAmounts' | 'currency'>
): Tile[] {
  const activeGoals = data.goals.filter((goal) => !goal.archived);
  const openGoals = activeGoals.filter((goal) => goal.currentAmountMinor < goal.targetAmountMinor);
  const budgetLeft = data.budgets.budgetedMinor - data.budgets.usedMinor;
  const money = (minor: number) => formatMoney(minor, data.currency);
  const holdings = data.investments.holdings.length + data.investments.otherCurrency.length;
  const goalTarget = activeGoals.reduce((sum, goal) => sum + goal.targetAmountMinor, 0);
  const goalSaved = activeGoals.reduce(
    (sum, goal) => sum + Math.min(goal.currentAmountMinor, goal.targetAmountMinor),
    0
  );
  const goalFraction = goalTarget > 0 ? goalSaved / goalTarget : 0;
  const budgetOver = budgetLeft < 0;
  return [
    {
      name: 'Budgets',
      icon: 'chart-donut',
      id: 'budgets',
      subtitle: data.budgets.rows.length
        ? budgetOver
          ? 'Over planned limits'
          : `left of ${money(data.budgets.budgetedMinor)}`
        : 'No budgets this month',
      amount: data.budgets.rows.length ? money(Math.abs(budgetLeft)) : '',
      progress:
        data.budgets.budgetedMinor > 0 ? data.budgets.usedMinor / data.budgets.budgetedMinor : undefined,
      over: budgetOver,
    },
    {
      name: 'Goals',
      icon: 'flag-outline',
      id: 'goals',
      subtitle: !activeGoals.length
        ? 'No active goals'
        : data.hideAmounts
          ? 'Savings hidden'
          : openGoals.length
            ? `${openGoals.length} in progress`
            : 'All reached',
      amount: !activeGoals.length || data.hideAmounts ? '' : `${Math.round(goalFraction * 100)}%`,
      progress: !activeGoals.length || data.hideAmounts ? undefined : goalFraction,
    },
    {
      name: 'Investments',
      icon: 'chart-line',
      id: 'investments',
      subtitle: !holdings
        ? 'No holdings'
        : data.hideAmounts
          ? 'Values hidden'
          : data.investments.otherCurrency.length
            ? 'Across currencies'
            : 'Portfolio value',
      amount:
        !holdings || data.hideAmounts
          ? ''
          : data.investments.otherCurrency.length
            ? String(holdings)
            : formatMaskableMoney(data.investments.valueMinor, { currency: data.investments.currency }),
    },
    {
      name: 'Debt',
      icon: 'credit-card-outline',
      id: 'debt',
      subtitle: data.loans.borrowedCount
        ? `to repay · ${Math.round(data.loans.paidFraction * 100)}% paid`
        : data.loans.rows.length
          ? 'Money lent'
          : 'No open loans',
      amount: data.loans.rows.length
        ? money(data.loans.borrowedCount ? data.loans.debtLeftMinor : data.loans.lentLeftMinor)
        : '',
      progress: data.loans.borrowedCount ? data.loans.paidFraction : undefined,
    },
  ];
}

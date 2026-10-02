import { budgetPace } from '@/lib/pace';
import { parseLocalIsoDate } from '@/lib/date';
import type { BudgetProgress } from '@/db/budgets';

type HeroBudget = Pick<BudgetProgress, 'effectiveLimitMinor' | 'spentMinor' | 'percentUsed' | 'overBudget'>;

export type BudgetsTone = 'ok' | 'ahead' | 'over';

export interface BudgetsHeroFigures {
  limitMinor: number;
  spentMinor: number;
  leftMinor: number;
  overMinor: number;
  daysLeft: number;
  /** What is left spread over the days after today. Null once nothing is left, or on the month's last day. */
  perDayMinor: number | null;
  /** Share of the combined limit spent, 0-100 (capped for the bar). */
  usedPct: number;
  /** Where an even spend would be today, 0-100. */
  expectedPct: number;
  budgetCount: number;
  overCount: number;
  /** Budgets still under their limit but past the even-spending line. */
  aheadCount: number;
  /** Worst state across the budgets: any over, else any ahead, else ok. */
  tone: BudgetsTone;
}

export function monthDayInfo(today: string): { day: number; daysInMonth: number; daysLeft: number } {
  const d = parseLocalIsoDate(today);
  const daysInMonth = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  return { day: d.getDate(), daysInMonth, daysLeft: daysInMonth - d.getDate() };
}

/** The totals the Budgets hero shows for one month's budgets, as of `today`. */
export function budgetsOverview(budgets: HeroBudget[], today: string): BudgetsHeroFigures {
  const { day, daysInMonth, daysLeft } = monthDayInfo(today);

  let limitMinor = 0;
  let spentMinor = 0;
  let overCount = 0;
  let aheadCount = 0;
  for (const b of budgets) {
    limitMinor += b.effectiveLimitMinor;
    spentMinor += b.spentMinor;
    if (b.overBudget) overCount += 1;
    else if (budgetPace(b.percentUsed / 100, today).state === 'ahead') aheadCount += 1;
  }

  const leftMinor = Math.max(0, limitMinor - spentMinor);
  return {
    limitMinor,
    spentMinor,
    leftMinor,
    overMinor: Math.max(0, spentMinor - limitMinor),
    daysLeft,
    perDayMinor: leftMinor > 0 && daysLeft > 0 ? Math.floor(leftMinor / daysLeft) : null,
    usedPct: limitMinor > 0 ? Math.min(100, (spentMinor / limitMinor) * 100) : 0,
    expectedPct: (day / daysInMonth) * 100,
    budgetCount: budgets.length,
    overCount,
    aheadCount,
    tone: overCount > 0 ? 'over' : aheadCount > 0 ? 'ahead' : 'ok',
  };
}

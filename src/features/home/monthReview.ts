import { getRangeComparison, findTopGrowingCategory, PeriodComparison } from '@/db/reports';
import { getMonthReviewDismissed } from '@/db/settings';
import { periodRange, previousPeriodRange } from '@/lib/period';
import { roundedMinor } from '@/lib/round';
import { savingsRatePct, savingsRateLabel } from '@/lib/savingsRate';
import { formatPctChange } from '@/lib/format';

/**
 * Home's "month in review" card: on the first days of a month, a short look
 * back at the month that just ended. Pure rules here (buildMonthReview);
 * loadMonthReview does the one query it needs, and only inside the window.
 */

/** The card shows on days 1 to this of each month. */
export const MONTH_REVIEW_LAST_DAY = 7;

export interface MonthReview {
  /** "YYYY-MM" of the reviewed month — what ✕ remembers as dismissed. */
  monthKey: string;
  /** e.g. "September" */
  monthLabel: string;
  spentMinor: number;
  /** "22%" — share of income not spent; null when the month had no income to measure against. */
  keptLabel: string | null;
  topCategoryName: string | null;
  /** e.g. "Food was up 32% on August." — the month's biggest mover, if any. */
  line: string | null;
}

function monthKeyOf(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

/**
 * Whether today is inside the review window, and the key of the month that
 * would be reviewed. Kept separate so the loader can skip its query entirely
 * outside the window or once dismissed.
 */
export function monthReviewWindow(today: Date): { open: boolean; monthKey: string; lastMonth: Date } {
  const lastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
  return { open: today.getDate() <= MONTH_REVIEW_LAST_DAY, monthKey: monthKeyOf(lastMonth), lastMonth };
}

export function buildMonthReview(input: {
  today: Date;
  /** Last month vs the month before it. */
  comparison: PeriodComparison;
  dismissedMonthKey: string | null;
}): MonthReview | null {
  const { open, monthKey, lastMonth } = monthReviewWindow(input.today);
  if (!open || input.dismissedMonthKey === monthKey) return null;
  const { current, previous } = input.comparison;
  // Nothing to look back on — a brand-new user never sees an empty review.
  if (current.expenseMinor <= 0) return null;

  const incomeMinor = roundedMinor(current.incomeMinor);
  const spentMinor = roundedMinor(current.expenseMinor);
  const monthBefore = new Date(lastMonth.getFullYear(), lastMonth.getMonth() - 1, 1);
  const mover = findTopGrowingCategory(current.categoryBreakdown, previous.categoryBreakdown);

  return {
    monthKey,
    monthLabel: lastMonth.toLocaleDateString(undefined, { month: 'long' }),
    spentMinor,
    keptLabel:
      incomeMinor > 0 ? savingsRateLabel(savingsRatePct(incomeMinor - spentMinor, incomeMinor)) : null,
    topCategoryName: current.categoryBreakdown[0]?.name ?? null,
    line: mover
      ? `${mover.name} was up ${formatPctChange(mover.pctChange)} on ${monthBefore.toLocaleDateString(undefined, { month: 'long' })}.`
      : null,
  };
}

/** Fetches what the card needs — but only inside the window and when not dismissed, so Home pays nothing the other ~24 days. */
export async function loadMonthReview(today: Date = new Date()): Promise<MonthReview | null> {
  const { open, monthKey } = monthReviewWindow(today);
  if (!open) return null;
  const dismissed = await getMonthReviewDismissed();
  if (dismissed === monthKey) return null;
  const lastMonthCursor = { granularity: 'month' as const, offset: -1 };
  const comparison = await getRangeComparison(
    periodRange(lastMonthCursor, today),
    previousPeriodRange(lastMonthCursor, today),
    'month'
  );
  return buildMonthReview({ today, comparison, dismissedMonthKey: dismissed });
}

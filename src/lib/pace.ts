import { parseLocalIsoDate } from './date';

/** Before this day of the month there's too little to go on, so no forecast is shown. */
export const PACE_MIN_DAY = 5;
/** How far past the even-spending line a budget can be before it's "ahead of pace", as a share of its limit. */
export const BUDGET_PACE_SLACK = 0.1;

function dayAndLength(today: string): { day: number; daysInMonth: number } {
  const d = parseLocalIsoDate(today);
  return { day: d.getDate(), daysInMonth: new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate() };
}

/**
 * Projected month-end spend (minor units): spent so far + everyday spend/day carried over the days left
 * + EMIs/bills due. "Everyday" skips self-filed categories (EMI, fees, Friends & Family). Null before the 5th.
 */
export function monthPace(input: {
  spentMinor: number;
  everydaySpentMinor: number;
  dueRestOfMonthMinor: number;
  today: string;
}): number | null {
  const { day, daysInMonth } = dayAndLength(input.today);
  if (day < PACE_MIN_DAY) return null;
  const perDay = input.everydaySpentMinor / day;
  return Math.round(input.spentMinor + perDay * (daysInMonth - day) + input.dueRestOfMonthMinor);
}

export type BudgetPaceState = 'onTrack' | 'ahead' | 'over';

/**
 * A budget vs the even-spending line, from the share of its limit used (1 = all). `expectedFraction` is the
 * share gone if spent evenly (26/30 → 0.87). "Ahead": BUDGET_PACE_SLACK past it; "over": past the limit.
 */
export function budgetPace(
  usedFraction: number,
  today: string
): { state: BudgetPaceState; expectedFraction: number } {
  const { day, daysInMonth } = dayAndLength(today);
  const expectedFraction = day / daysInMonth;
  if (!(usedFraction <= 1)) return { state: 'over', expectedFraction };
  return {
    state: usedFraction > expectedFraction + BUDGET_PACE_SLACK ? 'ahead' : 'onTrack',
    expectedFraction,
  };
}

export const BUDGET_PACE_LABEL: Record<BudgetPaceState, string> = {
  onTrack: 'On track',
  ahead: 'Ahead of pace',
  over: 'Over',
};

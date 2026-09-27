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
 * Where this month's spending is heading: what's spent so far, plus your
 * everyday spending per day so far carried over the days left, plus EMIs and
 * bills still due before the month ends. "Everyday" leaves out the
 * categories the app files itself (Loan EMI, fees, Friends & Family), so an
 * EMI on the 5th doesn't inflate every later day. Null before the 5th, when
 * a few days of spending say too little. Minor units.
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
 * A budget against the even-spending line, from the share of its limit
 * used (1 = all of it): `expectedFraction` is how much would be gone by
 * today if it were spent evenly (26 of 30 days → 0.87). "Ahead" once
 * spending is more than BUDGET_PACE_SLACK of the limit past that line;
 * "over" once it's past the limit itself.
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

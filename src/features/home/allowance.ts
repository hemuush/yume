/** How many days of the month are still to come after `now`'s date (the last day has none left). */
export function daysLeftInMonth(now: Date): number {
  const last = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  return Math.max(0, last - now.getDate());
}

/**
 * What can be spent each remaining day and still end the month free: what is free now over the days to come.
 * Null when nothing is free or no days are left, so Home shows no figure rather than a meaningless one.
 */
export function dailyAllowance(freeMinor: number, daysLeft: number): number | null {
  if (!(freeMinor > 0) || daysLeft < 1) return null;
  return Math.round(freeMinor / daysLeft);
}

import { daysUntilIsoDate } from './date';

/**
 * "today" / "in N days" for a near due date; the actual calendar date once
 * it's far enough out that a raw day-count reads as broken rather than
 * useful. Shared by Home's own Upcoming list and the NextDue home-screen
 * widget so the two can never drift into disagreeing about what a due date
 * should say.
 */
export function dueDateLabel(dateStr: string): string {
  const days = daysUntilIsoDate(dateStr);
  if (days <= 0) return 'today';
  if (days <= 90) return `in ${days} days`;
  return `on ${dateStr}`;
}

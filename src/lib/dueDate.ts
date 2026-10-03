import { daysUntilIsoDate } from './date';

/**
 * The full "due ..." phrase: today/in N days when near, "on <date>" when far, "overdue by N days" when past.
 * Self-contained (no caller "Due " prefix); shared by Home's Upcoming and the NextDue widget.
 */
export function dueDateLabel(dateStr: string): string {
  const days = daysUntilIsoDate(dateStr);
  if (days < 0) return `Overdue by ${Math.abs(days)} day${Math.abs(days) === 1 ? '' : 's'}`;
  if (days === 0) return 'Due today';
  if (days === 1) return 'Due tomorrow';
  if (days <= 90) return `Due in ${days} days`;
  return `Due on ${dateStr}`;
}

/** Today or already past — the threshold for the "urgent" (coral) treatment on Home's Upcoming list. */
export function isDueUrgent(dateStr: string): boolean {
  return daysUntilIsoDate(dateStr) <= 0;
}

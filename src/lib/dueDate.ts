import { daysUntilIsoDate } from './date';

/**
 * The full "due ..." phrase for a due date — "due today" / "due in N days"
 * once it's near, "on <date>" once it's far enough out that a raw day-count
 * reads as broken rather than useful, and "overdue by N days" once it's
 * actually past. That last case used to just say "today" too — a bill 3
 * days late told you nothing different from one due this afternoon, which
 * wasn't just unstyled, it was wrong. Self-contained (the caller doesn't
 * prefix its own "Due " — "Overdue by 3 days" already reads correctly
 * without one). Shared by Home's own Upcoming list and the NextDue
 * home-screen widget so the two can never drift into disagreeing about what
 * a due date should say.
 */
export function dueDateLabel(dateStr: string): string {
  const days = daysUntilIsoDate(dateStr);
  if (days < 0) return `Overdue by ${Math.abs(days)} day${Math.abs(days) === 1 ? '' : 's'}`;
  if (days === 0) return 'Due today';
  if (days <= 90) return `Due in ${days} days`;
  return `Due on ${dateStr}`;
}

/** Today or already past — the threshold for the "urgent" (coral) treatment on Home's Upcoming list. */
export function isDueUrgent(dateStr: string): boolean {
  return daysUntilIsoDate(dateStr) <= 0;
}

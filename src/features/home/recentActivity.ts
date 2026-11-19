import { periodLabel, periodRange, type PeriodCursor } from '@/lib/period';

/**
 * What Home's Recent activity says when the period on screen has no entries. It names the period instead of
 * telling someone browsing October to "try another period": the current one says there is nothing yet, a past
 * one says what it was.
 */
export function emptyRecentCopy(
  cursor: PeriodCursor,
  reference: Date = new Date()
): {
  title: string;
  subtitle: string;
} {
  const unit = cursor.granularity;
  if (cursor.offset === 0) {
    return { title: `Nothing logged this ${unit} yet`, subtitle: 'Tap + to add an entry.' };
  }
  return {
    title: `Nothing logged in ${periodLabel(cursor, reference)}`,
    subtitle: `Step to another ${unit} to look elsewhere.`,
  };
}

/**
 * Where "View all" goes: the same month in Activity. Years open Activity at its default range.
 */
export function viewAllTarget(
  cursor: PeriodCursor,
  reference: Date = new Date()
): { pathname: '/transactions'; params?: { month: string } } {
  if (cursor.granularity !== 'month') return { pathname: '/transactions' };
  return { pathname: '/transactions', params: { month: periodRange(cursor, reference).start.slice(0, 7) } };
}

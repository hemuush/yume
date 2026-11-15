import { parseLocalIsoDate } from '@/lib/date';
import { isCustomWindow, windowLabel, type ReportWindow } from '@/lib/period';
import { roundedMinor } from '@/lib/round';
import type { DateRange } from '@/types';
import type { DailyExpensePoint } from '@/db/reports';
import { RANGE_DAY_GRID_MAX_DAYS, daySpendFacts } from './reportsInsights';

/** What the tabs share about the period on show. */
export function periodModel({
  cursor,
  range,
  daily,
  today,
  expenseMinor,
}: {
  cursor: ReportWindow;
  range: DateRange;
  daily: DailyExpensePoint[];
  /** Today's date (ISO). */
  today: string;
  expenseMinor: number;
}) {
  const custom = isCustomWindow(cursor);
  const isYear = cursor.granularity === 'year';
  const daysInPeriod =
    Math.round(
      (parseLocalIsoDate(range.end).getTime() - parseLocalIsoDate(range.start).getTime()) / 86400000
    ) + 1;
  return {
    periodName: windowLabel(cursor),
    custom,
    isYear,
    daysInPeriod,
    // A long custom range reads like a year: by month, with no daily patterns.
    byMonth: isYear || (custom && daysInPeriod > RANGE_DAY_GRID_MAX_DAYS),
    // Spending dated after today is in the total but not in the days so far.
    facts: daySpendFacts(daily, range, today, roundedMinor(expenseMinor)),
  };
}

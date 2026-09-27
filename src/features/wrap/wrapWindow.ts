import { getPeriodSummary } from '@/db/reports';
import { getSeenWraps } from '@/db/settings';
import { periodRange } from '@/lib/period';
import { longMonth } from '@/lib/dateLabels';
import { roundedMinor } from '@/lib/round';
import { WrapPeriod, lastFullWeek, weekLabel } from './wrapData';

/**
 * When Home's Wrap button shows, and what it plays (the Wrap button
 * sign-off): last week's Wrap on a Monday, last month's on the 1st to the
 * 7th. A week or month with no spending has nothing to wrap, so it isn't
 * offered.
 */

/** Last month's Wrap is offered on days 1 to this of each month. */
export const MONTH_WRAP_LAST_DAY = 7;
/** Last week's Wrap is offered on this weekday (Date.getDay(): Monday). */
export const WEEK_WRAP_WEEKDAY = 1;

export interface ReadyWrap {
  period: WrapPeriod;
  /** Same as the Wrap's own key: "YYYY-MM" for a month, the week's first day for a week. */
  key: string;
  /** "September", "20–26 Sept". */
  label: string;
  spentMinor: number;
  /** Already played: the button's ring goes plain. */
  seen: boolean;
}

/** Which Wraps today's date allows, and the period each covers. Pure. */
export function wrapWindow(today: Date): {
  month: { key: string; label: string; start: string; end: string } | null;
  week: { key: string; label: string; start: string; end: string } | null;
} {
  let month = null;
  if (today.getDate() <= MONTH_WRAP_LAST_DAY) {
    const { start, end } = periodRange({ granularity: 'month', offset: -1 }, today);
    month = { key: start.slice(0, 7), label: longMonth(start), start, end };
  }
  let week = null;
  if (today.getDay() === WEEK_WRAP_WEEKDAY) {
    const { start, end } = lastFullWeek(today);
    week = { key: start, label: weekLabel(start, end), start, end };
  }
  return { month, week };
}

/** The Wraps ready today, month first. Queries nothing on the days neither is offered. */
export async function loadReadyWraps(today: Date = new Date()): Promise<ReadyWrap[]> {
  const { month, week } = wrapWindow(today);
  const offered = [
    month && { period: 'month' as const, ...month },
    week && { period: 'week' as const, ...week },
  ].filter((w) => w !== null);
  if (offered.length === 0) return [];
  const [seen, ...summaries] = await Promise.all([
    getSeenWraps(),
    ...offered.map((w) => getPeriodSummary({ start: w.start, end: w.end })),
  ]);
  const ready: ReadyWrap[] = [];
  offered.forEach((w, i) => {
    const spentMinor = roundedMinor(summaries[i].expenseMinor);
    if (spentMinor <= 0) return;
    ready.push({ period: w.period, key: w.key, label: w.label, spentMinor, seen: seen.includes(w.key) });
  });
  return ready;
}

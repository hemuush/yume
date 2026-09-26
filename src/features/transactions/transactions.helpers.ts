import { Transaction } from '@/types';
import { toLocalIsoDate, parseLocalIsoDate, addDaysToIsoDate } from '@/lib/date';

/** One day of the Activity week, enough for its "Sep 7 – 13" label and range. */
export interface WeekDay {
  iso: string;
  day: number;
  /** 0-based, as Date's. */
  month: number;
  year: number;
}

// A 7-day window ending on `anchor`, oldest first — `anchor` is a plain day
// step, not a week counter, so jumping straight to a chosen month (via the
// month picker) works the same way stepping by one day does. Only the
// metadata (for the "Sep 7 – 13" label) comes from this now — the day pills
// themselves were replaced by the spend chart, which is the actual way to
// jump to a day these days (tap a bar).
export function sevenDaysEndingOn(anchor: Date): WeekDay[] {
  const days: WeekDay[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(anchor);
    d.setDate(d.getDate() - i);
    days.push({
      iso: toLocalIsoDate(d),
      day: d.getDate(),
      month: d.getMonth(),
      year: d.getFullYear(),
    });
  }
  return days;
}

/** The equivalent immediately-prior range, for the headline's "N% less/more than last …" line. */
export function previousRangeFor(
  range: { fromDate: string; toDate: string },
  scope: 'week' | 'month'
): { fromDate: string; toDate: string } {
  if (scope === 'week') {
    const prevEnd = addDaysToIsoDate(range.fromDate, -1);
    const prevStart = addDaysToIsoDate(prevEnd, -6);
    return { fromDate: prevStart, toDate: prevEnd };
  }
  const start = parseLocalIsoDate(range.fromDate);
  const prevStart = new Date(start.getFullYear(), start.getMonth() - 1, 1);
  const prevEnd = new Date(start.getFullYear(), start.getMonth(), 0);
  return { fromDate: toLocalIsoDate(prevStart), toDate: toLocalIsoDate(prevEnd) };
}

/** Consecutive same-date runs — relies on `txs` already being date-sorted (the query's own ORDER BY), not a separate grouping pass over unsorted data. */
export function groupByDate(txs: Transaction[]): { date: string; items: Transaction[] }[] {
  const groups: { date: string; items: Transaction[] }[] = [];
  for (const tx of txs) {
    const last = groups[groups.length - 1];
    if (last && last.date === tx.date) last.items.push(tx);
    else groups.push({ date: tx.date, items: [tx] });
  }
  return groups;
}

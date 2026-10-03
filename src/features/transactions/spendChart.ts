import { Category, Transaction } from '@/types';
import { addDaysToIsoDate, parseLocalIsoDate } from '@/lib/date';
import { theme } from '@/constants/theme';

export interface SpendBarSegment {
  categoryId: string;
  name: string;
  color: string;
  amountMinor: number;
}

export interface SpendBar {
  /** Unique key — the day's own ISO date, or a week bucket's start date. */
  key: string;
  /** What shows under the bar — a weekday initial for a daily bar, a day-range ("6–12") for a weekly one. */
  label: string;
  totalMinor: number;
  segments: SpendBarSegment[];
  /** True for the bar covering today — draws the highlight ring. */
  isCurrent: boolean;
  /**
   * A week's seven fixed columns include non-bar days: 'outside' = a day of the neighbouring month (faint
   * dot, named by a note above), 'future' = not happened yet (faint baseline). Neither can be tapped.
   */
  state?: 'outside' | 'future';
}

const WEEKDAY_INITIAL = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

// Bucket for expenses with no (or unresolvable) category, e.g. loan EMIs from raw SQL (payInstallment): they
// still count toward `totalMinor` (as in Home/Reports); only the *segment* depends on a resolved category.
const UNCATEGORIZED_ID = '__uncategorized__';

function summariseExpenses(
  transactions: Transaction[],
  catById: Map<string, Category>,
  fromDate: string,
  toDate: string
): { totalMinor: number; segments: SpendBarSegment[] } {
  const byCategory = new Map<string, number>();
  let totalMinor = 0;
  for (const tx of transactions) {
    // Spending, less any money that came back on it as a refund.
    const signed = tx.type === 'expense' ? tx.amountMinor : tx.isRefund ? -tx.amountMinor : null;
    if (signed == null) continue;
    if (tx.date < fromDate || tx.date > toDate) continue;
    totalMinor += signed;
    const cat = tx.categoryId ? catById.get(tx.categoryId) : undefined;
    const topId = cat ? (cat.parentId ?? tx.categoryId!) : UNCATEGORIZED_ID;
    byCategory.set(topId, (byCategory.get(topId) ?? 0) + signed);
  }
  // A day (or a category in it) never goes below zero.
  totalMinor = Math.max(0, totalMinor);
  const segments = [...byCategory.entries()]
    .filter(([, amountMinor]) => amountMinor > 0)
    .map(([categoryId, amountMinor]) => {
      const cat = catById.get(categoryId);
      return {
        categoryId,
        amountMinor,
        name: cat?.name ?? 'Uncategorized',
        color: cat?.color ?? theme.colors.textMuted,
      };
    })
    // Largest segment first — it anchors the bottom of the stack, matching
    // SpendBarChart's own bottom-up (column-reverse) rendering.
    .sort((a, b) => b.amountMinor - a.amountMinor);
  return { totalMinor, segments };
}

/**
 * The seven Sunday-to-Saturday columns of one week of a month: days outside the month are placeholders, days
 * after today are empty, only real days carry spend (a short first/last week keeps its place in the row).
 */
export function buildWeekSpendBars(
  transactions: Transaction[],
  categories: Category[],
  week: { start: string; end: string },
  todayIso: string
): SpendBar[] {
  const catById = new Map(categories.map((c) => [c.id, c]));
  const sunday = addDaysToIsoDate(week.start, -parseLocalIsoDate(week.start).getDay());
  return Array.from({ length: 7 }, (_, i) => {
    const date = addDaysToIsoDate(sunday, i);
    const base = { key: date, label: WEEKDAY_INITIAL[i], isCurrent: date === todayIso };
    if (date < week.start || date > week.end) {
      return { ...base, totalMinor: 0, segments: [], state: 'outside' as const };
    }
    if (date > todayIso) return { ...base, totalMinor: 0, segments: [], state: 'future' as const };
    const { totalMinor, segments } = summariseExpenses(transactions, catById, date, date);
    return { ...base, totalMinor, segments };
  });
}

/**
 * Splits a month into Sunday-Saturday calendar weeks, clipped to the month's start/end so the first and last
 * can be partial; shared by `buildWeeklySpendBars` and its tests.
 */
export function weekRangesInMonth(monthStart: string, monthEnd: string): { start: string; end: string }[] {
  const ranges: { start: string; end: string }[] = [];
  let cursor = monthStart;
  while (cursor <= monthEnd) {
    const dow = parseLocalIsoDate(cursor).getDay(); // 0 = Sunday
    const daysLeftInWeek = 6 - dow;
    let end = addDaysToIsoDate(cursor, daysLeftInWeek);
    if (end > monthEnd) end = monthEnd;
    ranges.push({ start: cursor, end });
    cursor = addDaysToIsoDate(end, 1);
  }
  return ranges;
}

/**
 * One stacked bar per calendar week of a month (Month scope); few bars keep segment flex ratios sane.
 * (A `flex` built from raw paise reached the hundreds of thousands, which Yoga doesn't lay out reliably.)
 */
export function buildWeeklySpendBars(
  transactions: Transaction[],
  categories: Category[],
  monthStart: string,
  monthEnd: string,
  todayIso: string
): SpendBar[] {
  const catById = new Map(categories.map((c) => [c.id, c]));
  return weekRangesInMonth(monthStart, monthEnd).map(({ start, end }) => {
    const { totalMinor, segments } = summariseExpenses(transactions, catById, start, end);
    const startDay = parseLocalIsoDate(start).getDate();
    const endDay = parseLocalIsoDate(end).getDate();
    return {
      key: start,
      label: startDay === endDay ? String(startDay) : `${startDay}–${endDay}`,
      totalMinor,
      segments,
      isCurrent: todayIso >= start && todayIso <= end,
    };
  });
}

export interface ChartLegendItem {
  categoryId: string;
  name: string;
  color: string;
}

/**
 * Categories that appear in `bars` (not the full list), biggest spend first, so a legend of the first few
 * names the ones that matter.
 */
export function legendForBars(bars: SpendBar[]): ChartLegendItem[] {
  const seen = new Map<string, ChartLegendItem & { totalMinor: number }>();
  for (const bar of bars) {
    for (const seg of bar.segments) {
      const item = seen.get(seg.categoryId);
      if (item) item.totalMinor += seg.amountMinor;
      else
        seen.set(seg.categoryId, {
          categoryId: seg.categoryId,
          name: seg.name,
          color: seg.color,
          totalMinor: seg.amountMinor,
        });
    }
  }
  return [...seen.values()]
    .sort((a, b) => b.totalMinor - a.totalMinor)
    .map(({ categoryId, name, color }) => ({ categoryId, name, color }));
}

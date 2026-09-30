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
   * A week's seven fixed columns include days that aren't bars: 'outside' is a
   * day of the neighbouring month (a dashed placeholder), 'future' a day that
   * hasn't happened yet (a dotted baseline). Neither can be tapped.
   */
  state?: 'outside' | 'future';
}

const WEEKDAY_INITIAL = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

// A stable bucket for any expense with no (or an unresolvable) category —
// loan EMI payments and other transactions written directly via a raw SQL
// insert (see payInstallment) are exactly as real an expense as a normal
// categorized one, and used to be silently invisible here: this function
// required a valid categoryId just to count a transaction toward the total
// at all, not only for the segment breakdown, so an uncategorized expense
// quietly vanished from both the bar's height and the month's own "spent"
// figure on this screen — while Home/Reports (which sum straight from the
// database with no such requirement) kept showing the real total. Now a
// transaction always counts toward `totalMinor` the moment it's a real
// expense in range; only which *segment* it lands in depends on whether a
// category resolves.
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
 * One stacked bar per day, expense-only and rolled up to each transaction's
 * top-level category — a subcategory's spend folds into its parent's
 * segment, matching how Reports treats subcategories everywhere else.
 * Used for Week scope, where a handful of daily bars stays readable.
 */
export function buildDailySpendBars(
  transactions: Transaction[],
  categories: Category[],
  days: string[],
  todayIso: string
): SpendBar[] {
  const catById = new Map(categories.map((c) => [c.id, c]));
  return days.map((date) => {
    const { totalMinor, segments } = summariseExpenses(transactions, catById, date, date);
    return {
      key: date,
      label: WEEKDAY_INITIAL[parseLocalIsoDate(date).getDay()],
      totalMinor,
      segments,
      isCurrent: date === todayIso,
    };
  });
}

/**
 * The seven Sunday-to-Saturday columns of one week of a month. A short first
 * or last week keeps its place in the row: days outside the month are
 * placeholders, days after today are empty, and only real days carry spend.
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
 * Splits a month into calendar weeks (Sunday–Saturday, clipped to the
 * month's own start/end so the first and last bucket can be partial) —
 * shared by `buildWeeklySpendBars` and its own tests.
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
 * One stacked bar per calendar week within a month — Month scope's chart,
 * replacing a dense 28-31-bar-a-month grid that crowded and, worse, could
 * render several of that many bars' segments overlapping (a `flex` value
 * built from a segment's own raw paise amount could reach into the
 * hundreds of thousands, which Yoga doesn't lay out reliably at that
 * scale — see SpendBarChart's own fix). A handful of week bars stays both
 * readable and safely within normal flex-ratio territory.
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
 * Every category that actually appears in `bars` — only what the chart is
 * showing, not the full category list — biggest spend first, so a legend
 * that names only the first few names the ones that matter.
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

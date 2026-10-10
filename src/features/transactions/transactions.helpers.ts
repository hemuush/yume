import { Category, Transaction } from '@/types';
import { getCachedCurrency } from '@/db/settings';
import type { ActivityFilter } from './FilterModal';
import { toLocalIsoDate, parseLocalIsoDate, addDaysToIsoDate } from '@/lib/date';
import { dayMonth } from '@/lib/dateLabels';
import { weekRangesInMonth } from './spendChart';

/** One Sunday-to-Saturday week of a calendar month, cut at the month's own first and last day. */
export interface ActivityWeek {
  start: string;
  end: string;
  /** 0-based position among the month's weeks. */
  index: number;
  /** Every week of the month, in order — the week rail draws one segment for each. */
  ranges: { start: string; end: string }[];
}

/** The week of its month that holds `anchor`. Never reaches into a neighbouring month. */
export function weekContaining(anchor: Date): ActivityWeek {
  const iso = toLocalIsoDate(anchor);
  const monthStart = toLocalIsoDate(new Date(anchor.getFullYear(), anchor.getMonth(), 1));
  const monthEnd = toLocalIsoDate(new Date(anchor.getFullYear(), anchor.getMonth() + 1, 0));
  const ranges = weekRangesInMonth(monthStart, monthEnd);
  const index = Math.max(
    0,
    ranges.findIndex((r) => iso >= r.start && iso <= r.end)
  );
  return { ...ranges[index], index, ranges };
}

/**
 * Day to anchor on after one week back (-1) or forward (+1): the neighbouring week of the same month, or the
 * last/first week of the neighbouring month at a month edge. Forward stops at today.
 */
export function stepWeekAnchor(anchor: Date, dir: -1 | 1, today: Date): Date {
  const week = weekContaining(anchor);
  let iso: string;
  if (dir < 0) {
    iso =
      week.index > 0
        ? week.ranges[week.index - 1].start
        : weekContaining(new Date(anchor.getFullYear(), anchor.getMonth(), 0)).start;
  } else {
    iso =
      week.index < week.ranges.length - 1 ? week.ranges[week.index + 1].start : addDaysToIsoDate(week.end, 1);
  }
  return iso > toLocalIsoDate(today) ? today : parseLocalIsoDate(iso);
}

/**
 * Immediately-prior equivalent range for the headline's "N% less/more than last …" line.
 * A week compares with the same weekdays of the prior week, only up to the same day while in progress.
 */
export function previousRangeFor(
  range: { fromDate: string; toDate: string },
  scope: 'week' | 'month',
  todayIso?: string
): { fromDate: string; toDate: string } {
  if (scope === 'week') {
    const toDate = addDaysToIsoDate(range.toDate, -7);
    const inProgress = todayIso != null && todayIso >= range.fromDate && todayIso < range.toDate;
    return {
      fromDate: addDaysToIsoDate(range.fromDate, -7),
      toDate: inProgress ? addDaysToIsoDate(todayIso, -7) : toDate,
    };
  }
  const start = parseLocalIsoDate(range.fromDate);
  const prevStart = new Date(start.getFullYear(), start.getMonth() - 1, 1);
  const prevEnd = new Date(start.getFullYear(), start.getMonth(), 0);
  return { fromDate: toLocalIsoDate(prevStart), toDate: toLocalIsoDate(prevEnd) };
}

/** What the headline's change pill compares against: "last week", or "same days last week" for a part-week. */
export function weekCompareLabel(week: { start: string; end: string }, todayIso: string): string {
  const partial =
    week.start !== addDaysToIsoDate(week.end, -6) || (todayIso >= week.start && todayIso < week.end);
  return partial ? 'same days last week' : 'last week';
}

/**
 * Consecutive same-date runs — relies on `txs` already being date-sorted (the query's own ORDER BY), not a
 * separate grouping pass over unsorted data.
 */
export function groupByDate(txs: Transaction[]): { date: string; items: Transaction[] }[] {
  const groups: { date: string; items: Transaction[] }[] = [];
  for (const tx of txs) {
    const last = groups[groups.length - 1];
    if (last && last.date === tx.date) last.items.push(tx);
    else groups.push({ date: tx.date, items: [tx] });
  }
  return groups;
}

/**
 * Period bar title + quieter line. A week is a Sunday-Saturday row of its month: "This week" adds its dates
 * and place ("1–3 Oct · Week 1 of 5"); other weeks lead with dates. A month: its name, plus year if not now.
 */
export function periodHeading(input: {
  scope: 'week' | 'month';
  week: ActivityWeek;
  anchor: Date;
  today: Date;
}): { title: string; sub: string } {
  const { scope, week, anchor, today } = input;
  if (scope === 'month') {
    const title = anchor.toLocaleDateString(undefined, { month: 'long' });
    return { title, sub: anchor.getFullYear() === today.getFullYear() ? '' : String(anchor.getFullYear()) };
  }
  // The same "27 Sept" as each day's heading below it, so the two never disagree ("Sep" vs "Sept").
  const range =
    week.start === week.end
      ? dayMonth(week.end)
      : `${parseLocalIsoDate(week.start).getDate()}–${dayMonth(week.end)}`;
  const todayIso = toLocalIsoDate(today);
  const position = `Week ${week.index + 1} of ${week.ranges.length}`;
  if (todayIso >= week.start && todayIso <= week.end)
    return { title: 'This week', sub: `${range} · ${position}` };
  return {
    title: range,
    sub: anchor.getFullYear() === today.getFullYear() ? position : `${position} · ${anchor.getFullYear()}`,
  };
}

/**
 * Activity's list after filters: type, then accounts (a transfer matches either side), then categories,
 * where picking a parent ("Food & Dining") also matches its subcategories ("Zomato"), as Reports rolls up.
 */
export function filterActivity(
  transactions: Transaction[],
  filter: ActivityFilter,
  categories: Category[]
): Transaction[] {
  const parentOf = new Map(categories.map((c) => [c.id, c.parentId]));
  return transactions.filter((t) => {
    // A refund belongs with spending (it lowers it), so "Spent" shows it and "Income" doesn't.
    const filterAs = t.isRefund ? 'expense' : t.type;
    if (filter.type !== 'all' && filterAs !== filter.type) return false;
    if (
      filter.accountIds.length > 0 &&
      !filter.accountIds.includes(t.accountId) &&
      !(t.toAccountId && filter.accountIds.includes(t.toAccountId))
    ) {
      return false;
    }
    if (filter.categoryIds.length > 0) {
      if (!t.categoryId) return false;
      const parent = parentOf.get(t.categoryId);
      if (!filter.categoryIds.includes(t.categoryId) && !(parent && filter.categoryIds.includes(parent))) {
        return false;
      }
    }
    return true;
  });
}

/** One line on a timeline day: a single entry, or several of the same category stacked. */
export type LaneLine =
  | { kind: 'single'; tx: Transaction }
  | {
      kind: 'stack';
      key: string;
      categoryId: string | null;
      type: 'income' | 'expense';
      items: Transaction[];
      totalMinor: number;
    };

/**
 * Day layout (newest first): own-account transfers become notes; 2+ same-category entries stack into one line
 * ("Food & Dining ×5") in the newest's place. Split parts are plain lines of their own and never join a stack.
 */
export function buildDayLane(
  items: Transaction[],
  date: string,
  accountCurrency: (id: string) => string = () => ''
): { transfers: Transaction[]; lines: LaneLine[] } {
  const transfers = items.filter((t) => t.type === 'transfer');
  const rest = items.filter((t) => t.type !== 'transfer');
  const groupKey = (t: Transaction) => {
    const currency = accountCurrency(t.accountId);
    return `${date}|${t.type}|${t.categoryId ?? ''}${currency && currency !== getCachedCurrency() ? `|${currency}` : ''}`;
  };
  const counts = new Map<string, number>();
  for (const t of rest) {
    if (!t.splitId) counts.set(groupKey(t), (counts.get(groupKey(t)) ?? 0) + 1);
  }
  const lines: LaneLine[] = [];
  const stacks = new Map<string, Extract<LaneLine, { kind: 'stack' }>>();
  for (const t of rest) {
    const key = groupKey(t);
    if (t.splitId || (counts.get(key) ?? 0) < 2) {
      lines.push({ kind: 'single', tx: t });
      continue;
    }
    let stack = stacks.get(key);
    if (!stack) {
      stack = {
        kind: 'stack',
        key,
        categoryId: t.categoryId,
        type: t.type as 'income' | 'expense',
        items: [],
        totalMinor: 0,
      };
      stacks.set(key, stack);
      lines.push(stack);
    }
    stack.items.push(t);
    stack.totalMinor += t.amountMinor;
  }
  // Once the day has been arranged by hand, every line keeps the place it was dragged to.
  if (items.some((t) => t.dayRank != null)) {
    const place = new Map(items.map((t, i) => [t.id, i]));
    const top = (l: LaneLine) =>
      Math.min(...(l.kind === 'single' ? [l.tx] : l.items).map((t) => place.get(t.id) ?? Infinity));
    lines.sort((x, y) => top(x) - top(y));
  }
  return { transfers, lines };
}

/** The lines with one dragged from `from` to `to` (a new array; out-of-range moves change nothing). */
export function moveLine(lines: LaneLine[], from: number, to: number): LaneLine[] {
  if (from === to || from < 0 || to < 0 || from >= lines.length || to >= lines.length) return lines;
  const next = [...lines];
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved);
  return next;
}

/**
 * Where a line lifted from `from` and dragged `dy` px lands: the line whose
 * slot the lifted line's middle is over (`heights` are the lines' own heights, top to bottom).
 */
export function dropIndex(heights: number[], from: number, dy: number): number {
  if (heights.length === 0) return from;
  let top = 0;
  let centre = dy;
  const ends = heights.map((h, i) => {
    if (i === from) centre += top + h / 2;
    top += h;
    return top;
  });
  const hit = ends.findIndex((end) => centre < end);
  return hit === -1 ? heights.length - 1 : hit;
}

/** A day's entry ids top to bottom, as saved: each line's entries together, transfers after. */
export function laneOrderIds(lines: LaneLine[], transfers: Transaction[]): string[] {
  return [
    ...lines.flatMap((l) => (l.kind === 'single' ? [l.tx.id] : l.items.map((t) => t.id))),
    ...transfers.map((t) => t.id),
  ];
}

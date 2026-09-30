import { Category, Transaction } from '@/types';
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
 * The day to anchor on after one week back (-1) or forward (+1): the
 * neighbouring week of the same month, or the last/first week of the
 * neighbouring month at a month edge. Forward stops at today.
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
 * The equivalent immediately-prior range, for the headline's "N% less/more than last …" line.
 * A week is compared with the same weekdays of the week before, and — while it is still in
 * progress — only up to the same day, so a part-week is never set against a whole one.
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

/**
 * The Activity period bar's title and the quieter line beside it. A week is
 * the Sunday-to-Saturday row of its month, so "This week" carries its real
 * dates ("1–3 Oct") alongside; any other week leads with its dates and says
 * which week of the month it is. A month is its name, plus the year only when
 * it isn't this year's.
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
  if (todayIso >= week.start && todayIso <= week.end) return { title: 'This week', sub: range };
  const position = `Week ${week.index + 1} of ${week.ranges.length}`;
  return {
    title: range,
    sub: anchor.getFullYear() === today.getFullYear() ? position : `${position} · ${anchor.getFullYear()}`,
  };
}

/**
 * Activity's list after its filters: the type, then any accounts (a
 * transfer matches either side), then any categories — where picking a
 * parent ("Food & Dining") also matches its subcategories ("Zomato"), the
 * same rollup Reports uses.
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
    }
  | {
      /** The parts of one split payment, shown as the one payment they were. */
      kind: 'split';
      key: string;
      splitId: string;
      items: Transaction[];
      totalMinor: number;
    };

/**
 * How Activity's timeline draws one day (newest first, as the day's entries
 * already are): transfers between your own accounts come out as notes on the
 * thread, and two or more spending (or income) entries in the same category
 * stack into one line — "Food & Dining ×5" — in the place of the newest of
 * them. The parts of a split payment come first as one line of their own
 * ("Split · 2 categories"), and never join a category's stack. Everything
 * else stays a line of its own.
 */
export function buildDayLane(
  items: Transaction[],
  date: string
): { transfers: Transaction[]; lines: LaneLine[] } {
  const transfers = items.filter((t) => t.type === 'transfer');
  // A split shows whole only when at least two of its parts are here (a
  // category filter can leave just one, which then reads as a plain entry).
  const partsBySplit = new Map<string, Transaction[]>();
  for (const t of items) {
    if (t.type === 'transfer' || !t.splitId) continue;
    partsBySplit.set(t.splitId, [...(partsBySplit.get(t.splitId) ?? []), t]);
  }
  const isGroupedPart = (t: Transaction) => !!t.splitId && (partsBySplit.get(t.splitId)?.length ?? 0) >= 2;
  const rest = items.filter((t) => t.type !== 'transfer' && !isGroupedPart(t));
  const groupKey = (t: Transaction) => `${date}|${t.type}|${t.categoryId ?? ''}`;
  const counts = new Map<string, number>();
  for (const t of rest) counts.set(groupKey(t), (counts.get(groupKey(t)) ?? 0) + 1);
  const lines: LaneLine[] = [];
  const stacks = new Map<string, Extract<LaneLine, { kind: 'stack' }>>();
  // Splits sit where their newest part sits in the day, like stacks do.
  const splitsPlaced = new Set<string>();
  for (const t of items) {
    if (!isGroupedPart(t)) continue;
    if (splitsPlaced.has(t.splitId!)) continue;
    splitsPlaced.add(t.splitId!);
    const parts = [...partsBySplit.get(t.splitId!)!].sort((a, b) => b.amountMinor - a.amountMinor);
    lines.push({
      kind: 'split',
      key: `${date}|split|${t.splitId}`,
      splitId: t.splitId!,
      items: parts,
      totalMinor: parts.reduce((s, p) => s + p.amountMinor, 0),
    });
  }
  for (const t of rest) {
    const key = groupKey(t);
    if ((counts.get(key) ?? 0) < 2) {
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
  // Once the day has been arranged by hand, every line keeps the place it was
  // dragged to (splits included); until then splits lead, as above.
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

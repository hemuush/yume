import { Category, Transaction } from '@/types';
import type { ActivityFilter } from './FilterModal';
import { toLocalIsoDate, parseLocalIsoDate, addDaysToIsoDate } from '@/lib/date';
import { dayMonth } from '@/lib/dateLabels';

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

/**
 * The Activity period bar's title and the quieter line beside it. A week is
 * the 7 days ending on the anchor, so "This week" carries its real dates
 * ("20–26 Sep") alongside; a past week leads with its dates. A month is its
 * name, plus the year only when it isn't this year's.
 */
export function periodHeading(input: {
  scope: 'week' | 'month';
  days: WeekDay[];
  anchor: Date;
  today: Date;
}): { title: string; sub: string } {
  const { scope, days, anchor, today } = input;
  if (scope === 'month') {
    const title = anchor.toLocaleDateString(undefined, { month: 'long' });
    return { title, sub: anchor.getFullYear() === today.getFullYear() ? '' : String(anchor.getFullYear()) };
  }
  const first = days[0];
  const last = days[days.length - 1];
  // The same "27 Sept" as each day's heading below it, so the two never disagree ("Sep" vs "Sept").
  const range =
    first.month === last.month
      ? `${first.day}–${dayMonth(last.iso)}`
      : `${dayMonth(first.iso)} – ${dayMonth(last.iso)}`;
  const isCurrent = days.some((d) => d.iso === toLocalIsoDate(today));
  if (isCurrent) return { title: 'This week', sub: range };
  return { title: range, sub: last.year === today.getFullYear() ? '' : String(last.year) };
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
  return { transfers, lines };
}

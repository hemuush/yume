import type { Account, Category, Loan, Transaction } from '@/types';
import { investLines, investRole, investmentIdsOf } from '@/lib/investment';
import type { PersonWithBalance } from '@/db/people';
import {
  ReportPeriod,
  addDays,
  daysBetween,
  daysInMonth,
  inPeriod,
  periodRange,
  previousPeriod,
  weekdayIndex,
} from './period';

export interface ReportInput {
  currency: string;
  accounts: Account[];
  categories: Category[];
  /** Every entry (all periods): the previous period is read from the same list. */
  transactions: Transaction[];
  loans: Loan[];
  people: PersonWithBalance[];
  period: ReportPeriod;
  /** Today as YYYY-MM-DD, so a running month or year is averaged over the days so far. */
  today: string;
}

export interface CategoryRow {
  id: string;
  name: string;
  color: string;
  totalMinor: number;
  share: number; // 0–1 of the kind's total
  count: number;
  avgMinor: number;
  subs: { name: string; totalMinor: number; count: number }[];
}

export interface BarPoint {
  label: string;
  spentMinor: number;
  incomeMinor: number;
}

export interface ReportEntry {
  tx: Transaction;
  title: string;
  detail: string;
  /** The category's label, for lists that show it apart from the title. */
  category: string;
  /** Top-level category colour; neutral for a transfer. */
  color: string;
  /** Currency of the account the entry sits in. */
  currency: string;
}

export interface Report {
  period: ReportPeriod;
  currency: string;
  from: string;
  to: string;
  /** Days the averages run over (a running month or year counts only the days so far). */
  elapsedDays: number;
  incomeMinor: number;
  spentMinor: number;
  netMinor: number;
  /** Net as a share of income, or null with no income. */
  savedShare: number | null;
  avgPerDayMinor: number;
  noSpendDays: number | null;
  entryCount: number;
  transferCount: number;
  /** Entries in other currencies, listed but never added into the totals. */
  otherCurrencyCount: number;
  previous: { label: string; spentMinor: number; incomeMinor: number } | null;
  biggestDay: { date: string; spentMinor: number } | null;
  spendByCategory: CategoryRow[];
  incomeByCategory: CategoryRow[];
  series: { kind: 'days' | 'months' | 'years'; points: BarPoint[] };
  weekday: { label: string; avgMinor: number; totalMinor: number }[];
  topExpenses: ReportEntry[];
  frequent: { label: string; count: number; totalMinor: number }[];
  accountActivity: {
    name: string;
    type: string;
    balanceMinor: number;
    spentMinor: number;
    incomeMinor: number;
  }[];
  months: { label: string; incomeMinor: number; spentMinor: number; netMinor: number; count: number }[];
  entries: ReportEntry[];
  loans: Loan[];
  people: PersonWithBalance[];
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** A refund lowers spending and is never income; the rule every total in the app follows. */
const spendEffect = (t: Transaction) =>
  t.type === 'expense' ? t.amountMinor : t.type === 'income' && t.isRefund ? -t.amountMinor : 0;
const incomeEffect = (t: Transaction) => (t.type === 'income' && !t.isRefund ? t.amountMinor : 0);

function categoryLabel(categories: Map<string, Category>, id: string | null): string {
  if (!id) return 'Transfer';
  const cat = categories.get(id);
  if (!cat) return 'Deleted category';
  if (!cat.parentId) return cat.name;
  const parent = categories.get(cat.parentId);
  return parent ? `${parent.name} › ${cat.name}` : cat.name;
}

function elapsedDaysFor(period: ReportPeriod, from: string, to: string, today: string): number {
  if (period.kind === 'all') return Math.max(1, daysBetween(from, to) + 1);
  const end = today < from ? from : today > to ? to : today;
  return Math.max(1, daysBetween(from, end) + 1);
}

export function computeReport(input: ReportInput): Report {
  const { currency, accounts, categories, loans, people, period, today } = input;
  const accountById = new Map(accounts.map((a) => [a.id, a]));
  const categoryById = new Map(categories.map((c) => [c.id, c]));
  const currencyOf = (t: Transaction) => accountById.get(t.accountId)?.currency ?? currency;

  const inRange = input.transactions.filter((t) => inPeriod(t.date, period));
  const counted = inRange.filter((t) => currencyOf(t) === currency);
  const range = periodRange(
    period,
    inRange.map((t) => t.date)
  ) ?? { from: today, to: today };
  const elapsedDays = elapsedDaysFor(period, range.from, range.to, today);

  const incomeMinor = counted.reduce((s, t) => s + incomeEffect(t), 0);
  const spentMinor = Math.max(
    0,
    counted.reduce((s, t) => s + spendEffect(t), 0)
  );

  // ---- days / months / years series and the busiest day
  const spendByDay = new Map<string, number>();
  for (const t of counted) {
    const day = t.date.slice(0, 10);
    spendByDay.set(day, (spendByDay.get(day) ?? 0) + spendEffect(t));
  }
  let biggestDay: Report['biggestDay'] = null;
  for (const [date, v] of spendByDay) {
    if (v > 0 && (!biggestDay || v > biggestDay.spentMinor)) biggestDay = { date, spentMinor: v };
  }
  let noSpendDays: number | null = null;
  if (period.kind !== 'all') {
    noSpendDays = 0;
    for (let i = 0; i < elapsedDays; i++) {
      if ((spendByDay.get(addDays(range.from, i)) ?? 0) <= 0) noSpendDays++;
    }
  }

  const bucket = (keyOf: (iso: string) => string, labels: string[]): BarPoint[] => {
    const map = new Map(labels.map((l) => [l, { label: l, spentMinor: 0, incomeMinor: 0 }]));
    for (const t of counted) {
      const p = map.get(keyOf(t.date));
      if (!p) continue;
      p.spentMinor += spendEffect(t);
      p.incomeMinor += incomeEffect(t);
    }
    return [...map.values()].map((p) => ({ ...p, spentMinor: Math.max(0, p.spentMinor) }));
  };
  let series: Report['series'];
  if (period.kind === 'month') {
    const labels = Array.from({ length: daysInMonth(period.year, period.month) }, (_, i) => String(i + 1));
    series = { kind: 'days', points: bucket((d) => String(Number(d.slice(8, 10))), labels) };
  } else if (period.kind === 'year') {
    series = { kind: 'months', points: bucket((d) => MONTHS[Number(d.slice(5, 7)) - 1], MONTHS) };
  } else {
    const y0 = Number(range.from.slice(0, 4));
    const y1 = Number(range.to.slice(0, 4));
    const labels = Array.from({ length: y1 - y0 + 1 }, (_, i) => String(y0 + i));
    series = { kind: 'years', points: bucket((d) => d.slice(0, 4), labels) };
  }

  // ---- categories (top level, subcategories folded in)
  const group = (kind: 'expense' | 'income'): CategoryRow[] => {
    const rows = new Map<
      string,
      {
        id: string;
        name: string;
        color: string;
        total: number;
        count: number;
        subs: Map<string, { total: number; count: number }>;
      }
    >();
    for (const t of counted) {
      if (t.type === 'transfer' || !t.categoryId) continue;
      const isSpend = t.type === 'expense' || (t.type === 'income' && t.isRefund);
      if (kind === 'expense' ? !isSpend : isSpend || t.type !== 'income') continue;
      const cat = categoryById.get(t.categoryId);
      const topId = cat?.parentId ?? t.categoryId;
      const top = categoryById.get(topId);
      const amount = kind === 'expense' ? spendEffect(t) : t.amountMinor;
      const counts = kind === 'expense' ? (t.type === 'expense' ? 1 : 0) : 1;
      const row = rows.get(topId) ?? {
        id: topId,
        name: top?.name ?? cat?.name ?? 'Deleted category',
        color: top?.color ?? cat?.color ?? '#CFC8B6',
        total: 0,
        count: 0,
        subs: new Map(),
      };
      row.total += amount;
      row.count += counts;
      if (cat?.parentId) {
        const sub = row.subs.get(cat.name) ?? { total: 0, count: 0 };
        sub.total += amount;
        sub.count += counts;
        row.subs.set(cat.name, sub);
      }
      rows.set(topId, row);
    }
    const live = [...rows.values()].filter((r) => r.total > 0).sort((a, b) => b.total - a.total);
    const sum = live.reduce((s, r) => s + r.total, 0);
    return live.map((r) => ({
      id: r.id,
      name: r.name,
      color: r.color,
      totalMinor: r.total,
      share: sum ? r.total / sum : 0,
      count: r.count,
      avgMinor: r.count ? Math.round(r.total / r.count) : 0,
      subs: [...r.subs]
        .map(([name, v]) => ({ name, totalMinor: v.total, count: v.count }))
        .filter((s) => s.totalMinor > 0)
        .sort((a, b) => b.totalMinor - a.totalMinor),
    }));
  };

  // ---- weekday pattern: average spend on each weekday over the days that have passed
  const weekdayTotals = Array<number>(7).fill(0);
  const weekdayDays = Array<number>(7).fill(0);
  for (let i = 0; i < elapsedDays; i++) weekdayDays[weekdayIndex(addDays(range.from, i))]++;
  for (const [date, v] of spendByDay) weekdayTotals[weekdayIndex(date)] += v;
  const weekdayLabels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const weekday = weekdayLabels.map((label, i) => ({
    label,
    totalMinor: Math.max(0, weekdayTotals[i]),
    avgMinor: weekdayDays[i] ? Math.max(0, Math.round(weekdayTotals[i] / weekdayDays[i])) : 0,
  }));

  // ---- entries, with the words each row shows
  const investmentIds = investmentIdsOf(accounts);
  const accountName = (id: string | null) => (id ? (accountById.get(id)?.name ?? 'Deleted account') : '');
  const entryOf = (t: Transaction): ReportEntry => {
    const label = categoryLabel(categoryById, t.categoryId);
    const note = t.note.trim();
    const where = accountName(t.accountId);
    const cat = t.categoryId ? categoryById.get(t.categoryId) : undefined;
    const color =
      (cat?.parentId ? categoryById.get(cat.parentId)?.color : undefined) ?? cat?.color ?? '#CFC8B6';
    const role = investRole(t, investmentIds);
    if (role) {
      const lines = investLines(t, role, (id) => accountName(id));
      return {
        tx: t,
        title: lines.title,
        detail: lines.sub,
        category: 'Investment',
        color: '#CFC8B6',
        currency: currencyOf(t),
      };
    }
    if (t.type === 'transfer') {
      return {
        tx: t,
        title: note || 'Transfer',
        detail: `Transfer · ${where} → ${accountName(t.toAccountId)}`,
        category: 'Transfer',
        color: '#CFC8B6',
        currency: currencyOf(t),
      };
    }
    // With no note the title is the category already, so the second line only adds where it was paid from.
    return {
      tx: t,
      title: note || label,
      detail: `${t.isRefund ? 'Refund · ' : ''}${note ? `${label} · ` : ''}${where}`,
      category: label,
      color,
      currency: currencyOf(t),
    };
  };
  // Newest day first; within a day the order the app keeps (stable sort).
  const entries = [...inRange]
    .sort((a, b) =>
      a.date.slice(0, 10) < b.date.slice(0, 10) ? 1 : a.date.slice(0, 10) > b.date.slice(0, 10) ? -1 : 0
    )
    .map(entryOf);

  const topExpenses = counted
    .filter((t) => t.type === 'expense')
    .sort((a, b) => b.amountMinor - a.amountMinor)
    .slice(0, 5)
    .map(entryOf);

  const oft = new Map<string, { label: string; count: number; total: number }>();
  for (const t of counted) {
    const note = t.note.trim();
    if (t.type !== 'expense' || !note) continue;
    const key = note.toLowerCase();
    const row = oft.get(key) ?? { label: note, count: 0, total: 0 };
    row.count++;
    row.total += t.amountMinor;
    oft.set(key, row);
  }
  const frequent = [...oft.values()]
    .filter((r) => r.count >= 2)
    .sort((a, b) => b.count - a.count || b.total - a.total)
    .slice(0, 5)
    .map((r) => ({ label: r.label, count: r.count, totalMinor: r.total }));

  // ---- accounts: what moved through each in the period, beside today's balance
  const activity = new Map<string, { spent: number; income: number }>();
  for (const t of counted) {
    const a = activity.get(t.accountId) ?? { spent: 0, income: 0 };
    a.spent += spendEffect(t);
    a.income += incomeEffect(t);
    activity.set(t.accountId, a);
  }
  const accountActivity = accounts
    .filter((a) => a.currency === currency && (!a.archived || activity.has(a.id)))
    .map((a) => ({
      name: a.name,
      type: a.investment ? 'investment' : a.type.replace('_', ' '),
      balanceMinor: a.currentBalanceMinor,
      spentMinor: Math.max(0, activity.get(a.id)?.spent ?? 0),
      incomeMinor: activity.get(a.id)?.income ?? 0,
    }));

  // ---- the period before, for the comparison line
  let previous: Report['previous'] = null;
  const prev = previousPeriod(period);
  if (prev) {
    const before = input.transactions.filter((t) => inPeriod(t.date, prev) && currencyOf(t) === currency);
    const label =
      prev.kind === 'month'
        ? `${MONTHS[prev.month - 1]} ${prev.year}`
        : prev.kind === 'year'
          ? String(prev.year)
          : 'All time';
    if (before.length) {
      previous = {
        label,
        spentMinor: Math.max(
          0,
          before.reduce((s, t) => s + spendEffect(t), 0)
        ),
        incomeMinor: before.reduce((s, t) => s + incomeEffect(t), 0),
      };
    }
  }

  // ---- month-by-month table for a year or everything
  const months: Report['months'] = [];
  if (period.kind !== 'month') {
    const byMonth = new Map<string, { income: number; spent: number; count: number }>();
    for (const t of counted) {
      const key = t.date.slice(0, 7);
      const m = byMonth.get(key) ?? { income: 0, spent: 0, count: 0 };
      m.income += incomeEffect(t);
      m.spent += spendEffect(t);
      m.count += t.isRefund ? 0 : 1;
      byMonth.set(key, m);
    }
    for (const key of [...byMonth.keys()].sort()) {
      const m = byMonth.get(key)!;
      const spent = Math.max(0, m.spent);
      months.push({
        label: `${MONTHS[Number(key.slice(5, 7)) - 1]} ${key.slice(0, 4)}`,
        incomeMinor: m.income,
        spentMinor: spent,
        netMinor: m.income - spent,
        count: m.count,
      });
    }
  }

  const net = incomeMinor - spentMinor;
  return {
    period,
    currency,
    from: range.from,
    to: range.to,
    elapsedDays,
    incomeMinor,
    spentMinor,
    netMinor: net,
    savedShare: incomeMinor > 0 ? net / incomeMinor : null,
    avgPerDayMinor: Math.round(spentMinor / elapsedDays),
    noSpendDays,
    entryCount: inRange.filter((t) => t.type !== 'transfer' && !t.isRefund).length,
    transferCount: inRange.filter((t) => t.type === 'transfer').length,
    otherCurrencyCount: inRange.length - counted.length,
    previous,
    biggestDay,
    spendByCategory: group('expense'),
    incomeByCategory: group('income'),
    series,
    weekday,
    topExpenses,
    frequent,
    accountActivity,
    months,
    entries,
    loans: loans.filter((l) => l.status === 'active'),
    people: people.filter((p) => p.balanceMinor !== 0),
  };
}

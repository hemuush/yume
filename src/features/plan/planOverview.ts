import { addDaysToIsoDate, dayOfIsoDate, parseLocalIsoDate } from '@/lib/date';
import { advanceDate } from '@/lib/recurrence';
import type { RecurrenceFrequency } from '@/types';
import { peopleTotals } from '@/features/people/people.helpers';
import { payCardRoute, PayCardRoute } from '@/lib/payCard';

/**
 * What each Plan tab section says, from data the screen already fetched. Pure (today's date is an input), so
 * rules are tested without a DB or clock. Order: next 2 weeks, where you stand, Saving, Friends, Coming up.
 */

export type PlanRoute =
  '/budgets' | '/savings-goals' | '/recurring' | '/whatif' | '/loans' | '/people' | '/garden' | PayCardRoute;

/* ---------- Loans ---------- */

export interface PlanLoanInput {
  id: string;
  counterparty: string;
  direction: 'borrowed' | 'lent';
  status: 'active' | 'closed' | 'defaulted';
  principalMinor: number;
  outstandingPrincipalMinor: number;
}

export interface PlanLoanProgressInput {
  loanId: string;
  paidCount: number;
  totalCount: number;
  nextDueDate: string | null;
  nextEmiMinor: number | null;
  /** The last installment's due date — when the loan is done. */
  lastDueDate?: string | null;
}

export interface PlanLoanRow {
  id: string;
  name: string;
  direction: 'borrowed' | 'lent';
  leftMinor: number;
  nextDueDate: string | null;
  nextEmiMinor: number | null;
  paidCount: number;
  totalCount: number;
  /** When its last EMI is due (YYYY-MM-DD), if known. */
  endDate: string | null;
}

export interface LoansSummary {
  /** Outstanding on everything you borrowed (not closed). */
  debtLeftMinor: number;
  /** Principal repaid so far on those same loans. */
  paidOffMinor: number;
  /** Their original principal — debtLeft + paidOff. */
  borrowedPrincipalMinor: number;
  /** 0–1: share of borrowed principal repaid. */
  paidFraction: number;
  borrowedCount: number;
  /** The last EMI across everything borrowed — the month you're debt-free. Null if unknown. */
  debtFreeDate: string | null;
  /** Outstanding on money you lent out — owed to you. */
  lentLeftMinor: number;
  /** Every open loan: borrowed first, soonest EMI first, then money lent. */
  rows: PlanLoanRow[];
}

export function buildLoansSummary(loans: PlanLoanInput[], progress: PlanLoanProgressInput[]): LoansSummary {
  const open = loans.filter((l) => l.status !== 'closed');
  const byId = new Map(progress.map((p) => [p.loanId, p]));
  const borrowed = open.filter((l) => l.direction === 'borrowed');
  const debtLeftMinor = borrowed.reduce((s, l) => s + l.outstandingPrincipalMinor, 0);
  const borrowedPrincipalMinor = borrowed.reduce((s, l) => s + l.principalMinor, 0);
  const paidOffMinor = Math.max(0, borrowedPrincipalMinor - debtLeftMinor);
  const rows: PlanLoanRow[] = open.map((l) => {
    const p = byId.get(l.id);
    return {
      id: l.id,
      name: l.counterparty,
      direction: l.direction,
      leftMinor: l.outstandingPrincipalMinor,
      nextDueDate: p?.nextDueDate ?? null,
      nextEmiMinor: p?.nextEmiMinor ?? null,
      paidCount: p?.paidCount ?? 0,
      totalCount: p?.totalCount ?? 0,
      endDate: p?.lastDueDate ?? null,
    };
  });
  rows.sort((a, b) => {
    if (a.direction !== b.direction) return a.direction === 'borrowed' ? -1 : 1;
    if (a.nextDueDate && b.nextDueDate)
      return a.nextDueDate < b.nextDueDate ? -1 : a.nextDueDate > b.nextDueDate ? 1 : 0;
    return a.nextDueDate ? -1 : b.nextDueDate ? 1 : 0;
  });
  return {
    debtLeftMinor,
    paidOffMinor,
    borrowedPrincipalMinor,
    paidFraction: borrowedPrincipalMinor > 0 ? Math.min(1, paidOffMinor / borrowedPrincipalMinor) : 0,
    borrowedCount: borrowed.length,
    debtFreeDate: rows
      .filter((row) => row.direction === 'borrowed' && row.endDate)
      .reduce<string | null>((latest, row) => (latest && latest > row.endDate! ? latest : row.endDate), null),
    lentLeftMinor: open
      .filter((l) => l.direction === 'lent')
      .reduce((s, l) => s + l.outstandingPrincipalMinor, 0),
    rows,
  };
}

/* ---------- Coming up / Due in the next 2 weeks ---------- */

export interface PlanRuleInput {
  id: string;
  type: 'income' | 'expense' | 'transfer';
  active: boolean;
  nextRunDate: string;
  amountMinor: number;
  /** Already resolved by the screen: the rule's note, its category, or "From → To" for a transfer. */
  label: string;
  /** Its cadence, so a weekly or daily rule shows every run in the window, not only the next. */
  frequency?: RecurrenceFrequency;
  intervalCount?: number;
  endDate?: string | null;
}

export type DueKind = 'emi' | 'bill' | 'income' | 'transfer';

export interface PlanDueItem {
  key: string;
  title: string;
  kind: DueKind;
  dueDate: string;
  amountMinor: number;
  route: '/loans' | '/recurring' | PayCardRoute;
  /** Set on an EMI — Coming up's Paid button records that loan's next installment. */
  loanId?: string;
}

/** A credit card's bill still to pay (from listCardCycles). */
export interface PlanCardBillInput {
  accountId: string;
  accountName: string;
  dueDate: string;
  leftToPayMinor: number;
}

/**
 * Every dated thing coming up, soonest first: next EMI per borrowed loan, next run per active recurring
 * rule, and card bills with something left. Money you lent isn't here: its installments come back to you.
 */
export function buildDueItems(
  loanRows: PlanLoanRow[],
  rules: PlanRuleInput[],
  cardBills: PlanCardBillInput[] = [],
  /** The last day the screen shows (YYYY-MM-DD): a rule's runs up to it are listed, each on its own day. */
  untilDate?: string
): PlanDueItem[] {
  const items: PlanDueItem[] = [];
  for (const l of loanRows) {
    if (l.direction !== 'borrowed' || !l.nextDueDate || l.nextEmiMinor == null) continue;
    items.push({
      key: `loan-${l.id}`,
      title: l.name,
      kind: 'emi',
      dueDate: l.nextDueDate,
      amountMinor: l.nextEmiMinor,
      route: '/loans',
      loanId: l.id,
    });
  }
  for (const r of rules) {
    if (!r.active) continue;
    // The next run always; then, with a cadence and a window, each later run up to the window's end.
    const anchorDay = dayOfIsoDate(r.nextRunDate);
    let date = r.nextRunDate;
    for (let n = 0; n < 100; n++) {
      items.push({
        key: n === 0 ? `rule-${r.id}` : `rule-${r.id}-${date}`,
        title: r.label,
        kind: r.type === 'expense' ? 'bill' : r.type,
        dueDate: date,
        amountMinor: r.amountMinor,
        route: '/recurring',
      });
      if (!r.frequency || !untilDate) break;
      date = advanceDate(date, r.frequency, Math.max(1, r.intervalCount ?? 1), anchorDay);
      if (date > untilDate || (r.endDate && date > r.endDate)) break;
    }
  }
  for (const c of cardBills) {
    if (c.leftToPayMinor <= 0) continue;
    items.push({
      key: `card-${c.accountId}`,
      title: `${c.accountName} bill`,
      kind: 'bill',
      dueDate: c.dueDate,
      amountMinor: c.leftToPayMinor,
      route: payCardRoute(c.accountId, c.leftToPayMinor),
    });
  }
  return items.sort((a, b) => (a.dueDate < b.dueDate ? -1 : a.dueDate > b.dueDate ? 1 : 0));
}

/** How far ahead "Due in the next 2 weeks" looks. */
export const DUE_SOON_DAYS = 14;

export interface DueSoon {
  totalMinor: number;
  emiMinor: number;
  billMinor: number;
  count: number;
  /** YYYY-MM-DD, the last day counted. */
  untilDate: string;
}

/**
 * EMIs and bills due within two weeks, including anything overdue (due now). Income and transfers between
 * your own accounts aren't money going out, so they don't count.
 */
export function buildDueSoon(items: PlanDueItem[], today: string, days = DUE_SOON_DAYS): DueSoon {
  // Today plus the next 13 days — the same 14 days the strip draws and Coming up lists.
  const untilDate = addDaysToIsoDate(today, days - 1);
  let emiMinor = 0;
  let billMinor = 0;
  let count = 0;
  for (const it of items) {
    if (it.dueDate > untilDate) continue;
    if (it.kind === 'emi') emiMinor += it.amountMinor;
    else if (it.kind === 'bill') billMinor += it.amountMinor;
    else continue;
    count++;
  }
  return { totalMinor: emiMinor + billMinor, emiMinor, billMinor, count, untilDate };
}

/** One day of the next 14, for the Plan hero's strip. */
export interface DueDay {
  date: string;
  /** What's due that day: EMIs and bills only (money going out). */
  emi: boolean;
  bill: boolean;
  /** Their total, and what they are. */
  amountMinor: number;
  titles: string[];
}

/** A day with things due, for Coming up — its items and their total going out. */
export interface DueGroup {
  date: string;
  items: PlanDueItem[];
  outMinor: number;
}

/**
 * The next `days` days from today, each marked with whether an EMI or a
 * bill falls on it; anything already overdue counts on today.
 */
export function buildDueDays(items: PlanDueItem[], today: string, days = DUE_SOON_DAYS): DueDay[] {
  return Array.from({ length: days }, (_, i) => {
    const date = addDaysToIsoDate(today, i);
    const out = items.filter(
      (it) =>
        (it.kind === 'emi' || it.kind === 'bill') && (i === 0 ? it.dueDate <= date : it.dueDate === date)
    );
    return {
      date,
      emi: out.some((it) => it.kind === 'emi'),
      bill: out.some((it) => it.kind === 'bill'),
      amountMinor: out.reduce((sum, it) => sum + it.amountMinor, 0),
      titles: out.map((it) => it.title),
    };
  });
}

/** An EMI or card bill this close is flagged amber in Coming up, as on Home. */
export const PLAN_SOON_DAYS = 3;

/**
 * How urgent a Coming up row looks, by Home's rules: red when outgoing money is late or due today, amber
 * when an EMI or card bill is a few days away, else nothing so colour still means something.
 */
export function dueTone(item: PlanDueItem, today: string): 'urgent' | 'soon' | null {
  if (item.kind !== 'emi' && item.kind !== 'bill') return null;
  const days = Math.round(
    (parseLocalIsoDate(item.dueDate).getTime() - parseLocalIsoDate(today).getTime()) / 86400000
  );
  if (days <= 0) return 'urgent';
  const pinned = item.kind === 'emi' || item.key.startsWith('card-');
  return pinned && days <= PLAN_SOON_DAYS ? 'soon' : null;
}

/**
 * Coming up grouped by day: everything due within `days` (overdue first, on its own date), soonest first. If
 * the window is empty, show the next few upcoming items so the list isn't blank while rules or loans exist.
 */
export function groupDueItems(
  items: PlanDueItem[],
  today: string,
  days = DUE_SOON_DAYS,
  fallback = 3
): DueGroup[] {
  const until = addDaysToIsoDate(today, days - 1);
  const soon = items.filter((it) => it.dueDate <= until);
  const shown = soon.length > 0 ? soon : items.slice(0, fallback);
  const groups: DueGroup[] = [];
  for (const it of shown) {
    let g = groups[groups.length - 1];
    if (!g || g.date !== it.dueDate) {
      g = { date: it.dueDate, items: [], outMinor: 0 };
      groups.push(g);
    }
    g.items.push(it);
    if (it.kind === 'emi' || it.kind === 'bill') g.outMinor += it.amountMinor;
  }
  return groups;
}

/* ---------- Budgets ---------- */

export interface PlanBudgetInput {
  id: string;
  categoryName: string;
  spentMinor: number;
  effectiveLimitMinor: number;
  remainingMinor: number;
  percentUsed: number;
  overBudget: boolean;
  /** The category's icon and colour, for its jar. */
  categoryIcon?: string;
  categoryColor?: string;
}

export interface BudgetsSummary {
  usedMinor: number;
  budgetedMinor: number;
  overCount: number;
  /** Each budget's share of everything used, for the split bar — same order as `rows`. */
  shares: number[];
  /** Most urgent first — the order listBudgetsForMonth already returns. */
  rows: PlanBudgetInput[];
}

export function buildBudgetsSummary(budgets: PlanBudgetInput[]): BudgetsSummary {
  const usedMinor = budgets.reduce((s, b) => s + b.spentMinor, 0);
  return {
    usedMinor,
    budgetedMinor: budgets.reduce((s, b) => s + b.effectiveLimitMinor, 0),
    overCount: budgets.filter((b) => b.overBudget).length,
    shares: budgets.map((b) => (usedMinor > 0 ? b.spentMinor / usedMinor : 0)),
    rows: budgets,
  };
}

/* ---------- Friends & Family ---------- */

export type PeopleState =
  | { kind: 'none' }
  | { kind: 'settled'; count: number }
  | { kind: 'balances'; count: number; owedToYouMinor: number; youOweMinor: number };

export function buildPeopleState(people: { balanceMinor: number }[]): PeopleState {
  if (people.length === 0) return { kind: 'none' };
  const { owedToYouMinor, youOweMinor } = peopleTotals(people);
  if (owedToYouMinor === 0 && youOweMinor === 0) return { kind: 'settled', count: people.length };
  return { kind: 'balances', count: people.length, owedToYouMinor, youOweMinor };
}

/* ---------- Daily habit ---------- */

export interface HabitState {
  /** Oldest first: whether each of the last days stayed under the daily goal. */
  days: boolean[];
  streakDays: number;
}

export function buildHabitState(series: { streakDays: number }[]): HabitState {
  return {
    days: series.map((d) => d.streakDays > 0),
    streakDays: series.length ? series[series.length - 1].streakDays : 0,
  };
}

/** The What-if preview's cut sizes. */
export const WHAT_IF_CUTS = [5, 10, 20] as const;

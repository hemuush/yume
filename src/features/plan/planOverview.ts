import { addDaysToIsoDate } from '@/lib/date';
import { peopleTotals } from '@/features/people/people.helpers';

/**
 * What each section of the Plan tab says, from data the screen has already
 * fetched. Pure — every input is passed in, including today's date — so the
 * rules are unit-tested without a database or a clock. The sections, in
 * priority order (the Plan sign-off): Loans, Due in the next 2 weeks,
 * Coming up, Budgets, Friends & Family, Saving toward, Daily habit.
 */

export type PlanRoute =
  '/budgets' | '/savings-goals' | '/recurring' | '/whatif' | '/loans' | '/people' | '/garden';

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
}

export type DueKind = 'emi' | 'bill' | 'income' | 'transfer';

export interface PlanDueItem {
  key: string;
  title: string;
  kind: DueKind;
  dueDate: string;
  amountMinor: number;
  route: '/loans' | '/recurring';
}

/**
 * Every dated thing coming up, soonest first: each borrowed loan's next
 * EMI and each active recurring rule's next run. Money you lent isn't here
 * — its "installments" come back to you, they aren't due from you.
 */
export function buildDueItems(loanRows: PlanLoanRow[], rules: PlanRuleInput[]): PlanDueItem[] {
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
    });
  }
  for (const r of rules) {
    if (!r.active) continue;
    items.push({
      key: `rule-${r.id}`,
      title: r.label,
      kind: r.type === 'expense' ? 'bill' : r.type,
      dueDate: r.nextRunDate,
      amountMinor: r.amountMinor,
      route: '/recurring',
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
 * EMIs and bills due between now and two weeks out — including anything
 * already overdue, which is due right now. Income and transfers between
 * your own accounts aren't money going out, so they don't count.
 */
export function buildDueSoon(items: PlanDueItem[], today: string, days = DUE_SOON_DAYS): DueSoon {
  const untilDate = addDaysToIsoDate(today, days);
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

/* ---------- Budgets ---------- */

export interface PlanBudgetInput {
  id: string;
  categoryName: string;
  spentMinor: number;
  effectiveLimitMinor: number;
  remainingMinor: number;
  percentUsed: number;
  overBudget: boolean;
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

/** A budget at or past this share of its limit reads as "close" — the same line Home's Needs you uses. */
export const BUDGET_NEAR_PCT = 90;

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

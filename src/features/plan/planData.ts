import { addDaysToIsoDate, toLocalIsoDate } from '@/lib/date';
import { categorySentence, parentNameOf } from '@/lib/categoryLabel';
import { isFixedCategoryName } from '@/lib/fixedCategory';
import { investRole, investRuleTitle, investmentIdsOf } from '@/lib/investment';
import { buildPortfolio, type Portfolio } from '@/lib/portfolio';
import { isSavingsEntry } from '@/lib/privateSummary';
import { recurringRulesInCurrency } from '@/lib/recurringScope';
import { savingsAccountIdsOf } from '@/lib/account';
import type { BudgetProgress } from '@/db/budgets';
import type { listCardCycles } from '@/db/cardCycles';
import type { PersonWithBalance } from '@/db/people';
import type { getLoanProgress, listPendingLoanPayments } from '@/db/loans';
import type { getCategoryMonthlyAverages } from '@/db/reports';
import type { Account, Category, Loan, RecurringRule, SavingsGoal } from '@/types';
import {
  buildBudgetsSummary,
  buildDueItems,
  buildDueSoon,
  buildHabitState,
  buildLoansSummary,
  buildPeopleState,
  groupDueItems,
  PEOPLE_SHOWN,
  PLAN_DAYS,
  type PlanPerson,
  type BudgetsSummary,
  type DueGroup,
  type DueSoon,
  type HabitState,
  type LoansSummary,
  type PeopleState,
} from './planOverview';
import { buildRunway, isRunwayAccount, runwayStartMinor, transferFlow, type Runway } from './runway';

/** Everything the Plan page shows, worked out from what was read (see `buildPlanData`). */
export interface PlanData {
  hideAmounts: boolean;
  currency: string;
  accounts: Account[];
  categories: Category[];
  budgetDetails: BudgetProgress[];
  loanDetails: Loan[];
  personDetails: PersonWithBalance[];
  ruleDetails: RecurringRule[];
  loans: LoansSummary;
  dueSoon: DueSoon;
  dueGroups: DueGroup[];
  runway: Runway;
  schedule: Runway;
  /** Whether a bank, cash or wallet account holds the balance the runway starts from. */
  hasAccounts: boolean;
  /** Payment-sheet balances, by account id. */
  balances: Record<string, number>;
  today: string;
  savingsAccounts: Account[];
  budgets: BudgetsSummary;
  people: PeopleState;
  topPeople: PlanPerson[];
  goals: SavingsGoal[];
  whatIf: { categoryId: string; categoryName: string; avgMonthlyMinor: number } | null;
  habit: HabitState | null;
  dailyGoalMinor: number | null;
  investments: Portfolio;
}

/** What the Plan page reads. */
export interface PlanInput {
  hideAmounts: boolean;
  budgets: BudgetProgress[];
  goals: SavingsGoal[];
  rules: RecurringRule[];
  loans: Loan[];
  progress: Awaited<ReturnType<typeof getLoanProgress>>;
  people: PersonWithBalance[];
  categories: Category[];
  accounts: Account[];
  dailyGoal: number | null;
  averages: Awaited<ReturnType<typeof getCategoryMonthlyAverages>>;
  cardCycles: Awaited<ReturnType<typeof listCardCycles>>;
  streak: Parameters<typeof buildHabitState>[0] | null;
  currency: string;
  loanPayments: Awaited<ReturnType<typeof listPendingLoanPayments>>;
  /** Today's date (ISO). */
  today: string;
}

/**
 * The Plan page's figures from what was read: the next 30 days' payments and runway, budgets, loans, people, goals and
 * the habit. Pure: the same input gives the same page.
 */
export function buildPlanData(input: PlanInput): PlanData {
  const {
    hideAmounts,
    budgets,
    goals,
    rules,
    loans,
    progress,
    people,
    categories,
    accounts,
    dailyGoal,
    averages,
    streak,
    currency,
    loanPayments,
    today,
  } = input;
  const until = addDaysToIsoDate(today, PLAN_DAYS - 1);
  const categoriesById = new Map(categories.map((c) => [c.id, c]));
  const accountsById = new Map(accounts.map((a) => [a.id, a]));
  // Totals and the runway are in the default currency; another currency's card bill isn't added to them.
  const cardCycles = input.cardCycles.filter((c) => accountsById.get(c.accountId)?.currency === currency);
  const categoryLabelOf = (id: string | null) => {
    const cat = id ? categoriesById.get(id) : undefined;
    return cat ? categorySentence(cat.name, parentNameOf(id, categoriesById)) : undefined;
  };
  const savingsIds = savingsAccountIdsOf(accounts);
  const accountName = (id: string | null) => (id ? accountsById.get(id)?.name : undefined) ?? '—';
  const loansSummary = buildLoansSummary(loans, progress);
  // Same label Home's Upcoming list uses for a rule.
  const investIds = investmentIdsOf(accounts);
  const ruleLabel = (r: RecurringRule) => {
    const role = investRole(r, investIds);
    if (role) return investRuleTitle(role, accountName(r.accountId), accountName(r.toAccountId));
    return r.type === 'transfer'
      ? `${accountName(r.accountId)} → ${accountName(r.toAccountId)}`
      : r.note || categoryLabelOf(r.categoryId) || 'Recurring';
  };
  // A transfer is listed (and counted in the runway) only when it moves money you can spend.
  const transferOf = (r: RecurringRule) => {
    const flow = transferFlow(r, accountsById, currency);
    if (!flow) return undefined;
    const role = investRole(r, investIds);
    const sub =
      role === 'invest'
        ? `from ${accountName(r.accountId)}`
        : role === 'withdraw'
          ? `to ${accountName(r.toAccountId)}`
          : flow === 'out'
            ? `Moving to ${accountName(r.toAccountId)}`
            : `Coming back from ${accountName(r.accountId)}`;
    return { flow, sub, invest: role === 'invest' || role === 'withdraw' };
  };
  const toRuleInput = (r: RecurringRule, type: 'income' | 'expense' | 'transfer' = r.type) => ({
    id: r.id,
    type,
    active: r.active,
    nextRunDate: r.nextRunDate,
    frequency: r.frequency,
    intervalCount: r.intervalCount,
    anchorDay: r.anchorDay,
    nextAmountMinor: r.nextAmountMinor,
    scheduledDate: r.scheduledDate,
    endDate: r.endDate,
    amountMinor: r.amountMinor,
    label: ruleLabel(r),
    ...(r.type === 'transfer' ? { transfer: transferOf(r) } : {}),
  });
  const visibleRules = recurringRulesInCurrency(
    rules.filter((r) => !hideAmounts || !isSavingsEntry(r, categoriesById, savingsIds)),
    accounts,
    currency
  );
  // Every run in the 30 days Plan shows: a weekly bill is due twice in it, not once.
  const dueItems = buildDueItems(
    loansSummary.rows,
    visibleRules.map((r) => toRuleInput(r)),
    cardCycles,
    until,
    loanPayments
  );
  // The runway only moves with money in and out of bank, cash and wallets: a bill charged to a card waits for
  // the card's own bill, and a transfer counts when it crosses in or out of those accounts (a SIP to an
  // investment account goes out; a sweep from savings comes in).
  const runwayIds = new Set(accounts.filter((a) => isRunwayAccount(a, currency)).map((a) => a.id));
  const runwayRules = visibleRules.flatMap((r) => {
    if (r.type === 'transfer') {
      const flow = transferFlow(r, accountsById, currency);
      return flow ? [toRuleInput(r, flow === 'out' ? 'expense' : 'income')] : [];
    }
    return runwayIds.has(r.accountId) ? [toRuleInput(r)] : [];
  });
  const runwayItems = buildDueItems(loansSummary.rows, runwayRules, cardCycles, until, loanPayments);
  // The top-spend category (sorted biggest first) a cut could apply to: not a built-in like Loan EMI, which the
  // app files automatically, nor rent, insurance or a subscription — "spend 10% less on your rent" isn't a real
  // choice. The same fixed list Reports counts as "already spoken for".
  const top = averages.find(
    (c) =>
      c.totalMinor > 0 &&
      !(hideAmounts && c.isSensitive) &&
      !categoriesById.get(c.categoryId)?.isSystem &&
      !isFixedCategoryName(c.name)
  );

  return {
    investments: buildPortfolio(accounts, currency, today),
    hideAmounts,
    currency,
    accounts,
    categories,
    budgetDetails: budgets,
    loanDetails: loans,
    personDetails: people,
    ruleDetails: visibleRules,
    loans: loansSummary,
    dueSoon: buildDueSoon(dueItems, today, PLAN_DAYS),
    dueGroups: groupDueItems(dueItems, today, PLAN_DAYS),
    schedule: buildRunway(0, dueItems, today, PLAN_DAYS),
    runway: buildRunway(runwayStartMinor(accounts, currency), runwayItems, today, PLAN_DAYS),
    hasAccounts: accounts.some((a) => isRunwayAccount(a, currency)),
    // A savings balance stays hidden in privacy mode, so the pay sheet doesn't show it either.
    balances: Object.fromEntries(
      accounts.filter((a) => !(hideAmounts && a.type === 'savings')).map((a) => [a.id, a.currentBalanceMinor])
    ),
    today,
    savingsAccounts: accounts.filter((a) => a.type === 'savings' && !a.archived),
    budgets: buildBudgetsSummary(
      budgets.map((b) => ({
        id: b.budget.id,
        categoryName: categorySentence(b.categoryName, b.parentName),
        categoryIcon: b.categoryIcon,
        categoryColor: b.categoryColor,
        spentMinor: b.spentMinor,
        effectiveLimitMinor: b.effectiveLimitMinor,
        categoryId: b.budget.categoryId,
        parentCategoryId: b.parentCategoryId,
        remainingMinor: b.remainingMinor,
        percentUsed: b.percentUsed,
        overBudget: b.overBudget,
      }))
    ),
    people: buildPeopleState(people),
    topPeople: [...people]
      .filter((p) => p.balanceMinor !== 0)
      .sort((a, b) => Math.abs(b.balanceMinor) - Math.abs(a.balanceMinor))
      .slice(0, PEOPLE_SHOWN)
      .map((p) => ({ id: p.id, name: p.name, balanceMinor: p.balanceMinor })),
    goals,
    whatIf: top
      ? { categoryId: top.categoryId, categoryName: top.name, avgMonthlyMinor: top.totalMinor }
      : null,
    habit: streak ? buildHabitState(streak) : null,
    dailyGoalMinor: dailyGoal,
  };
}

/** Today's date, and the last day of the 30 days Plan shows. */
export function planWindow(now = new Date()) {
  const today = toLocalIsoDate(now);
  return { today, until: addDaysToIsoDate(today, PLAN_DAYS - 1) };
}

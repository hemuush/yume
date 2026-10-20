import type { Account, Category, RecurringRule, SavingsGoal } from '@/types';
import { monthlyCostMinor } from '@/db/subscriptions';
import { goalPlan } from '@/features/goals/goalPlan';

export interface MonthlyPlanInput {
  categories: Category[];
  accounts: Account[];
  rules: RecurringRule[];
  budgets: { categoryId: string; limitMinor: number }[];
  goals: SavingsGoal[];
  loans: { direction: string; nextEmiMinor: number | null }[];
  today: string;
}

/** A monthly target estimate, not the dated cash-flow forecast. Parent limits cover their children. */
export function monthlyCommitments(input: MonthlyPlanInput) {
  const caps = new Map(input.budgets.map((b) => [b.categoryId, b.limitMinor]));
  const fixed = new Map<string, number>();
  const saving = new Map<string, number>();
  let incomeMinor = 0;
  let uncategorizedMinor = 0;
  const accounts = new Map(input.accounts.map((a) => [a.id, a]));
  const cats = new Map(input.categories.map((c) => [c.id, c]));
  for (const rule of input.rules) {
    if (!rule.active || (rule.endDate && (rule.endDate < input.today || rule.nextRunDate > rule.endDate)))
      continue;
    const monthly = Math.round(monthlyCostMinor(rule));
    if (rule.type === 'income') incomeMinor += monthly;
    else if (rule.type === 'expense') {
      if (rule.categoryId && cats.has(rule.categoryId))
        fixed.set(rule.categoryId, (fixed.get(rule.categoryId) ?? 0) + monthly);
      else uncategorizedMinor += monthly;
    } else {
      const from = accounts.get(rule.accountId),
        to = accounts.get(rule.toAccountId ?? '');
      if (
        from &&
        to &&
        from.type !== 'savings' &&
        !from.investment &&
        (to.type === 'savings' || to.investment)
      )
        saving.set(to.id, (saving.get(to.id) ?? 0) + monthly);
    }
  }
  const incompleteLoans = input.loans.filter(
    (loan) => loan.direction === 'borrowed' && loan.nextEmiMinor == null
  ).length;
  const emiMinor = input.loans
    .filter((loan) => loan.direction === 'borrowed')
    .reduce((sum, loan) => sum + (loan.nextEmiMinor ?? 0), 0);
  const emiCategory = input.categories.find(
    (c) => c.isSystem && c.name === 'Loan EMI' && c.kind === 'expense'
  );
  if (emiCategory) fixed.set(emiCategory.id, (fixed.get(emiCategory.id) ?? 0) + emiMinor);
  else uncategorizedMinor += emiMinor;
  let spendingMinor = uncategorizedMinor;
  for (const root of input.categories.filter((c) => c.kind === 'expense' && !c.parentId)) {
    const children = input.categories.filter((c) => c.parentId === root.id);
    const detailed =
      (fixed.get(root.id) ?? 0) +
      children.reduce((sum, child) => sum + Math.max(caps.get(child.id) ?? 0, fixed.get(child.id) ?? 0), 0);
    spendingMinor += Math.max(caps.get(root.id) ?? 0, detailed);
  }
  let unlinkedGoalMinor = 0;
  const following = new Map<string, number>();
  const goalNeeds = new Map<string, number>();
  let undatedGoals = 0;
  for (const goal of input.goals) {
    if (goal.archived) continue;
    const plan = goalPlan(goal, input.today);
    if (plan.toGoMinor > 0 && plan.perMonthMinor == null) {
      undatedGoals++;
      continue;
    }
    const need = plan.perMonthMinor ?? 0;
    if (!goal.linkedAccountId) unlinkedGoalMinor += need;
    else if (goal.tracksAccount)
      following.set(goal.linkedAccountId, Math.max(following.get(goal.linkedAccountId) ?? 0, need));
    else goalNeeds.set(goal.linkedAccountId, (goalNeeds.get(goal.linkedAccountId) ?? 0) + need);
  }
  const ids = new Set([...saving.keys(), ...following.keys(), ...goalNeeds.keys()]);
  const savingsMinor =
    unlinkedGoalMinor +
    [...ids].reduce(
      (sum, id) => sum + Math.max(saving.get(id) ?? 0, (goalNeeds.get(id) ?? 0) + (following.get(id) ?? 0)),
      0
    );
  const totalMinor = spendingMinor + savingsMinor;
  if (![incomeMinor, spendingMinor, savingsMinor, totalMinor].every(Number.isSafeInteger))
    throw new Error('These commitments are too large to estimate safely.');
  return { incomeMinor, spendingMinor, savingsMinor, totalMinor, undatedGoals, incompleteLoans };
}

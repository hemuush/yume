import { budgetPace } from '@/lib/pace';
import { daysUntilIsoDate } from '@/lib/date';
import { goalProgress } from '@/lib/savingsGoalProgress';
import type { BudgetProgress } from '@/db/budgets';
import type { SavingsGoal } from '@/types';
import { goalPlan } from '@/features/goals/goalPlan';
import { DUE_SOON_DAYS, type Upcoming, type UpcomingItem } from './upcomingItems';

/** Home's Coming up: payments, budgets and goals in one list, the most pressing first. */
export type ComingUpKind = 'payment' | 'budget' | 'goal';
export type ComingUpFilter = 'all' | ComingUpKind;

type BudgetState = 'over' | 'ahead' | 'ok';

export type ComingUpItem =
  | { kind: 'payment'; key: string; rank: number; item: UpcomingItem }
  | { kind: 'budget'; key: string; rank: number; progress: BudgetProgress; state: BudgetState }
  | {
      kind: 'goal';
      key: string;
      rank: number;
      goal: SavingsGoal;
      percent: number;
      toGoMinor: number;
      perMonthMinor: number | null;
      pace: 'ahead' | 'onPace' | 'behind' | null;
    };

/** How many rows Coming up shows at once; the rest are one tap away in Plan, Budgets or Goals. */
const COMING_UP_ROWS = 5;
/** Outgoing payments further away than this stay out of Home; Plan lists them all. */
const PAYMENT_WINDOW_DAYS = 31;

/** Lower comes first. Overdue and due-today payments, then budgets over their limit, then bills due soon. */
function paymentRank(days: number): number {
  if (days <= 0) return 0;
  return days <= DUE_SOON_DAYS ? 20 + days : 60 + days;
}

export function budgetState(progress: BudgetProgress, today: string): BudgetState {
  if (progress.overBudget) return 'over';
  return budgetPace(progress.percentUsed / 100, today).state === 'ahead' ? 'ahead' : 'ok';
}

const BUDGET_RANK: Record<BudgetState, number> = { over: 10, ahead: 30, ok: 70 };
const GOAL_RANK = { behind: 40, onPace: 80, ahead: 85, none: 90 } as const;

export function buildComingUp(input: {
  upcoming: Upcoming;
  budgets: BudgetProgress[];
  goals: SavingsGoal[];
  today: string;
}): ComingUpItem[] {
  const items: ComingUpItem[] = [];
  for (const item of input.upcoming.all ?? [
    ...input.upcoming.items,
    ...(input.upcoming.next ? [input.upcoming.next] : []),
  ]) {
    if (item.sign !== '-' || item.amountMinor <= 0) continue;
    const days = daysUntilIsoDate(item.sortDate);
    if (days > PAYMENT_WINDOW_DAYS) continue;
    items.push({ kind: 'payment', key: item.key, rank: paymentRank(days), item });
  }
  for (const progress of input.budgets) {
    const state = budgetState(progress, input.today);
    items.push({
      kind: 'budget',
      key: `budget-${progress.budget.id}`,
      rank: BUDGET_RANK[state],
      progress,
      state,
    });
  }
  for (const goal of input.goals) {
    if (goal.archived) continue;
    const { percent, done } = goalProgress(goal.currentAmountMinor, goal.targetAmountMinor);
    if (done) continue;
    const plan = goalPlan(goal, input.today);
    items.push({
      kind: 'goal',
      key: `goal-${goal.id}`,
      rank: GOAL_RANK[plan.pace ?? 'none'],
      goal,
      percent,
      toGoMinor: plan.toGoMinor,
      perMonthMinor: plan.perMonthMinor,
      pace: plan.pace,
    });
  }
  // Stable within a rank: the sources' own order (payments soonest first, budgets fullest first) is kept.
  return items
    .map((item, index) => ({ item, index }))
    .sort((a, b) => a.item.rank - b.item.rank || a.index - b.index)
    .map(({ item }) => item);
}

/** On "All" the list is a mix, not the five most pressing of any kind: this many of each, then any slack. */
const ALL_QUOTA: Record<ComingUpKind, number> = { payment: 3, budget: 1, goal: 1 };

/**
 * The rows "All" shows: up to three payments, one budget and one goal (each kind's most pressing), in rank
 * order. A kind with fewer than its share leaves its rows to the next most pressing of the others.
 */
function mixedRows(items: ComingUpItem[]): ComingUpItem[] {
  const taken = new Set<ComingUpItem>();
  for (const kind of ['payment', 'budget', 'goal'] as const) {
    items
      .filter((i) => i.kind === kind)
      .slice(0, ALL_QUOTA[kind])
      .forEach((i) => taken.add(i));
  }
  for (const item of items) {
    if (taken.size >= COMING_UP_ROWS) break;
    taken.add(item);
  }
  return items.filter((i) => taken.has(i));
}

/** What the list shows for a filter, and the counts and attention flags the filter chips carry. */
export function summarizeComingUp(items: ComingUpItem[], filter: ComingUpFilter) {
  const kinds: ComingUpKind[] = ['payment', 'budget', 'goal'];
  const count = (kind: ComingUpKind) => items.filter((i) => i.kind === kind).length;
  return {
    visible:
      filter === 'all' ? mixedRows(items) : items.filter((i) => i.kind === filter).slice(0, COMING_UP_ROWS),
    counts: Object.fromEntries(kinds.map((k) => [k, count(k)])) as Record<ComingUpKind, number>,
    // A dot on a chip means something in it needs a look: a payment due soon or late, a budget over or
    // ahead of pace, a goal behind.
    attention: {
      payment: items.some((i) => i.kind === 'payment' && i.rank < 60),
      budget: items.some((i) => i.kind === 'budget' && i.state !== 'ok'),
      goal: items.some((i) => i.kind === 'goal' && i.pace === 'behind'),
    },
  };
}

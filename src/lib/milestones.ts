import { formatMoney } from './money';
import { longMonth } from './dateLabels';

export const GOAL_MILESTONES = [25, 50, 75, 100] as const;
export type GoalMilestone = (typeof GOAL_MILESTONES)[number];

export interface MilestoneCopy {
  title: string;
  body: string;
  /** The goal is fully funded: a firmer haptic. */
  strong: boolean;
}

const pctOf = (current: number, target: number) => (target > 0 ? (current / target) * 100 : 0);

/** The highest milestone a save newly reached (below it before, at or past it after); null if none. */
export function milestoneReached(
  beforeMinor: number,
  afterMinor: number,
  targetMinor: number
): GoalMilestone | null {
  const before = pctOf(beforeMinor, targetMinor);
  const after = pctOf(afterMinor, targetMinor);
  let reached: GoalMilestone | null = null;
  for (const m of GOAL_MILESTONES) if (before < m && after >= m) reached = m;
  return reached;
}

/** Every milestone up to and including `m`, so skipping past 25 and 50 in one save leaves neither to fire later. */
export function milestonesUpTo(m: GoalMilestone): GoalMilestone[] {
  return GOAL_MILESTONES.filter((x) => x <= m);
}

export const goalMilestoneKey = (goalId: string, m: GoalMilestone) => `goal:${goalId}:${m}`;
export const budgetMonthKey = (periodMonth: string) => `budgets:${periodMonth}`;

const GOAL_TITLE: Record<GoalMilestone, string> = {
  25: 'A quarter of the way',
  50: 'Halfway there',
  75: 'Three quarters there',
  100: 'Goal reached',
};

/** Amounts are left out while savings are hidden, so a glance over a shoulder shows nothing private. */
export function goalMilestoneCopy(
  m: GoalMilestone,
  name: string,
  toGoMinor: number,
  masked: boolean
): MilestoneCopy {
  const body =
    m === 100
      ? `${name} is fully funded.`
      : masked
        ? `${name} is ${m}% funded.`
        : `${formatMoney(toGoMinor)} to go for ${name}.`;
  return { title: GOAL_TITLE[m], body, strong: m === 100 };
}

/** A month closes under budget when nothing went over and at least one budget was actually spent from. */
export function budgetMonthHeld(budgets: { spentMinor: number; overBudget: boolean }[]): boolean {
  return budgets.length > 0 && budgets.every((b) => !b.overBudget) && budgets.some((b) => b.spentMinor > 0);
}

export function budgetMonthCopy(periodMonth: string, count: number): MilestoneCopy {
  return {
    title: `${longMonth(`${periodMonth}-01`)} closed under budget`,
    body: count === 1 ? 'Your budget held.' : `All ${count} budgets held.`,
    strong: true,
  };
}

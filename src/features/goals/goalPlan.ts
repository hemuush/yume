import { theme } from '@/constants/theme';
import { parseLocalIsoDate, toLocalIsoDate } from '@/lib/date';
import type { SavingsGoal } from '@/types';

/** How far a goal may sit from the even-saving line, as a share of its target, and still be "on pace". */
export const GOAL_PACE_SLACK = 0.05;

export type GoalPace = 'ahead' | 'onPace' | 'behind';

export interface GoalPlan {
  toGoMinor: number;
  /** Calendar months from today to the target date, counting a part month as a whole one. Null with no date. */
  monthsLeft: number | null;
  /** What to put in each of those months to finish on time. Null with no date, or when the date has passed. */
  perMonthMinor: number | null;
  /** Null for a goal with no date, one already reached, or one whose dates leave nothing to compare. */
  pace: GoalPace | null;
  pastDue: boolean;
}

type PlanGoal = Pick<SavingsGoal, 'currentAmountMinor' | 'targetAmountMinor' | 'targetDate' | 'createdAt'>;

function monthsBetween(today: string, target: string): number {
  const a = parseLocalIsoDate(today);
  const b = parseLocalIsoDate(target);
  const whole = (b.getFullYear() - a.getFullYear()) * 12 + (b.getMonth() - a.getMonth());
  return b.getDate() > a.getDate() ? whole + 1 : whole;
}

/**
 * The local calendar day a goal was created. SQLite's `datetime('now')` is UTC ("YYYY-MM-DD HH:MM:SS", no
 * zone), so slicing it gives the UTC date, which differs from the local date the rest of the plan uses
 * around midnight. A date-only or unparseable value falls back to its first ten characters.
 */
export function createdLocalDate(createdAt: string): string {
  const m = /^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?)(Z|[+-]\d{2}:?\d{2})?$/.exec(
    createdAt
  );
  if (!m) return createdAt.slice(0, 10);
  const parsed = new Date(`${m[1]}T${m[2].length === 5 ? `${m[2]}:00` : m[2]}${m[3] ?? 'Z'}`);
  return Number.isNaN(parsed.getTime()) ? createdAt.slice(0, 10) : toLocalIsoDate(parsed);
}

/**
 * What is left on a goal and what finishing by its date takes. `pace` compares the share saved with where an
 * even saving line, from creation day to target date, would be today.
 */
export function goalPlan(goal: PlanGoal, today: string): GoalPlan {
  const toGoMinor = Math.max(0, goal.targetAmountMinor - goal.currentAmountMinor);
  const done = toGoMinor === 0;
  const target = goal.targetDate;
  if (!target || done)
    return { toGoMinor, monthsLeft: null, perMonthMinor: null, pace: null, pastDue: false };

  const pastDue = target < today;
  const monthsLeft = pastDue ? 0 : Math.max(1, monthsBetween(today, target));
  const perMonthMinor = pastDue ? null : Math.ceil(toGoMinor / monthsLeft);

  const created = createdLocalDate(goal.createdAt);
  const span = parseLocalIsoDate(target).getTime() - parseLocalIsoDate(created).getTime();
  let pace: GoalPace | null = null;
  if (pastDue) {
    pace = 'behind';
  } else if (span > 0 && goal.targetAmountMinor > 0) {
    const elapsed = parseLocalIsoDate(today).getTime() - parseLocalIsoDate(created).getTime();
    const expected = Math.min(1, Math.max(0, elapsed / span));
    const actual = goal.currentAmountMinor / goal.targetAmountMinor;
    pace =
      actual >= expected + GOAL_PACE_SLACK
        ? 'ahead'
        : actual >= expected - GOAL_PACE_SLACK
          ? 'onPace'
          : 'behind';
  }
  return { toGoMinor, monthsLeft, perMonthMinor, pace, pastDue };
}

export const GOAL_PACE_LABEL: Record<GoalPace, string> = {
  ahead: 'Ahead',
  onPace: 'On pace',
  behind: 'Behind',
};

export interface GoalsTotals {
  savedMinor: number;
  targetMinor: number;
  /** Saved share of the combined target, 0-100. */
  percent: number;
  goalCount: number;
  /** What all the dated, unfinished goals need each month to finish on time. */
  perMonthMinor: number;
}

/** The totals over the active goals the screen's hero shows. */
export function summarizeGoals(goals: PlanGoal[], today: string): GoalsTotals {
  let savedMinor = 0;
  let targetMinor = 0;
  let perMonthMinor = 0;
  for (const g of goals) {
    savedMinor += Math.min(g.currentAmountMinor, g.targetAmountMinor);
    targetMinor += g.targetAmountMinor;
    perMonthMinor += goalPlan(g, today).perMonthMinor ?? 0;
  }
  const percent = targetMinor > 0 ? Math.min(100, (savedMinor / targetMinor) * 100) : 0;
  return { savedMinor, targetMinor, percent, goalCount: goals.length, perMonthMinor };
}

// A goal's colour only says which one it is; the numbers carry the meaning.
const GOAL_HUES = [
  theme.colors.idTeal,
  theme.colors.primary,
  theme.colors.idGold,
  theme.colors.idCoral,
  theme.colors.idSage,
];

/** Each goal's identity colour by its place in the list, so it keeps it when another is archived or reached. */
export function goalHues(goals: Pick<SavingsGoal, 'id'>[]): Record<string, string> {
  const hues: Record<string, string> = {};
  goals.forEach((g, i) => {
    hues[g.id] = GOAL_HUES[i % GOAL_HUES.length];
  });
  return hues;
}

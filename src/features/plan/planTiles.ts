import { daysUntilIsoDate } from '@/lib/date';
import { goalProgress } from '@/lib/savingsGoalProgress';

/**
 * The Plan tab's six tiles, each with one live line so the page is worth a
 * glance rather than being a menu. Pure — the screen fetches, this decides
 * what each tile says — so every rule here is unit-tested.
 */
export type PlanRoute = '/budgets' | '/savings-goals' | '/recurring' | '/loans' | '/whatif' | '/garden';

export interface PlanTile {
  key: string;
  title: string;
  /** The live line; `null` would mean "nothing to say", but every tile always has something. */
  line: string;
  route: PlanRoute;
}

export interface PlanInput {
  budgets: { percentUsed: number; overBudget: boolean }[];
  goals: { name: string; currentAmountMinor: number; targetAmountMinor: number; archived: boolean }[];
  recurring: { active: boolean; nextRunDate: string; label: string }[];
  nextEmiDueDate: string | null;
  activeLoanCount: number;
  peopleCount: number;
  /** Today's under-goal streak, or null when no daily spending goal is set. */
  gardenStreakDays: number | null;
  /** Injectable for tests; defaults to the real "days from today". */
  daysUntil?: (iso: string) => number;
}

/** A budget counts as on track below this share of its limit — the same line Home's "Needs you" uses. */
const ON_TRACK_BELOW_PCT = 90;

function whenLabel(days: number): string {
  if (days < 0) return 'overdue';
  if (days === 0) return 'due today';
  if (days === 1) return 'due tomorrow';
  return `in ${days} days`;
}

export function buildPlanTiles(input: PlanInput): PlanTile[] {
  const daysUntil = input.daysUntil ?? daysUntilIsoDate;

  const budgetLine = (() => {
    const n = input.budgets.length;
    if (n === 0) return 'Set a monthly limit';
    const onTrack = input.budgets.filter((b) => !b.overBudget && b.percentUsed < ON_TRACK_BELOW_PCT).length;
    return `${onTrack} of ${n} on track`;
  })();

  const goalLine = (() => {
    const active = input.goals.filter((g) => !g.archived);
    if (active.length === 0) return 'Save toward something';
    // The one closest to done — the most motivating one to show.
    const best = active
      // Floored, so a goal never reads 100% before it is actually reached.
      .map((g) => ({ g, pct: Math.floor(goalProgress(g.currentAmountMinor, g.targetAmountMinor).percent) }))
      .sort((a, b) => b.pct - a.pct)[0];
    return `${best.g.name} · ${best.pct}%`;
  })();

  const recurringLine = (() => {
    const next = input.recurring
      .filter((r) => r.active)
      .sort((a, b) => (a.nextRunDate < b.nextRunDate ? -1 : a.nextRunDate > b.nextRunDate ? 1 : 0))[0];
    if (!next) return 'Rent, salary, subscriptions';
    return `${next.label} ${whenLabel(daysUntil(next.nextRunDate))}`;
  })();

  const loansLine = (() => {
    if (input.nextEmiDueDate) return `Next EMI ${whenLabel(daysUntil(input.nextEmiDueDate))}`;
    const parts: string[] = [];
    if (input.activeLoanCount > 0)
      parts.push(`${input.activeLoanCount} loan${input.activeLoanCount === 1 ? '' : 's'}`);
    if (input.peopleCount > 0)
      parts.push(`${input.peopleCount} ${input.peopleCount === 1 ? 'person' : 'people'}`);
    return parts.length > 0 ? parts.join(' · ') : 'Loans and IOUs';
  })();

  const gardenLine =
    input.gardenStreakDays == null ? 'Set a daily goal' : `${input.gardenStreakDays}-day streak`;

  return [
    { key: 'budgets', title: 'Budgets', line: budgetLine, route: '/budgets' },
    { key: 'goals', title: 'Goals', line: goalLine, route: '/savings-goals' },
    { key: 'recurring', title: 'Recurring', line: recurringLine, route: '/recurring' },
    { key: 'loans', title: 'Loans & people', line: loansLine, route: '/loans' },
    { key: 'whatif', title: 'What-if', line: 'Try a spending cut', route: '/whatif' },
    { key: 'garden', title: "Suu's Garden", line: gardenLine, route: '/garden' },
  ];
}

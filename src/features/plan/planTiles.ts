import { daysUntilIsoDate } from '@/lib/date';
import { formatMoney } from '@/lib/money';
import { goalProgress } from '@/lib/savingsGoalProgress';
import { peopleTotals } from '@/features/people/people.helpers';

/**
 * The Plan tab's seven tiles, each with one live line so the page is worth a
 * glance rather than being a menu. Pure — the screen fetches, this decides
 * what each tile says — so every rule here is unit-tested.
 */
type PlanRoute = '/budgets' | '/savings-goals' | '/recurring' | '/whatif' | '/loans' | '/people' | '/garden';

export interface PlanTile {
  key: string;
  title: string;
  /** The live line; `null` would mean "nothing to say", but every tile always has something. */
  line: string;
  route: PlanRoute;
  /** Spans the whole row — the last, odd tile, so the two-column grid ends evenly. */
  wide?: boolean;
}

export interface PlanInput {
  budgets: { percentUsed: number; overBudget: boolean }[];
  goals: { name: string; currentAmountMinor: number; targetAmountMinor: number; archived: boolean }[];
  recurring: { active: boolean; nextRunDate: string; label: string }[];
  nextEmiDueDate: string | null;
  activeLoanCount: number;
  /** Each person's balance; positive means they owe you. */
  people: { balanceMinor: number }[];
  /** Today's under-goal streak, or null when no daily spending goal is set. */
  gardenStreakDays: number | null;
  /** Injectable for tests; defaults to the real "days from today". */
  daysUntil?: (iso: string) => number;
  /** Injectable for tests; defaults to the app's money format. */
  money?: (minor: number) => string;
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
  const money = input.money ?? formatMoney;

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
    const n = input.activeLoanCount;
    return n > 0 ? `${n} loan${n === 1 ? '' : 's'}` : 'Track an EMI';
  })();

  const peopleLine = (() => {
    if (input.people.length === 0) return 'Track money with friends';
    const { owedToYouMinor, youOweMinor } = peopleTotals(input.people);
    if (owedToYouMinor > 0 && youOweMinor > 0)
      return `${money(owedToYouMinor)} to you · you owe ${money(youOweMinor)}`;
    if (owedToYouMinor > 0) return `${money(owedToYouMinor)} owed to you`;
    if (youOweMinor > 0) return `You owe ${money(youOweMinor)}`;
    return 'All settled up';
  })();

  const gardenLine =
    input.gardenStreakDays == null ? 'Set a daily goal' : `${input.gardenStreakDays}-day streak`;

  return [
    { key: 'budgets', title: 'Budgets', line: budgetLine, route: '/budgets' },
    { key: 'goals', title: 'Goals', line: goalLine, route: '/savings-goals' },
    { key: 'recurring', title: 'Recurring', line: recurringLine, route: '/recurring' },
    { key: 'whatif', title: 'What-if', line: 'Try a spending cut', route: '/whatif' },
    { key: 'loans', title: 'Loans', line: loansLine, route: '/loans' },
    { key: 'people', title: 'Friends & Family', line: peopleLine, route: '/people' },
    { key: 'garden', title: "Suu's Garden", line: gardenLine, route: '/garden', wide: true },
  ];
}

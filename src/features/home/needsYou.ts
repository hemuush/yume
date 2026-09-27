import { parseLocalIsoDate } from '@/lib/date';
import { budgetPace } from '@/lib/pace';
import { formatPctChange } from '@/lib/format';

/**
 * The one list of things that want you to do something — Home's "Needs
 * you" shows the top three, and the bell opens all of them (Alerts). Never
 * general information: that's what Upcoming and the month hero are for.
 * Pure — every input is passed in, including today's date — so the rules
 * below are unit-tested without a database or a clock.
 *
 * Each item's key carries its situation (a budget "near" vs "over", an EMI
 * "soon" vs "due"), so an item dismissed with ✕ comes back when things change.
 */
export type NeedsYouTone = 'urgent' | 'warn' | 'info';
export type NeedsYouAction = 'loans' | 'budgets' | 'backup' | 'reports' | 'tidy' | 'recurring';

export interface NeedsYouItem {
  key: string;
  tone: NeedsYouTone;
  title: string;
  detail: string;
  amountMinor?: number;
  action: NeedsYouAction;
  /** Only the "no backup yet" reminder can be snoozed; everything else can be dismissed. */
  snoozable?: boolean;
}

export interface NeedsYouInput {
  /** The nearest pending EMI across active borrowed loans (getNextDueInstallment). */
  nextDue: { counterparty: string; dueDate: string; emiAmountMinor: number } | null;
  /** This month's budgets (listBudgetsForMonth), any order. */
  budgets: { budget: { id: string }; categoryName: string; percentUsed: number; overBudget: boolean }[];
  backup: {
    folderUri: string | null;
    lastResult: { ok: boolean } | null;
    snoozedUntil: string | null;
  };
  /** How many transactions exist at all — the "no backup yet" reminder waits until there's data worth losing. */
  transactionCount: number;
  /** The category well up on last month this month, if any (findTopGrowingCategory). */
  growing?: { categoryId: string; name: string; pctChange: number } | null;
  /** How many things Tidy up has found (tidyUpCount). */
  tidyCount?: number;
  /** Charges seen once a month for a while with no rule yet (findMonthlyPatterns), minus hidden ones. */
  monthlyPatterns?: { key: string; categoryName: string; amountMinor: number }[];
  /** YYYY-MM-DD, local. */
  today: string;
  now: Date;
}

/** A budget at or past this share of its limit is worth a look. */
const BUDGET_ALERT_PCT = 90;
/** Don't nag about backups before the user has put real effort in. */
export const BACKUP_NUDGE_MIN_TRANSACTIONS = 10;
/** An EMI this close is a warning; up to UPCOMING_EMI_DAYS away it's a heads-up. */
const EMI_SOON_DAYS = 3;
const UPCOMING_EMI_DAYS = 14;

function wholeDaysBetween(fromIso: string, toIso: string): number {
  return Math.round((parseLocalIsoDate(toIso).getTime() - parseLocalIsoDate(fromIso).getTime()) / 86400000);
}

/** Everything that needs you, most pressing first: urgent, then warnings, then info. */
export function buildNeedsYouItems(input: NeedsYouInput): NeedsYouItem[] {
  const items: NeedsYouItem[] = [];

  // The next EMI: urgent once due or overdue, a warning in the last few
  // days, a heads-up in the two weeks before.
  if (input.nextDue) {
    const days = wholeDaysBetween(input.today, input.nextDue.dueDate);
    const base = {
      title: `${input.nextDue.counterparty} EMI`,
      amountMinor: input.nextDue.emiAmountMinor,
      action: 'loans' as const,
    };
    if (days <= 0) {
      const late = -days;
      items.push({
        ...base,
        key: `emi-${input.nextDue.dueDate}-due`,
        tone: 'urgent',
        detail: late === 0 ? 'Due today' : `Overdue by ${late} day${late === 1 ? '' : 's'}`,
      });
    } else if (days <= UPCOMING_EMI_DAYS) {
      items.push({
        ...base,
        key: `emi-${input.nextDue.dueDate}-${days <= EMI_SOON_DAYS ? 'soon' : 'upcoming'}`,
        tone: days <= EMI_SOON_DAYS ? 'warn' : 'info',
        detail: days === 1 ? 'Due tomorrow' : `Due in ${days} days`,
      });
    }
  }

  // A backup that was set up and then failed: the user believes they're
  // protected and aren't.
  const { folderUri, lastResult, snoozedUntil } = input.backup;
  if (folderUri && lastResult && !lastResult.ok) {
    items.push({
      key: 'backup-failed',
      tone: 'urgent',
      title: 'Last backup failed',
      detail: 'Check your backup folder',
      action: 'backup',
    });
  }

  // Budgets over, nearly out, or running ahead of the even-spending pace —
  // fullest first.
  const hot = input.budgets
    .map((b) => ({ b, pace: budgetPace(b.percentUsed / 100, input.today).state }))
    .filter(({ b, pace }) => b.overBudget || b.percentUsed >= BUDGET_ALERT_PCT || pace === 'ahead')
    .sort((x, y) => y.b.percentUsed - x.b.percentUsed);
  for (const { b, pace } of hot) {
    const state = b.overBudget ? 'over' : b.percentUsed >= BUDGET_ALERT_PCT ? 'near' : 'ahead';
    items.push({
      key: `budget-${b.budget.id}-${state}`,
      tone: 'warn',
      title: `${b.categoryName} budget`,
      detail: b.overBudget
        ? 'Over its limit'
        : `${Math.floor(b.percentUsed)}% used${pace === 'ahead' ? ' · ahead of pace' : ''}`,
      action: 'budgets',
    });
  }

  // Things Tidy up found in your data.
  if (input.tidyCount && input.tidyCount > 0) {
    items.push({
      key: `tidy-${input.tidyCount}`,
      tone: 'info',
      title: 'Tidy up',
      detail: `${input.tidyCount} thing${input.tidyCount === 1 ? '' : 's'} to check`,
      action: 'tidy',
    });
  }

  // A charge that keeps coming back monthly with no rule — once each; ✕
  // (or hiding it on Recurring) puts it away for good.
  for (const p of input.monthlyPatterns ?? []) {
    items.push({
      key: `looks-monthly-${p.key}`,
      tone: 'info',
      title: `${p.categoryName} looks monthly`,
      detail: 'Set it up once in Recurring',
      amountMinor: p.amountMinor,
      action: 'recurring',
    });
  }

  // A category well up on last month.
  if (input.growing) {
    items.push({
      key: `grow-${input.growing.categoryId}-${input.today.slice(0, 7)}`,
      tone: 'info',
      title: `${input.growing.name} is up ${formatPctChange(input.growing.pctChange)}`,
      detail: 'Against last month so far',
      action: 'reports',
    });
  }

  // No backup ever set up, once there's real data to lose. Snoozable.
  const snoozed = snoozedUntil != null && input.now.getTime() < new Date(snoozedUntil).getTime();
  if (!folderUri && input.transactionCount >= BACKUP_NUDGE_MIN_TRANSACTIONS && !snoozed) {
    items.push({
      key: 'backup-none',
      tone: 'info',
      title: 'No backup yet',
      detail: 'Your data only lives on this phone',
      action: 'backup',
      snoozable: true,
    });
  }

  // Urgent first, then warnings, then info — stable within each tone.
  const rank: Record<NeedsYouTone, number> = { urgent: 0, warn: 1, info: 2 };
  return items
    .map((item, i) => ({ item, i }))
    .sort((a, b) => rank[a.item.tone] - rank[b.item.tone] || a.i - b.i)
    .map(({ item }) => item);
}

/** Splits the list into what's showing and what's been dismissed with ✕. */
export function splitDismissed(
  items: NeedsYouItem[],
  dismissed: string[]
): { shown: NeedsYouItem[]; dismissed: NeedsYouItem[] } {
  const hidden = new Set(dismissed);
  return {
    shown: items.filter((i) => !hidden.has(i.key)),
    dismissed: items.filter((i) => hidden.has(i.key)),
  };
}

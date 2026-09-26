import { parseLocalIsoDate } from '@/lib/date';

/**
 * Home's "Needs you" row: only things that want the user to DO something
 * today, never general information (that's what Upcoming and the month hero
 * are for). Pure — every input is passed in, including today's date — so the
 * rules below are unit-tested without a database or a clock.
 */
export type NeedsYouTone = 'urgent' | 'warn' | 'info';
export type NeedsYouAction = 'loans' | 'budgets' | 'backup';

export interface NeedsYouItem {
  key: string;
  tone: NeedsYouTone;
  title: string;
  detail: string;
  amountMinor?: number;
  action: NeedsYouAction;
  /** Only the "no backup yet" reminder can be snoozed; everything else clears itself once dealt with. */
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
  /** YYYY-MM-DD, local. */
  today: string;
  now: Date;
}

/** A budget at or past this share of its limit is worth a look. */
export const BUDGET_ALERT_PCT = 90;
/** Don't nag about backups before the user has put real effort in. */
export const BACKUP_NUDGE_MIN_TRANSACTIONS = 10;
/** Most items the row shows; the most pressing win. */
export const NEEDS_YOU_MAX = 3;

function wholeDaysBetween(fromIso: string, toIso: string): number {
  return Math.round((parseLocalIsoDate(toIso).getTime() - parseLocalIsoDate(fromIso).getTime()) / 86400000);
}

export function buildNeedsYouItems(input: NeedsYouInput): NeedsYouItem[] {
  const items: NeedsYouItem[] = [];

  // An EMI due today or already overdue. One further out is "upcoming",
  // which Home's Upcoming list already covers.
  if (input.nextDue) {
    const days = wholeDaysBetween(input.today, input.nextDue.dueDate);
    if (days <= 0) {
      const late = -days;
      items.push({
        key: 'emi',
        tone: 'urgent',
        title: `${input.nextDue.counterparty} EMI`,
        detail: late === 0 ? 'Due today' : `Overdue by ${late} day${late === 1 ? '' : 's'}`,
        amountMinor: input.nextDue.emiAmountMinor,
        action: 'loans',
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

  // Budgets at or past the alert line, fullest first.
  const hot = input.budgets
    .filter((b) => b.overBudget || b.percentUsed >= BUDGET_ALERT_PCT)
    .sort((a, b) => b.percentUsed - a.percentUsed);
  for (const b of hot) {
    items.push({
      key: `budget-${b.budget.id}`,
      tone: 'warn',
      title: `${b.categoryName} budget`,
      detail: b.overBudget ? 'Over its limit' : `${Math.floor(b.percentUsed)}% used`,
      action: 'budgets',
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
    .slice(0, NEEDS_YOU_MAX)
    .map(({ item }) => item);
}

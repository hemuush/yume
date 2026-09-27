import { getNextDueInstallment } from '@/db/loans';
import { listBudgetsForMonth } from '@/db/budgets';
import { countTransactions } from '@/db/ledger';
import { getPeriodComparison, findTopGrowingCategory } from '@/db/reports';
import { getTidyUpReport, tidyUpCount } from '@/db/tidyUp';
import { findMonthlyPatterns } from '@/db/subscriptions';
import {
  getLocalBackupFolderUri,
  getLastLocalBackupResult,
  getBackupNudgeSnoozedUntil,
  setBackupNudgeSnoozedUntil,
  getNeedsYouDismissed,
  setNeedsYouDismissed,
  getHiddenSubscriptionSuggestions,
  hideSubscriptionSuggestion,
  unhideSubscriptionSuggestion,
} from '@/db/settings';
import { toLocalIsoDate } from '@/lib/date';
import { buildNeedsYouItems, splitDismissed, NeedsYouItem } from './needsYou';
import { listCardCycles } from '@/db/cardCycles';

/** How long "Later" hides the no-backup reminder. */
const BACKUP_SNOOZE_DAYS = 30;

/**
 * Loads everything the Needs you list is built from and builds it — one
 * loader for both Home's card and the bell's full list, so the two can never
 * disagree about what needs you or how many things there are.
 */
export async function loadNeedsYou(
  now: Date = new Date()
): Promise<{ shown: NeedsYouItem[]; dismissed: NeedsYouItem[] }> {
  const [
    nextDue,
    budgets,
    folderUri,
    lastResult,
    snoozedUntil,
    transactionCount,
    comparison,
    tidy,
    dismissedKeys,
    patterns,
    hiddenSuggestions,
    cardCycles,
  ] = await Promise.all([
    getNextDueInstallment(),
    listBudgetsForMonth(),
    getLocalBackupFolderUri(),
    getLastLocalBackupResult(),
    getBackupNudgeSnoozedUntil(),
    countTransactions(),
    getPeriodComparison('month', now),
    getTidyUpReport().catch(() => null),
    getNeedsYouDismissed(),
    findMonthlyPatterns(toLocalIsoDate(now)).catch(() => []),
    getHiddenSubscriptionSuggestions().catch(() => [] as string[]),
    listCardCycles(toLocalIsoDate(now)).catch(() => []),
  ]);
  const items = buildNeedsYouItems({
    nextDue,
    budgets,
    backup: { folderUri, lastResult, snoozedUntil },
    transactionCount,
    growing: findTopGrowingCategory(
      comparison.current.categoryBreakdown,
      comparison.previous.categoryBreakdown
    ),
    tidyCount: tidy ? tidyUpCount(tidy) : 0,
    monthlyPatterns: patterns,
    cardBills: cardCycles,
    today: toLocalIsoDate(now),
    now,
  });
  // A charge hidden on Recurring counts as dismissed here too, so it can be
  // brought back from either place.
  return splitDismissed(items, [...dismissedKeys, ...hiddenSuggestions.map(lookMonthlyKey)]);
}

const LOOKS_MONTHLY = 'looks-monthly-';
const lookMonthlyKey = (suggestionKey: string) => LOOKS_MONTHLY + suggestionKey;

/** ✕ on an item: hidden until its situation changes (its key changes with it). */
export async function dismissNeedsYou(key: string): Promise<void> {
  // A "looks monthly" charge is one thing in two places: hiding it here hides it on Recurring too.
  if (key.startsWith(LOOKS_MONTHLY)) return hideSubscriptionSuggestion(key.slice(LOOKS_MONTHLY.length));
  await setNeedsYouDismissed([...(await getNeedsYouDismissed()), key]);
}

/** Undoes a dismiss. */
export async function restoreNeedsYou(key: string): Promise<void> {
  if (key.startsWith(LOOKS_MONTHLY)) return unhideSubscriptionSuggestion(key.slice(LOOKS_MONTHLY.length));
  await setNeedsYouDismissed((await getNeedsYouDismissed()).filter((k) => k !== key));
}

/** "Later" on the no-backup reminder. */
export async function snoozeBackupReminder(): Promise<void> {
  await setBackupNudgeSnoozedUntil(new Date(Date.now() + BACKUP_SNOOZE_DAYS * 86400000).toISOString());
}

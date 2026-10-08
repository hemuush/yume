import { getNextDueInstallment } from '@/db/loans';
import { listBudgetsForMonth, periodMonthOf } from '@/db/budgets';
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
  getCachedHideSensitiveAmounts,
} from '@/db/settings';
import { privateComparison } from '@/lib/privateSummary';
import { toLocalIsoDate } from '@/lib/date';
import { buildNeedsYouItems, splitDismissed, NeedsYouItem } from './needsYou';
import { listCardCycles } from '@/db/cardCycles';

/** How long "Later" hides the no-backup reminder. */
const BACKUP_SNOOZE_DAYS = 30;

/**
 * Loads and builds everything the Needs you list uses; one loader for every consumer so they can't disagree
 * on what needs you or how many.
 */
export async function loadNeedsYou(
  now: Date = new Date()
): Promise<{ shown: NeedsYouItem[]; dismissed: NeedsYouItem[] }> {
  // Each source is read on its own: one that fails drops only its own entries from the list instead of
  // blanking Needs you, and (below) stops stale dismissals being pruned on an incomplete picture.
  let incomplete = false;
  const isolate = <T>(read: Promise<T>, fallback: T): Promise<T> =>
    read.catch(() => {
      incomplete = true;
      return fallback;
    });
  const hideSensitive = getCachedHideSensitiveAmounts();
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
    isolate(getNextDueInstallment(), null),
    isolate(listBudgetsForMonth(periodMonthOf(now), hideSensitive), []),
    getLocalBackupFolderUri(),
    getLastLocalBackupResult(),
    getBackupNudgeSnoozedUntil(),
    isolate(countTransactions(), 0),
    isolate(
      getPeriodComparison('month', now).then((c) => privateComparison(c, hideSensitive)),
      null
    ),
    isolate(getTidyUpReport(), null),
    isolate(getNeedsYouDismissed(), [] as string[]),
    isolate(findMonthlyPatterns(toLocalIsoDate(now)), []),
    isolate(getHiddenSubscriptionSuggestions(), [] as string[]),
    isolate(listCardCycles(toLocalIsoDate(now)), []),
  ]);
  const items = buildNeedsYouItems({
    nextDue,
    budgets,
    backup: { folderUri, lastResult, snoozedUntil },
    transactionCount,
    growing: comparison
      ? findTopGrowingCategory(comparison.current.categoryBreakdown, comparison.previous.categoryBreakdown)
      : null,
    tidyCount: tidy ? tidyUpCount(tidy) : 0,
    // A savings or investment charge (an SIP) says its amount, so it stays out while those are hidden.
    monthlyPatterns: hideSensitive ? patterns.filter((p) => !p.isSensitive) : patterns,
    cardBills: cardCycles,
    today: toLocalIsoDate(now),
    now,
  });
  // A dismissal whose item is gone (its situation changed, so its key did) is dead weight: drop it. Only on a
  // complete picture, or a failed read would look like "nothing needs you" and wipe live dismissals.
  if (!incomplete) {
    const live = new Set(items.map((i) => i.key));
    if (dismissedKeys.some((k) => !live.has(k))) {
      await updateDismissed((keys) => keys.filter((k) => live.has(k))).catch(() => {});
    }
  }
  // A charge hidden on Recurring counts as dismissed here too, so it can be
  // brought back from either place.
  return splitDismissed(items, [...dismissedKeys, ...hiddenSuggestions.map(lookMonthlyKey)]);
}

const LOOKS_MONTHLY = 'looks-monthly-';
const lookMonthlyKey = (suggestionKey: string) => LOOKS_MONTHLY + suggestionKey;

/**
 * Dismissals are a read-modify-write of one setting; run them one at a time so a ✕ and a prune (or two ✕s)
 * can't overwrite each other.
 */
let dismissedQueue: Promise<unknown> = Promise.resolve();
function updateDismissed(change: (keys: string[]) => string[]): Promise<void> {
  const run = dismissedQueue.then(async () => setNeedsYouDismissed(change(await getNeedsYouDismissed())));
  dismissedQueue = run.catch(() => {});
  return run;
}

/** ✕ on an item: hidden until its situation changes (its key changes with it). */
export async function dismissNeedsYou(key: string): Promise<void> {
  // A "looks monthly" charge is one thing in two places: hiding it here hides it on Recurring too.
  if (key.startsWith(LOOKS_MONTHLY)) return hideSubscriptionSuggestion(key.slice(LOOKS_MONTHLY.length));
  await updateDismissed((keys) => [...keys, key]);
}

/** Undoes a dismiss. */
export async function restoreNeedsYou(key: string): Promise<void> {
  if (key.startsWith(LOOKS_MONTHLY)) return unhideSubscriptionSuggestion(key.slice(LOOKS_MONTHLY.length));
  await updateDismissed((keys) => keys.filter((k) => k !== key));
}

/** "Later" on the no-backup reminder. */
export async function snoozeBackupReminder(now: Date = new Date()): Promise<void> {
  await setBackupNudgeSnoozedUntil(new Date(now.getTime() + BACKUP_SNOOZE_DAYS * 86400000).toISOString());
}

/** Undoes a snooze: the reminder is due again straight away. */
export async function unsnoozeBackupReminder(): Promise<void> {
  await setBackupNudgeSnoozedUntil(new Date(0).toISOString());
}

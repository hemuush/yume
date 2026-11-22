import { runDueRecurringRules } from '@/db/recurring';
import { runLocalBackupIfDue } from './localBackup';
import { emitTransactionsChanged } from './dataEvents';
import { rebuildNotificationsAfterCommit } from '@/db/afterCommit';
import { rebuildIsStale } from '@/lib/rebuildState';

let running: Promise<void> | null = null;

/** Catch up scheduled entries before taking a backup; overlapping app resumes share one run. */
export function runAppMaintenance(): Promise<void> {
  running ??= maintain().finally(() => {
    running = null;
  });
  return running;
}

async function maintain(): Promise<void> {
  let posted = 0;
  try {
    posted = await runDueRecurringRules();
    if (posted > 0) emitTransactionsChanged();
  } catch (error) {
    console.error('Recurring catch-up failed:', error);
  }
  // A process may stay alive beyond the notification plan's horizon. Renew on foreground too,
  // after catch-up has changed the ledger, not only on a cold start or a manual save. A rebuild that is still good is
  // kept, unless the catch-up just posted entries: those change what is due and whether today has an entry.
  if (posted > 0 || rebuildIsStale()) await rebuildNotificationsAfterCommit();
  await runLocalBackupIfDue();
}

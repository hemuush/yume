import { runDueRecurringRules } from '@/db/recurring';
import { runLocalBackupIfDue } from './localBackup';
import { emitTransactionsChanged } from './dataEvents';

let running: Promise<void> | null = null;

/** Catch up scheduled entries before taking a backup; overlapping app resumes share one run. */
export function runAppMaintenance(): Promise<void> {
  running ??= maintain().finally(() => {
    running = null;
  });
  return running;
}

async function maintain(): Promise<void> {
  try {
    if ((await runDueRecurringRules()) > 0) emitTransactionsChanged();
  } catch (error) {
    console.error('Recurring catch-up failed:', error);
  }
  await runLocalBackupIfDue();
}

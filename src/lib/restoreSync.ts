import { getNotificationPrefs } from '@/db/settings';
import { resyncAllLoanReminders } from '@/db/loans';
import { syncDailyReminder, syncWeeklySummary } from '@/lib/notifications';
import { refreshAllWidgets } from '@/widgets/notifyWidgets';

/**
 * After a restore replaces every row: reschedule loan and summary reminders
 * from the restored data and redraw the widgets. Shared by the Backup screen
 * and onboarding's "I have a Yume backup". Never throws — a failed resync
 * shouldn't turn a finished restore into an error.
 */
export async function resyncAfterRestore(): Promise<void> {
  await resyncAllLoanReminders().catch((err) => console.error('resyncAllLoanReminders failed:', err));
  try {
    const prefs = await getNotificationPrefs();
    await syncDailyReminder(prefs);
    await syncWeeklySummary(prefs);
  } catch (err) {
    console.error('Reminder resync after restore failed:', err);
  }
  refreshAllWidgets();
}

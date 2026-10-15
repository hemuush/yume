import { rebuildNotifications } from '@/lib/notifications';
import { getNotificationPrefs } from './settings';

/** Optional attention topics refresh only after their write commits; scheduling cannot fail the saved action. */
export async function rebuildAttentionNotificationsAfterCommit(
  topic: 'recurringAlerts' | 'refundAlerts'
): Promise<void> {
  try {
    if ((await getNotificationPrefs())[topic] && !(await rebuildNotifications())) {
      console.warn('Attention reminders could not be refreshed after a committed write.');
    }
  } catch (e) {
    console.warn('Attention reminder refresh failed after a committed write:', e);
  }
}

/**
 * Rebuilds notifications after a write that has already committed. A failure here (OS permission, scheduler)
 * is logged and swallowed: the money already moved, so the caller must not report the write as failed or
 * roll its own bookkeeping back (e.g. recurring.ts deactivating a rule whose occurrence was posted).
 */
export async function rebuildNotificationsAfterCommit(): Promise<void> {
  try {
    await rebuildNotifications();
  } catch (e) {
    console.warn('Notification rebuild after a committed write failed:', e);
  }
}

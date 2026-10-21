import { rebuildNotifications } from '@/lib/notifications';
import { getNotificationPrefs, setHideSensitiveAmounts } from './settings';

/** Privacy changes can invalidate both optional topics. Report failure separately from the committed save. */
export async function refreshPrivacyNotificationsAfterCommit(): Promise<boolean> {
  try {
    // Rebuild even with both topics disabled: an earlier failed refresh may have left private OS payloads.
    const refreshed = await rebuildNotifications();
    if (!refreshed) console.warn('Private reminder content could not be refreshed after a committed change.');
    return refreshed;
  } catch (e) {
    console.warn('Private reminder refresh failed after a committed change:', e);
    return false;
  }
}

/** Saves the privacy toggle, then refreshes queued reminders. Returns false if the save worked but they could not be refreshed. */
export async function saveHideSensitiveAmounts(value: boolean): Promise<boolean> {
  await setHideSensitiveAmounts(value);
  return refreshPrivacyNotificationsAfterCommit();
}

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

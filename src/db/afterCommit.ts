import { rebuildNotifications } from '@/lib/notifications';

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

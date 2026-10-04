import { rebuildNotifications } from '@/lib/notifications';
import { refreshAllWidgets } from '@/widgets/notifyWidgets';

/**
 * After a restore: rebuild notifications from the restored loans and settings, and redraw the widgets.
 * Shared by Backup and onboarding. Never throws, so a failed rebuild can't make a finished restore an error.
 */
export async function resyncAfterRestore(): Promise<void> {
  try {
    await rebuildNotifications();
  } catch (e) {
    console.warn('Notification rebuild after restore failed:', e);
  }
  try {
    refreshAllWidgets();
  } catch (e) {
    console.warn('Widget refresh after restore failed:', e);
  }
}

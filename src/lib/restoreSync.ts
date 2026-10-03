import { rebuildNotifications } from '@/lib/notifications';
import { refreshAllWidgets } from '@/widgets/notifyWidgets';

/**
 * After a restore: rebuild notifications from the restored loans and settings, and redraw the widgets.
 * Shared by Backup and onboarding. Never throws, so a failed rebuild can't make a finished restore an error.
 */
export async function resyncAfterRestore(): Promise<void> {
  await rebuildNotifications();
  refreshAllWidgets();
}

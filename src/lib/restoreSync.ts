import { rebuildNotifications } from '@/lib/notifications';
import { refreshAllWidgets } from '@/widgets/notifyWidgets';
import { emitSettingsRestored } from '@/lib/dataEvents';
import { getUserName } from '@/db/settings';

/**
 * After a restore: re-read app-wide preferences, rebuild notifications from the restored loans and settings,
 * and redraw the widgets.
 * Shared by Backup and onboarding. Never throws, so a failed rebuild can't make a finished restore an error.
 */
export async function resyncAfterRestore(): Promise<void> {
  // The name every header's initial reads synchronously from its cache, which the restore cleared.
  try {
    await getUserName();
  } catch (e) {
    console.warn('Reloading the name after restore failed:', e);
  }
  // Theme, hide amounts and app lock re-read the restored settings (the caches were already cleared).
  emitSettingsRestored();
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

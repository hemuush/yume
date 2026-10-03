import { rebuildNotifications } from '@/lib/notifications';
import { refreshAllWidgets } from '@/widgets/notifyWidgets';

/**
 * After a restore replaces every row: rebuild the notifications from the
 * restored loans and settings and redraw the widgets. Shared by the Backup
 * screen and onboarding's "I have a Yume backup". Never throws — a failed
 * rebuild shouldn't turn a finished restore into an error.
 */
export async function resyncAfterRestore(): Promise<void> {
  await rebuildNotifications();
  refreshAllWidgets();
}

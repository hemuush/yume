import * as Haptics from 'expo-haptics';

/**
 * Named intents (not raw haptic types) so call sites read by meaning; used only at a few key moments.
 * Fire-and-forget, errors swallowed: some devices/emulators lack a haptic engine; that must not break a save.
 */
export const haptics = {
  /** A light tick — a toggle flips, a row expands, an undo is tapped. */
  tap(): void {
    Haptics.selectionAsync().catch(() => {});
  },
  /** A confirming action actually completes — Pay, Save, Restore. */
  confirm(): void {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
  },
  /** Something was just removed — a delete fires this once, immediately. */
  warn(): void {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
  },
};

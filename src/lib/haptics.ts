import * as Haptics from 'expo-haptics';

/**
 * A deliberately small set of named intents rather than raw haptic types, so
 * call sites read by *meaning* ("this confirmed", "this warns") instead of
 * picking a feedback style by hand each time. Wired at only a few meaningful
 * moments across the app (a confirming button's done-state, a toggle, a
 * delete/undo, a list expanding) — matching the app's restrained,
 * Apple/Nothing-leaning register rather than buzzing on every tap.
 *
 * Every call is fire-and-forget and swallows its own errors: some Android
 * devices and every emulator have no haptic engine at all, and a missing
 * buzz must never be the thing that breaks a save/delete/toggle.
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

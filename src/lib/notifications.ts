import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { getAlertQueue, getNotificationPrefs, setAlertQueue } from '@/db/settings';
import { hasLoggedOn, listLoansDue } from '@/db/notificationData';
import { theme } from '@/constants/theme';
import { toLocalIsoDate } from './date';
import { NOTIFICATION_ROUTES, NotificationRoute, planNotifications } from './notificationPlan';

export { NOTIFICATION_ROUTES };
export type { NotificationRoute };

/** Kept as 'default' so a phone that already has the channel keeps its sound/importance settings. */
export const NOTIFICATION_CHANNEL_ID = 'default';

/** Every notification Yume schedules has an id starting with this, which is how a rebuild finds them. */
const ID_PREFIX = 'yume-';

// Foreground behavior — without this, a notification fired while the app is
// open never shows anything at all on some platforms.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

export async function ensureAndroidChannel(): Promise<void> {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync(NOTIFICATION_CHANNEL_ID, {
    name: 'Yume reminders',
    importance: Notifications.AndroidImportance.DEFAULT,
    lightColor: theme.colors.primary,
  });
}

export async function requestNotificationPermission(): Promise<boolean> {
  const existing = await Notifications.getPermissionsAsync();
  if (existing.granted) return true;
  const result = await Notifications.requestPermissionsAsync();
  return result.granted;
}

/**
 * One-time cleanup: notification identifiers were `flynse-*` before the
 * rename to Yume. Any still scheduled under the old prefix would otherwise
 * linger forever (a rebuild only ever cancels `yume-*` ids).
 * Best-effort, run once on startup.
 */
export async function cancelLegacyScheduledNotifications(): Promise<void> {
  // The background task behind the old notification buttons is gone; drop its registration too.
  await Notifications.unregisterTaskAsync('yume-notification-actions').catch(() => {});
  try {
    const all = await Notifications.getAllScheduledNotificationsAsync();
    await Promise.all(
      all
        .filter((n) => typeof n.identifier === 'string' && n.identifier.startsWith('flynse-'))
        .map((n) => Notifications.cancelScheduledNotificationAsync(n.identifier).catch(() => {}))
    );
  } catch {
    // best effort — an OS that clears these on reinstall makes it moot anyway
  }
}

/** The screen a tapped notification asks for, or null if it carries none this app knows. */
export function notificationRoute(
  response: Notifications.NotificationResponse | null
): NotificationRoute | null {
  const url = response?.notification.request.content.data?.url;
  return typeof url === 'string' && (NOTIFICATION_ROUTES as readonly string[]).includes(url)
    ? (url as NotificationRoute)
    : null;
}

let rebuildChain: Promise<unknown> = Promise.resolve();

/**
 * Works out everything Yume should notify about (see planNotifications) from
 * the current settings and data, then replaces whatever is scheduled with
 * exactly that. Called whenever something it depends on changes — app start,
 * saving the notification settings, logging a transaction, any loan change,
 * a restore — so it is always safe to call again. Runs one at a time, never
 * throws, and resolves false when the notifications could not be set up
 * (a missing permission is not a failure: there is simply nothing to schedule).
 */
export function rebuildNotifications(): Promise<boolean> {
  const run = rebuildChain.then(doRebuild, doRebuild);
  rebuildChain = run;
  return run;
}

async function doRebuild(): Promise<boolean> {
  try {
    const now = new Date();
    const [prefs, loans, alerts, loggedToday] = await Promise.all([
      getNotificationPrefs(),
      listLoansDue(),
      getAlertQueue(),
      hasLoggedOn(toLocalIsoDate(now)),
    ]);
    const { notifications, waitingAlerts } = planNotifications({ prefs, loans, alerts, loggedToday, now });

    const scheduled = (await Notifications.getAllScheduledNotificationsAsync()) ?? [];
    await Promise.all(
      scheduled
        .filter((n) => typeof n.identifier === 'string' && n.identifier.startsWith(ID_PREFIX))
        .map((n) => Notifications.cancelScheduledNotificationAsync(n.identifier).catch(() => {}))
    );
    // Alerts already sent (or stale) drop out of the queue here.
    if (waitingAlerts.length !== alerts.length) await setAlertQueue(waitingAlerts);

    if (notifications.length === 0) return true;
    const permission = await Notifications.getPermissionsAsync();
    if (!permission?.granted) return true;

    await ensureAndroidChannel();
    for (const n of notifications) {
      await Notifications.scheduleNotificationAsync({
        identifier: n.id,
        content: { title: n.title, body: n.body, data: { url: n.route } },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date: n.at,
          channelId: NOTIFICATION_CHANNEL_ID,
        },
      });
    }
    return true;
  } catch (err) {
    console.error('rebuildNotifications failed:', err);
    return false;
  }
}

/**
 * Calls `onRoute` whenever the user taps a Yume notification — including the
 * tap that just cold-started the app. That launch response is cleared once
 * read: the system otherwise keeps returning it on every later launch, which
 * would reopen the same screen each time the app is opened normally.
 * Returns the unsubscribe function.
 */
export function subscribeToNotificationTaps(onRoute: (route: NotificationRoute) => void): () => void {
  let active = true;
  const take = (response: Notifications.NotificationResponse | null) => {
    if (!response) return;
    try {
      Notifications.clearLastNotificationResponse();
    } catch {
      // best effort — worst case the same screen opens again on the next launch
    }
    const route = notificationRoute(response);
    if (route && active) onRoute(route);
  };
  try {
    take(Notifications.getLastNotificationResponse());
  } catch {
    // no launch response to read — the live listener below still works
  }
  const sub = Notifications.addNotificationResponseReceivedListener(take);
  return () => {
    active = false;
    sub.remove();
  };
}

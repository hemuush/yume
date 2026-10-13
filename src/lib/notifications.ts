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
    // Amounts and names stay off the phone's lock screen until it's unlocked.
    lockscreenVisibility: Notifications.AndroidNotificationVisibility.PRIVATE,
  });
}

export async function requestNotificationPermission(): Promise<boolean> {
  // Android 13's permission prompt needs a channel to exist first.
  await ensureAndroidChannel();
  const existing = await Notifications.getPermissionsAsync();
  if (existing.granted) return true;
  const result = await Notifications.requestPermissionsAsync();
  return result.granted;
}

export interface NotificationDeliveryStatus {
  permitted: boolean;
  channelBlocked: boolean;
  scheduledCount: number;
}

/** App permission and the reminder channel are independent Android settings. */
export async function getNotificationDeliveryStatus(): Promise<NotificationDeliveryStatus> {
  const [permission, scheduled, channel] = await Promise.all([
    Notifications.getPermissionsAsync(),
    Notifications.getAllScheduledNotificationsAsync(),
    Platform.OS === 'android'
      ? Notifications.getNotificationChannelAsync(NOTIFICATION_CHANNEL_ID)
      : Promise.resolve(null),
  ]);
  return {
    permitted: !!permission?.granted,
    channelBlocked: channel?.importance === Notifications.AndroidImportance.NONE,
    scheduledCount: (scheduled ?? []).filter((n) =>
      /^yume-\d{4}-\d{2}-\d{2}-(morning|evening)$/.test(n.identifier)
    ).length,
  };
}

/** An immediate, amount-free test of the same channel used by real reminders. */
export async function sendTestNotification(): Promise<void> {
  if (!(await requestNotificationPermission()))
    throw new Error('Allow Yume notifications in phone settings first.');
  const status = await getNotificationDeliveryStatus();
  if (status.channelBlocked)
    throw new Error('Enable the Yume reminders category in phone notification settings.');
  await Notifications.scheduleNotificationAsync({
    identifier: 'yume-delivery-test',
    content: {
      title: 'Yume notification test',
      body: 'Reminders use this notification category.',
      data: { url: '/add-transaction' },
    },
    trigger: { channelId: NOTIFICATION_CHANNEL_ID },
  });
}

/**
 * One-time cleanup: identifiers were `flynse-*` before the Yume rename; any still scheduled under that prefix
 * would linger forever (rebuilds only cancel `yume-*` ids). Best-effort, run once on startup.
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
 * Works out everything to notify about (planNotifications) from settings and data, then replaces whatever is
 * scheduled. Safe to re-call; serialized; never throws; false on failure (a missing permission isn't one).
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
    let allCancelled = true;
    await Promise.all(
      scheduled
        .filter((n) => typeof n.identifier === 'string' && n.identifier.startsWith(ID_PREFIX))
        .map((n) =>
          Notifications.cancelScheduledNotificationAsync(n.identifier).catch((err) => {
            allCancelled = false;
            console.error(`Cancelling notification ${n.identifier} failed:`, err);
          })
        )
    );
    // Alerts already sent (or stale) drop out of the queue here.
    if (waitingAlerts.length !== alerts.length) await setAlertQueue(waitingAlerts);

    if (notifications.length === 0) return allCancelled;
    const permission = await Notifications.getPermissionsAsync();
    if (!permission?.granted) return allCancelled;

    await ensureAndroidChannel();
    let allScheduled = true;
    for (const n of notifications) {
      // One that fails to schedule must not stop the ones after it.
      try {
        await Notifications.scheduleNotificationAsync({
          identifier: n.id,
          content: { title: n.title, body: n.body, data: { url: n.route } },
          trigger: {
            type: Notifications.SchedulableTriggerInputTypes.DATE,
            date: n.at,
            channelId: NOTIFICATION_CHANNEL_ID,
          },
        });
      } catch (err) {
        allScheduled = false;
        console.error(`Scheduling notification ${n.id} failed:`, err);
      }
    }
    return allScheduled && allCancelled;
  } catch (err) {
    console.error('rebuildNotifications failed:', err);
    return false;
  }
}

/**
 * Calls `onRoute` whenever the user taps a Yume notification, including the tap that cold-started the app.
 * That launch response is cleared once read (else re-delivered every launch). Returns the unsubscribe function.
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

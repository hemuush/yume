import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import {
  getAlertQueue,
  getNotificationPermissionAsked,
  getNotificationPrefs,
  getScheduledReminders,
  setAlertQueue,
  setNotificationPermissionAsked,
  setScheduledReminders,
} from '@/db/settings';
import { hasLoggedOn, listLoansDue, listReminderAttention } from '@/db/notificationData';
import { resolveQueuedSpendAlerts } from '@/db/queuedSpendAlerts';
import { theme } from '@/constants/theme';
import { toLocalIsoDate } from './date';
import { NOTIFICATION_ROUTES, NotificationRoute, planNotifications } from './notificationPlan';

export { NOTIFICATION_ROUTES };
export type { NotificationRoute };

/** Kept as 'default' so a phone that already has the channel keeps its sound/importance settings. */
const NOTIFICATION_CHANNEL_ID = 'default';

/** Every notification Yume schedules has an id starting with this, which is how a rebuild finds them. */
const ID_PREFIX = 'yume-';

// Foreground behavior — without this, a notification fired while the app is
// open never shows anything at all on some platforms.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
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

let permissionRequest: Promise<boolean> | null = null;

/** Startup and Settings share one native permission prompt. Failed native calls can be retried. */
export function requestNotificationPermission(): Promise<boolean> {
  permissionRequest ??= (async () => {
    // Android 13's permission prompt needs a channel to exist first.
    await ensureAndroidChannel();
    const existing = await Notifications.getPermissionsAsync();
    if (existing.granted) return true;
    if (existing.canAskAgain === false) return false;
    const result = await Notifications.requestPermissionsAsync();
    if (Platform.OS === 'android') {
      try {
        await setNotificationPermissionAsked();
      } catch (e) {
        console.warn('Remembering notification permission request failed:', e);
      }
    }
    return result.granted;
  })().finally(() => {
    permissionRequest = null;
  });
  return permissionRequest;
}

/**
 * Asks for notification permission once, on its own, when reminders are on but the phone has never been asked.
 * Android 13 and later grant nothing until an app asks, and the morning reminder is on from the start, so
 * without this a new install schedules reminders the phone silently drops until the person finds Settings.
 * Asks at most once per phone (the system only shows the prompt twice anyway); later, Notifications settings
 * explains how to turn it on. Returns whether permission is now granted.
 */
export async function askNotificationPermissionOnce(): Promise<boolean> {
  if (Platform.OS !== 'android') return false;
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  if (!current.canAskAgain || (await getNotificationPermissionAsked())) return false;
  const prefs = await getNotificationPrefs();
  if (!prefs.morningEnabled && !prefs.eveningEnabled) return false;
  const granted = await requestNotificationPermission();
  if (granted) await rebuildNotifications();
  return granted;
}

export interface NotificationDeliveryStatus {
  morningCount?: number;
  eveningCount?: number;
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
    morningCount: (scheduled ?? []).filter((n) => /^yume-\d{4}-\d{2}-\d{2}-morning$/.test(n.identifier))
      .length,
    eveningCount: (scheduled ?? []).filter((n) => /^yume-\d{4}-\d{2}-\d{2}-evening$/.test(n.identifier))
      .length,
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
      sound: 'default',
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
 * scheduled. Safe to re-call; serialized; never throws; false when enabled reminders cannot be scheduled.
 */
export function rebuildNotifications(): Promise<boolean> {
  const run = rebuildChain.then(doRebuild, doRebuild);
  rebuildChain = run;
  return run;
}

async function doRebuild(): Promise<boolean> {
  let scheduled: Notifications.NotificationRequest[] = [];
  const acceptedIds = new Set<string>();
  const pendingIds = new Set<string>();
  const cancel = async (ids: string[]): Promise<boolean> => {
    const results = await Promise.allSettled(
      ids.map(async (id) => {
        await Notifications.cancelScheduledNotificationAsync(id);
      })
    );
    results.forEach((result, i) => {
      if (result.status === 'rejected')
        console.error(`Cancelling notification ${ids[i]} failed:`, result.reason);
    });
    return results.every((result) => result.status === 'fulfilled');
  };
  try {
    scheduled = (await Notifications.getAllScheduledNotificationsAsync()) ?? [];
    scheduled.forEach((request) => pendingIds.add(request.identifier));
    const logDate = toLocalIsoDate(new Date());
    const [prefs, loans, queuedAlerts, initiallyLogged, previousReminders] = await Promise.all([
      getNotificationPrefs(),
      listLoansDue(),
      getAlertQueue(),
      hasLoggedOn(logDate),
      getScheduledReminders(),
    ]);
    const alerts = await resolveQueuedSpendAlerts(queuedAlerts);
    const attention =
      (prefs.morningEnabled || prefs.eveningEnabled) && (prefs.recurringAlerts || prefs.refundAlerts)
        ? await listReminderAttention(
            toLocalIsoDate(new Date()),
            !!prefs.recurringAlerts,
            !!prefs.refundAlerts
          )
        : [];
    const now = new Date();
    const loggedToday =
      toLocalIsoDate(now) === logDate ? initiallyLogged : await hasLoggedOn(toLocalIsoDate(now));
    const { notifications, waitingAlerts } = planNotifications({
      prefs,
      loans,
      alerts,
      attention,
      loggedToday,
      now,
      previouslyScheduled: previousReminders,
      pendingNotificationIds: [...pendingIds],
    });

    let permitted = true;
    if (notifications.length > 0) {
      const permission = await Notifications.getPermissionsAsync();
      permitted = !!permission?.granted;
      if (permitted) await ensureAndroidChannel();
      if (permitted && Platform.OS === 'android') {
        const channel = await Notifications.getNotificationChannelAsync(NOTIFICATION_CHANNEL_ID);
        permitted = channel?.importance !== Notifications.AndroidImportance.NONE;
      }
    }
    let allScheduled = permitted;
    const acceptedTimes = new Set<number>();
    const nextReminders = previousReminders.filter(
      (item) => new Date(item.at).getTime() <= now.getTime() && !pendingIds.has(item.notificationId ?? '')
    );
    for (const n of permitted ? notifications : []) {
      try {
        // Bridge/database work can straddle a slot. Never submit an already-passed date.
        if (n.at.getTime() <= Date.now()) {
          allScheduled = false;
          continue;
        }
        await Notifications.scheduleNotificationAsync({
          identifier: n.id,
          content: { title: n.title, body: n.body, sound: 'default', data: { url: n.route } },
          trigger: {
            type: Notifications.SchedulableTriggerInputTypes.DATE,
            date: n.at,
            channelId: NOTIFICATION_CHANNEL_ID,
          },
        });
        acceptedIds.add(n.id);
        acceptedTimes.add(n.at.getTime());
        nextReminders.push(
          ...n.reminderKeys.map((key) => ({ key, at: n.at.toISOString(), notificationId: n.id }))
        );
      } catch (err) {
        allScheduled = false;
        console.error(`Scheduling notification ${n.id} failed:`, err);
      }
    }
    // A failed replacement must not preserve stale names/amounts under the same ID. This also
    // clears old payloads while permission/the channel is off, before the phone can enable them again.
    const allCancelled = await cancel(
      scheduled
        .filter(
          (n) =>
            typeof n.identifier === 'string' &&
            n.identifier.startsWith(ID_PREFIX) &&
            !acceptedIds.has(n.identifier)
        )
        .map((n) => n.identifier)
    );
    const reconciledAlerts = waitingAlerts.map((alert) => {
      if (alert.scheduledFor && !acceptedTimes.has(new Date(alert.scheduledFor).getTime())) {
        const pending = { ...alert };
        delete pending.scheduledFor;
        delete pending.scheduledNotificationId;
        return pending;
      }
      return alert;
    });
    // Record acceptance per slot, including partial success; failed slots remain retryable.
    if (JSON.stringify(reconciledAlerts) !== JSON.stringify(queuedAlerts))
      await setAlertQueue(reconciledAlerts, queuedAlerts);
    await setScheduledReminders(nextReminders);
    return allScheduled && allCancelled;
  } catch (err) {
    console.error('rebuildNotifications failed:', err);
    // Unknown current content must not leave an obsolete financial payload armed after a failed read.
    await cancel([
      ...new Set([
        ...scheduled.filter((n) => n.identifier?.startsWith(ID_PREFIX)).map((n) => n.identifier),
        ...acceptedIds,
      ]),
    ]);
    try {
      const queue = await getAlertQueue();
      const pending = queue.map((alert) => {
        if (
          !alert.scheduledFor ||
          (new Date(alert.scheduledFor).getTime() <= Date.now() &&
            !pendingIds.has(alert.scheduledNotificationId ?? '') &&
            !acceptedIds.has(alert.scheduledNotificationId ?? ''))
        )
          return alert;
        const copy = { ...alert };
        delete copy.scheduledFor;
        delete copy.scheduledNotificationId;
        return copy;
      });
      if (JSON.stringify(queue) !== JSON.stringify(pending)) await setAlertQueue(pending, queue);
      await setScheduledReminders(
        (await getScheduledReminders()).filter(
          (item) =>
            new Date(item.at).getTime() <= Date.now() &&
            !pendingIds.has(item.notificationId ?? '') &&
            !acceptedIds.has(item.notificationId ?? '')
        )
      );
    } catch (cleanupError) {
      console.warn('Clearing notification acceptance after failure failed:', cleanupError);
    }
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

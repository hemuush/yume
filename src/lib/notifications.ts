import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { NotificationPrefs, getNotificationPrefs } from '@/db/settings';
import { theme } from '@/constants/theme';
import { parseLocalIsoDate } from './date';
import { formatMoney } from './money';
import { formatPctChange } from './format';
import { pickRandom } from './pickRandom';
import { DAILY_REMINDER_COPY, WEEKLY_SUMMARY_COPY, loanDueCopy, overspendCopy } from './notificationCopy';

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

const DAILY_REMINDER_ID = 'yume-daily-reminder';

export async function ensureAndroidChannel(): Promise<void> {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync('default', {
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
 * linger forever (the new sync functions only ever cancel the new IDs).
 * Best-effort, run once on startup.
 */
export async function cancelLegacyScheduledNotifications(): Promise<void> {
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

/**
 * Cancels any previously scheduled daily reminder and, if enabled, schedules
 * a fresh one at the chosen time.
 */
export async function syncDailyReminder(prefs: NotificationPrefs): Promise<void> {
  await Notifications.cancelScheduledNotificationAsync(DAILY_REMINDER_ID).catch(() => {});
  if (!prefs.reminderEnabled) return;

  await ensureAndroidChannel();
  await Notifications.scheduleNotificationAsync({
    identifier: DAILY_REMINDER_ID,
    // A fresh variant each time this (re)schedules — every cold start and
    // every settings save, not literally once per calendar day; see
    // notificationCopy.ts's own note on why a repeating OS trigger can't
    // roll the wording on every single firing.
    content: {
      ...pickRandom(DAILY_REMINDER_COPY),
      data: { url: '/add-transaction' satisfies NotificationRoute },
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DAILY,
      hour: prefs.reminderHour,
      minute: prefs.reminderMinute,
    },
  });
}

const WEEKLY_SUMMARY_ID = 'yume-weekly-summary';

/**
 * Cancels any previously scheduled weekly summary and, if enabled, schedules
 * a fresh one — every Sunday at the same hour/minute as the daily reminder
 * preference, so there's only one time-of-day setting to reason about.
 */
export async function syncWeeklySummary(prefs: NotificationPrefs): Promise<void> {
  await Notifications.cancelScheduledNotificationAsync(WEEKLY_SUMMARY_ID).catch(() => {});
  if (!prefs.weeklySummary) return;

  await ensureAndroidChannel();
  await Notifications.scheduleNotificationAsync({
    identifier: WEEKLY_SUMMARY_ID,
    content: { ...pickRandom(WEEKLY_SUMMARY_COPY), data: { url: '/reports' satisfies NotificationRoute } },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.WEEKLY,
      weekday: 1, // Sunday
      hour: prefs.reminderHour,
      minute: prefs.reminderMinute,
    },
  });
}

function loanDueReminderId(loanId: string): string {
  return `yume-loan-due-${loanId}`;
}

/**
 * Schedules a one-off reminder for a loan's next due installment, replacing
 * any reminder already scheduled for this loan. Called proactively whenever
 * a loan is created or an installment is paid (see db/loans.ts), instead of
 * periodically polling for upcoming due dates in the background.
 */
export async function scheduleLoanDueReminder(
  loanId: string,
  dueDateIso: string,
  counterparty: string,
  emiAmountMinor: number
): Promise<void> {
  await cancelLoanDueReminder(loanId);

  const [existing, prefs] = await Promise.all([Notifications.getPermissionsAsync(), getNotificationPrefs()]);
  if (!existing.granted || !prefs.billAlerts) return;

  const dueAt = parseLocalIsoDate(dueDateIso);
  dueAt.setHours(9, 0, 0, 0);
  if (dueAt.getTime() <= Date.now()) return; // due date already passed — nothing useful to schedule

  await ensureAndroidChannel();
  await Notifications.scheduleNotificationAsync({
    identifier: loanDueReminderId(loanId),
    content: {
      ...loanDueCopy(counterparty, formatMoney(emiAmountMinor)),
      data: { url: '/loans' satisfies NotificationRoute },
    },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: dueAt },
  });
}

export async function cancelLoanDueReminder(loanId: string): Promise<void> {
  await Notifications.cancelScheduledNotificationAsync(loanDueReminderId(loanId)).catch(() => {});
}

/**
 * Fires an immediate local notification if a category's spend this month has
 * grown well past its prior-month total — checked once, right where spend
 * actually changes (after a transaction write), instead of a background poll.
 */
export async function notifyOverspend(categoryName: string, pctChange: number): Promise<void> {
  const existing = await Notifications.getPermissionsAsync();
  if (!existing.granted) return;

  await ensureAndroidChannel();
  await Notifications.scheduleNotificationAsync({
    content: {
      ...overspendCopy(categoryName, formatPctChange(pctChange)),
      data: { url: '/reports' satisfies NotificationRoute },
    },
    trigger: null,
  });
}

/**
 * Where tapping each kind of Yume notification takes you: the daily
 * reminder opens Add (it's asking you to log something), an EMI reminder
 * opens Loans, the weekly summary and overspend alerts open Reports. A fixed
 * list — a notification can only ever route to one of these, whatever its
 * payload says.
 */
export const NOTIFICATION_ROUTES = ['/add-transaction', '/loans', '/reports'] as const;
export type NotificationRoute = (typeof NOTIFICATION_ROUTES)[number];

/** The route a tapped notification asks for, or null if it carries none this app knows. */
export function notificationRoute(
  response: Notifications.NotificationResponse | null
): NotificationRoute | null {
  const url = response?.notification.request.content.data?.url;
  return typeof url === 'string' && (NOTIFICATION_ROUTES as readonly string[]).includes(url)
    ? (url as NotificationRoute)
    : null;
}

/**
 * Calls `onRoute` whenever the user taps a Yume notification — including the
 * one that just cold-started the app. That launch response is cleared once
 * read: the system otherwise keeps returning it on every later launch, which
 * would reopen the same screen each time the app is opened normally.
 * Returns the unsubscribe function.
 */
export function subscribeToNotificationTaps(onRoute: (route: NotificationRoute) => void): () => void {
  let active = true;
  const take = (response: Notifications.NotificationResponse | null) => {
    if (!response) return;
    Notifications.clearLastNotificationResponseAsync().catch(() => {});
    const route = notificationRoute(response);
    if (route && active) onRoute(route);
  };
  Notifications.getLastNotificationResponseAsync()
    .then(take)
    .catch(() => {});
  const sub = Notifications.addNotificationResponseReceivedListener(take);
  return () => {
    active = false;
    sub.remove();
  };
}

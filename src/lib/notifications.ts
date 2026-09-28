import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { NotificationPrefs, getNotificationPrefs } from '@/db/settings';
import { theme } from '@/constants/theme';
import { parseLocalIsoDate } from './date';
import { formatMoney } from './money';
import { formatPctChange } from './format';
import { pickRandom } from './pickRandom';
import { DAILY_REMINDER_COPY, WEEKLY_SUMMARY_COPY, loanDueCopy, overspendCopy } from './notificationCopy';
import {
  NOTIFICATION_KIND,
  NotificationRoute,
  isQuietAction,
  responseRoute,
  runQuietAction,
} from './notificationActions';

export {
  NOTIFICATION_ROUTES,
  notificationRoute,
  registerNotificationCategories,
} from './notificationActions';
export type { NotificationRoute } from './notificationActions';

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
      categoryIdentifier: NOTIFICATION_KIND.daily,
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
 * a fresh one — every Monday at the same hour/minute as the daily reminder
 * preference, so there's only one time-of-day setting to reason about.
 */
export async function syncWeeklySummary(prefs: NotificationPrefs): Promise<void> {
  await Notifications.cancelScheduledNotificationAsync(WEEKLY_SUMMARY_ID).catch(() => {});
  if (!prefs.weeklySummary) return;

  await ensureAndroidChannel();
  await Notifications.scheduleNotificationAsync({
    identifier: WEEKLY_SUMMARY_ID,
    // Plays the week's Wrap, which ends on that week's full report.
    content: {
      ...pickRandom(WEEKLY_SUMMARY_COPY),
      data: { url: '/wrap?period=week' satisfies NotificationRoute },
      categoryIdentifier: NOTIFICATION_KIND.wrap,
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.WEEKLY,
      weekday: 2, // Monday (expo counts Sunday as 1): the day Home's Wrap button offers last week too
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
      // "Pay now" opens this loan's pay sheet (see responseRoute).
      data: { url: '/loans' satisfies NotificationRoute, loanId },
      categoryIdentifier: NOTIFICATION_KIND.emi,
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
      categoryIdentifier: NOTIFICATION_KIND.spike,
    },
    trigger: null,
  });
}

/**
 * A budget passing 80% of its limit, or going over — see checkBudgetNudge in
 * db/spendAlerts.ts. Opens Budgets. `budgetKey` ("<budget id>:<month>") is
 * what "Quiet this month" marks as done.
 */
export async function notifyBudget(copy: { title: string; body: string }, budgetKey: string): Promise<void> {
  const existing = await Notifications.getPermissionsAsync();
  if (!existing.granted) return;

  await ensureAndroidChannel();
  await Notifications.scheduleNotificationAsync({
    content: {
      ...copy,
      data: { url: '/budgets' satisfies NotificationRoute, budgetKey },
      categoryIdentifier: NOTIFICATION_KIND.budget,
    },
    trigger: null,
  });
}

/**
 * Calls `onRoute` whenever the user taps a Yume notification or one of its
 * buttons — including the tap that just cold-started the app. That launch
 * response is cleared once read: the system otherwise keeps returning it on
 * every later launch, which would reopen the same screen each time the app
 * is opened normally.
 *
 * A quiet button ("In 1 hour", "Quiet this month") opens nothing. Tapped
 * while the app is running, it is carried out here; the launch response
 * never needs it, since the background task already ran it.
 * Returns the unsubscribe function.
 */
export function subscribeToNotificationTaps(onRoute: (route: NotificationRoute) => void): () => void {
  let active = true;
  const take = (response: Notifications.NotificationResponse | null, live: boolean) => {
    if (!response) return;
    Notifications.clearLastNotificationResponseAsync().catch(() => {});
    if (isQuietAction(response.actionIdentifier)) {
      if (live) runQuietAction(response).catch((e) => console.warn('Notification action failed:', e));
      return;
    }
    const route = responseRoute(response);
    if (route && active) onRoute(route);
  };
  Notifications.getLastNotificationResponseAsync()
    .then((response) => take(response, false))
    .catch(() => {});
  const sub = Notifications.addNotificationResponseReceivedListener((response) => take(response, true));
  return () => {
    active = false;
    sub.remove();
  };
}

import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { NotificationPrefs, getNotificationPrefs } from '@/db/settings';
import { parseLocalIsoDate } from './date';
import { formatMoney } from './money';
import { formatPctChange } from './format';

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

const DAILY_REMINDER_ID = 'flynse-daily-reminder';

export async function ensureAndroidChannel(): Promise<void> {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync('default', {
    name: 'Yume reminders',
    importance: Notifications.AndroidImportance.DEFAULT,
    lightColor: '#E0F0A8',
  });
}

export async function requestNotificationPermission(): Promise<boolean> {
  const existing = await Notifications.getPermissionsAsync();
  if (existing.granted) return true;
  const result = await Notifications.requestPermissionsAsync();
  return result.granted;
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
    content: {
      title: 'A minute for Yume?',
      body: "Log today's spending while it's still fresh 🌱",
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DAILY,
      hour: prefs.reminderHour,
      minute: prefs.reminderMinute,
    },
  });
}

const WEEKLY_SUMMARY_ID = 'flynse-weekly-summary';

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
    content: {
      title: 'Your week, wrapped',
      body: 'See what moved this week and how you tracked against your usual.',
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.WEEKLY,
      weekday: 1, // Sunday
      hour: prefs.reminderHour,
      minute: prefs.reminderMinute,
    },
  });
}

function loanDueReminderId(loanId: string): string {
  return `flynse-loan-due-${loanId}`;
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
      title: 'EMI due today',
      body: `${counterparty} — ${formatMoney(emiAmountMinor)}. One step closer to done.`,
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
      title: 'Worth a peek 👀',
      body: `${categoryName} spending is up ${formatPctChange(pctChange)} vs last month.`,
    },
    trigger: null,
  });
}

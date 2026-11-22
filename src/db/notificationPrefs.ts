import { clampSlotMinutes } from '../lib/notificationTimes';
import { getDb } from './client';
import { withSettingsLock } from './settingsLock';

/**
 * The two times Yume can notify at, Morning and Evening (ranges in lib/notificationTimes.ts, never overlapping);
 * the rest are what it may mention at those times.
 */
export interface NotificationPrefs {
  recurringAlerts?: boolean;
  refundAlerts?: boolean;
  morningEnabled: boolean;
  morningHour: number;
  morningMinute: number;
  eveningEnabled: boolean;
  eveningHour: number;
  eveningMinute: number;
  overspendAlerts: boolean;
  billAlerts: boolean;
  weeklySummary: boolean;
  suuCheckins: boolean;
}

const NOTIFICATION_PREFS_KEY = 'notification_prefs';
const DEFAULT_NOTIFICATION_PREFS: NotificationPrefs = {
  morningEnabled: true,
  morningHour: 9,
  morningMinute: 0,
  // On from the start: Morning only speaks when something is due, so Evening is the nudge a new install hears.
  eveningEnabled: true,
  eveningHour: 20,
  eveningMinute: 0,
  overspendAlerts: true,
  billAlerts: true,
  weeklySummary: false,
  suuCheckins: true,
};

function clampPrefTimes(prefs: NotificationPrefs): NotificationPrefs {
  // Restored settings are untrusted JSON too. Invalid clock fields must not produce NaN dates,
  // and strings such as "false" must not silently enable reminders.
  const valid = { ...prefs };
  for (const key of ['recurringAlerts', 'refundAlerts'] as const) {
    if (key in prefs) valid[key] = prefs[key] === true;
  }
  for (const key of [
    'morningEnabled',
    'eveningEnabled',
    'billAlerts',
    'overspendAlerts',
    'weeklySummary',
    'suuCheckins',
  ] as const) {
    valid[key] = typeof prefs[key] === 'boolean' ? prefs[key] : DEFAULT_NOTIFICATION_PREFS[key];
  }
  for (const key of ['morningHour', 'morningMinute', 'eveningHour', 'eveningMinute'] as const) {
    const value = prefs[key];
    const max = key.endsWith('Hour') ? 23 : 59;
    valid[key] =
      Number.isInteger(value) && value >= 0 && value <= max ? value : DEFAULT_NOTIFICATION_PREFS[key];
  }
  const morning = clampSlotMinutes('morning', valid.morningHour * 60 + valid.morningMinute);
  const evening = clampSlotMinutes('evening', valid.eveningHour * 60 + valid.eveningMinute);
  return {
    ...valid,
    morningHour: Math.floor(morning / 60),
    morningMinute: morning % 60,
    eveningHour: Math.floor(evening / 60),
    eveningMinute: evening % 60,
  };
}

export async function getNotificationPrefs(): Promise<NotificationPrefs> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ value: string }>('SELECT value FROM settings WHERE key = ?', [
    NOTIFICATION_PREFS_KEY,
  ]);
  return readNotificationPrefs(row?.value);
}

function readNotificationPrefs(value: string | undefined): NotificationPrefs {
  if (!value) return { ...DEFAULT_NOTIFICATION_PREFS };
  try {
    const stored = JSON.parse(value);
    // `flynnCheckins` was renamed to `suuCheckins`; carry an existing install's value across so anyone who
    // turned check-ins off doesn't get them back on.
    if ('flynnCheckins' in stored && !('suuCheckins' in stored)) {
      stored.suuCheckins = stored.flynnCheckins;
    }
    delete stored.flynnCheckins;
    // The single daily reminder (`reminder*`) became the Evening time: an install that set it keeps it,
    // with Morning on its default.
    if (!('eveningEnabled' in stored) && 'reminderEnabled' in stored) {
      stored.eveningEnabled = stored.reminderEnabled;
      if (typeof stored.reminderHour === 'number') stored.eveningHour = stored.reminderHour;
      if (typeof stored.reminderMinute === 'number') stored.eveningMinute = stored.reminderMinute;
    }
    delete stored.reminderEnabled;
    delete stored.reminderHour;
    delete stored.reminderMinute;
    return clampPrefTimes({ ...DEFAULT_NOTIFICATION_PREFS, ...stored });
  } catch {
    return { ...DEFAULT_NOTIFICATION_PREFS };
  }
}

/** Merge one UI change with live settings atomically; unrelated choices and restores cannot be overwritten. */
export async function updateNotificationPrefs(patch: Partial<NotificationPrefs>): Promise<NotificationPrefs> {
  return withSettingsLock(async () => {
    const db = await getDb();
    let updated!: NotificationPrefs;
    await db.withTransactionAsync(async (tx) => {
      const row = await tx.getFirstAsync<{ value: string }>('SELECT value FROM settings WHERE key = ?', [
        NOTIFICATION_PREFS_KEY,
      ]);
      updated = clampPrefTimes({ ...readNotificationPrefs(row?.value), ...patch });
      await tx.runAsync(
        `INSERT INTO settings (key, value) VALUES (?, ?)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
        [NOTIFICATION_PREFS_KEY, JSON.stringify(updated)]
      );
    });
    return updated;
  });
}

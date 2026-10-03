import { clampSlotMinutes } from '../lib/notificationTimes';
import type { QueuedAlert } from '../lib/notificationPlan';
import { getDb } from './client';

// Cached in-memory after first load so formatMoney() etc. can read it
// synchronously without every call touching SQLite.
let cachedCurrency: string | null = null;

const DEFAULT_CURRENCY = 'INR';
const CURRENCY_KEY = 'default_currency';

export async function getDefaultCurrency(): Promise<string> {
  if (cachedCurrency) return cachedCurrency;
  const db = await getDb();
  const row = await db.getFirstAsync<{ value: string }>('SELECT value FROM settings WHERE key = ?', [
    CURRENCY_KEY,
  ]);
  cachedCurrency = row?.value ?? DEFAULT_CURRENCY;
  return cachedCurrency;
}

export function getCachedCurrency(): string {
  return cachedCurrency ?? DEFAULT_CURRENCY;
}

/** For db/client.ts to call during init with an already-open db handle, avoiding a circular getDb() call. */
export function primeCurrencyCache(value: string | null): void {
  cachedCurrency = value ?? DEFAULT_CURRENCY;
}

export async function setDefaultCurrency(code: string): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    `INSERT INTO settings (key, value) VALUES (?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
    [CURRENCY_KEY, code]
  );
  cachedCurrency = code;
}

/**
 * The two times Yume can notify at, Morning and Evening (ranges in lib/notificationTimes.ts, never overlapping);
 * the rest are what it may mention at those times.
 */
export interface NotificationPrefs {
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
  eveningEnabled: false,
  eveningHour: 20,
  eveningMinute: 0,
  overspendAlerts: true,
  billAlerts: true,
  weeklySummary: false,
  suuCheckins: true,
};

function clampPrefTimes(prefs: NotificationPrefs): NotificationPrefs {
  const morning = clampSlotMinutes('morning', prefs.morningHour * 60 + prefs.morningMinute);
  const evening = clampSlotMinutes('evening', prefs.eveningHour * 60 + prefs.eveningMinute);
  return {
    ...prefs,
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
  if (!row) return DEFAULT_NOTIFICATION_PREFS;
  try {
    const stored = JSON.parse(row.value);
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
    return DEFAULT_NOTIFICATION_PREFS;
  }
}

export async function setNotificationPrefs(prefs: NotificationPrefs): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    `INSERT INTO settings (key, value) VALUES (?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
    [NOTIFICATION_PREFS_KEY, JSON.stringify(prefs)]
  );
}

const ACCENT_COLOR_KEY = 'accent_color';
// Sky-blue signature accent, seen by anyone who never opened the accent picker (theme.ts's `primary` matches it
// for screens that skip `useAccent()`). Sage `#E0F0A8` (the old default) remains a selectable swatch below.
const DEFAULT_ACCENT = '#8FCBFF';
let cachedAccent: string | null = null;

export function getCachedAccentColor(): string {
  return cachedAccent ?? DEFAULT_ACCENT;
}

// A stored shade no longer offered would stay stuck forever (the hex is just a string, so a palette change in
// code never reaches an existing install): remap once here, then persist.
const LEGACY_ACCENT_REMAP: Record<string, string> = {
  '#D6FF3D': '#E0F0A8', // original neon-lime mockup colour, softened
  '#FFB84D': '#EFD3A8', // original harsher gold/tan
  // Ink and Cream were dropped from ACCENT_SWATCHES: they're the app's text/page colours, not accents, so
  // picking either turned buttons black or switched accents off.
  '#12130F': '#E0F0A8',
  '#FFFDF6': '#E0F0A8',
  // Tan was dropped for reading muddy next to the other pastels — remapped
  // to its closest replacement (Terracotta) rather than the plain default.
  '#EFD3A8': '#F0A387',
};

export async function getAccentColor(): Promise<string> {
  if (cachedAccent) return cachedAccent;
  const db = await getDb();
  const row = await db.getFirstAsync<{ value: string }>('SELECT value FROM settings WHERE key = ?', [
    ACCENT_COLOR_KEY,
  ]);
  const stored = row?.value ?? DEFAULT_ACCENT;
  const remapped = LEGACY_ACCENT_REMAP[stored];
  cachedAccent = remapped ?? stored;
  if (remapped) await setAccentColor(remapped);
  return cachedAccent;
}

export async function setAccentColor(hex: string): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    `INSERT INTO settings (key, value) VALUES (?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
    [ACCENT_COLOR_KEY, hex]
  );
  cachedAccent = hex;
}

const THEME_ID_KEY = 'theme_id';
let cachedThemeId: string | null | undefined; // undefined = not yet read; null = read, nothing stored

// The theme's `primary` is still written to `accent_color` so `getAccentColor()`/`useAccent()` readers keep
// working; `theme_id` only records which pack the hex came from (to re-select its card and `secondary`).
export async function getThemeId(): Promise<string | null> {
  if (cachedThemeId !== undefined) return cachedThemeId;
  const db = await getDb();
  const row = await db.getFirstAsync<{ value: string }>('SELECT value FROM settings WHERE key = ?', [
    THEME_ID_KEY,
  ]);
  cachedThemeId = row?.value ?? null;
  return cachedThemeId;
}

export async function setThemeId(id: string): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    `INSERT INTO settings (key, value) VALUES (?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
    [THEME_ID_KEY, id]
  );
  cachedThemeId = id;
}

const DAILY_SPENDING_GOAL_KEY = 'daily_spending_goal_minor';
let cachedDailySpendingGoal: number | null | undefined; // undefined = not yet read; null = read, nothing stored (feature off)

/**
 * A single overall daily spending cap in minor units: one number, no per-category split, no rollover of an
 * unspent day (unlike Budgets). `null` = off; Home's "Today" strip renders only once it's set.
 */
export async function getDailySpendingGoal(): Promise<number | null> {
  if (cachedDailySpendingGoal !== undefined) return cachedDailySpendingGoal;
  const db = await getDb();
  const row = await db.getFirstAsync<{ value: string }>('SELECT value FROM settings WHERE key = ?', [
    DAILY_SPENDING_GOAL_KEY,
  ]);
  cachedDailySpendingGoal = row ? Number(row.value) : null;
  return cachedDailySpendingGoal;
}

export async function setDailySpendingGoal(minor: number | null): Promise<void> {
  const db = await getDb();
  if (minor == null) {
    await db.runAsync('DELETE FROM settings WHERE key = ?', [DAILY_SPENDING_GOAL_KEY]);
  } else {
    await db.runAsync(
      `INSERT INTO settings (key, value) VALUES (?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
      [DAILY_SPENDING_GOAL_KEY, String(minor)]
    );
  }
  cachedDailySpendingGoal = minor;
}

const HAS_ONBOARDED_KEY = 'has_onboarded';

export async function getHasOnboarded(): Promise<boolean> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ value: string }>('SELECT value FROM settings WHERE key = ?', [
    HAS_ONBOARDED_KEY,
  ]);
  return row?.value === '1';
}

export async function setHasOnboarded(value: boolean): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    `INSERT INTO settings (key, value) VALUES (?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
    [HAS_ONBOARDED_KEY, value ? '1' : '0']
  );
}

const USER_NAME_KEY = 'user_name';
let cachedUserName: string | null | undefined; // undefined = not yet loaded, null = loaded but unset

export function getCachedUserName(): string | null {
  return cachedUserName ?? null;
}

export async function getUserName(): Promise<string | null> {
  if (cachedUserName !== undefined) return cachedUserName;
  const db = await getDb();
  const row = await db.getFirstAsync<{ value: string }>('SELECT value FROM settings WHERE key = ?', [
    USER_NAME_KEY,
  ]);
  cachedUserName = row?.value ?? null;
  return cachedUserName;
}

export async function setUserName(name: string): Promise<void> {
  const trimmed = name.trim();
  const db = await getDb();
  if (!trimmed) {
    await db.runAsync('DELETE FROM settings WHERE key = ?', [USER_NAME_KEY]);
    cachedUserName = null;
    return;
  }
  await db.runAsync(
    `INSERT INTO settings (key, value) VALUES (?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
    [USER_NAME_KEY, trimmed]
  );
  cachedUserName = trimmed;
}

/**
 * The year this install started, taken from the earliest `accounts.created_at` (no dedicated setting needed).
 */
export async function getMemberSinceYear(): Promise<number> {
  const db = await getDb();
  // Not `categories`: it has no `created_at` column, and the resulting throw failed Profile's whole
  // Promise.all (zero accounts/loans shown).
  const row = await db.getFirstAsync<{ earliest: string | null }>(
    'SELECT MIN(created_at) as earliest FROM accounts'
  );
  // `created_at` is SQLite `datetime('now')` format (space, not "T"): `new Date(...)` can yield Invalid Date
  // ("Member since NaN") on some engines, so just take the first 4 characters.
  const year = row?.earliest ? parseInt(row.earliest.slice(0, 4), 10) : NaN;
  return Number.isFinite(year) ? year : new Date().getFullYear();
}

const LOCAL_BACKUP_FOLDER_KEY = 'local_backup_folder_uri';
let cachedLocalBackupFolder: string | null | undefined;

export async function getLocalBackupFolderUri(): Promise<string | null> {
  if (cachedLocalBackupFolder !== undefined) return cachedLocalBackupFolder;
  const db = await getDb();
  const row = await db.getFirstAsync<{ value: string }>('SELECT value FROM settings WHERE key = ?', [
    LOCAL_BACKUP_FOLDER_KEY,
  ]);
  cachedLocalBackupFolder = row?.value ?? null;
  return cachedLocalBackupFolder;
}

export async function setLocalBackupFolderUri(uri: string | null): Promise<void> {
  const db = await getDb();
  if (!uri) {
    await db.runAsync('DELETE FROM settings WHERE key = ?', [LOCAL_BACKUP_FOLDER_KEY]);
  } else {
    await db.runAsync(
      `INSERT INTO settings (key, value) VALUES (?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
      [LOCAL_BACKUP_FOLDER_KEY, uri]
    );
  }
  cachedLocalBackupFolder = uri;
}

const LAST_LOCAL_BACKUP_KEY = 'last_local_backup_at';
let cachedLastLocalBackupAt: string | null | undefined;

export async function getLastLocalBackupAt(): Promise<string | null> {
  if (cachedLastLocalBackupAt !== undefined) return cachedLastLocalBackupAt;
  const db = await getDb();
  const row = await db.getFirstAsync<{ value: string }>('SELECT value FROM settings WHERE key = ?', [
    LAST_LOCAL_BACKUP_KEY,
  ]);
  cachedLastLocalBackupAt = row?.value ?? null;
  return cachedLastLocalBackupAt;
}

export async function setLastLocalBackupAt(iso: string): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    `INSERT INTO settings (key, value) VALUES (?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
    [LAST_LOCAL_BACKUP_KEY, iso]
  );
  cachedLastLocalBackupAt = iso;
}

const APP_LOCK_ENABLED_KEY = 'app_lock_enabled';
let cachedAppLockEnabled: boolean | undefined;

export async function getAppLockEnabled(): Promise<boolean> {
  if (cachedAppLockEnabled !== undefined) return cachedAppLockEnabled;
  const db = await getDb();
  const row = await db.getFirstAsync<{ value: string }>('SELECT value FROM settings WHERE key = ?', [
    APP_LOCK_ENABLED_KEY,
  ]);
  cachedAppLockEnabled = row?.value === '1';
  return cachedAppLockEnabled;
}

export async function setAppLockEnabled(value: boolean): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    `INSERT INTO settings (key, value) VALUES (?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
    [APP_LOCK_ENABLED_KEY, value ? '1' : '0']
  );
  cachedAppLockEnabled = value;
}

/**
 * Clears every in-memory settings cache so the next read hits the database. Needed after a full restore, which
 * writes the `settings` table directly (bypassing these setters) and would leave caches stale until relaunch.
 */
export type BackupFrequency = 'daily' | 'weekly' | 'monthly';
const BACKUP_FREQUENCY_KEY = 'backup_frequency';
let cachedBackupFrequency: BackupFrequency | undefined;

export async function getBackupFrequency(): Promise<BackupFrequency> {
  if (cachedBackupFrequency !== undefined) return cachedBackupFrequency;
  const db = await getDb();
  const row = await db.getFirstAsync<{ value: string }>('SELECT value FROM settings WHERE key = ?', [
    BACKUP_FREQUENCY_KEY,
  ]);
  cachedBackupFrequency = (row?.value as BackupFrequency) ?? 'daily';
  return cachedBackupFrequency;
}

export async function setBackupFrequency(value: BackupFrequency): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    `INSERT INTO settings (key, value) VALUES (?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
    [BACKUP_FREQUENCY_KEY, value]
  );
  cachedBackupFrequency = value;
}

// Elapsed-time windows for the weekly and monthly backups. Daily is once per
// calendar day instead — see isLocalBackupDue in lib/localBackup.ts.
export const BACKUP_FREQUENCY_MS: Record<Exclude<BackupFrequency, 'daily'>, number> = {
  weekly: 6.5 * 24 * 60 * 60 * 1000,
  monthly: 28 * 24 * 60 * 60 * 1000,
};

export type BackupOutcome = { at: string; ok: boolean; sizeBytes?: number; error?: string };

const LAST_LOCAL_BACKUP_RESULT_KEY = 'last_local_backup_result';
let cachedLastLocalResult: BackupOutcome | null | undefined;

async function getBackupOutcome(key: string): Promise<BackupOutcome | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ value: string }>('SELECT value FROM settings WHERE key = ?', [key]);
  if (!row) return null;
  try {
    return JSON.parse(row.value);
  } catch {
    return null;
  }
}

async function setBackupOutcome(key: string, outcome: BackupOutcome): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    `INSERT INTO settings (key, value) VALUES (?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
    [key, JSON.stringify(outcome)]
  );
}

export async function getLastLocalBackupResult(): Promise<BackupOutcome | null> {
  if (cachedLastLocalResult !== undefined) return cachedLastLocalResult;
  cachedLastLocalResult = await getBackupOutcome(LAST_LOCAL_BACKUP_RESULT_KEY);
  return cachedLastLocalResult;
}

export async function setLastLocalBackupResult(outcome: BackupOutcome): Promise<void> {
  await setBackupOutcome(LAST_LOCAL_BACKUP_RESULT_KEY, outcome);
  cachedLastLocalResult = outcome;
}

export function resetSettingsCache(): void {
  cachedCurrency = null;
  cachedAccent = null;
  cachedThemeId = undefined;
  cachedDailySpendingGoal = undefined;
  cachedUserName = undefined;
  cachedLocalBackupFolder = undefined;
  cachedLastLocalBackupAt = undefined;
  cachedAppLockEnabled = undefined;
  cachedBackupFrequency = undefined;
  cachedLastLocalResult = undefined;
  cachedLastOverspendNotified = undefined;
  cachedHideSensitiveAmounts = undefined;
  cachedBudgetNudgesSent = undefined;
  cachedMilestonesSeen = undefined;
}

const LAST_OVERSPEND_NOTIFIED_KEY = 'last_overspend_notified';
let cachedLastOverspendNotified: string | null | undefined;

/** A "categoryId:YYYY-MM" key for the last overspend alert actually shown, so the same category doesn't re-notify on every single transaction logged that month. */
export async function getLastOverspendNotified(): Promise<string | null> {
  if (cachedLastOverspendNotified !== undefined) return cachedLastOverspendNotified;
  const db = await getDb();
  const row = await db.getFirstAsync<{ value: string }>('SELECT value FROM settings WHERE key = ?', [
    LAST_OVERSPEND_NOTIFIED_KEY,
  ]);
  cachedLastOverspendNotified = row?.value ?? null;
  return cachedLastOverspendNotified;
}

export async function setLastOverspendNotified(key: string): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    `INSERT INTO settings (key, value) VALUES (?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
    [LAST_OVERSPEND_NOTIFIED_KEY, key]
  );
  cachedLastOverspendNotified = key;
}

const NEEDS_YOU_DISMISSED_KEY = 'needs_you_dismissed';
/** Keys carry their own situation (see needsYou.ts), so old ones simply stop matching; keep only recent ones. */
const NEEDS_YOU_DISMISSED_KEPT = 100;

/** Needs you items dismissed with ✕ — hidden until their situation changes. */
export async function getNeedsYouDismissed(): Promise<string[]> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ value: string }>('SELECT value FROM settings WHERE key = ?', [
    NEEDS_YOU_DISMISSED_KEY,
  ]);
  try {
    const parsed = row ? JSON.parse(row.value) : [];
    return Array.isArray(parsed) ? parsed.filter((k): k is string => typeof k === 'string') : [];
  } catch {
    return [];
  }
}

export async function setNeedsYouDismissed(keys: string[]): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    `INSERT INTO settings (key, value) VALUES (?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
    [NEEDS_YOU_DISMISSED_KEY, JSON.stringify([...new Set(keys)].slice(-NEEDS_YOU_DISMISSED_KEPT))]
  );
}

const HIDDEN_SUBSCRIPTION_SUGGESTIONS_KEY = 'hidden_subscription_suggestions';

/** Recurring's "Not set up yet" suggestions hidden with ✕ — `sub-<categoryId>` keys, hidden for good. */
export async function getHiddenSubscriptionSuggestions(): Promise<string[]> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ value: string }>('SELECT value FROM settings WHERE key = ?', [
    HIDDEN_SUBSCRIPTION_SUGGESTIONS_KEY,
  ]);
  try {
    const parsed = row ? JSON.parse(row.value) : [];
    return Array.isArray(parsed) ? parsed.filter((k): k is string => typeof k === 'string') : [];
  } catch {
    return [];
  }
}

async function setHiddenSubscriptionSuggestions(keys: string[]): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    `INSERT INTO settings (key, value) VALUES (?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
    [HIDDEN_SUBSCRIPTION_SUGGESTIONS_KEY, JSON.stringify([...new Set(keys)])]
  );
}

export async function hideSubscriptionSuggestion(key: string): Promise<void> {
  await setHiddenSubscriptionSuggestions([...(await getHiddenSubscriptionSuggestions()), key]);
}

/** Brings a hidden suggestion back — "Bring back" on it in Needs you. */
export async function unhideSubscriptionSuggestion(key: string): Promise<void> {
  await setHiddenSubscriptionSuggestions((await getHiddenSubscriptionSuggestions()).filter((k) => k !== key));
}

const MILESTONES_SEEN_KEY = 'milestones_seen';
const MILESTONES_KEPT = 200;
let cachedMilestonesSeen: string[] | undefined;

/** Keys of the goal and budget-month milestone notes already shown (see src/lib/milestones.ts), so each fires once. */
export async function getMilestonesSeen(): Promise<string[]> {
  if (cachedMilestonesSeen !== undefined) return cachedMilestonesSeen;
  const db = await getDb();
  const row = await db.getFirstAsync<{ value: string }>('SELECT value FROM settings WHERE key = ?', [
    MILESTONES_SEEN_KEY,
  ]);
  let keys: string[] = [];
  try {
    const parsed = row ? JSON.parse(row.value) : [];
    keys = Array.isArray(parsed) ? parsed.filter((k): k is string => typeof k === 'string') : [];
  } catch {
    keys = [];
  }
  cachedMilestonesSeen = keys;
  return keys;
}

export async function markMilestonesSeen(keys: string[]): Promise<void> {
  const next = [...(await getMilestonesSeen()).filter((k) => !keys.includes(k)), ...keys].slice(
    -MILESTONES_KEPT
  );
  const db = await getDb();
  await db.runAsync(
    `INSERT INTO settings (key, value) VALUES (?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
    [MILESTONES_SEEN_KEY, JSON.stringify(next)]
  );
  cachedMilestonesSeen = next;
}

const BUDGET_NUDGES_SENT_KEY = 'budget_nudges_sent';
/** Only recent ones matter (they're per month); older keys are dropped so the list can't grow forever. */
const BUDGET_NUDGES_KEPT = 60;
let cachedBudgetNudgesSent: string[] | undefined;

/** "budgetId:YYYY-MM:level" keys for the budget notifications already sent (see dueBudgetNudge). */
export async function getBudgetNudgesSent(): Promise<string[]> {
  if (cachedBudgetNudgesSent !== undefined) return cachedBudgetNudgesSent;
  const db = await getDb();
  const row = await db.getFirstAsync<{ value: string }>('SELECT value FROM settings WHERE key = ?', [
    BUDGET_NUDGES_SENT_KEY,
  ]);
  let keys: string[] = [];
  try {
    const parsed = row ? JSON.parse(row.value) : [];
    keys = Array.isArray(parsed) ? parsed.filter((k): k is string => typeof k === 'string') : [];
  } catch {
    keys = [];
  }
  cachedBudgetNudgesSent = keys;
  return keys;
}

export async function addBudgetNudgesSent(keys: string[]): Promise<void> {
  const next = [...(await getBudgetNudgesSent()).filter((k) => !keys.includes(k)), ...keys].slice(
    -BUDGET_NUDGES_KEPT
  );
  const db = await getDb();
  await db.runAsync(
    `INSERT INTO settings (key, value) VALUES (?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
    [BUDGET_NUDGES_SENT_KEY, JSON.stringify(next)]
  );
  cachedBudgetNudgesSent = next;
}

const ALERT_QUEUE_KEY = 'notification_alert_queue';
/** Alerts only wait for the next time, so a handful is plenty. */
const ALERT_QUEUE_KEPT = 20;

/** Spending alerts waiting for the next notification time (see planNotifications). */
export async function getAlertQueue(): Promise<QueuedAlert[]> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ value: string }>('SELECT value FROM settings WHERE key = ?', [
    ALERT_QUEUE_KEY,
  ]);
  try {
    const parsed: unknown = row ? JSON.parse(row.value) : [];
    return Array.isArray(parsed)
      ? parsed.filter(
          (a): a is QueuedAlert => !!a && typeof a.id === 'string' && typeof a.queuedAt === 'string'
        )
      : [];
  } catch {
    return [];
  }
}

export async function setAlertQueue(alerts: QueuedAlert[]): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    `INSERT INTO settings (key, value) VALUES (?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
    [ALERT_QUEUE_KEY, JSON.stringify(alerts.slice(-ALERT_QUEUE_KEPT))]
  );
}

/** Adds alerts to the queue; one already queued under the same id is replaced, not doubled. */
export async function addQueuedAlerts(alerts: QueuedAlert[]): Promise<void> {
  if (alerts.length === 0) return;
  const ids = new Set(alerts.map((a) => a.id));
  await setAlertQueue([...(await getAlertQueue()).filter((a) => !ids.has(a.id)), ...alerts]);
}

const HIDE_SENSITIVE_AMOUNTS_KEY = 'hide_sensitive_amounts';
let cachedHideSensitiveAmounts: boolean | undefined;

/** Global "privacy mode" toggle — masks amounts for categories flagged `isSensitive` (Savings Deposit/Investments by default) wherever they'd otherwise show. Off by default: opt-in, same as app lock. */
export async function getHideSensitiveAmounts(): Promise<boolean> {
  if (cachedHideSensitiveAmounts !== undefined) return cachedHideSensitiveAmounts;
  const db = await getDb();
  const row = await db.getFirstAsync<{ value: string }>('SELECT value FROM settings WHERE key = ?', [
    HIDE_SENSITIVE_AMOUNTS_KEY,
  ]);
  cachedHideSensitiveAmounts = row?.value === '1';
  return cachedHideSensitiveAmounts;
}

export function getCachedHideSensitiveAmounts(): boolean {
  return cachedHideSensitiveAmounts ?? false;
}

export async function setHideSensitiveAmounts(value: boolean): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    `INSERT INTO settings (key, value) VALUES (?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
    [HIDE_SENSITIVE_AMOUNTS_KEY, value ? '1' : '0']
  );
  cachedHideSensitiveAmounts = value;
}

export const SUPPORTED_CURRENCIES = [
  { code: 'INR', label: 'Indian Rupee' },
  { code: 'USD', label: 'US Dollar' },
  { code: 'EUR', label: 'Euro' },
  { code: 'GBP', label: 'British Pound' },
  { code: 'AED', label: 'UAE Dirham' },
  { code: 'AUD', label: 'Australian Dollar' },
  { code: 'CAD', label: 'Canadian Dollar' },
  { code: 'SGD', label: 'Singapore Dollar' },
  { code: 'JPY', label: 'Japanese Yen' },
  { code: 'NPR', label: 'Nepalese Rupee' },
];

/**
 * Add Transaction's per-type pre-selection: the account (and transfer destination) and category last saved.
 * Ids only; Add ignores any that no longer resolve (deleted/archived, or a savings account for an expense).
 */
export interface AddDefaults {
  expense?: { accountId: string; categoryId: string | null };
  income?: { accountId: string; categoryId: string | null };
  transfer?: { accountId: string; toAccountId: string | null };
}

const ADD_DEFAULTS_KEY = 'add_defaults';

export async function getAddDefaults(): Promise<AddDefaults> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ value: string }>('SELECT value FROM settings WHERE key = ?', [
    ADD_DEFAULTS_KEY,
  ]);
  if (!row) return {};
  try {
    const parsed = JSON.parse(row.value);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

export async function setAddDefaults(defaults: AddDefaults): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    `INSERT INTO settings (key, value) VALUES (?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
    [ADD_DEFAULTS_KEY, JSON.stringify(defaults)]
  );
}

/**
 * Until when (ISO timestamp) Home's "set up backups" reminder stays hidden
 * after the user taps "Later" on it. Null when never snoozed.
 */
const BACKUP_NUDGE_SNOOZED_UNTIL_KEY = 'backup_nudge_snoozed_until';

export async function getBackupNudgeSnoozedUntil(): Promise<string | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ value: string }>('SELECT value FROM settings WHERE key = ?', [
    BACKUP_NUDGE_SNOOZED_UNTIL_KEY,
  ]);
  return row?.value ?? null;
}

export async function setBackupNudgeSnoozedUntil(iso: string): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    `INSERT INTO settings (key, value) VALUES (?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
    [BACKUP_NUDGE_SNOOZED_UNTIL_KEY, iso]
  );
}

/**
 * Wraps already played (a month's "YYYY-MM", a week's first day); Home's Wrap ring goes plain once present.
 * Only the latest few are kept: the button only ever offers last week and last month.
 */
const WRAPS_SEEN_KEY = 'wraps_seen';
const WRAPS_SEEN_KEEP = 12;
/** Before the Wrap button, a month's Wrap marked itself seen here (Home's old review row). */
const LEGACY_MONTH_REVIEW_KEY = 'month_review_dismissed';

export async function getSeenWraps(): Promise<string[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<{ key: string; value: string }>(
    'SELECT key, value FROM settings WHERE key IN (?, ?)',
    [WRAPS_SEEN_KEY, LEGACY_MONTH_REVIEW_KEY]
  );
  const seen: string[] = [];
  for (const row of rows) {
    if (row.key === LEGACY_MONTH_REVIEW_KEY) {
      seen.push(row.value);
      continue;
    }
    try {
      const parsed: unknown = JSON.parse(row.value);
      if (Array.isArray(parsed)) seen.push(...parsed.filter((k): k is string => typeof k === 'string'));
    } catch {
      // A damaged value only means a ring shows in colour again.
    }
  }
  return seen;
}

export async function markWrapSeen(key: string): Promise<void> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ value: string }>('SELECT value FROM settings WHERE key = ?', [
    WRAPS_SEEN_KEY,
  ]);
  let seen: string[] = [];
  try {
    const parsed: unknown = row ? JSON.parse(row.value) : [];
    if (Array.isArray(parsed)) seen = parsed.filter((k): k is string => typeof k === 'string');
  } catch {
    seen = [];
  }
  if (seen.includes(key)) return;
  const next = [...seen, key].slice(-WRAPS_SEEN_KEEP);
  await db.runAsync(
    `INSERT INTO settings (key, value) VALUES (?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
    [WRAPS_SEEN_KEY, JSON.stringify(next)]
  );
}

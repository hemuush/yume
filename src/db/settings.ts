import { toLocalIsoDate } from '../lib/date';
import type { QueuedAlert, ScheduledReminder } from '../lib/queuedAlert';
import { getDb } from './client';
import { withSettingsLock } from './settingsLock';
import { resetBackupSettingsCache } from './backupSettings';

import {
  DEFAULT_CURRENCY,
  getCachedCurrency,
  primeCurrencyCache,
  readCurrencyCache,
  setCurrencyCache,
} from './currencyCache';
import { isAppearancePreference, type AppearancePreference } from '@/theme/scheme';

export { getCachedCurrency, primeCurrencyCache };
// The groups that moved out, so everything still imports from here.
export * from './notificationPrefs';
export * from './backupSettings';

const CURRENCY_KEY = 'default_currency';

export async function getDefaultCurrency(): Promise<string> {
  const cached = readCurrencyCache();
  if (cached) return cached;
  const db = await getDb();
  const row = await db.getFirstAsync<{ value: string }>('SELECT value FROM settings WHERE key = ?', [
    CURRENCY_KEY,
  ]);
  setCurrencyCache(row?.value ?? DEFAULT_CURRENCY);
  return getCachedCurrency();
}

export async function setDefaultCurrency(code: string): Promise<void> {
  const db = await getDb();
  await db.withTransactionAsync(async (tx) => {
    const current = await tx.getFirstAsync<{ value: string }>('SELECT value FROM settings WHERE key = ?', [
      CURRENCY_KEY,
    ]);
    if (code !== (current?.value ?? DEFAULT_CURRENCY)) {
      const owned = await tx.getFirstAsync<{ count: number }>(`SELECT
        (SELECT COUNT(*) FROM loans) + (SELECT COUNT(*) FROM savings_goals) +
        (SELECT COUNT(*) FROM person_ledger_entries) + (SELECT COUNT(*) FROM budgets) AS count`);
      if (owned && owned.count > 0)
        throw new Error(
          'The default currency cannot change while loans, goals, IOUs or budgets use it. Their amounts cannot be converted automatically.'
        );
    }
    await tx.runAsync(
      `INSERT INTO settings (key, value) VALUES (?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
      [CURRENCY_KEY, code]
    );
  });
  setCurrencyCache(code);
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
  const stored = row ? Number(row.value) : null;
  // A damaged value ("abc") must read as "off", not NaN, which would show as a goal of "NaN".
  cachedDailySpendingGoal = stored !== null && Number.isFinite(stored) ? stored : null;
  return cachedDailySpendingGoal;
}

export async function setDailySpendingGoal(minor: number | null): Promise<void> {
  if (minor != null && (!Number.isSafeInteger(minor) || minor < 0)) {
    throw new Error('Enter a valid daily spending goal');
  }
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

const NOTIFICATION_PERMISSION_ASKED_KEY = 'notification_permission_asked';

/** Whether Yume has already asked this phone for notification permission (it asks once, on its own). */
export async function getNotificationPermissionAsked(): Promise<boolean> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ value: string }>('SELECT value FROM settings WHERE key = ?', [
    NOTIFICATION_PERMISSION_ASKED_KEY,
  ]);
  return row?.value === '1';
}

export async function setNotificationPermissionAsked(): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    `INSERT INTO settings (key, value) VALUES (?, '1')
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
    [NOTIFICATION_PERMISSION_ASKED_KEY]
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
export function resetSettingsCache(): void {
  setCurrencyCache(null);
  resetBackupSettingsCache();
  cachedDailySpendingGoal = undefined;
  cachedUserName = undefined;
  cachedAppLockEnabled = undefined;
  cachedSpendSpikesSent = undefined;
  cachedHideSensitiveAmounts = undefined;
  cachedAppearance = undefined;
  cachedAddStyle = undefined;
  cachedHideWidgetValues = undefined;
  cachedBudgetNudgesSent = undefined;
  cachedMilestonesSeen = undefined;
}

const LAST_OVERSPEND_NOTIFIED_KEY = 'last_overspend_notified';
let cachedSpendSpikesSent: string[] | undefined;

/** Per-category/month spike keys already queued. Older installs stored only the last key as plain text. */
export async function getSpendSpikesSent(): Promise<string[]> {
  if (cachedSpendSpikesSent !== undefined) return cachedSpendSpikesSent;
  const db = await getDb();
  const row = await db.getFirstAsync<{ value: string }>('SELECT value FROM settings WHERE key = ?', [
    LAST_OVERSPEND_NOTIFIED_KEY,
  ]);
  let parsed: unknown = [];
  try {
    parsed = row ? JSON.parse(row.value) : [];
  } catch {
    parsed = row ? [row.value] : [];
  }
  cachedSpendSpikesSent = Array.isArray(parsed)
    ? parsed.filter((key): key is string => typeof key === 'string' && /:\d{4}-(0[1-9]|1[0-2])$/.test(key))
    : [];
  return cachedSpendSpikesSent;
}

export async function addSpendSpikeSent(key: string): Promise<void> {
  await withSettingsLock(async () => {
    const now = new Date();
    const months = [
      toLocalIsoDate(now).slice(0, 7),
      toLocalIsoDate(new Date(now.getFullYear(), now.getMonth() - 1, 1)).slice(0, 7),
    ];
    const next = [...new Set([...(await getSpendSpikesSent()), key])].filter((item) =>
      months.includes(item.slice(-7))
    );
    const db = await getDb();
    await db.runAsync(
      `INSERT INTO settings (key, value) VALUES (?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
      [LAST_OVERSPEND_NOTIFIED_KEY, JSON.stringify(next)]
    );
    cachedSpendSpikesSent = next;
  });
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

/** Suggestions hidden with ✕: category/currency keys; legacy category-only keys still cover every currency. */
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
  await withSettingsLock(async () => {
    await setHiddenSubscriptionSuggestions([...(await getHiddenSubscriptionSuggestions()), key]);
  });
}

/** Brings a hidden suggestion back — "Bring back" on it in Needs you. */
export async function unhideSubscriptionSuggestion(key: string): Promise<void> {
  await withSettingsLock(async () => {
    await setHiddenSubscriptionSuggestions(
      (await getHiddenSubscriptionSuggestions()).filter((k) => k !== key)
    );
  });
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
  await withSettingsLock(async () => {
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
  });
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
  await withSettingsLock(async () => {
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
  });
}

const ALERT_QUEUE_KEY = 'notification_alert_queue';
const SCHEDULED_REMINDERS_KEY = 'notification_scheduled_topics';

/** Device-local scheduling receipts, not a claim of OS presentation. Invalid/expired history is ignored. */
export async function getScheduledReminders(): Promise<ScheduledReminder[]> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ value: string }>('SELECT value FROM settings WHERE key = ?', [
    SCHEDULED_REMINDERS_KEY,
  ]);
  try {
    const parsed: unknown = row ? JSON.parse(row.value) : [];
    const cutoff = Date.now() - 14 * 86400000;
    return Array.isArray(parsed)
      ? parsed.filter(
          (item): item is ScheduledReminder =>
            !!item &&
            typeof item.key === 'string' &&
            typeof item.at === 'string' &&
            new Date(item.at).getTime() >= cutoff
        )
      : [];
  } catch {
    return [];
  }
}

export async function setScheduledReminders(items: ScheduledReminder[]): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    `INSERT INTO settings (key, value) VALUES (?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
    [SCHEDULED_REMINDERS_KEY, JSON.stringify(items)]
  );
}
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

async function writeAlertQueue(alerts: QueuedAlert[]): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    `INSERT INTO settings (key, value) VALUES (?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
    [ALERT_QUEUE_KEY, JSON.stringify(alerts.slice(-ALERT_QUEUE_KEPT))]
  );
}

export async function setAlertQueue(alerts: QueuedAlert[], original?: QueuedAlert[]): Promise<void> {
  await withSettingsLock(async () => {
    if (!original) return writeAlertQueue(alerts);
    // A rebuild resolves a snapshot while other writers can queue alerts. Replace only unchanged entries.
    const before = new Map(original.map((a) => [a.id, JSON.stringify(a)]));
    const resolved = new Map(alerts.map((a) => [a.id, a]));
    const next = (await getAlertQueue()).flatMap((a) => {
      if (!before.has(a.id) || before.get(a.id) !== JSON.stringify(a)) return [a];
      const updated = resolved.get(a.id);
      return updated ? [updated] : [];
    });
    await writeAlertQueue(next);
  });
}

/** Adds alerts to the queue; one already queued under the same id is replaced, not doubled. */
export async function addQueuedAlerts(alerts: QueuedAlert[]): Promise<void> {
  if (alerts.length === 0) return;
  const ids = new Set(alerts.map((a) => a.id));
  await withSettingsLock(async () => {
    await writeAlertQueue([...(await getAlertQueue()).filter((a) => !ids.has(a.id)), ...alerts]);
  });
}

const ADD_STYLE_KEY = 'add_style';
/** How the + button adds an entry: the form (the default), or by typing a sentence in a chat. */
export type AddStyle = 'form' | 'chat';
let cachedAddStyle: AddStyle | undefined; // undefined = not yet read

/** Anything stored that is not "chat" (an older or damaged value) reads as the form. */
export async function getAddStyle(): Promise<AddStyle> {
  if (cachedAddStyle !== undefined) return cachedAddStyle;
  const db = await getDb();
  const row = await db.getFirstAsync<{ value: string }>('SELECT value FROM settings WHERE key = ?', [
    ADD_STYLE_KEY,
  ]);
  cachedAddStyle = row?.value === 'chat' ? 'chat' : 'form';
  return cachedAddStyle;
}

export async function setAddStyle(style: AddStyle): Promise<void> {
  if (style !== 'form' && style !== 'chat') throw new Error('Choose the form or the chat.');
  const db = await getDb();
  await db.runAsync(
    `INSERT INTO settings (key, value) VALUES (?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
    [ADD_STYLE_KEY, style]
  );
  cachedAddStyle = style;
}

const APPEARANCE_KEY = 'appearance';
let cachedAppearance: AppearancePreference | undefined; // undefined = not yet read

/**
 * Which colour mode the person chose: follow the phone (the default), or always light, or always dark. Anything
 * stored that is not one of those three (an older or damaged value) reads as "system".
 */
export async function getAppearance(): Promise<AppearancePreference> {
  if (cachedAppearance !== undefined) return cachedAppearance;
  const db = await getDb();
  const row = await db.getFirstAsync<{ value: string }>('SELECT value FROM settings WHERE key = ?', [
    APPEARANCE_KEY,
  ]);
  cachedAppearance = isAppearancePreference(row?.value) ? row.value : 'system';
  return cachedAppearance;
}

export function getCachedAppearance(): AppearancePreference {
  return cachedAppearance ?? 'system';
}

export async function setAppearance(preference: AppearancePreference): Promise<void> {
  if (!isAppearancePreference(preference)) throw new Error('Choose system, light or dark.');
  const db = await getDb();
  await db.runAsync(
    `INSERT INTO settings (key, value) VALUES (?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
    [APPEARANCE_KEY, preference]
  );
  cachedAppearance = preference;
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

/**
 * Saves the toggle. Queued private reminder content is refreshed by saveHideSensitiveAmounts (afterCommit.ts),
 * which this module cannot import: afterCommit needs the notification scheduler, which needs these settings.
 */
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
  await withSettingsLock(async () => {
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
  });
}

const RECENT_SEARCHES_KEY = 'recent_searches';
/** How many past Activity searches are kept, newest first. */
export const RECENT_SEARCHES_KEPT = 5;

/** Activity's recent searches, newest first. Kept on the phone only, like every other setting. */
export async function getRecentSearches(): Promise<string[]> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ value: string }>('SELECT value FROM settings WHERE key = ?', [
    RECENT_SEARCHES_KEY,
  ]);
  try {
    const parsed = row ? JSON.parse(row.value) : [];
    return Array.isArray(parsed) ? parsed.filter((q): q is string => typeof q === 'string') : [];
  } catch {
    return [];
  }
}

/** Puts `query` first (once, ignoring case) and keeps the newest few; an empty list clears them. */
export async function setRecentSearches(queries: string[]): Promise<void> {
  const db = await getDb();
  const seen = new Set<string>();
  const kept = queries
    .map((q) => q.trim())
    .filter((q) => q && !seen.has(q.toLowerCase()) && seen.add(q.toLowerCase()))
    .slice(0, RECENT_SEARCHES_KEPT);
  await db.runAsync(
    `INSERT INTO settings (key, value) VALUES (?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
    [RECENT_SEARCHES_KEY, JSON.stringify(kept)]
  );
}

let cachedHideWidgetValues: boolean | undefined;
/** Independent launcher privacy, off by default to preserve existing widgets. */
export async function getHideWidgetValues(): Promise<boolean> {
  if (cachedHideWidgetValues !== undefined) return cachedHideWidgetValues;
  const db = await getDb();
  const row = await db.getFirstAsync<{ value: string }>('SELECT value FROM settings WHERE key = ?', [
    'hide_widget_values',
  ]);
  cachedHideWidgetValues = row?.value === '1';
  return cachedHideWidgetValues;
}
export async function setHideWidgetValues(value: boolean): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    'INSERT INTO settings (key,value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value',
    ['hide_widget_values', value ? '1' : '0']
  );
  cachedHideWidgetValues = value;
}

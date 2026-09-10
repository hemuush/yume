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

export interface NotificationPrefs {
  reminderEnabled: boolean;
  reminderHour: number; // 0-23
  reminderMinute: number; // 0-59
  overspendAlerts: boolean;
  billAlerts: boolean;
  weeklySummary: boolean;
  flynnCheckins: boolean;
}

const NOTIFICATION_PREFS_KEY = 'notification_prefs';
const DEFAULT_NOTIFICATION_PREFS: NotificationPrefs = {
  reminderEnabled: false,
  reminderHour: 20,
  reminderMinute: 0,
  overspendAlerts: true,
  billAlerts: true,
  weeklySummary: false,
  flynnCheckins: true,
};

export async function getNotificationPrefs(): Promise<NotificationPrefs> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ value: string }>('SELECT value FROM settings WHERE key = ?', [
    NOTIFICATION_PREFS_KEY,
  ]);
  if (!row) return DEFAULT_NOTIFICATION_PREFS;
  try {
    return { ...DEFAULT_NOTIFICATION_PREFS, ...JSON.parse(row.value) };
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
// Soft sage-lime — the original mockup's neon lime (#D6FF3D) sat noticeably
// darker/more saturated than the rest of the palette and read as harsh
// across a full header band; this keeps the same signature hue, lightened
// to match. See theme.ts for the full rationale.
const DEFAULT_ACCENT = '#E0F0A8';
let cachedAccent: string | null = null;

export function getCachedAccentColor(): string {
  return cachedAccent ?? DEFAULT_ACCENT;
}

// Anyone who already picked (or was defaulted to) the old, harsher shade
// before it was softened would otherwise stay stuck on it forever — the
// stored hex is just a string, so a code-level palette change alone never
// reaches an existing install. Remapped once here, then persisted so the fix
// sticks.
const LEGACY_ACCENT_REMAP: Record<string, string> = {
  '#D6FF3D': '#E0F0A8',
  '#FFB84D': '#EFD3A8',
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

export const ACCENT_SWATCHES = [
  '#12130F',
  '#E0F0A8',
  '#EFD3A8',
  '#8FCBFF',
  '#C9B8FF',
  '#FFA8CE',
  '#8FE8C8',
  '#FFFDF6',
];

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
 * The default categories are always seeded exactly once, on first launch —
 * their earliest created_at is a real, always-present proxy for "when this
 * install first started using Yume" without needing a dedicated setting.
 */
export async function getMemberSinceYear(): Promise<number> {
  const db = await getDb();
  // `categories` has no `created_at` column — querying it here always threw
  // "no such column: created_at", and since this runs inside Profile's
  // Promise.all with no error handling, that one throw silently failed the
  // *entire* batch, leaving Profile showing zero accounts, zero loans, zero
  // everything even though the data was all there. `accounts.created_at`
  // genuinely exists and is just as reasonable a "when did you start" proxy.
  const row = await db.getFirstAsync<{ earliest: string | null }>(
    'SELECT MIN(created_at) as earliest FROM accounts'
  );
  // `created_at` is SQLite's own `datetime('now')` format ("YYYY-MM-DD
  // HH:MM:SS", a space separator, not ISO 8601's "T") — `new Date(...)` on a
  // non-standard format is engine-dependent and can silently yield Invalid
  // Date (a "Member since NaN" bug) on some JS engines. The year is always
  // the first 4 characters regardless, so no Date parsing is needed at all.
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
 * Clears every in-memory settings cache so the next read for each hits the
 * database again — needed right after a full-data restore, since restoring
 * writes the `settings` table directly rather than through these files'
 * setters, and every cache above would otherwise keep showing whatever value
 * it held before the restore ran until the app is fully relaunched.
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

export function getCachedBackupFrequency(): BackupFrequency {
  return cachedBackupFrequency ?? 'daily';
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

export const BACKUP_FREQUENCY_MS: Record<BackupFrequency, number> = {
  daily: 20 * 60 * 60 * 1000, // ~daily, with slack so app-open timing doesn't skip a day
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
  cachedUserName = undefined;
  cachedLocalBackupFolder = undefined;
  cachedLastLocalBackupAt = undefined;
  cachedAppLockEnabled = undefined;
  cachedBackupFrequency = undefined;
  cachedLastLocalResult = undefined;
  cachedLastOverspendNotified = undefined;
  cachedHideSensitiveAmounts = undefined;
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

import { getDb } from './client';

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

export type BackupFrequency = 'daily' | 'weekly' | 'monthly';
const BACKUP_FREQUENCY_KEY = 'backup_frequency';
let cachedBackupFrequency: BackupFrequency | undefined;

export async function getBackupFrequency(): Promise<BackupFrequency> {
  if (cachedBackupFrequency !== undefined) return cachedBackupFrequency;
  const db = await getDb();
  const row = await db.getFirstAsync<{ value: string }>('SELECT value FROM settings WHERE key = ?', [
    BACKUP_FREQUENCY_KEY,
  ]);
  const stored = row?.value;
  cachedBackupFrequency =
    stored === 'daily' || stored === 'weekly' || stored === 'monthly' ? stored : 'daily';
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

/** Forgets what was read, so the next read asks the database (after a restore writes the table directly). */
export function resetBackupSettingsCache(): void {
  cachedLocalBackupFolder = undefined;
  cachedLastLocalBackupAt = undefined;
  cachedBackupFrequency = undefined;
  cachedLastLocalResult = undefined;
}

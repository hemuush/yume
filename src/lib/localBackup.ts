import { StorageAccessFramework } from 'expo-file-system/legacy';
import {
  buildBackupSnapshot,
  BackupSnapshot,
  BackupSummary,
  summarizeSnapshot,
  isTooLargeForBackup,
} from './backup';
import { toLocalIsoDate } from './date';
import { withoutRelock } from './appLock';
import {
  getLocalBackupFolderUri,
  setLocalBackupFolderUri,
  getLastLocalBackupAt,
  setLastLocalBackupAt,
  getBackupFrequency,
  BACKUP_FREQUENCY_MS,
  BackupFrequency,
  setLastLocalBackupResult,
} from '@/db/settings';
import { errorMessage } from '@/lib/errorMessage';

/**
 * Opens Android's folder picker once; the returned URI is a persistent grant Yume can keep writing into.
 * Returns null if the user cancels. The caller scans the folder before saving it.
 */
export async function pickBackupFolder(): Promise<string | null> {
  const result = await withoutRelock(() => StorageAccessFramework.requestDirectoryPermissionsAsync());
  if (!result.granted) return null;
  return result.directoryUri;
}

export async function forgetBackupFolder(): Promise<void> {
  await setLocalBackupFolderUri(null);
}

// One file per calendar day, not per backup run — no extension here (see
// below), and named by date only rather than a full timestamp.
function backupFilename(dateIso: string): string {
  return `yume-backup-${dateIso}`;
}

// Android may add a ".json" extension to the name, and a " (1)" when a name is taken.
const BACKUP_NAME = /^yume-backup-(\d{4}-\d{2}-\d{2})(?: \(\d+\))?(?:\.json)?$/;

/** The file name at the end of a storage URI (after the last "/" and ":"), or null if the URI doesn't decode. */
function backupBaseName(uri: string): string | null {
  try {
    const decoded = decodeURIComponent(uri);
    const afterSlash = decoded.slice(decoded.lastIndexOf('/') + 1);
    return afterSlash.slice(afterSlash.lastIndexOf(':') + 1);
  } catch {
    return null;
  }
}

/**
 * The day a backup is for, read from the file's own name (last part of its URI), or null if not ours.
 * Name only: a folder called "yume-backup-…" would otherwise claim every file in it. Exported for tests.
 */
export function backupFileDate(uri: string): string | null {
  const name = backupBaseName(uri);
  if (name === null) return null;
  const day = BACKUP_NAME.exec(name)?.[1];
  if (
    day &&
    !Number.isNaN(Date.parse(`${day}T00:00:00Z`)) &&
    new Date(`${day}T00:00:00Z`).toISOString().slice(0, 10) === day
  )
    return day;
  const timestamp = /^yume-backup-(\d{13})(?: \(\d+\))?(?:\.json)?$/.exec(name)?.[1];
  return timestamp ? toLocalIsoDate(new Date(Number(timestamp))) : null;
}

/** Our backup files among `uris`, oldest first: by the day in the name, then by name so a " (1)" copy follows its original. */
function backupFilesOldestFirst(uris: string[]): string[] {
  // backupFileDate is null for a URI that doesn't decode, so those drop out before the name is ever decoded.
  return uris
    .map((uri) => ({ uri, date: backupFileDate(uri) }))
    .filter((f): f is { uri: string; date: string } => f.date !== null)
    .map((f) => ({ ...f, name: decodeURIComponent(f.uri) }))
    .sort((a, b) => (a.date === b.date ? (a.name < b.name ? -1 : 1) : a.date < b.date ? -1 : 1))
    .map((f) => f.uri);
}

/** A string's size as stored on disk (UTF-8), not its character count — ₹ and emoji take several bytes. */
const byteLength = (text: string): number => new TextEncoder().encode(text).length;

// Days of local backups kept (one per calendar day, ~two weeks); older files are pruned after each write
// so the folder stays bounded. Yesterday's file always survives, covering "today's data got corrupted".
const KEEP_DAILY_BACKUPS = 14;

/**
 * Deletes all but the newest `KEEP_DAILY_BACKUPS` managed daily backups by their contents.
 * Exported copies are outside automatic retention. Best effort: a failed delete must never fail the backup that just succeeded.
 */
async function pruneOldLocalBackups(directoryUri: string): Promise<void> {
  try {
    const files = await listLocalBackups(directoryUri, Number.MAX_SAFE_INTEGER);
    const backups = files
      .filter((file) => BACKUP_NAME.test(backupBaseName(file.uri) ?? ''))
      .map((file) => file.uri)
      .reverse();
    for (const uri of backups.slice(0, Math.max(0, backups.length - KEEP_DAILY_BACKUPS))) {
      await StorageAccessFramework.deleteAsync(uri).catch(() => {});
    }
  } catch {
    // folder listing failed — nothing to prune, and not worth surfacing
  }
}

/**
 * Writes a snapshot to the chosen folder, replacing today's file (SAF would otherwise create "(1)" copies).
 * Old file deleted only AFTER the new one is fully written; a partial new file is removed. Throws on failure.
 */
export async function writeLocalBackupNow(
  directoryUri: string,
  options?: { preserveExisting?: boolean }
): Promise<{ sizeBytes: number }> {
  const snapshot = await buildBackupSnapshot();
  const json = JSON.stringify(snapshot);
  const today = toLocalIsoDate(new Date());
  const filename = backupFilename(today);
  const sizeBytes = byteLength(json);

  const existing = await StorageAccessFramework.readDirectoryAsync(directoryUri);
  // Exported copies and backups discovered in a newly chosen folder are never replaced.
  const sameDay = options?.preserveExisting
    ? []
    : existing.filter((uri) => BACKUP_NAME.test(backupBaseName(uri) ?? '') && backupFileDate(uri) === today);

  const fileUri = await StorageAccessFramework.createFileAsync(directoryUri, filename, 'application/json');
  try {
    await StorageAccessFramework.writeAsStringAsync(fileUri, json);
  } catch (e) {
    await StorageAccessFramework.deleteAsync(fileUri).catch(() => {});
    throw e;
  }
  for (const uri of sameDay) {
    if (uri !== fileUri) await StorageAccessFramework.deleteAsync(uri).catch(() => {});
  }
  await setLastLocalBackupAt(snapshot.exportedAt);
  if (!options?.preserveExisting) await pruneOldLocalBackups(directoryUri);
  return { sizeBytes };
}

/**
 * Whether a periodic backup is due. Daily = once per local calendar day, not 20 hours since the last one
 * (that skipped days opened only in the morning). Weekly/monthly are elapsed windows. Exported for tests.
 */
export function isLocalBackupDue(
  lastBackupIso: string | null,
  frequency: BackupFrequency,
  now: Date
): boolean {
  if (!lastBackupIso) return true;
  const last = new Date(lastBackupIso);
  if (frequency === 'daily') return toLocalIsoDate(last) !== toLocalIsoDate(now);
  return now.getTime() - last.getTime() >= BACKUP_FREQUENCY_MS[frequency];
}

/**
 * When the next automatic backup will run, as a phrase for the Backup screen ("Next backup tomorrow"); null if
 * there has never been one. Mirrors isLocalBackupDue: daily is the next calendar day, the others an elapsed window.
 */
export function nextLocalBackupLabel(
  lastBackupIso: string | null,
  frequency: BackupFrequency,
  now: Date
): string | null {
  if (!lastBackupIso) return null;
  if (isLocalBackupDue(lastBackupIso, frequency, now)) return 'Next backup when you open Yume';
  if (frequency === 'daily') return 'Backs up when you open Yume tomorrow';
  const due = new Date(new Date(lastBackupIso).getTime() + BACKUP_FREQUENCY_MS[frequency]);
  return `Backs up when you open Yume on or after ${due.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}`;
}

// The run in progress, if any — cold start and the app coming to the
// foreground can both ask at once, and two runs would write today's file twice.
let runningBackup: Promise<void> | null = null;

/**
 * Best-effort periodic backup if a folder is chosen and one is due (isLocalBackupDue); run on cold start and
 * on foreground (Android keeps Yume alive for days). Never throws; outcome is recorded for the Backup screen.
 */
export function runLocalBackupIfDue(): Promise<void> {
  runningBackup ??= backUpIfDue().finally(() => {
    runningBackup = null;
  });
  return runningBackup;
}

async function backUpIfDue(): Promise<void> {
  try {
    const directoryUri = await getLocalBackupFolderUri();
    if (!directoryUri) return;

    const lastBackup = await getLastLocalBackupAt();
    const frequency = await getBackupFrequency();
    const files = await listLocalBackups(directoryUri);
    const latest = files.find((file) => file.summary);
    // A newer file may belong to another install. Never overwrite it automatically.
    if (
      files.length &&
      (!latest?.exportedAt ||
        !lastBackup ||
        !Number.isFinite(Date.parse(lastBackup)) ||
        Date.parse(latest.exportedAt) > Date.parse(lastBackup))
    ) {
      throw new Error(
        'Existing backups need review. Open Backup & restore and review the latest backup before backing up this app’s data.'
      );
    }
    if (!isLocalBackupDue(latest?.exportedAt ?? null, frequency, new Date())) return;

    const { sizeBytes } = await writeLocalBackupNow(directoryUri);
    await setLastLocalBackupResult({ at: new Date().toISOString(), ok: true, sizeBytes });
  } catch (e) {
    await setLastLocalBackupResult({
      at: new Date().toISOString(),
      ok: false,
      error: errorMessage(e),
    }).catch(() => {});
  }
}

/** One backup file in the chosen folder, for Backup & Restore's list. */
export interface LocalBackupFile {
  uri: string;
  /** The backup's own export time (ISO), or null if the file couldn't be read. */
  exportedAt: string | null;
  sizeBytes: number;
  /** Null when the file couldn't be read as a Yume backup. */
  summary: BackupSummary | null;
}

/** Scan fresh contents: external storage can replace a file while retaining its URI. */
export async function listLocalBackups(
  directoryUri: string,
  limit = KEEP_DAILY_BACKUPS
): Promise<LocalBackupFile[]> {
  // An inaccessible folder is an error, not an empty folder that is safe to overwrite.
  const uris = await StorageAccessFramework.readDirectoryAsync(directoryUri);
  const backups = backupFilesOldestFirst(uris).reverse();
  const files: LocalBackupFile[] = [];
  for (const uri of backups) {
    try {
      const content = await StorageAccessFramework.readAsStringAsync(uri);
      const sizeBytes = byteLength(content);
      if (isTooLargeForBackup(sizeBytes)) throw new Error('Backup is too large');
      const snapshot = JSON.parse(content);
      const summary = summarizeSnapshot(snapshot);
      const exportedAt =
        summary &&
        typeof snapshot?.exportedAt === 'string' &&
        Number.isFinite(Date.parse(snapshot.exportedAt))
          ? snapshot.exportedAt
          : null;
      const info = { exportedAt, sizeBytes, summary };
      files.push({ uri, ...info });
    } catch {
      files.push({ uri, exportedAt: null, sizeBytes: 0, summary: null });
    }
  }
  // Valid snapshots come first. Apply the display limit only after inspecting every candidate.
  return files
    .sort((a, b) => {
      if (!!a.summary !== !!b.summary) return a.summary ? -1 : 1;
      const time = (file: LocalBackupFile) =>
        Date.parse(file.exportedAt ?? `${backupFileDate(file.uri)}T00:00:00Z`);
      return time(b) - time(a) || b.uri.localeCompare(a.uri, undefined, { numeric: true });
    })
    .slice(0, limit);
}

/**
 * Reads (but does not apply) one backup file — the caller confirms with
 * the user (the restore preview) before calling restoreFromSnapshot.
 */
export async function readLocalBackup(uri: string): Promise<BackupSnapshot> {
  const content = await StorageAccessFramework.readAsStringAsync(uri);
  // Same ceiling the file picker applies: parsing something this large could exhaust memory.
  if (isTooLargeForBackup(content.length) || isTooLargeForBackup(byteLength(content)))
    throw new Error('This file is too large to be a Yume backup.');
  return JSON.parse(content);
}

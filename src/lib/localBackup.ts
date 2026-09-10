import { StorageAccessFramework } from 'expo-file-system/legacy';
import { buildBackupSnapshot, BackupSnapshot } from './backup';
import { toLocalIsoDate } from './date';
import {
  getLocalBackupFolderUri,
  setLocalBackupFolderUri,
  getLastLocalBackupAt,
  setLastLocalBackupAt,
  getBackupFrequency,
  BACKUP_FREQUENCY_MS,
  setLastLocalBackupResult,
} from '@/db/settings';

/**
 * Opens Android's folder picker once; the returned URI is a persistent
 * grant Yume can keep writing into without asking again. Returns null if
 * the user cancels.
 */
export async function pickBackupFolder(): Promise<string | null> {
  const result = await StorageAccessFramework.requestDirectoryPermissionsAsync();
  if (!result.granted) return null;
  await setLocalBackupFolderUri(result.directoryUri);
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

// How many days of local backups to keep in the chosen folder. Backups are
// one-per-calendar-day, so this is roughly two weeks of history; older files
// are pruned after each successful write so the folder can't grow without
// bound over months of use. Yesterday's file always survives, which covers
// the "today's data got corrupted, restore the last good copy" case.
const KEEP_DAILY_BACKUPS = 14;

/**
 * Deletes all but the newest `KEEP_DAILY_BACKUPS` backup files in the folder.
 * The ISO date in each filename sorts correctly as a string (see
 * backupFilename), so "newest" is just the tail of a lexical sort. Best
 * effort — a failed delete here must never fail the backup that just
 * succeeded.
 */
async function pruneOldLocalBackups(directoryUri: string): Promise<void> {
  try {
    const uris = await StorageAccessFramework.readDirectoryAsync(directoryUri);
    const backups = uris.filter((u) => decodeURIComponent(u).includes('yume-backup-')).sort();
    for (const uri of backups.slice(0, Math.max(0, backups.length - KEEP_DAILY_BACKUPS))) {
      await StorageAccessFramework.deleteAsync(uri).catch(() => {});
    }
  } catch {
    // folder listing failed — nothing to prune, and not worth surfacing
  }
}

/**
 * Writes a fresh snapshot into the chosen folder right now, replacing
 * today's backup if one already exists rather than adding another one next
 * to it. Throws if no folder has been chosen, or on any write failure —
 * callers are expected to record/report that failure.
 *
 * SAF's createFileAsync always creates a brand-new file — even when one
 * with the same display name already exists, Android just appends "(1)",
 * "(2)", etc. rather than overwriting it. Without deleting today's existing
 * file first, running a backup more than once a day (a manual "Backup now"
 * on top of the automatic one, or just tapping it twice) silently piled up
 * duplicate same-day files forever, and "restore the newest" got less
 * reliable the more of them accumulated.
 */
export async function writeLocalBackupNow(directoryUri: string): Promise<{ sizeBytes: number }> {
  const snapshot = await buildBackupSnapshot();
  const json = JSON.stringify(snapshot);
  const filename = backupFilename(toLocalIsoDate(new Date()));

  const existing = await StorageAccessFramework.readDirectoryAsync(directoryUri);
  for (const uri of existing) {
    if (decodeURIComponent(uri).includes(filename)) {
      await StorageAccessFramework.deleteAsync(uri).catch(() => {});
    }
  }

  const fileUri = await StorageAccessFramework.createFileAsync(directoryUri, filename, 'application/json');
  await StorageAccessFramework.writeAsStringAsync(fileUri, json);
  await setLastLocalBackupAt(new Date().toISOString());
  await pruneOldLocalBackups(directoryUri);
  return { sizeBytes: json.length };
}

/**
 * Best-effort periodic local backup: only runs if a folder has been chosen
 * and enough time has passed since the last one, per the user's chosen
 * frequency. Never throws — the folder grant can be revoked outside the app
 * (e.g. the user deletes the folder), and a failed local backup should
 * never disrupt app startup — but the outcome is still recorded so the
 * Backup screen can show a failure instead of a silently stale "last
 * backup" timestamp.
 */
export async function runLocalBackupIfDue(): Promise<void> {
  try {
    const directoryUri = await getLocalBackupFolderUri();
    if (!directoryUri) return;

    const lastBackup = await getLastLocalBackupAt();
    const frequency = await getBackupFrequency();
    if (lastBackup && Date.now() - new Date(lastBackup).getTime() < BACKUP_FREQUENCY_MS[frequency]) return;

    const { sizeBytes } = await writeLocalBackupNow(directoryUri);
    await setLastLocalBackupResult({ at: new Date().toISOString(), ok: true, sizeBytes });
  } catch (e: any) {
    await setLastLocalBackupResult({
      at: new Date().toISOString(),
      ok: false,
      error: String(e?.message ?? e),
    }).catch(() => {});
  }
}

/**
 * Reads (but does not apply) the newest backup file in the chosen folder —
 * the caller is responsible for confirming with the user before calling
 * restoreFromSnapshot, same as every other restore path in the app. Returns
 * null if the folder has no backup file yet.
 */
export async function readNewestLocalBackup(directoryUri: string): Promise<BackupSnapshot | null> {
  const uris = await StorageAccessFramework.readDirectoryAsync(directoryUri);
  const backupUris = uris.filter((u) => decodeURIComponent(u).includes('yume-backup-'));
  if (backupUris.length === 0) return null;

  // SAF gives no reliable modified-time; the ISO timestamp embedded in the
  // filename itself (see backupFilename()) sorts correctly as a string.
  backupUris.sort();
  const newestUri = backupUris[backupUris.length - 1];

  const content = await StorageAccessFramework.readAsStringAsync(newestUri);
  return JSON.parse(content);
}

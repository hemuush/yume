import { StorageAccessFramework } from 'expo-file-system/legacy';
import { buildBackupSnapshot, BackupSnapshot, BackupSummary, summarizeSnapshot } from './backup';
import { toLocalIsoDate } from './date';
import { withoutRelock } from './appLock';
import { readBackupIndex, writeBackupIndex, rememberBackupFile, BackupIndex } from './backupIndex';
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
 * Opens Android's folder picker once; the returned URI is a persistent
 * grant Yume can keep writing into without asking again. Returns null if
 * the user cancels.
 */
export async function pickBackupFolder(): Promise<string | null> {
  const result = await withoutRelock(() => StorageAccessFramework.requestDirectoryPermissionsAsync());
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
 *
 * The old same-day file is only deleted AFTER the new one is fully written.
 * Deleting it first meant a failed write (storage full, the folder grant
 * revoked mid-way) left no backup for today at all — and a half-written new
 * file is removed rather than left behind to be picked up as "the newest".
 */
export async function writeLocalBackupNow(directoryUri: string): Promise<{ sizeBytes: number }> {
  const snapshot = await buildBackupSnapshot();
  const json = JSON.stringify(snapshot);
  const filename = backupFilename(toLocalIsoDate(new Date()));

  const existing = await StorageAccessFramework.readDirectoryAsync(directoryUri);
  const sameDay = existing.filter((uri) => decodeURIComponent(uri).includes(filename));

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
  await setLastLocalBackupAt(new Date().toISOString());
  await rememberBackupFile(fileUri, {
    exportedAt: snapshot.exportedAt,
    sizeBytes: json.length,
    summary: summarizeSnapshot(snapshot),
  });
  await pruneOldLocalBackups(directoryUri);
  return { sizeBytes: json.length };
}

/**
 * Whether a periodic backup is due. Daily means once per local calendar day
 * — not "20 hours since the last one": with a gap, a backup taken in the
 * afternoon wasn't due again until the next afternoon, so a day where the
 * app was only opened in the morning got no backup file at all. Weekly and
 * monthly stay elapsed-time windows. Exported for tests.
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

// The run in progress, if any — cold start and the app coming to the
// foreground can both ask at once, and two runs would write today's file twice.
let runningBackup: Promise<void> | null = null;

/**
 * Best-effort periodic local backup: only runs if a folder has been chosen
 * and one is due (isLocalBackupDue). Called on cold start and whenever the
 * app returns to the foreground — Android keeps Yume alive in the
 * background for days, so cold start alone could skip days. Never throws — the folder grant can be revoked outside the app
 * (e.g. the user deletes the folder), and a failed local backup should
 * never disrupt app startup — but the outcome is still recorded so the
 * Backup screen can show a failure instead of a silently stale "last
 * backup" timestamp.
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
    if (!isLocalBackupDue(lastBackup, frequency, new Date())) return;

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

/**
 * The backup files in the chosen folder, newest first (at most `limit`),
 * each saying what's inside. What's inside comes from the phone's backup
 * index (see backupIndex.ts) when Yume wrote or already read that file;
 * only a file it hasn't seen is read, once, and then remembered. A file
 * that can't be read is still listed, with no summary, rather than
 * breaking the list — and isn't remembered, so it's tried again next time.
 */
export async function listLocalBackups(
  directoryUri: string,
  limit = KEEP_DAILY_BACKUPS
): Promise<LocalBackupFile[]> {
  const uris = await StorageAccessFramework.readDirectoryAsync(directoryUri);
  // The ISO date in each filename (see backupFilename) sorts correctly as a string.
  const backups = uris
    .filter((u) => decodeURIComponent(u).includes('yume-backup-'))
    .sort()
    .reverse()
    .slice(0, limit);
  const index = await readBackupIndex();
  const kept: BackupIndex = {};
  let learned = false;
  const files: LocalBackupFile[] = [];
  for (const uri of backups) {
    const known = index[uri];
    if (known) {
      kept[uri] = known;
      files.push({ uri, ...known });
      continue;
    }
    try {
      const content = await StorageAccessFramework.readAsStringAsync(uri);
      const snapshot = JSON.parse(content);
      const info = {
        exportedAt: typeof snapshot?.exportedAt === 'string' ? snapshot.exportedAt : null,
        sizeBytes: content.length,
        summary: summarizeSnapshot(snapshot),
      };
      kept[uri] = info;
      learned = true;
      files.push({ uri, ...info });
    } catch {
      files.push({ uri, exportedAt: null, sizeBytes: 0, summary: null });
    }
  }
  // Save what was learned, and drop files that have left the folder.
  if (learned || Object.keys(index).length !== Object.keys(kept).length) writeBackupIndex(kept);
  return files;
}

/**
 * Reads (but does not apply) one backup file — the caller confirms with
 * the user (the restore preview) before calling restoreFromSnapshot.
 */
export async function readLocalBackup(uri: string): Promise<BackupSnapshot> {
  return JSON.parse(await StorageAccessFramework.readAsStringAsync(uri));
}

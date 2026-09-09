import { buildBackupSnapshot } from './backup';
import { getAuthSilently, uploadBackupToDrive } from './googleDrive';
import {
  getLastDriveBackupAt,
  setLastDriveBackupAt,
  getBackupFrequency,
  BACKUP_FREQUENCY_MS,
  setLastDriveBackupResult,
} from '@/db/settings';

/**
 * Best-effort silent backup: only runs if the user has previously linked
 * Google Drive (a stored refresh token exists) and it's been long enough
 * since the last backup, per their chosen frequency. Never throws — a
 * failed background backup should never disrupt app startup; call sites can
 * ignore the returned promise. The outcome (success/failure, size) is still
 * recorded so the Backup screen can show it even though nothing was shown
 * to the user at the moment it happened.
 */
export async function runAutoBackupIfDue(): Promise<void> {
  try {
    const lastBackup = await getLastDriveBackupAt();
    const frequency = await getBackupFrequency();
    if (lastBackup && Date.now() - new Date(lastBackup).getTime() < BACKUP_FREQUENCY_MS[frequency]) return;

    const auth = await getAuthSilently();
    if (!auth) return; // never linked, or refresh failed — skip quietly

    const json = JSON.stringify(await buildBackupSnapshot());
    await uploadBackupToDrive(auth.accessToken, 'flynse-backup-latest.json', json);
    const now = new Date().toISOString();
    await setLastDriveBackupAt(now);
    await setLastDriveBackupResult({ at: now, ok: true, sizeBytes: json.length });
  } catch (e: any) {
    // Silent to the user by design — network issues, revoked access, etc.
    // should not surface at startup — but still recorded, so the Backup
    // screen can show "last attempt failed" instead of a stale success.
    await setLastDriveBackupResult({
      at: new Date().toISOString(),
      ok: false,
      error: String(e?.message ?? e),
    }).catch(() => {});
  }
}

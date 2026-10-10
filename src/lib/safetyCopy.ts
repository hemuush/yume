import { File, Paths } from 'expo-file-system';
import { getDb } from '@/db/client';
import { buildBackupSnapshotOn, restoreFromSnapshotOn, BackupSnapshot, RestoreResult } from './backup';
import { errorMessage } from '@/lib/errorMessage';

/**
 * A way back from every restore: current data is first saved to one app-private file, not the backup folder.
 * Undo keeps a copy too. The new copy is *pending* and replaces the old one only after the restore succeeds.
 */

const COPY_NAME = 'yume-safety-copy.json';
const PENDING_NAME = 'yume-safety-copy.pending.json';

interface SafetyCopyFile {
  version: 1;
  /** When the copy was taken — i.e. just before that restore. */
  savedAt: string;
  transactions: number;
  accounts: number;
  snapshot: BackupSnapshot;
}

export interface SafetyCopyInfo {
  savedAt: string;
  transactions: number;
  accounts: number;
}

/** Thrown when the current data couldn't be saved as a safety copy — nothing has been replaced. */
export class SafetyCopyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SafetyCopyError';
  }
}

const copyFile = () => new File(Paths.document, COPY_NAME);
const pendingFile = () => new File(Paths.document, PENDING_NAME);

function removeIfPresent(file: File): void {
  try {
    if (file.exists) file.delete();
  } catch {
    // best effort — a leftover pending file is replaced by the next restore anyway
  }
}

/**
 * Restores `snapshot` after keeping current data as the safety copy; throws SafetyCopyError (nothing changed)
 * if it can't be saved, unless `withoutCopy`. `undoAvailable` is false if the new copy couldn't be placed.
 */
export async function restoreKeepingSafetyCopy(
  snapshot: BackupSnapshot,
  opts: { withoutCopy?: boolean } = {}
): Promise<RestoreResult & { undoAvailable: boolean }> {
  const pending = pendingFile();
  removeIfPresent(pending); // a stale one from an interrupted earlier restore

  // Taking the copy and restoring are one exclusive section: a write landing between them would be in neither
  // the safety copy nor the restored data. The helpers take the exclusive handle (getDb() inside would deadlock).
  const db = await getDb();
  let result: RestoreResult;
  try {
    result = await db.exclusiveAsync(async (xdb) => {
      if (!opts.withoutCopy) {
        try {
          const current = await buildBackupSnapshotOn(xdb);
          const payload: SafetyCopyFile = {
            version: 1,
            savedAt: new Date().toISOString(),
            transactions: current.tables.transactions?.length ?? 0,
            accounts: current.tables.accounts?.length ?? 0,
            snapshot: current,
          };
          pending.create();
          pending.write(JSON.stringify(payload));
        } catch (e) {
          removeIfPresent(pending);
          throw new SafetyCopyError(errorMessage(e));
        }
      }
      return restoreFromSnapshotOn(xdb, snapshot);
    });
  } catch (e) {
    // Nothing was replaced (the restore rolled back), so any copy we just
    // took is redundant — and the previous safety copy must survive.
    removeIfPresent(pending);
    throw e;
  }

  // No copy was taken of what this restore replaced: an older safety copy may still exist, but it's from
  // before an earlier restore, so offering it as "undo this restore" would put back the wrong data.
  if (opts.withoutCopy) return { ...result, undoAvailable: false };
  try {
    await pending.move(copyFile(), { overwrite: true });
    return { ...result, undoAvailable: true };
  } catch (e) {
    console.warn('Safety copy could not be put in place after restore:', e);
    removeIfPresent(pending);
    return { ...result, undoAvailable: false };
  }
}

async function readCopy(): Promise<SafetyCopyFile | null> {
  const file = copyFile();
  if (!file.exists) return null;
  try {
    const parsed = JSON.parse(await file.text()) as SafetyCopyFile;
    if (parsed?.version !== 1 || !parsed.snapshot?.tables || typeof parsed.savedAt !== 'string') return null;
    return parsed;
  } catch {
    return null;
  }
}

/** What the saved recovery copy holds — it can predate an older restore; null when there isn't one. */
export async function getSafetyCopyInfo(): Promise<SafetyCopyInfo | null> {
  const copy = await readCopy();
  return copy ? { savedAt: copy.savedAt, transactions: copy.transactions, accounts: copy.accounts } : null;
}

/**
 * Puts back the saved recovery snapshot. Itself a restore, so the
 * data it replaces becomes the new safety copy (undo can be undone).
 */
export async function undoLastRestore(): Promise<RestoreResult & { undoAvailable: boolean }> {
  const copy = await readCopy();
  if (!copy) throw new Error('There is no earlier data to put back.');
  return restoreKeepingSafetyCopy(copy.snapshot);
}

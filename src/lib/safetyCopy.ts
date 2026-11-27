import { File, Paths } from 'expo-file-system';
import { getDb, type AppDb } from '@/db/client';
import { newId } from '@/lib/id';
import {
  buildBackupSnapshotOn,
  restoreFromSnapshotOn,
  BackupSnapshot,
  RestoreResult,
  RESTORE_RECOVERY_KEY,
} from './backup';
import { errorMessage } from '@/lib/errorMessage';

/**
 * A way back from every restore: current data is first saved to one app-private file, not the backup folder.
 * Undo keeps a copy too. The new copy is *pending* and replaces the old one only after the restore succeeds.
 */

const COPY_NAME = 'yume-safety-copy.json';
const PENDING_NAME = 'yume-safety-copy.pending.json';
const ALTERNATE_PENDING_NAME = 'yume-safety-copy.alternate.pending.json';

interface SafetyCopyFile {
  version: 1;
  restoreId?: string;
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
const pendingFiles = () =>
  [PENDING_NAME, ALTERNATE_PENDING_NAME].map((name) => new File(Paths.document, name));
type CommittedPending = { file: File; copy: SafetyCopyFile; restoreId: string };

function removeIfPresent(file: File): void {
  try {
    if (file.exists) file.delete();
  } catch {
    // best effort — a leftover pending file is replaced by the next restore anyway
  }
}

/**
 * Restores `snapshot` after keeping current data as the safety copy; throws SafetyCopyError (nothing changed)
 * if it can't be saved, unless `withoutCopy`. Only a restore with a new recovery copy offers Undo.
 */
export async function restoreKeepingSafetyCopy(
  snapshot: BackupSnapshot,
  opts: { withoutCopy?: boolean } = {}
): Promise<RestoreResult & { undoAvailable: boolean }> {
  const db = await getDb();
  return db.exclusiveAsync(async (xdb) =>
    restoreWithCopyOn(xdb, snapshot, await readCommittedPending(xdb), opts)
  );
}

async function readCommittedPending(db: AppDb): Promise<CommittedPending | null> {
  const files = pendingFiles().filter((file) => file.exists);
  if (!files.length) return null;
  const marker = await db.getFirstAsync<{ value: string }>('SELECT value FROM settings WHERE key = ?', [
    RESTORE_RECOVERY_KEY,
  ]);
  if (!marker) return null;
  for (const file of files) {
    const copy = await readCopy(file);
    if (copy?.restoreId === marker.value) return { file, copy, restoreId: marker.value };
  }
  return null;
}

async function restoreWithCopyOn(
  db: AppDb,
  snapshot: BackupSnapshot,
  committed: CommittedPending | null,
  opts: { withoutCopy?: boolean } = {}
): Promise<RestoreResult & { undoAvailable: boolean }> {
  if (opts.withoutCopy) {
    return { ...(await restoreFromSnapshotOn(db, snapshot, committed?.restoreId)), undoAvailable: false };
  }

  // A failed move can leave the active recovery in either slot. Keep it until the next restore commits.
  const nextName = committed?.file.name === PENDING_NAME ? ALTERNATE_PENDING_NAME : PENDING_NAME;
  const nextPending = new File(Paths.document, nextName);
  removeIfPresent(nextPending);
  const restoreId = newId();
  try {
    const current = await buildBackupSnapshotOn(db);
    const payload: SafetyCopyFile = {
      version: 1,
      restoreId,
      savedAt: new Date().toISOString(),
      transactions: current.tables.transactions?.length ?? 0,
      accounts: current.tables.accounts?.length ?? 0,
      snapshot: current,
    };
    nextPending.create();
    await nextPending.write(JSON.stringify(payload));
  } catch (e) {
    removeIfPresent(nextPending);
    throw new SafetyCopyError(errorMessage(e));
  }

  let result: RestoreResult;
  try {
    result = await restoreFromSnapshotOn(db, snapshot, restoreId);
  } catch (e) {
    removeIfPresent(nextPending);
    throw e;
  }

  if (committed) removeIfPresent(committed.file);
  try {
    await nextPending.move(copyFile(), { overwrite: true });
  } catch (e) {
    // The marker was committed with the restore. A recovery read can use the pending file directly.
    console.warn('Safety copy could not be moved after restore:', e);
  }
  return { ...result, undoAvailable: true };
}

/**
 * The data as it was just before the one-time move of loans to whole rupees, kept in one app-private file (its own, so it
 * never stands in for a restore's recovery copy). Throws if it can't be saved; the move then waits for the next run.
 */
export async function keepCopyBeforeLoanRounding(): Promise<void> {
  const file = new File(Paths.document, 'yume-before-loan-rounding.json');
  const db = await getDb();
  const snapshot = await db.exclusiveAsync((xdb) => buildBackupSnapshotOn(xdb));
  removeIfPresent(file);
  file.create();
  await file.write(JSON.stringify({ savedAt: new Date().toISOString(), snapshot }));
}

async function readCopy(file = copyFile()): Promise<SafetyCopyFile | null> {
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
  const db = await getDb();
  const copy = await db.exclusiveAsync(async (xdb) => (await readCommittedPending(xdb))?.copy ?? readCopy(), {
    readOnly: true,
  });
  return copy ? { savedAt: copy.savedAt, transactions: copy.transactions, accounts: copy.accounts } : null;
}

/**
 * Puts back the saved recovery snapshot. Itself a restore, so the
 * data it replaces becomes the new safety copy (undo can be undone).
 */
export async function undoLastRestore(): Promise<RestoreResult & { undoAvailable: boolean }> {
  const db = await getDb();
  return db.exclusiveAsync(async (xdb) => {
    const pending = await readCommittedPending(xdb);
    const copy = pending?.copy ?? (await readCopy());
    if (!copy) throw new Error('There is no earlier data to put back.');
    return restoreWithCopyOn(xdb, copy.snapshot, pending);
  });
}

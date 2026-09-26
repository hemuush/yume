import { File, Paths } from 'expo-file-system';
import { buildBackupSnapshot, restoreFromSnapshot, BackupSnapshot, RestoreResult } from './backup';

/**
 * A way back from every restore. Before a restore replaces the data, the
 * current data is saved as a "safety copy" — one file in the app's own
 * private documents folder (never the user's backup folder, never shared,
 * removed with the app). Restoring that copy undoes the restore; since that
 * undo is itself a restore, it keeps a copy too, so the user can go back
 * and forth without ever losing either version.
 *
 * The new copy is written to a *pending* file first and only replaces the
 * previous safety copy once the restore has actually succeeded. A restore
 * that fails (a damaged file, broken references — restoreFromSnapshot
 * rolls those back) therefore leaves both the data and the existing safety
 * copy exactly as they were: trying a bad file can never cost the user
 * their way back.
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
 * Restores `snapshot`, first keeping the current data as the safety copy.
 * Throws SafetyCopyError (with nothing changed) if that copy can't be
 * saved — unless `withoutCopy` is set, which the user can choose after
 * being told. `undoAvailable` is false if the restore succeeded but the new
 * copy couldn't be put in place (then the older copy, if any, remains).
 */
export async function restoreKeepingSafetyCopy(
  snapshot: BackupSnapshot,
  opts: { withoutCopy?: boolean } = {}
): Promise<RestoreResult & { undoAvailable: boolean }> {
  const pending = pendingFile();
  removeIfPresent(pending); // a stale one from an interrupted earlier restore

  if (!opts.withoutCopy) {
    try {
      const current = await buildBackupSnapshot();
      const payload: SafetyCopyFile = {
        version: 1,
        savedAt: new Date().toISOString(),
        transactions: current.tables.transactions?.length ?? 0,
        accounts: current.tables.accounts?.length ?? 0,
        snapshot: current,
      };
      pending.create();
      pending.write(JSON.stringify(payload));
    } catch (e: any) {
      removeIfPresent(pending);
      throw new SafetyCopyError(String(e?.message ?? e));
    }
  }

  let result: RestoreResult;
  try {
    result = await restoreFromSnapshot(snapshot);
  } catch (e) {
    // Nothing was replaced (the restore rolled back), so the copy we just
    // took is redundant — and the previous safety copy must survive.
    removeIfPresent(pending);
    throw e;
  }

  if (opts.withoutCopy) return { ...result, undoAvailable: copyFile().exists };
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

/** What the current safety copy holds, for the Backup screen's "Undo your last restore" card — null when there isn't one. */
export async function getSafetyCopyInfo(): Promise<SafetyCopyInfo | null> {
  const copy = await readCopy();
  return copy ? { savedAt: copy.savedAt, transactions: copy.transactions, accounts: copy.accounts } : null;
}

/**
 * Puts back the data from before the last restore. Itself a restore, so the
 * data it replaces becomes the new safety copy (undo can be undone).
 */
export async function undoLastRestore(): Promise<RestoreResult & { undoAvailable: boolean }> {
  const copy = await readCopy();
  if (!copy) throw new Error('There is no earlier data to put back.');
  return restoreKeepingSafetyCopy(copy.snapshot);
}

import { File, Paths } from 'expo-file-system';
import type { BackupSummary } from './backup';

/**
 * What's inside each backup file in the chosen folder, remembered on the
 * phone so the Backup screen doesn't re-read every file each time it opens.
 * A backup file is ~1 KB per entry: at 20,000 entries, reading and parsing
 * all fourteen kept files would be ~80 MB of work before the list showed.
 *
 * Keyed by the file's SAF URI. Backup files are never edited in place — a
 * new backup is always a new file (a new URI), and the old one is deleted —
 * so a remembered entry can't go stale; entries for files no longer in the
 * folder are dropped whenever the list is read. The index lives in the app's
 * own private storage, never in the backup folder or inside a backup, so a
 * restore never brings another phone's index along. Losing it only costs
 * one slow read: every read here fails soft to "nothing remembered".
 */

export interface BackupFileInfo {
  exportedAt: string | null;
  sizeBytes: number;
  summary: BackupSummary | null;
}

export type BackupIndex = Record<string, BackupFileInfo>;

const INDEX_NAME = 'backup-index.json';
const indexFile = () => new File(Paths.document, INDEX_NAME);

export async function readBackupIndex(): Promise<BackupIndex> {
  try {
    const file = indexFile();
    if (!file.exists) return {};
    const parsed = JSON.parse(await file.text());
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

/** Best effort: a failed write only means the next list reads the files again. */
export function writeBackupIndex(index: BackupIndex): void {
  try {
    const file = indexFile();
    if (!file.exists) file.create();
    file.write(JSON.stringify(index));
  } catch {
    // Nothing to do: the index is only a speed-up.
  }
}

/** Remembers one file just written, so its first listing is instant too. */
export async function rememberBackupFile(uri: string, info: BackupFileInfo): Promise<void> {
  writeBackupIndex({ ...(await readBackupIndex()), [uri]: info });
}

import { File, Paths } from 'expo-file-system';
import type { BackupSummary } from './backup';

/**
 * Cache of each backup file's contents so the Backup screen needn't re-parse them on open (~1 KB/entry).
 * Keyed by SAF URI (files are never edited in place, so no stale entries); app-private; fails soft to empty.
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

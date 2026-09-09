/**
 * writeLocalBackupNow's one-file-per-day behavior — SAF's createFileAsync
 * always creates a brand-new file even when one with the same display name
 * already exists (Android appends "(1)", "(2)", ... rather than
 * overwriting), so without an explicit delete-then-create step, repeated
 * backups on the same day silently piled up duplicate files forever.
 */
jest.mock('expo-file-system/legacy', () => ({
  StorageAccessFramework: {
    readDirectoryAsync: jest.fn(),
    createFileAsync: jest.fn(),
    writeAsStringAsync: jest.fn(),
    deleteAsync: jest.fn(),
    requestDirectoryPermissionsAsync: jest.fn(),
  },
}));
jest.mock('./backup', () => ({
  buildBackupSnapshot: jest.fn(async () => ({ formatVersion: 1, exportedAt: 'x', tables: {} })),
}));
jest.mock('@/db/settings', () => ({
  getLocalBackupFolderUri: jest.fn(),
  setLocalBackupFolderUri: jest.fn(),
  getLastLocalBackupAt: jest.fn(),
  setLastLocalBackupAt: jest.fn(async () => {}),
  getBackupFrequency: jest.fn(),
  BACKUP_FREQUENCY_MS: { daily: 1, weekly: 1, monthly: 1 },
  setLastLocalBackupResult: jest.fn(async () => {}),
}));

import { StorageAccessFramework } from 'expo-file-system/legacy';
import { writeLocalBackupNow } from './localBackup';
import { toLocalIsoDate } from './date';

describe('writeLocalBackupNow', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (StorageAccessFramework.deleteAsync as jest.Mock).mockResolvedValue(undefined);
  });

  it('deletes an existing same-day backup before creating the new one', async () => {
    const todayIso = toLocalIsoDate(new Date());
    const existingUri = `content://tree/primary/flynse-backup-${todayIso}`;
    (StorageAccessFramework.readDirectoryAsync as jest.Mock).mockResolvedValue([
      existingUri,
      'content://tree/primary/flynse-backup-2020-01-01', // an older day's file — left alone
    ]);
    (StorageAccessFramework.createFileAsync as jest.Mock).mockResolvedValue('content://new-file');

    await writeLocalBackupNow('content://tree/primary');

    expect(StorageAccessFramework.deleteAsync).toHaveBeenCalledTimes(1);
    expect(StorageAccessFramework.deleteAsync).toHaveBeenCalledWith(existingUri);
    expect(StorageAccessFramework.createFileAsync).toHaveBeenCalledWith(
      'content://tree/primary',
      `flynse-backup-${todayIso}`,
      'application/json'
    );
  });

  it('creates the file with no delete when nothing exists for today yet', async () => {
    (StorageAccessFramework.readDirectoryAsync as jest.Mock).mockResolvedValue([]);
    (StorageAccessFramework.createFileAsync as jest.Mock).mockResolvedValue('content://new-file');

    await writeLocalBackupNow('content://tree/primary');

    expect(StorageAccessFramework.deleteAsync).not.toHaveBeenCalled();
    expect(StorageAccessFramework.createFileAsync).toHaveBeenCalled();
  });

  it("never deletes a different day's backup file", async () => {
    (StorageAccessFramework.readDirectoryAsync as jest.Mock).mockResolvedValue([
      'content://tree/primary/flynse-backup-2020-01-01',
      'content://tree/primary/flynse-backup-2020-01-02',
    ]);
    (StorageAccessFramework.createFileAsync as jest.Mock).mockResolvedValue('content://new-file');

    await writeLocalBackupNow('content://tree/primary');

    expect(StorageAccessFramework.deleteAsync).not.toHaveBeenCalled();
  });
});

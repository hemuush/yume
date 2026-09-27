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
    readAsStringAsync: jest.fn(),
    requestDirectoryPermissionsAsync: jest.fn(),
  },
}));
jest.mock('./backup', () => ({
  buildBackupSnapshot: jest.fn(async () => ({ formatVersion: 1, exportedAt: 'x', tables: {} })),
  summarizeSnapshot: (s: any) => (s?.tables?.transactions ? { entries: s.tables.transactions.length } : null),
}));
jest.mock('@/db/settings', () => ({
  getLocalBackupFolderUri: jest.fn(),
  setLocalBackupFolderUri: jest.fn(),
  getLastLocalBackupAt: jest.fn(),
  setLastLocalBackupAt: jest.fn(async () => {}),
  getBackupFrequency: jest.fn(),
  BACKUP_FREQUENCY_MS: { weekly: 6.5 * 24 * 60 * 60 * 1000, monthly: 28 * 24 * 60 * 60 * 1000 },
  setLastLocalBackupResult: jest.fn(async () => {}),
}));

import { StorageAccessFramework } from 'expo-file-system/legacy';
import { writeLocalBackupNow, isLocalBackupDue, listLocalBackups } from './localBackup';
import { toLocalIsoDate } from './date';

describe('isLocalBackupDue', () => {
  // Local times — the daily rule is about the phone's own calendar day.
  const at = (day: number, hour: number, minute = 0) => new Date(2026, 8, day, hour, minute);

  it('is due when there has never been a backup', () => {
    expect(isLocalBackupDue(null, 'daily', at(24, 9))).toBe(true);
  });

  it('runs daily backups once per calendar day, however few hours have passed', () => {
    // Yesterday afternoon's backup, opened this morning: a new day, so due.
    expect(isLocalBackupDue(at(23, 13, 53).toISOString(), 'daily', at(24, 9, 8))).toBe(true);
    // Just after midnight counts as the new day too.
    expect(isLocalBackupDue(at(24, 23, 58).toISOString(), 'daily', at(25, 0, 6))).toBe(true);
  });

  it('does not repeat a daily backup on the same day', () => {
    expect(isLocalBackupDue(at(24, 0, 5).toISOString(), 'daily', at(24, 23, 55))).toBe(false);
  });

  it('keeps weekly and monthly as elapsed-time windows', () => {
    expect(isLocalBackupDue(at(20, 9).toISOString(), 'weekly', at(26, 20))).toBe(false);
    expect(isLocalBackupDue(at(19, 9).toISOString(), 'weekly', at(26, 9))).toBe(true);
    expect(isLocalBackupDue(at(1, 9).toISOString(), 'monthly', at(28, 9))).toBe(false);
    expect(isLocalBackupDue(at(1, 9).toISOString(), 'monthly', at(29, 10))).toBe(true);
  });
});

describe('writeLocalBackupNow', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (StorageAccessFramework.deleteAsync as jest.Mock).mockResolvedValue(undefined);
  });

  it('replaces an existing same-day backup, deleting the old one only after the new one is written', async () => {
    const todayIso = toLocalIsoDate(new Date());
    const existingUri = `content://tree/primary/yume-backup-${todayIso}`;
    (StorageAccessFramework.readDirectoryAsync as jest.Mock).mockResolvedValue([
      existingUri,
      'content://tree/primary/yume-backup-2020-01-01', // an older day's file — left alone
    ]);
    (StorageAccessFramework.createFileAsync as jest.Mock).mockResolvedValue('content://new-file');

    await writeLocalBackupNow('content://tree/primary');

    expect(StorageAccessFramework.deleteAsync).toHaveBeenCalledTimes(1);
    expect(StorageAccessFramework.deleteAsync).toHaveBeenCalledWith(existingUri);
    expect(StorageAccessFramework.createFileAsync).toHaveBeenCalledWith(
      'content://tree/primary',
      `yume-backup-${todayIso}`,
      'application/json'
    );
    const writeOrder = (StorageAccessFramework.writeAsStringAsync as jest.Mock).mock.invocationCallOrder[0];
    const deleteOrder = (StorageAccessFramework.deleteAsync as jest.Mock).mock.invocationCallOrder[0];
    expect(writeOrder).toBeLessThan(deleteOrder);
  });

  it("keeps today's existing backup when writing the new one fails, and removes the half-written file", async () => {
    const todayIso = toLocalIsoDate(new Date());
    const existingUri = `content://tree/primary/yume-backup-${todayIso}`;
    (StorageAccessFramework.readDirectoryAsync as jest.Mock).mockResolvedValue([existingUri]);
    (StorageAccessFramework.createFileAsync as jest.Mock).mockResolvedValue('content://new-file');
    (StorageAccessFramework.writeAsStringAsync as jest.Mock).mockRejectedValueOnce(new Error('disk full'));

    await expect(writeLocalBackupNow('content://tree/primary')).rejects.toThrow('disk full');

    const deleted = (StorageAccessFramework.deleteAsync as jest.Mock).mock.calls.map((c) => c[0]);
    expect(deleted).toEqual(['content://new-file']);
    expect(deleted).not.toContain(existingUri);
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
      'content://tree/primary/yume-backup-2020-01-01',
      'content://tree/primary/yume-backup-2020-01-02',
    ]);
    (StorageAccessFramework.createFileAsync as jest.Mock).mockResolvedValue('content://new-file');

    await writeLocalBackupNow('content://tree/primary');

    expect(StorageAccessFramework.deleteAsync).not.toHaveBeenCalled();
  });

  it('prunes the oldest backups once more than 14 days have accumulated, keeping the newest 14', async () => {
    // 20 distinct past days plus whatever today writes — the 6 oldest should
    // be pruned, none of the recent 14 touched.
    const days = Array.from({ length: 20 }, (_, i) => {
      const d = String(i + 1).padStart(2, '0');
      return `content://tree/primary/yume-backup-2025-01-${d}`;
    });
    (StorageAccessFramework.readDirectoryAsync as jest.Mock).mockResolvedValue(days);
    (StorageAccessFramework.createFileAsync as jest.Mock).mockResolvedValue('content://new-file');

    await writeLocalBackupNow('content://tree/primary');

    const deleted = (StorageAccessFramework.deleteAsync as jest.Mock).mock.calls.map((c) => c[0]);
    expect(deleted).toEqual(days.slice(0, 6));
    expect(deleted).not.toContain(days[6]);
  });
});

describe('listLocalBackups', () => {
  const folder = 'content://folder';
  const file = (date: string) => `${folder}/yume-backup-${date}`;

  beforeEach(() => jest.clearAllMocks());

  it('lists backup files newest first, each with what is inside', async () => {
    (StorageAccessFramework.readDirectoryAsync as jest.Mock).mockResolvedValue([
      file('2026-09-22'),
      `${folder}/notes.txt`,
      file('2026-09-25'),
    ]);
    (StorageAccessFramework.readAsStringAsync as jest.Mock).mockImplementation(async (uri: string) =>
      JSON.stringify({ exportedAt: `${uri.slice(-10)}T10:00:00Z`, tables: { transactions: [{}, {}] } })
    );
    const files = await listLocalBackups(folder);
    expect(files.map((f) => [f.uri, f.exportedAt, f.summary])).toEqual([
      [file('2026-09-25'), '2026-09-25T10:00:00Z', { entries: 2 }],
      [file('2026-09-22'), '2026-09-22T10:00:00Z', { entries: 2 }],
    ]);
    expect(files[0].sizeBytes).toBeGreaterThan(0);
  });

  it("keeps a file it can't read in the list, with nothing to restore", async () => {
    (StorageAccessFramework.readDirectoryAsync as jest.Mock).mockResolvedValue([file('2026-09-25')]);
    (StorageAccessFramework.readAsStringAsync as jest.Mock).mockResolvedValue('not json');
    expect(await listLocalBackups(folder)).toEqual([
      { uri: file('2026-09-25'), exportedAt: null, sizeBytes: 0, summary: null },
    ]);
  });

  it('shows at most the newest few', async () => {
    (StorageAccessFramework.readDirectoryAsync as jest.Mock).mockResolvedValue(
      Array.from({ length: 20 }, (_, i) => file(`2026-09-${String(i + 1).padStart(2, '0')}`))
    );
    (StorageAccessFramework.readAsStringAsync as jest.Mock).mockResolvedValue(
      '{"tables":{"transactions":[]}}'
    );
    const files = await listLocalBackups(folder, 14);
    expect(files).toHaveLength(14);
    expect(files[0].uri).toBe(file('2026-09-20'));
  });
});

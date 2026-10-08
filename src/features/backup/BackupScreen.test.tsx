/**
 * The Backup & restore screen: a status card that says whether you are backed up, then two tabs - the
 * restore-points timeline (three newest, "See all" for the rest) and the exports.
 */
import { create, act, ReactTestRenderer } from 'react-test-renderer';
import { Text } from 'react-native';

jest.setTimeout(30000);

jest.mock('react-native-reanimated', () => require('@/test-support/reanimatedMock').createReanimatedMock());
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
jest.mock('expo-router', () => ({
  router: { replace: jest.fn(), push: jest.fn() },
  useFocusEffect: (cb: () => void) => require('react').useEffect(cb, [cb]),
}));
// The sky header reads the theme's colours; this file's settings mock has no cached theme.
jest.mock('@/theme/AccentContext', () => ({
  useAccent: () => ({ accent: '#8FCBFF', secondary: '#8FE8C8', onAccent: '#12130F' }),
}));
jest.mock('@/components/AppHeader', () => ({ HeaderUserButton: () => null }));
jest.mock('@/features/backup/RestorePreviewSheet', () => ({ RestorePreviewSheet: () => null }));
jest.mock('@/lib/restoreSync', () => ({ resyncAfterRestore: jest.fn(async () => {}) }));
// A stand-in File that remembers what was written and whether it was deleted, so a test can see that the
// temporary export never outlives the share.
const mockCreated: { name: string; deleted: boolean; content?: unknown }[] = [];
jest.mock('expo-file-system', () => ({
  Paths: { document: 'documents' },
  File: class {
    record: { name: string; deleted: boolean; content?: unknown };
    uri: string;
    constructor(_dir: unknown, name?: string) {
      this.uri = `file://documents/${name}`;
      this.record = { name: name ?? '', deleted: false };
    }
    get exists() {
      return !this.record.deleted;
    }
    create() {
      mockCreated.push(this.record);
    }
    write(content: unknown) {
      this.record.content = content;
    }
    delete() {
      this.record.deleted = true;
    }
  },
}));
const mockSharing = { isAvailableAsync: jest.fn(async () => true), shareAsync: jest.fn(async () => {}) };
// Read lazily: the imports below run before `mockSharing` is initialised.
jest.mock('expo-sharing', () => ({
  isAvailableAsync: () => mockSharing.isAvailableAsync(),
  shareAsync: (...args: unknown[]) => (mockSharing.shareAsync as (...a: unknown[]) => unknown)(...args),
}));
jest.mock('@/components/AppDialog', () => ({ showAlert: jest.fn() }));
jest.mock('expo-document-picker', () => ({}));
jest.mock('@/lib/backup', () => ({
  buildBackupSnapshot: jest.fn(),
  summarizeSnapshot: jest.fn(() => ({ entries: 1 })),
  getCurrentSummary: jest.fn(),
  countEntriesSavedAfter: jest.fn(),
  isTooLargeForBackup: jest.fn(() => false),
}));
jest.mock('@/lib/exportExcel', () => ({ generateExportWorkbookBytes: jest.fn() }));
const mockState = {
  folder: null as string | null,
  files: [] as unknown[],
  lastAt: null as string | null,
  result: null as null | { at: string; ok: boolean; sizeBytes?: number; error?: string },
};
jest.mock('@/lib/localBackup', () => ({
  pickBackupFolder: jest.fn(),
  forgetBackupFolder: jest.fn(),
  writeLocalBackupNow: jest.fn(),
  listLocalBackups: jest.fn(async () => mockState.files),
  readLocalBackup: jest.fn(async () => ({})),
  nextLocalBackupLabel: () => 'Next backup tomorrow',
}));
jest.mock('@/db/settings', () => ({
  getLocalBackupFolderUri: async () => mockState.folder,
  getLastLocalBackupAt: async () => mockState.lastAt,
  getBackupFrequency: async () => 'daily',
  setBackupFrequency: jest.fn(),
  getLastLocalBackupResult: async () => mockState.result,
  setLastLocalBackupResult: jest.fn(),
  getNotificationPrefs: async () => ({}),
}));
jest.mock('@/lib/notifications', () => ({ rebuildNotifications: async () => {} }));
jest.mock('@/lib/appLock', () => ({ withoutRelock: (fn: () => unknown) => fn() }));
jest.mock('@/widgets/notifyWidgets', () => ({ refreshAllWidgets: jest.fn() }));
jest.mock('@/lib/safetyCopy', () => ({
  getSafetyCopyInfo: jest.fn(async () => null),
  undoLastRestore: jest.fn(),
  restoreKeepingSafetyCopy: jest.fn(),
  SafetyCopyError: class extends Error {},
}));

import BackupScreen from '../../../app/backup';
import { readLocalBackup } from '@/lib/localBackup';

const file = (n: number) => ({
  uri: `content://backups/${n}`,
  exportedAt: new Date(2026, 9, n, 14, 5).toISOString(),
  sizeBytes: 280000,
  summary: { entries: 200 + n },
});

async function render() {
  let tree!: ReactTestRenderer;
  await act(async () => {
    tree = create(<BackupScreen />);
  });
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
  return tree;
}
const texts = (tree: ReactTestRenderer) =>
  tree.root.findAllByType(Text).map((t) => [].concat(t.props.children).join(''));
const buttons = (tree: ReactTestRenderer, title: string) =>
  tree.root.findAll((n) => n.props.title === title && typeof n.props.onPress === 'function');

// Loads React Native's lazily-required components once, with a generous budget.
beforeAll(async () => {
  await render();
}, 180000);

beforeEach(() => {
  jest.clearAllMocks();
  mockCreated.length = 0;
  mockSharing.isAvailableAsync.mockResolvedValue(true);
  mockSharing.shareAsync.mockResolvedValue(undefined);
  mockState.folder = null;
  mockState.files = [];
  mockState.lastAt = null;
  mockState.result = null;
});

describe('Backup & restore · status', () => {
  it('asks for a folder first when none is chosen, and still shows the schedule', async () => {
    const tree = await render();
    const shown = texts(tree);
    expect(shown).toContain('No backup folder yet');
    expect(buttons(tree, 'Choose folder')).toHaveLength(1);
    expect(buttons(tree, 'Back up now')).toHaveLength(0);
    expect(shown).toContain('No backups yet');
    expect(shown).not.toContain('Forget folder');
  });

  it('says backed up today with the time, size and when the next one runs', async () => {
    mockState.folder = 'content://folder';
    mockState.lastAt = new Date().toISOString();
    mockState.result = { at: mockState.lastAt, ok: true, sizeBytes: 285491 };
    const tree = await render();
    const shown = texts(tree);
    expect(shown).toContain('Backed up today');
    expect(shown.some((t) => t.includes('278.8 KB'))).toBe(true);
    expect(shown).toContain('Next backup tomorrow');
    expect(buttons(tree, 'Back up now')).toHaveLength(1);
    expect(shown).toContain('Forget folder');
  });

  it('shows why the last backup failed', async () => {
    mockState.folder = 'content://folder';
    mockState.lastAt = new Date().toISOString();
    mockState.result = { at: mockState.lastAt, ok: false, error: 'Folder is gone' };
    const shown = texts(await render());
    expect(shown).toContain('Last backup failed');
    expect(shown).toContain('Folder is gone');
  });
});

describe('Backup & restore · restore points', () => {
  beforeEach(() => {
    mockState.folder = 'content://folder';
    mockState.lastAt = new Date().toISOString();
    mockState.files = [5, 4, 3, 2, 1].map(file);
  });

  it('lists the three newest, marks the latest, and expands in place', async () => {
    const tree = await render();
    expect(buttons(tree, 'Restore')).toHaveLength(3);
    expect(texts(tree)).toContain('Latest');
    expect(texts(tree)).toContain('See all 5 →');

    const seeAll = tree.root.find(
      (n) => n.props.accessibilityState?.expanded === false && typeof n.props.onPress === 'function'
    );
    act(() => seeAll.props.onPress());
    expect(buttons(tree, 'Restore')).toHaveLength(5);
    expect(texts(tree)).toContain('Show less');
  });

  it('restoring a backup reads that file for the preview', async () => {
    const tree = await render();
    await act(async () => {
      buttons(tree, 'Restore')[0].props.onPress();
    });
    expect(readLocalBackup).toHaveBeenCalledWith('content://backups/5');
  });

  it('keeps a file it cannot read in the list, with nothing to restore', async () => {
    mockState.files = [{ ...file(5), summary: null }];
    const tree = await render();
    expect(texts(tree)).toContain("Couldn't read this file");
    expect(buttons(tree, 'Restore')[0].props.disabled).toBe(true);
  });
});

describe('Backup & restore · save a copy', () => {
  it('moves the two exports to their own tab', async () => {
    const tree = await render();
    expect(texts(tree)).not.toContain('Excel workbook');

    const tabs = tree.root.find(
      (n) => n.props.options?.[0]?.value === 'points' && typeof n.props.onChange === 'function'
    );
    act(() => tabs.props.onChange('copy'));
    const shown = texts(tree);
    expect(shown).toContain('Full backup (JSON)');
    expect(shown).toContain('Excel workbook');
    expect(shown).not.toContain('Restore from file');
  });
});

describe('Backup & restore · the temporary export file', () => {
  const openCopyTab = async () => {
    const tree = await render();
    const tabs = tree.root.find(
      (n) => n.props.options?.[0]?.value === 'points' && typeof n.props.onChange === 'function'
    );
    act(() => tabs.props.onChange('copy'));
    return tree;
  };
  const exportJson = async (tree: ReactTestRenderer) => {
    const row = tree.root.find(
      (n) => n.props.label === 'Full backup (JSON)' && typeof n.props.onPress === 'function'
    );
    await act(async () => {
      await row.props.onPress();
    });
  };

  beforeEach(() => {
    const { buildBackupSnapshot } = jest.requireMock('@/lib/backup');
    buildBackupSnapshot.mockResolvedValue({ version: 1 });
  });

  it('is deleted once the share sheet has closed', async () => {
    await exportJson(await openCopyTab());
    expect(mockSharing.shareAsync).toHaveBeenCalledTimes(1);
    expect(mockCreated).toHaveLength(1);
    expect(mockCreated[0].deleted).toBe(true);
  });

  it('is deleted even when sharing fails', async () => {
    mockSharing.shareAsync.mockRejectedValue(new Error('no share target'));
    await exportJson(await openCopyTab());
    expect(mockCreated).toHaveLength(1);
    expect(mockCreated[0].deleted).toBe(true);
  });

  it('is deleted when sharing is not available at all', async () => {
    mockSharing.isAvailableAsync.mockResolvedValue(false);
    await exportJson(await openCopyTab());
    expect(mockSharing.shareAsync).not.toHaveBeenCalled();
    expect(mockCreated[0].deleted).toBe(true);
  });
});

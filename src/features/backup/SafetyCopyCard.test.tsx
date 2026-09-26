/**
 * The Backup & Restore screen's safety-copy card: it appears only when a
 * safety copy exists, says what it holds, and "Put back that data" asks
 * once more before undoing the restore.
 */
import { create, act, ReactTestRenderer } from 'react-test-renderer';
import { Alert, Text } from 'react-native';

jest.setTimeout(30000);

jest.mock('react-native-reanimated', () => require('@/test-support/reanimatedMock').createReanimatedMock());
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
jest.mock('expo-router', () => ({
  router: { replace: jest.fn(), push: jest.fn() },
  useFocusEffect: (cb: () => void) => require('react').useEffect(cb, [cb]),
}));
jest.mock('@/components/AppHeader', () => ({ AppHeader: () => null }));
jest.mock('expo-file-system', () => ({ File: jest.fn(), Paths: { document: 'documents' } }));
jest.mock('expo-sharing', () => ({}));
jest.mock('expo-document-picker', () => ({}));
jest.mock('@/lib/backup', () => ({ buildBackupSnapshot: jest.fn() }));
jest.mock('@/lib/exportExcel', () => ({ generateExportWorkbookBytes: jest.fn() }));
jest.mock('@/lib/localBackup', () => ({
  pickBackupFolder: jest.fn(),
  forgetBackupFolder: jest.fn(),
  writeLocalBackupNow: jest.fn(),
  readNewestLocalBackup: jest.fn(),
}));
jest.mock('@/db/settings', () => ({
  getLocalBackupFolderUri: async () => null,
  getLastLocalBackupAt: async () => null,
  getBackupFrequency: async () => 'daily',
  setBackupFrequency: jest.fn(),
  getLastLocalBackupResult: async () => null,
  setLastLocalBackupResult: jest.fn(),
  getNotificationPrefs: async () => ({}),
}));
jest.mock('@/db/loans', () => ({ resyncAllLoanReminders: jest.fn(async () => {}) }));
jest.mock('@/lib/notifications', () => ({
  syncDailyReminder: jest.fn(async () => {}),
  syncWeeklySummary: jest.fn(async () => {}),
}));
jest.mock('@/lib/appLock', () => ({ withoutRelock: (fn: () => unknown) => fn() }));
jest.mock('@/widgets/notifyWidgets', () => ({ refreshAllWidgets: jest.fn() }));
const mockInfo = { current: null as null | { savedAt: string; transactions: number; accounts: number } };
jest.mock('@/lib/safetyCopy', () => ({
  getSafetyCopyInfo: jest.fn(async () => mockInfo.current),
  undoLastRestore: jest.fn(async () => ({ skippedColumns: [], undoAvailable: true })),
  restoreKeepingSafetyCopy: jest.fn(),
  SafetyCopyError: class extends Error {},
}));

import BackupScreen from '../../../app/backup';
import { undoLastRestore } from '@/lib/safetyCopy';

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

// Loads React Native's lazily-required components once, with a generous budget.
beforeAll(async () => {
  await render();
}, 180000);

describe('Backup & Restore · safety copy card', () => {
  beforeEach(() => jest.clearAllMocks());

  it('is not shown when there is no safety copy', async () => {
    mockInfo.current = null;
    const shown = texts(await render());
    expect(shown).not.toContain('Undo your last restore');
    expect(shown).toContain('Restore from a backup JSON file saved on this device.');
  });

  it('says what the copy holds, and "Put back that data" asks before undoing', async () => {
    mockInfo.current = { savedAt: '2026-09-26T04:44:00.000Z', transactions: 284, accounts: 4 };
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    const tree = await render();
    expect(texts(tree)).toContain('Undo your last restore');
    expect(texts(tree).some((t) => t.includes('284 entries') && t.includes('4 accounts'))).toBe(true);

    const button = tree.root.find(
      (n) => n.props.title === 'Put back that data' && typeof n.props.onPress === 'function'
    );
    act(() => button.props.onPress());
    expect(undoLastRestore).not.toHaveBeenCalled(); // asks first
    const [title, , buttons] = alert.mock.calls[0];
    expect(title).toBe('Put back your earlier data?');

    const putBack = (buttons as { text: string; onPress: () => Promise<void> }[]).find(
      (b) => b.text === 'Put back'
    )!;
    await act(async () => {
      await putBack.onPress();
    });
    expect(undoLastRestore).toHaveBeenCalledTimes(1);
    alert.mockRestore();
  });
});

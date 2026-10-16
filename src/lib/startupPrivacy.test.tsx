import { act, create, ReactTestRenderer } from 'react-test-renderer';
import { Text } from 'react-native';
import RootLayout from '../../app/_layout';
import { getHideSensitiveAmounts } from '@/db/settings';

jest.mock('expo-font', () => ({ useFonts: () => [true, null] }));
jest.mock('expo-router', () => ({
  Stack: Object.assign(
    () => require('react').createElement(require('react-native').Text, null, 'Financial screens'),
    { Screen: () => null }
  ),
  useRootNavigationState: () => ({ key: 'ready' }),
  router: {},
}));
jest.mock('expo-screen-capture', () => ({
  preventScreenCaptureAsync: async () => {},
  allowScreenCaptureAsync: async () => {},
}));
jest.mock('expo-status-bar', () => ({ StatusBar: () => null }));
jest.mock('react-native-safe-area-context', () => ({ SafeAreaProvider: ({ children }: any) => children }));
jest.mock('react-native-keyboard-controller', () => ({ KeyboardProvider: ({ children }: any) => children }));
jest.mock('@/db/client', () => ({ getDb: async () => ({}) }));
jest.mock('@/db/settings', () => ({
  getHasOnboarded: async () => true,
  setHasOnboarded: jest.fn(),
  getAppLockEnabled: async () => false,
  getHideSensitiveAmounts: jest.fn(),
}));
jest.mock('@/db/ledger', () => ({ listAccounts: jest.fn(), listTransactions: jest.fn() }));
jest.mock('@/lib/runAppMaintenance', () => ({ runAppMaintenance: async () => {} }));
jest.mock('@/lib/notifications', () => ({
  ensureAndroidChannel: async () => {},
  rebuildNotifications: async () => {},
  cancelLegacyScheduledNotifications: async () => {},
  subscribeToNotificationTaps: () => () => {},
}));
jest.mock('@/widgets/notifyWidgets', () => ({ refreshAllWidgets: jest.fn() }));
jest.mock('@/components/ErrorBoundary', () => ({ ErrorBoundary: ({ children }: any) => children }));
jest.mock('@/theme/AccentContext', () => ({ AccentProvider: ({ children }: any) => children }));
jest.mock('@/theme/PrivacyContext', () => ({ PrivacyProvider: ({ children }: any) => children }));
jest.mock('@/lib/AppLockContext', () => ({
  AppLockProvider: ({ children }: any) => children,
  useAppLock: () => ({ lockEnabled: false }),
}));
jest.mock('@/components/UndoToast', () => ({ UndoToastProvider: ({ children }: any) => children }));
jest.mock('@/components/MilestoneNote', () => ({
  MilestoneNoteProvider: ({ children }: any) => children,
  BudgetMonthWatcher: () => null,
}));
jest.mock('@/components/CardGrowHost', () => ({ CardGrowHost: () => null }));
jest.mock('@/components/AppDialog', () => ({ AppDialogHost: () => null }));
jest.mock('@/components/LockScreen', () => ({ LockScreen: () => null }));
jest.mock('@/features/onboarding/Onboarding', () => ({ Onboarding: () => null }));
jest.mock('@/components/PrimaryButton', () => ({ PrimaryButton: () => null }));

let tree: ReactTestRenderer;
const shown = () => tree.root.findAllByType(Text).map((n) => n.props.children);
afterEach(() => {
  act(() => tree?.unmount());
  jest.clearAllMocks();
});

it('does not mount financial screens until the saved privacy preference is loaded', async () => {
  let finish!: (hidden: boolean) => void;
  jest.mocked(getHideSensitiveAmounts).mockReturnValue(
    new Promise((resolve) => {
      finish = resolve;
    })
  );
  await act(async () => {
    tree = create(<RootLayout />);
  });
  expect(shown()).not.toContain('Financial screens');
  await act(async () => {
    finish(true);
  });
  expect(shown()).toContain('Financial screens');
});

it('keeps financial screens unmounted when the privacy preference cannot be read', async () => {
  jest.mocked(getHideSensitiveAmounts).mockRejectedValue(new Error('Preference read failed'));
  await act(async () => {
    tree = create(<RootLayout />);
  });
  expect(shown()).not.toContain('Financial screens');
  expect(shown()).toContain('Preference read failed');
});

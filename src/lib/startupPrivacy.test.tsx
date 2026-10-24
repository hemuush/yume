import { act, create, ReactTestRenderer } from 'react-test-renderer';
import { Text } from 'react-native';
import type { ReactNode } from 'react';
import RootLayout from '../../app/_layout';
import { getHideSensitiveAmounts } from '@/db/settings';
import { preventScreenCaptureAsync } from 'expo-screen-capture';
import { router } from 'expo-router';
import type { NotificationRoute } from '@/lib/notifications';

let mockLockEnabled = false;
let mockNotificationListener: ((route: NotificationRoute) => void) | null = null;

jest.mock('expo-font', () => ({ useFonts: () => [true, null] }));
jest.mock('expo-router', () => ({
  Stack: Object.assign(
    () => require('react').createElement(require('react-native').Text, null, 'Financial screens'),
    { Screen: () => null }
  ),
  useRootNavigationState: () => ({ key: 'ready' }),
  usePathname: () => '/',
  router: { navigate: jest.fn() },
}));
jest.mock('expo-screen-capture', () => ({
  preventScreenCaptureAsync: jest.fn(async () => {}),
  allowScreenCaptureAsync: async () => {},
}));
jest.mock('expo-status-bar', () => ({ StatusBar: () => null }));
jest.mock('react-native-safe-area-context', () => ({
  SafeAreaProvider: ({ children }: { children: ReactNode }) => children,
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
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
  askNotificationPermissionOnce: async () => false,
  ensureAndroidChannel: async () => {},
  rebuildNotifications: async () => {},
  cancelLegacyScheduledNotifications: async () => {},
  subscribeToNotificationTaps: (listener: (route: NotificationRoute) => void) => {
    mockNotificationListener = listener;
    return () => {
      mockNotificationListener = null;
    };
  },
}));
jest.mock('@/widgets/notifyWidgets', () => ({ refreshAllWidgets: jest.fn() }));
jest.mock('@/components/ErrorBoundary', () => ({ ErrorBoundary: ({ children }: any) => children }));
jest.mock('@/theme/AccentContext', () => ({
  AccentProvider: ({ children }: { children: ReactNode }) => children,
  useAccent: () => ({ themeSaveError: null, waitForThemePersistence: async () => undefined }),
}));
jest.mock('@/theme/PrivacyContext', () => ({ PrivacyProvider: ({ children }: any) => children }));
jest.mock('@/lib/AppLockContext', () => ({
  AppLockProvider: ({ children }: any) => children,
  useAppLock: () => ({ lockEnabled: mockLockEnabled }),
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
beforeEach(() => {
  mockLockEnabled = false;
  mockNotificationListener = null;
  jest.mocked(preventScreenCaptureAsync).mockResolvedValue(undefined);
});
afterEach(() => {
  act(() => tree?.unmount());
  jest.clearAllMocks();
  jest.useRealTimers();
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

it('keeps unlocked financial screens unmounted until required capture protection succeeds', async () => {
  // The shared preference represents an enabled lock after authentication/toggling in Settings.
  mockLockEnabled = true;
  jest.mocked(getHideSensitiveAmounts).mockResolvedValue(false);
  let finish: (() => void) | undefined;
  jest.mocked(preventScreenCaptureAsync).mockReturnValue(
    new Promise((resolve) => {
      finish = resolve;
    })
  );
  await act(async () => {
    tree = create(<RootLayout />);
  });
  expect(shown()).not.toContain('Financial screens');
  if (!finish) throw new Error('Protection was not requested');
  await act(async () => {
    finish?.();
  });
  expect(shown()).toContain('Financial screens');
});

it('keeps unlocked financial screens unmounted when required capture protection fails', async () => {
  mockLockEnabled = true;
  jest.mocked(getHideSensitiveAmounts).mockResolvedValue(false);
  jest.mocked(preventScreenCaptureAsync).mockRejectedValue(new Error('Native capture failure'));
  await act(async () => {
    tree = create(<RootLayout />);
  });
  expect(shown()).not.toContain('Financial screens');
  expect(shown()).toContain('Screen protection unavailable');
  expect(shown()).not.toContain('Native capture failure');
});

it('retains a notification route until required screen protection succeeds', async () => {
  jest.useFakeTimers();
  mockLockEnabled = true;
  jest.mocked(getHideSensitiveAmounts).mockResolvedValue(false);
  let finish: (() => void) | undefined;
  jest.mocked(preventScreenCaptureAsync).mockReturnValue(
    new Promise((resolve) => {
      finish = resolve;
    })
  );
  await act(async () => {
    tree = create(<RootLayout />);
  });
  const notify = mockNotificationListener;
  if (!notify) throw new Error('Notification subscription missing');
  await act(async () => {
    notify('/loans');
  });
  act(() => jest.runOnlyPendingTimers());
  expect(router.navigate).not.toHaveBeenCalled();
  if (!finish) throw new Error('Protection was not requested');
  await act(async () => {
    finish?.();
  });
  act(() => jest.runOnlyPendingTimers());
  expect(router.navigate).toHaveBeenCalledWith('/loans');
});

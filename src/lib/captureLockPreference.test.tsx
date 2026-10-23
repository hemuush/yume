import { act, fireEvent, render, screen } from '@testing-library/react-native';
import type { ReactNode } from 'react';
import { Pressable } from 'react-native';
import { Text } from '@/components/Text';
import { useAppLock } from '@/lib/AppLockContext';
import { setAppLockEnabled } from '@/db/settings';
import { preventScreenCaptureAsync } from 'expo-screen-capture';
import { router } from 'expo-router';
import RootLayout from '../../app/_layout';

jest.mock('expo-font', () => ({ useFonts: () => [true, null] }));
jest.mock('expo-router', () => ({
  Stack: Object.assign(() => <MockSettings />, { Screen: () => null }),
  useRootNavigationState: () => ({ key: 'ready' }),
  usePathname: () => '/profile',
  router: { navigate: jest.fn() },
}));
jest.mock('expo-screen-capture', () => ({
  preventScreenCaptureAsync: jest.fn(async () => {}),
  allowScreenCaptureAsync: jest.fn(async () => {}),
}));
jest.mock('@/components/AppDialog', () => jest.requireActual('@/components/AppDialog'));
jest.mock('expo-status-bar', () => ({ StatusBar: () => null }));
jest.mock('react-native-safe-area-context', () => ({
  SafeAreaProvider: ({ children }: { children: ReactNode }) => children,
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
jest.mock('react-native-keyboard-controller', () => ({
  KeyboardProvider: ({ children }: { children: ReactNode }) => children,
}));
jest.mock('react-native-reanimated', () => require('@/test-support/reanimatedMock').createReanimatedMock());
jest.mock('@expo/vector-icons/Feather', () => () => null);
jest.mock('@/components/ModalSheet', () => ({
  ModalSheet: ({
    visible,
    children,
    footer,
  }: {
    visible: boolean;
    children: ReactNode;
    footer: ReactNode;
  }) =>
    visible ? (
      <>
        {children}
        {footer}
      </>
    ) : null,
}));
jest.mock('@/db/client', () => ({ getDb: async () => ({}) }));
jest.mock('@/db/settings', () => ({
  getHasOnboarded: async () => true,
  setHasOnboarded: jest.fn(),
  getAppLockEnabled: async () => false,
  setAppLockEnabled: jest.fn(async () => {}),
  getHideSensitiveAmounts: async () => false,
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
jest.mock('@/components/ErrorBoundary', () => ({
  ErrorBoundary: ({ children }: { children: ReactNode }) => children,
}));
jest.mock('@/theme/AccentContext', () => ({
  AccentProvider: ({ children }: { children: ReactNode }) => children,
  useAccent: () => ({ accent: '#8FCBFF', themeSaveError: null, waitForThemePersistence: async () => {} }),
}));
jest.mock('@/theme/PrivacyContext', () => ({
  PrivacyProvider: ({ children }: { children: ReactNode }) => children,
}));
jest.mock('@/components/UndoToast', () => ({
  UndoToastProvider: ({ children }: { children: ReactNode }) => children,
}));
jest.mock('@/components/MilestoneNote', () => ({
  MilestoneNoteProvider: ({ children }: { children: ReactNode }) => children,
  BudgetMonthWatcher: () => null,
}));
jest.mock('@/components/CardGrowHost', () => ({ CardGrowHost: () => null }));
jest.mock('@/components/LockScreen', () => ({ LockScreen: () => null }));
jest.mock('@/features/onboarding/Onboarding', () => ({ Onboarding: () => null }));

function MockSettings() {
  const { lockEnabled, setLockEnabled } = useAppLock();
  return (
    <>
      <Text>{lockEnabled ? 'Lock enabled' : 'Lock disabled'}</Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Enable app lock"
        onPress={() => setLockEnabled(true)}
      />
    </>
  );
}

it('shows a failed lock-save notice after capture gating unmounts and restores the dialog host', async () => {
  let rejectSave: (error: Error) => void = () => {
    throw new Error('Save not requested');
  };
  let finishProtection: () => void = () => {
    throw new Error('Protection not requested');
  };
  jest.mocked(setAppLockEnabled).mockReturnValue(
    new Promise((_resolve, reject) => {
      rejectSave = reject;
    })
  );
  jest.mocked(preventScreenCaptureAsync).mockReturnValue(
    new Promise((resolve) => {
      finishProtection = resolve;
    })
  );
  await render(<RootLayout />);
  await fireEvent.press(screen.getByRole('button', { name: 'Enable app lock' }));
  expect(screen.queryByText('Lock enabled')).toBeNull();
  expect(screen.getByText('Protecting your screen')).toBeOnTheScreen();
  await act(async () => {
    rejectSave(new Error('Storage write failed'));
  });
  expect(screen.getByText('Lock disabled')).toBeOnTheScreen();
  await act(async () => {
    finishProtection();
  });
  expect(screen.getByText("Couldn't change the app lock")).toBeOnTheScreen();
  expect(screen.queryByText('Storage write failed')).toBeNull();
  expect(
    screen.getByText('Your previous app lock setting has been restored. Try again to save your choice.')
  ).toBeOnTheScreen();
});

it('takes you back to the screen you were on once protection is applied', async () => {
  let finishProtection: () => void = () => {
    throw new Error('Protection not requested');
  };
  jest.mocked(setAppLockEnabled).mockResolvedValue(undefined);
  jest.mocked(preventScreenCaptureAsync).mockReturnValue(
    new Promise((resolve) => {
      finishProtection = resolve;
    })
  );
  jest.mocked(router.navigate).mockClear();
  await render(<RootLayout />);
  await fireEvent.press(screen.getByRole('button', { name: 'Enable app lock' }));
  // The navigator is unmounted while protection is applied, so nothing can be restored yet.
  expect(screen.queryByText('Lock enabled')).toBeNull();
  expect(router.navigate).not.toHaveBeenCalled();
  await act(async () => {
    finishProtection();
  });
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
  expect(router.navigate).toHaveBeenCalledWith('/profile');
});

it('does not restore a screen when protection was already applied before anything was open', async () => {
  jest.mocked(router.navigate).mockClear();
  await render(<RootLayout />);
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
  expect(router.navigate).not.toHaveBeenCalled();
});

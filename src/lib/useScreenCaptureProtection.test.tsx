import { act, cleanup, fireEvent, render, screen } from '@testing-library/react-native';
import { useState, type ReactNode } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import { SafeAreaInsetsContext } from 'react-native-safe-area-context';
import { Text, TextInput } from '@/components/Text';
import { AppDialogHost } from '@/components/AppDialog';
import { CaptureProtectionScreen } from '@/components/CaptureProtectionScreen';
import { CaptureReleaseFeedback } from '@/components/CaptureReleaseFeedback';
import { useScreenCaptureProtection } from './useScreenCaptureProtection';

// Keep Expo's actual JS key cache and rollback behavior; mock only its native module.
jest.mock('expo-screen-capture', () => jest.requireActual('expo-screen-capture'));
jest.mock('@/components/AppDialog', () => jest.requireActual('@/components/AppDialog'));
jest.mock('expo-screen-capture/build/ExpoScreenCapture', () => ({
  __esModule: true,
  default: {
    preventScreenCapture: jest.fn(async () => {}),
    allowScreenCapture: jest.fn(async () => {}),
  },
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

interface NativeCapture {
  preventScreenCapture: () => Promise<void>;
  allowScreenCapture: () => Promise<void>;
}
const nativeCapture = jest.requireMock<{ default: jest.Mocked<NativeCapture> }>(
  'expo-screen-capture/build/ExpoScreenCapture'
).default;
const listeners = new Set<(state: AppStateStatus) => void>();

function FinancialForm() {
  const [draft, setDraft] = useState('');
  return (
    <>
      <Text>Financial screens</Text>
      <TextInput accessibilityLabel="Draft entry" value={draft} onChangeText={setDraft} />
    </>
  );
}

function Probe({ isRequired }: { isRequired: boolean }) {
  const protection = useScreenCaptureProtection(isRequired);
  const content = protection.isBlocked ? (
    <CaptureProtectionScreen
      status={protection.status === 'failed' ? 'failed' : 'checking'}
      onRetry={protection.retry}
    />
  ) : (
    <>
      <AppDialogHost />
      <CaptureReleaseFeedback protection={protection} />
      <FinancialForm />
    </>
  );
  return (
    <SafeAreaInsetsContext.Provider value={{ top: 24, bottom: 24, left: 0, right: 0 }}>
      {content}
    </SafeAreaInsetsContext.Provider>
  );
}

function deferred(): { promise: Promise<void>; resolve: () => void } {
  let resolve: () => void = () => {
    throw new Error('Deferred promise not initialized');
  };
  const promise = new Promise<void>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

beforeEach(() => {
  nativeCapture.preventScreenCapture.mockReset().mockResolvedValue(undefined);
  nativeCapture.allowScreenCapture.mockReset().mockResolvedValue(undefined);
  listeners.clear();
  jest.spyOn(AppState, 'addEventListener').mockImplementation((_event, listener) => {
    listeners.add(listener);
    return {
      remove: () => {
        listeners.delete(listener);
      },
    };
  });
});

afterEach(async () => {
  await cleanup();
  // Release this test's owned keys through the public preference workflow.
  await render(<Probe isRequired={false} />);
  await cleanup();
  jest.restoreAllMocks();
});

it('shows only public progress until Android confirms protection', async () => {
  const pending = deferred();
  nativeCapture.preventScreenCapture.mockReturnValueOnce(pending.promise);
  await render(<Probe isRequired />);
  expect(screen.getByRole('progressbar', { name: 'Checking screen protection' })).toBeOnTheScreen();
  expect(screen.queryByText('Financial screens')).toBeNull();
  await act(async () => pending.resolve());
  expect(screen.getByText('Financial screens')).toBeOnTheScreen();
});

it('keeps finances closed on failure and opens them only after a successful retry', async () => {
  nativeCapture.preventScreenCapture.mockRejectedValueOnce(new Error('Private native error detail'));
  await render(<Probe isRequired />);
  expect(screen.getByRole('alert')).toHaveTextContent('Screen protection unavailable');
  expect(screen.queryByText('Financial screens')).toBeNull();
  expect(screen.queryByText('Private native error detail')).toBeNull();
  const pending = deferred();
  nativeCapture.preventScreenCapture.mockReturnValueOnce(pending.promise);
  await fireEvent.press(screen.getByRole('button', { name: 'Retry screen protection' }));
  expect(screen.queryByRole('button', { name: 'Retry screen protection' })).toBeNull();
  expect(screen.queryByText('Financial screens')).toBeNull();
  await act(async () => pending.resolve());
  expect(screen.getByText('Financial screens')).toBeOnTheScreen();
  expect(nativeCapture.preventScreenCapture).toHaveBeenCalledTimes(2);
});

it('retries failed protection when the app returns to the foreground', async () => {
  nativeCapture.preventScreenCapture.mockRejectedValueOnce(new Error('Activity not ready'));
  await render(<Probe isRequired />);
  expect(screen.queryByText('Financial screens')).toBeNull();
  await act(async () => {
    listeners.forEach((listener) => listener('active'));
  });
  expect(screen.getByText('Financial screens')).toBeOnTheScreen();
  expect(nativeCapture.preventScreenCapture).toHaveBeenCalledTimes(2);
});

it('waits for an older release before protecting again and ignores its stale completion', async () => {
  const view = await render(<Probe isRequired />);
  const release = deferred();
  nativeCapture.allowScreenCapture.mockReturnValueOnce(release.promise);
  await view.rerender(<Probe isRequired={false} />);
  const protect = deferred();
  nativeCapture.preventScreenCapture.mockReturnValueOnce(protect.promise);
  await view.rerender(<Probe isRequired />);
  expect(screen.queryByText('Financial screens')).toBeNull();
  expect(nativeCapture.preventScreenCapture).toHaveBeenCalledTimes(1);
  await act(async () => release.resolve());
  expect(nativeCapture.preventScreenCapture).toHaveBeenCalledTimes(2);
  expect(screen.queryByText('Financial screens')).toBeNull();
  await act(async () => protect.resolve());
  expect(screen.getByText('Financial screens')).toBeOnTheScreen();
});

it('ignores a superseded success and skips an obsolete queued release', async () => {
  const first = deferred();
  nativeCapture.preventScreenCapture.mockReturnValueOnce(first.promise);
  const view = await render(<Probe isRequired />);
  await view.rerender(<Probe isRequired={false} />);
  const latest = deferred();
  nativeCapture.preventScreenCapture.mockReturnValueOnce(latest.promise);
  await view.rerender(<Probe isRequired />);
  await act(async () => first.resolve());
  expect(screen.queryByText('Financial screens')).toBeNull();
  expect(nativeCapture.preventScreenCapture).toHaveBeenCalledTimes(2);
  await act(async () => latest.resolve());
  expect(screen.getByText('Financial screens')).toBeOnTheScreen();
  expect(nativeCapture.allowScreenCapture).not.toHaveBeenCalled();
});

it('makes a fresh native protection request after remount without releasing the previous protection', async () => {
  const view = await render(<Probe isRequired />);
  await view.unmount();
  expect(listeners.size).toBe(0);
  await render(<Probe isRequired />);
  expect(nativeCapture.preventScreenCapture).toHaveBeenCalledTimes(2);
  expect(nativeCapture.allowScreenCapture).not.toHaveBeenCalled();
  expect(screen.getByText('Financial screens')).toBeOnTheScreen();
});

it('keeps an unsaved form mounted on a normal foreground event after protection succeeds', async () => {
  await render(<Probe isRequired />);
  await fireEvent.changeText(screen.getByLabelText('Draft entry'), 'Unsaved lunch');
  await act(async () => {
    listeners.forEach((listener) => listener('active'));
  });
  expect(screen.getByLabelText('Draft entry')).toHaveProp('value', 'Unsaved lunch');
  expect(nativeCapture.preventScreenCapture).toHaveBeenCalledTimes(1);
});

it('reports a failed release without claiming capture is required and retries from the notice', async () => {
  const view = await render(<Probe isRequired />);
  nativeCapture.allowScreenCapture.mockRejectedValueOnce(new Error('Release failed'));
  await view.rerender(<Probe isRequired={false} />);
  expect(screen.getByText('Financial screens')).toBeOnTheScreen();
  expect(screen.getByText('Screenshot setting not updated')).toBeOnTheScreen();
  await fireEvent.press(screen.getByRole('button', { name: 'Try again' }));
  expect(screen.queryByText('Screenshot setting not updated')).toBeNull();
  expect(nativeCapture.allowScreenCapture).toHaveBeenCalledTimes(2);
});

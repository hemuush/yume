import { act, create, ReactTestRenderer } from 'react-test-renderer';
import { useEffect } from 'react';
import { AppLockProvider, useAppLock } from './AppLockContext';
import { getAppLockEnabled, setAppLockEnabled } from '@/db/settings';
import { emitSettingsRestored } from '@/lib/dataEvents';
jest.mock('@/db/settings', () => ({ getAppLockEnabled: jest.fn(), setAppLockEnabled: jest.fn() }));
jest.mock('@/components/AppDialog', () => ({ showAlert: jest.fn() }));
let value!: ReturnType<typeof useAppLock>;
let tree: ReactTestRenderer;
function Probe() {
  const lock = useAppLock();
  useEffect(() => {
    value = lock;
  }, [lock]);
  return null;
}
const read = getAppLockEnabled as jest.Mock;
const write = setAppLockEnabled as jest.Mock;
afterEach(() => {
  act(() => tree?.unmount());
  jest.resetAllMocks();
});
it('retains the startup lock preference if the provider read fails', async () => {
  read.mockRejectedValue(new Error('read failed'));
  await act(async () => {
    tree = create(
      <AppLockProvider initialLockEnabled>
        <Probe />
      </AppLockProvider>
    );
  });
  expect(value.lockEnabled).toBe(true);
});
it('does not let an older preference read undo a newer toggle', async () => {
  let finish!: (enabled: boolean) => void;
  read.mockImplementation(
    () =>
      new Promise<boolean>((resolve) => {
        finish = resolve;
      })
  );
  write.mockResolvedValue(undefined);
  await act(async () => {
    tree = create(
      <AppLockProvider>
        <Probe />
      </AppLockProvider>
    );
  });
  await act(async () => {
    value.setLockEnabled(true);
  });
  await act(async () => {
    finish(false);
  });
  expect(value.lockEnabled).toBe(true);
});

it('discards an undelivered lock-save error when settings are restored', async () => {
  read.mockResolvedValue(false);
  write.mockRejectedValue(new Error('Storage write failed'));
  await act(async () => {
    tree = create(
      <AppLockProvider>
        <Probe />
      </AppLockProvider>
    );
  });
  await act(async () => {
    value.setLockEnabled(true);
  });
  expect(value.lockEnabled).toBe(false);
  expect(value.lockSaveError).not.toBeNull();
  read.mockResolvedValue(true);
  await act(async () => {
    emitSettingsRestored();
  });
  expect(value.lockEnabled).toBe(true);
  expect(value.lockSaveError).toBeNull();
});

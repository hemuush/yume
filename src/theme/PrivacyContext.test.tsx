import { useEffect } from 'react';
import { act, create, ReactTestRenderer } from 'react-test-renderer';
import { PrivacyProvider, usePrivacy } from './PrivacyContext';
import { getHideSensitiveAmounts } from '@/db/settings';
import { saveHideSensitiveAmounts } from '@/db/afterCommit';
import { authenticate } from '@/lib/appLock';
import { emitSettingsRestored } from '@/lib/dataEvents';
import { showAlert } from '@/components/AppDialog';

jest.mock('@/db/settings', () => ({
  getHideSensitiveAmounts: jest.fn(),
  getCachedHideSensitiveAmounts: () => false,
}));
jest.mock('@/db/afterCommit', () => ({ saveHideSensitiveAmounts: jest.fn(async () => true) }));
let mockLocked = false;
jest.mock('@/lib/AppLockContext', () => ({ useAppLock: () => ({ lockEnabled: mockLocked }) }));
jest.mock('@/lib/appLock', () => ({ authenticate: jest.fn() }));
let value!: ReturnType<typeof usePrivacy>;
let tree: ReactTestRenderer;
function Probe() {
  const current = usePrivacy();
  useEffect(() => {
    value = current;
  }, [current]);
  return null;
}
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}
async function mount() {
  await act(async () => {
    tree = create(
      <PrivacyProvider>
        <Probe />
      </PrivacyProvider>
    );
  });
}
beforeEach(() => {
  mockLocked = false;
  jest.clearAllMocks();
});
afterEach(() => {
  act(() => tree?.unmount());
});

it('does not let a pending startup read reveal amounts after the user hides them', async () => {
  const pending = deferred<boolean>();
  jest.mocked(getHideSensitiveAmounts).mockReturnValue(pending.promise);
  await mount();
  await act(async () => {
    await value.toggleHideAmounts();
  });
  await act(async () => {
    pending.resolve(false);
  });
  expect(value.hideAmounts).toBe(true);
  expect(saveHideSensitiveAmounts).toHaveBeenCalledWith(true);
});

it('keeps the newest restored preference when older reads finish later', async () => {
  const startup = deferred<boolean>();
  const restored = deferred<boolean>();
  jest
    .mocked(getHideSensitiveAmounts)
    .mockReturnValueOnce(startup.promise)
    .mockReturnValueOnce(restored.promise);
  await mount();
  act(() => emitSettingsRestored());
  await act(async () => {
    restored.resolve(true);
  });
  await act(async () => {
    startup.resolve(false);
  });
  expect(value.hideAmounts).toBe(true);
});

it('opens one unlock prompt and ignores its result if a restore overtakes it', async () => {
  mockLocked = true;
  jest.mocked(getHideSensitiveAmounts).mockResolvedValue(true);
  const unlock = deferred<boolean>();
  jest.mocked(authenticate).mockReturnValue(unlock.promise);
  await mount();
  let toggle!: Promise<void> | void;
  act(() => {
    toggle = value.toggleHideAmounts();
    void value.toggleHideAmounts();
  });
  expect(authenticate).toHaveBeenCalledTimes(1);
  await act(async () => {
    emitSettingsRestored();
  });
  await act(async () => {
    unlock.resolve(true);
    await toggle;
  });
  expect(value.hideAmounts).toBe(true);
  expect(saveHideSensitiveAmounts).not.toHaveBeenCalled();
});

it('keeps amounts hidden after an unsuccessful unlock', async () => {
  mockLocked = true;
  jest.mocked(getHideSensitiveAmounts).mockResolvedValue(true);
  jest.mocked(authenticate).mockRejectedValue(new Error('cancelled'));
  await mount();
  await act(async () => {
    await value.toggleHideAmounts();
  });
  expect(value.hideAmounts).toBe(true);
  expect(saveHideSensitiveAmounts).not.toHaveBeenCalled();
});

it('warns when the preference is saved but private reminders cannot be refreshed', async () => {
  jest.mocked(getHideSensitiveAmounts).mockResolvedValue(false);
  jest.mocked(saveHideSensitiveAmounts).mockResolvedValueOnce(false);
  await mount();
  await act(async () => {
    await value.toggleHideAmounts();
  });
  expect(value.hideAmounts).toBe(true);
  expect(showAlert).toHaveBeenCalledWith(
    'Reminders need attention',
    expect.stringContaining('may still show private details')
  );
});

it('keeps the session switch and warns when its preference cannot be saved', async () => {
  jest.mocked(getHideSensitiveAmounts).mockResolvedValue(false);
  jest.mocked(saveHideSensitiveAmounts).mockRejectedValueOnce(new Error('Disk full'));
  await mount();
  await act(async () => {
    await value.toggleHideAmounts();
  });
  expect(value.hideAmounts).toBe(true);
  expect(showAlert).toHaveBeenCalledWith('Privacy preference not saved', expect.any(String));
});

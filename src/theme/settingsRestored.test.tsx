/**
 * After a restore, app-wide preferences held in React state (hide amounts, app lock) re-read the restored
 * settings straight away, instead of keeping the pre-restore values until the app is relaunched.
 */
import { create, act } from 'react-test-renderer';

const mockHide = { current: false };
const mockLock = { current: false };
jest.mock('@/db/settings', () => ({
  getHideSensitiveAmounts: jest.fn(async () => mockHide.current),
  setHideSensitiveAmounts: jest.fn(async () => {}),
  getCachedHideSensitiveAmounts: () => false,
  getAppLockEnabled: jest.fn(async () => mockLock.current),
  setAppLockEnabled: jest.fn(async () => {}),
  getUserName: jest.fn(async () => null),
}));
jest.mock('@/lib/notifications', () => ({ rebuildNotifications: jest.fn(async () => true) }));
jest.mock('@/widgets/notifyWidgets', () => ({ refreshAllWidgets: jest.fn() }));

import { PrivacyProvider, usePrivacy } from './PrivacyContext';
import { AppLockProvider, useAppLock } from '@/lib/AppLockContext';
import { resyncAfterRestore } from '@/lib/restoreSync';

const settle = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

describe('preferences after a restore', () => {
  it('hide amounts and app lock take the restored values without a relaunch', async () => {
    const seen = { hide: false, lock: false };
    function Probe() {
      seen.hide = usePrivacy().hideAmounts;
      seen.lock = useAppLock().lockEnabled;
      return null;
    }
    await act(async () => {
      create(
        <AppLockProvider>
          <PrivacyProvider>
            <Probe />
          </PrivacyProvider>
        </AppLockProvider>
      );
      await settle();
    });
    expect(seen).toEqual({ hide: false, lock: false });

    // The backup had both turned on.
    mockHide.current = true;
    mockLock.current = true;
    await act(async () => {
      await resyncAfterRestore();
      await settle();
    });
    expect(seen).toEqual({ hide: true, lock: true });
  });
});

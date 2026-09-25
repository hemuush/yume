/**
 * App lock: "is the phone secured" must count a PIN/pattern/password, not
 * only biometrics; and the app's own pickers must not re-arm the lock.
 */
jest.mock('expo-local-authentication', () => ({
  SecurityLevel: { NONE: 0, SECRET: 1, BIOMETRIC_WEAK: 2, BIOMETRIC_STRONG: 3 },
  getEnrolledLevelAsync: jest.fn(),
  authenticateAsync: jest.fn(),
}));

import * as LocalAuthentication from 'expo-local-authentication';
import { isDeviceSecured, authenticate, withoutRelock, isReturningFromOwnActivity } from './appLock';

const enrolledLevel = LocalAuthentication.getEnrolledLevelAsync as jest.Mock;

describe('isDeviceSecured', () => {
  it('is true for a PIN/pattern-only phone (no biometrics enrolled)', async () => {
    enrolledLevel.mockResolvedValue(LocalAuthentication.SecurityLevel.SECRET);
    expect(await isDeviceSecured()).toBe(true);
  });

  it('is true for a phone with biometrics', async () => {
    enrolledLevel.mockResolvedValue(LocalAuthentication.SecurityLevel.BIOMETRIC_STRONG);
    expect(await isDeviceSecured()).toBe(true);
  });

  it('is false only when the phone has no screen lock at all', async () => {
    enrolledLevel.mockResolvedValue(LocalAuthentication.SecurityLevel.NONE);
    expect(await isDeviceSecured()).toBe(false);
  });
});

describe('withoutRelock', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('marks the app as returning from its own activity while it is open and briefly after', async () => {
    jest.advanceTimersByTime(10000); // well past any earlier activity's grace period
    expect(isReturningFromOwnActivity()).toBe(false);

    let finish!: () => void;
    const open = withoutRelock(() => new Promise<void>((resolve) => (finish = resolve)));
    expect(isReturningFromOwnActivity()).toBe(true);

    finish();
    await open;
    expect(isReturningFromOwnActivity()).toBe(true); // still inside the grace window

    jest.advanceTimersByTime(2000);
    expect(isReturningFromOwnActivity()).toBe(false); // genuinely leaving later locks again
  });

  it('still clears the marker when the activity fails', async () => {
    jest.advanceTimersByTime(10000);
    await expect(withoutRelock(() => Promise.reject(new Error('cancelled')))).rejects.toThrow('cancelled');
    jest.advanceTimersByTime(2000);
    expect(isReturningFromOwnActivity()).toBe(false);
  });

  it("the unlock prompt itself counts as the app's own activity", async () => {
    jest.advanceTimersByTime(10000);
    (LocalAuthentication.authenticateAsync as jest.Mock).mockResolvedValue({ success: true });
    expect(await authenticate()).toBe(true);
    expect(isReturningFromOwnActivity()).toBe(true);
  });
});

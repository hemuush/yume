import * as LocalAuthentication from 'expo-local-authentication';

/**
 * True if the phone has any screen lock (biometric OR PIN/pattern/password), as `authenticate()` accepts.
 * Not `isEnrolledAsync`: it reports only biometrics, which blocks PIN-only phones from enabling the lock.
 */
export async function isDeviceSecured(): Promise<boolean> {
  const level = await LocalAuthentication.getEnrolledLevelAsync();
  return level !== LocalAuthentication.SecurityLevel.NONE;
}

/**
 * Wraps the app's own system pickers/sheets (document, share, SAF folder): marks the background round-trip as
 * app-initiated so AppGate skips re-locking, which would drop the user to Home mid-restore/export.
 */
let externalActivities = 0;
let lastExternalActivityEndedAt = 0;
const EXTERNAL_ACTIVITY_GRACE_MS = 1500;

export async function withoutRelock<T>(open: () => Promise<T>): Promise<T> {
  externalActivities++;
  try {
    return await open();
  } finally {
    externalActivities--;
    lastExternalActivityEndedAt = Date.now();
  }
}

/** For AppGate: is the app coming back from one of its own pickers rather than being reopened by the user? */
export function isReturningFromOwnActivity(): boolean {
  return externalActivities > 0 || Date.now() - lastExternalActivityEndedAt < EXTERNAL_ACTIVITY_GRACE_MS;
}

/** How long Yume can be away before asking to unlock again; a quick hop to another app shouldn't lock it. */
export const RELOCK_AFTER_MS = 60_000;

/**
 * For AppGate on return to foreground: re-lock only if the app really backgrounded (`backgroundedAt`, not the
 * brief "inactive" of notifications), was away >= RELOCK_AFTER_MS, and wasn't in one of its own pickers.
 */
export function shouldRelock(backgroundedAt: number | null, now: number): boolean {
  if (backgroundedAt === null) return false;
  const away = now - backgroundedAt;
  // A clock moved backwards can't be trusted to measure the gap: lock.
  if (away < 0) return true;
  // Even one of its own pickers doesn't keep Yume open forever: a share sheet left open for long still locks.
  if (away >= OWN_ACTIVITY_MAX_MS) return true;
  return away >= RELOCK_AFTER_MS && !isReturningFromOwnActivity();
}

/** The longest a trip through Yume's own picker or share sheet can last before it locks anyway. */
export const OWN_ACTIVITY_MAX_MS = 5 * 60_000;

/**
 * Shows the phone's biometric prompt, falling back to device PIN/pattern/password (disableDeviceFallback:
 * false), so one call covers both and Yume never handles a credential itself.
 */
export async function authenticate(): Promise<boolean> {
  // The device-PIN fallback can open as its own system screen, which briefly
  // backgrounds the app — that round-trip must not count as "left the app".
  const result = await withoutRelock(() =>
    LocalAuthentication.authenticateAsync({
      promptMessage: 'Unlock Yume',
      disableDeviceFallback: false,
    })
  );
  return result.success;
}

import * as LocalAuthentication from 'expo-local-authentication';

/**
 * True if the phone has any screen lock at all — a biometric OR a
 * PIN/pattern/password, the same set `authenticate()` below accepts.
 * `isEnrolledAsync` alone (what this used) only reports *biometric*
 * enrollment, which both kept PIN-only phones from turning the lock on
 * (despite the copy promising PIN works) and, on a phone whose fingerprints
 * were later removed but still has a PIN, offered the lock screen's "Turn
 * off Yume's lock" escape hatch to anyone who simply cancelled the prompt.
 */
export async function isDeviceSecured(): Promise<boolean> {
  const level = await LocalAuthentication.getEnrolledLevelAsync();
  return level !== LocalAuthentication.SecurityLevel.NONE;
}

/**
 * Opening one of the app's own system pickers/sheets (document picker, share
 * sheet, SAF folder picker) sends Yume to the background, and returning from
 * it would otherwise re-arm the app lock — the lock screen replaces the
 * whole navigation tree, so the user was dropped back to Home mid-restore or
 * mid-export. Wrapping the call in this marks that one round-trip as
 * app-initiated so AppGate (app/_layout.tsx) skips re-locking for it.
 * Genuinely leaving the app (home button, app switcher) still locks.
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

/**
 * Shows the phone's own biometric prompt, falling back to its device
 * PIN/pattern/password automatically (disableDeviceFallback: false) — so
 * one call covers both "biometric" and "PIN" without Yume ever handling
 * a credential itself.
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

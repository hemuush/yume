import * as LocalAuthentication from 'expo-local-authentication';

/** True only if the phone has both the hardware and an enrolled biometric/PIN/pattern/password. */
export async function isDeviceSecured(): Promise<boolean> {
  const [hasHardware, isEnrolled] = await Promise.all([
    LocalAuthentication.hasHardwareAsync(),
    LocalAuthentication.isEnrolledAsync(),
  ]);
  return hasHardware && isEnrolled;
}

/**
 * Shows the phone's own biometric prompt, falling back to its device
 * PIN/pattern/password automatically (disableDeviceFallback: false) — so
 * one call covers both "biometric" and "PIN" without Yume ever handling
 * a credential itself.
 */
export async function authenticate(): Promise<boolean> {
  const result = await LocalAuthentication.authenticateAsync({
    promptMessage: 'Unlock Yume',
    disableDeviceFallback: false,
  });
  return result.success;
}

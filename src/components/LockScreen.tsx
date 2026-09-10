import { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SuuIllustration } from './SuuIllustration';
import { YumeLogo } from './YumeLogo';
import { PrimaryButton } from './PrimaryButton';
import { theme } from '@/constants/theme';
import { authenticate, isDeviceSecured } from '@/lib/appLock';
import { useAppLock } from '@/lib/AppLockContext';

export function LockScreen({ onUnlocked }: { onUnlocked: () => void }) {
  const insets = useSafeAreaInsets();
  const { setLockEnabled } = useAppLock();
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  // Yume never stores a password of its own — it locks using whatever the
  // phone itself is secured with. If the user later removes their device
  // PIN/biometric entirely (Settings only checks this once, at the moment
  // the toggle is turned on), authenticateAsync can never succeed again,
  // and Settings — where "Require unlock" lives — is unreachable without
  // first passing this screen. Without an escape hatch that's a permanent,
  // unrecoverable lockout of the user's own financial data. It's safe to
  // offer one here specifically: if the device has no lock method at all,
  // the phone itself is already unsecured, so turning off Yume's own
  // lock adds no new exposure beyond what already exists.
  const [deviceUnsecured, setDeviceUnsecured] = useState(false);
  const mounted = useRef(true);
  useEffect(
    () => () => {
      mounted.current = false;
    },
    []
  );

  const tryUnlock = async () => {
    setBusy(true);
    setFailed(false);
    try {
      const [ok, secured] = await Promise.all([authenticate(), isDeviceSecured()]);
      if (!mounted.current) return;
      if (ok) {
        onUnlocked();
      } else {
        setFailed(true);
        setDeviceUnsecured(!secured);
      }
    } finally {
      if (mounted.current) setBusy(false);
    }
  };

  // Prompt automatically once when the lock screen first appears — the
  // "Unlock" button below stays as a manual retry if that prompt is
  // dismissed or fails.
  useEffect(() => {
    void tryUnlock();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const turnOffLock = () => {
    setLockEnabled(false);
    onUnlocked();
  };

  return (
    <View style={styles.container}>
      <View style={[styles.wordmark, { top: insets.top + 24 }]}>
        <YumeLogo size={18} />
        <Text style={styles.wordmarkText}>Yume</Text>
      </View>
      <SuuIllustration size={110} pose="sleepy" />
      <Text style={styles.title}>Yume is locked</Text>
      <Text style={styles.subtitle}>Unlock with your fingerprint, face, or device PIN.</Text>
      {failed && !deviceUnsecured && <Text style={styles.failedText}>That didn't work — try again.</Text>}
      {deviceUnsecured && (
        <Text style={styles.failedText}>
          Your device no longer has a screen lock set up, so Yume can't verify you this way. Set one up again
          in your phone's settings, or turn off Yume's lock below.
        </Text>
      )}
      <PrimaryButton
        title={busy ? 'Checking...' : 'Unlock'}
        onPress={tryUnlock}
        disabled={busy}
        style={{ marginTop: 24, width: 200 }}
      />
      {deviceUnsecured && (
        <PrimaryButton
          title="Turn off Yume's lock"
          variant="secondary"
          onPress={turnOffLock}
          disabled={busy}
          style={{ marginTop: 12, width: 200 }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  wordmark: {
    position: 'absolute',
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  wordmarkText: {
    fontFamily: theme.font.roundedBold,
    fontSize: 14,
    color: theme.colors.textSecondary,
    letterSpacing: 0.2,
  },
  title: { fontFamily: theme.font.roundedBold, fontSize: 20, color: theme.colors.textPrimary, marginTop: 20 },
  subtitle: { fontSize: 13, color: theme.colors.textMuted, marginTop: 8, textAlign: 'center' },
  failedText: { fontSize: 12, color: theme.colors.expense, marginTop: 14 },
});

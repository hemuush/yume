import { useEffect, useRef, useState } from 'react';
import { View, ScrollView, StyleSheet } from 'react-native';
import { Text } from '@/components/Text';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { SuuIllustration } from './SuuIllustration';
import { YumeLogo } from './YumeLogo';
import { PrimaryButton } from './PrimaryButton';
import Feather from '@expo/vector-icons/Feather';
import { HeaderHills } from '@/features/home/HeaderHills';
import { theme } from '@/constants/theme';
import { useAccent } from '@/theme/AccentContext';
import { shade } from '@/lib/color';
import { authenticate, isDeviceSecured } from '@/lib/appLock';
import { useAppLock } from '@/lib/AppLockContext';

/**
 * Yume's app-level lock gate (never a password of its own, see `tryUnlock`). Reuses Home's "Dreamlight"
 * gradient with one quiet summary; the phone's prompt opens only when Unlock is tapped.
 */
export function LockScreen({ onUnlocked }: { onUnlocked: () => void }) {
  const insets = useSafeAreaInsets();
  const { accent, secondary } = useAccent();
  const { setLockEnabled } = useAppLock();
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  // Recovery is offered only after an explicit check confirms no device lock method.
  const [deviceUnsecured, setDeviceUnsecured] = useState(false);
  const mounted = useRef(true);
  const running = useRef(false);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const tryUnlock = async () => {
    if (running.current) return;
    running.current = true;
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
    } catch {
      // Only an explicit absence of device security permits the recovery action.
      // A native API failure is unknown, not evidence that authentication can be bypassed.
      if (!mounted.current) return;
      setFailed(true);
      const secured = await isDeviceSecured().catch(() => null);
      if (mounted.current) setDeviceUnsecured(secured === false);
    } finally {
      running.current = false;
      if (mounted.current) setBusy(false);
    }
  };

  // The system prompt opens only after Unlock is tapped, leaving this screen readable.

  const turnOffLock = () => {
    setLockEnabled(false);
    onUnlocked();
  };

  // The same shade() call HomeHeader makes for its "Dreamlight" wash: one gradient formula for both
  // screens, retinted by the accent picked in Settings.
  const gradientTop = shade(accent, 88, 4);
  const gradientBottom = shade(accent, 96, 2);

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ flexGrow: 1 }}>
      <LinearGradient colors={[gradientTop, gradientBottom]} style={StyleSheet.absoluteFill} />
      <View style={[styles.wordmark, { top: insets.top + 24 }]}>
        <YumeLogo size={18} />
        <Text style={styles.wordmarkText}>Yume</Text>
      </View>

      <View style={[styles.centered, { paddingTop: insets.top + 64 }]}>
        <SuuIllustration size={72} pose="sleepy" animate={false} />
      </View>

      {/* Suu's hills, rolling into the cream the card stands on. */}
      <HeaderHills sky="transparent" primary={accent} secondary={secondary} />
      <View style={[styles.ground, { paddingBottom: insets.bottom + 28 }]}>
        <View style={styles.card}>
          <View style={styles.cardBody}>
            <View style={styles.kickerRow}>
              <Feather name="lock" size={16} color={theme.colors.textSecondary} />
              <Text style={styles.kicker}>Private until you unlock</Text>
            </View>
            <Text style={styles.title}>Yume is locked</Text>
            <Text style={styles.subtitle}>
              Tap Unlock to use your phone’s fingerprint, face or screen lock.
            </Text>
            {failed && !deviceUnsecured && (
              <Text style={styles.failedText} accessibilityLiveRegion="polite">
                Yume is still locked. Tap Unlock to try again.
              </Text>
            )}
            {deviceUnsecured && (
              <Text style={styles.failedText} accessibilityLiveRegion="polite">
                Your device no longer has a screen lock set up, so Yume can't verify you this way. Set one up
                again in your phone's settings, or turn off Yume's lock below.
              </Text>
            )}
            <PrimaryButton
              title={busy ? 'Unlocking…' : 'Unlock'}
              icon="unlock"
              variant="primary"
              onPress={tryUnlock}
              disabled={busy}
              accessibilityState={{ busy }}
              style={styles.unlockBtn}
            />
            {deviceUnsecured && (
              <PrimaryButton
                title="Turn off Yume's lock"
                variant="secondary"
                onPress={turnOffLock}
                disabled={busy}
                style={[styles.unlockBtn, styles.turnOffBtn]}
              />
            )}
          </View>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
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
    fontSize: 12.5,
    color: theme.colors.textSecondary,
    letterSpacing: 0.2,
  },
  // Fills the sky between the wordmark and the hills, and centres the moon row and Suu in it.
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
  },
  // Suu stands on Home's hills; the message and Unlock sit below in a white card, under the thumb.
  ground: { backgroundColor: theme.colors.background, paddingHorizontal: 20, paddingTop: 4 },
  card: {
    alignSelf: 'stretch',
    borderRadius: 22,
    backgroundColor: theme.colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.borderSoft,
  },
  cardBody: { padding: 16 },
  kickerRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  kicker: {
    fontFamily: theme.font.bodyMedium,
    fontSize: 12,
    color: theme.colors.textSecondary,
    flexShrink: 1,
  },
  title: {
    fontFamily: theme.font.roundedBold,
    fontSize: 22,
    color: theme.colors.textPrimary,
    marginTop: 8,
  },
  subtitle: {
    fontFamily: theme.font.body,
    fontSize: 13,
    lineHeight: 19,
    color: theme.colors.textSecondary,
    marginTop: 6,
  },
  // The same expense red every error/destructive bit of text in the app
  // uses — not a separate colour invented just for this screen.
  failedText: {
    fontFamily: theme.font.body,
    fontSize: 12,
    color: theme.colors.expenseText,
    marginTop: 12,
    lineHeight: 17,
  },
  unlockBtn: { marginTop: 18, width: '100%' },
  turnOffBtn: { marginTop: 12, opacity: 1 },
});

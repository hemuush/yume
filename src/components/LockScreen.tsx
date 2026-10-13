import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, View, ScrollView, StyleSheet } from 'react-native';
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
 * gradient with a top-aligned summary and one automatic device-authentication prompt per lock visit.
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
  const automaticAttempted = useRef(false);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const tryUnlock = useCallback(async () => {
    if (running.current) return;
    automaticAttempted.current = true;
    running.current = true;
    setBusy(true);
    setFailed(false);
    try {
      const ok = await authenticate();
      if (!mounted.current) return;
      if (ok) {
        onUnlocked();
      } else {
        const secured = await isDeviceSecured();
        if (!mounted.current) return;
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
  }, [onUnlocked]);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const schedule = () => {
      if (automaticAttempted.current || timer) return;
      timer = setTimeout(() => {
        timer = undefined;
        if (
          !mounted.current ||
          AppState.currentState === 'background' ||
          AppState.currentState === 'inactive'
        )
          return;
        automaticAttempted.current = true;
        void tryUnlock();
      }, 250);
    };
    if (AppState.currentState !== 'background' && AppState.currentState !== 'inactive') schedule();
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') schedule();
    });
    return () => {
      if (timer) clearTimeout(timer);
      subscription.remove();
    };
  }, [tryUnlock]);

  const turnOffLock = () => {
    setLockEnabled(false);
    onUnlocked();
  };

  // The same shade() call HomeHeader makes for its "Dreamlight" wash: one gradient formula for both
  // screens, retinted by the accent picked in Settings.
  const gradientTop = shade(accent, 88, 4);
  const gradientBottom = shade(accent, 96, 2);

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[
        styles.content,
        { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24 },
      ]}
      showsVerticalScrollIndicator={false}
    >
      <LinearGradient colors={[gradientTop, gradientBottom]} style={StyleSheet.absoluteFill} />
      <View pointerEvents="none" style={styles.hills}>
        <HeaderHills sky="transparent" primary={accent} secondary={secondary} />
      </View>
      <View style={styles.topContent}>
        <View style={styles.wordmark}>
          <YumeLogo size={26} />
          <Text style={styles.wordmarkText}>Yume</Text>
        </View>
        <View style={styles.card}>
          <View style={styles.cardBody}>
            <View style={styles.identityRow}>
              <View style={styles.kickerRow}>
                <Feather name="lock" size={16} color={theme.colors.textSecondary} />
                <Text style={styles.kicker}>Your private space</Text>
              </View>
              <SuuIllustration size={48} pose="sleepy" animate={false} />
            </View>
            <Text style={styles.title}>Yume is locked</Text>
            <Text style={styles.subtitle}>
              Use your phone’s fingerprint, face or screen lock to continue.
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
  content: { flexGrow: 1, paddingHorizontal: 20 },
  topContent: { width: '100%', maxWidth: 420, alignSelf: 'center' },
  hills: { position: 'absolute', bottom: 0, left: 0, right: 0, opacity: 0.5 },
  wordmark: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 24 },
  wordmarkText: { fontFamily: theme.font.roundedBold, fontSize: 24, color: theme.colors.textPrimary },
  identityRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  card: {
    alignSelf: 'stretch',
    borderRadius: 22,
    backgroundColor: theme.colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.borderSoft,
  },
  cardBody: { padding: 20 },
  kickerRow: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6 },
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

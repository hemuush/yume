import { useEffect, useRef, useState } from 'react';
import { View, ScrollView, StyleSheet } from 'react-native';
import { Text } from '@/components/Text';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { SuuIllustration } from './SuuIllustration';
import { YumeLogo } from './YumeLogo';
import { PrimaryButton } from './PrimaryButton';
import { StripCard, KickerDot } from './StripCard';
import { HeaderHills } from '@/features/home/HeaderHills';
import { theme } from '@/constants/theme';
import { EYEBROW } from '@/constants/textStyles';
import { useAccent } from '@/theme/AccentContext';
import { shade, hexToRgba } from '@/lib/color';
import { authenticate, isDeviceSecured } from '@/lib/appLock';
import { useAppLock } from '@/lib/AppLockContext';

// Sparks stay the cream surface tone at low opacity, like HomeHeader's own. Precomputed once because
// theme.colors values are static.
const SPARK_COLOR = theme.colors.surface;

/**
 * Scattered stars through the gradient, like HomeHeader's "sparks". Fixed positions (not random) so the
 * screen renders identically every mount; spread over the full height since the content is centered.
 */
const STARS: { top: number; left: number; size: number; opacity: number }[] = [
  { top: 58, left: 12, size: 2, opacity: 0.5 },
  { top: 44, left: 82, size: 2.5, opacity: 0.65 },
  { top: 132, left: 30, size: 2, opacity: 0.4 },
  { top: 108, left: 90, size: 2, opacity: 0.5 },
  { top: 20, left: 45, size: 2, opacity: 0.5 },
  { top: 440, left: 10, size: 2, opacity: 0.4 },
  { top: 470, left: 86, size: 2.5, opacity: 0.55 },
  { top: 520, left: 60, size: 2, opacity: 0.4 },
];

/** Suu's dot row on the lock screen: seven dots, the middle one in the theme's dot colour. */
const MOON_PHASE_OPACITY = [0.15, 0.4, 0.7, 1, 0.7, 0.4, 0.15];
// `accent` is the active theme pack's colour (see AccentContext), so the highlighted dot retints
// with the gradient instead of staying the static `theme.colors.primary`.
function MoonPhaseRow({ accent }: { accent: string }) {
  return (
    <View style={styles.moonRow}>
      {MOON_PHASE_OPACITY.map((o, i) =>
        i === 3 ? (
          <View key={i} style={[styles.moonDot, styles.moonDotHighlight, { backgroundColor: accent }]} />
        ) : (
          <View key={i} style={[styles.moonDot, { backgroundColor: hexToRgba(theme.colors.ink, o) }]} />
        )
      )}
    </View>
  );
}

/**
 * Yume's app-level lock gate (never a password of its own, see `tryUnlock`). Reuses Home's "Dreamlight"
 * gradient and the widgets' moon language; no clock (the system lock screen already shows the time).
 */
export function LockScreen({ onUnlocked }: { onUnlocked: () => void }) {
  const insets = useSafeAreaInsets();
  const { accent, secondary } = useAccent();
  const { setLockEnabled } = useAppLock();
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  // See LockScreen's original comment (kept below on tryUnlock): an escape
  // hatch for when the phone itself no longer has any lock method at all.
  const [deviceUnsecured, setDeviceUnsecured] = useState(false);
  const mounted = useRef(true);
  const running = useRef(false);
  useEffect(
    () => () => {
      mounted.current = false;
    },
    []
  );

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

  // Prompt automatically once when the lock screen first appears; the "Unlock" button is a manual retry
  // if the prompt is dismissed or fails.
  useEffect(() => {
    void tryUnlock();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
      {STARS.map((s, i) => (
        <View
          key={i}
          style={[
            styles.star,
            {
              top: insets.top + s.top,
              left: `${s.left}%`,
              width: s.size,
              height: s.size,
              borderRadius: s.size / 2,
              opacity: s.opacity,
            },
          ]}
        />
      ))}

      <View style={[styles.wordmark, { top: insets.top + 24 }]}>
        <YumeLogo size={18} />
        <Text style={styles.wordmarkText}>Yume</Text>
      </View>

      <View style={[styles.centered, { paddingTop: insets.top + 64 }]}>
        <MoonPhaseRow accent={accent} />
        {/* SuuIllustration now breathes on its own (see its own comment) —
            this used to wrap it in a second, independent scale loop, which
            after that change would have compounded with the inner one:
            two unsynchronized loops multiplying together into a wobble
            rather than a single subtle pulse. */}
        <SuuIllustration size={92} pose="sleepy" />
      </View>

      {/* Suu's hills, rolling into the cream the card stands on. */}
      <HeaderHills sky="transparent" primary={accent} secondary={secondary} />
      <View style={[styles.ground, { paddingBottom: insets.bottom + 28 }]}>
        <StripCard tone={theme.colors.slice.free} style={styles.card}>
          <View style={styles.cardBody}>
            <View style={styles.kickerRow}>
              <KickerDot color={theme.colors.link} />
              <Text style={styles.kicker}>Locked</Text>
            </View>
            <Text style={styles.title}>Yume is locked</Text>
            <Text style={styles.subtitle}>Unlock with your fingerprint, face, or device PIN.</Text>
            {failed && !deviceUnsecured && (
              <Text style={styles.failedText}>That didn't work — try again.</Text>
            )}
            {deviceUnsecured && (
              <Text style={styles.failedText}>
                Your device no longer has a screen lock set up, so Yume can't verify you this way. Set one up
                again in your phone's settings, or turn off Yume's lock below.
              </Text>
            )}
            <PrimaryButton
              title={busy ? 'Checking…' : 'Unlock'}
              variant="primary"
              onPress={tryUnlock}
              disabled={busy}
              accessibilityState={{ busy }}
              style={styles.unlockBtn}
            />
            {deviceUnsecured && (
              <PrimaryButton
                title="Turn off Yume's lock"
                variant="primary"
                onPress={turnOffLock}
                disabled={busy}
                style={[styles.unlockBtn, styles.turnOffBtn]}
              />
            )}
          </View>
        </StripCard>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  star: { position: 'absolute', backgroundColor: SPARK_COLOR },
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
  moonRow: { flexDirection: 'row', gap: 4, marginBottom: 18 },
  moonDot: { width: 6, height: 6, borderRadius: 3 },
  moonDotHighlight: {
    borderWidth: 1,
    borderColor: theme.colors.ink,
  },
  // Suu stands on Home's hills; the message and Unlock sit below in a white card, under the thumb.
  ground: { backgroundColor: theme.colors.background, paddingHorizontal: 20, paddingTop: 4 },
  card: { alignSelf: 'stretch' },
  cardBody: { paddingHorizontal: 18, paddingTop: 20, paddingBottom: 18 },
  kickerRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  kicker: { ...EYEBROW, color: theme.colors.textSecondary },
  title: {
    fontFamily: theme.font.roundedBold,
    fontSize: 17,
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
  turnOffBtn: { marginTop: 12, opacity: 0.85 },
});

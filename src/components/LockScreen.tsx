import { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { SuuIllustration } from './SuuIllustration';
import { YumeLogo } from './YumeLogo';
import { PrimaryButton } from './PrimaryButton';
import { theme } from '@/constants/theme';
import { useAccent } from '@/theme/AccentContext';
import { shade, hexToRgba } from '@/lib/color';
import { authenticate, isDeviceSecured } from '@/lib/appLock';
import { useAppLock } from '@/lib/AppLockContext';

// Sparks scattered through the gradient stay the app's cream surface tone
// at low opacity — the same subtle-shimmer trick HomeHeader's own sparks
// use on its light wash. Precomputed once: theme.colors values are static,
// so there's no reason to re-derive these on every render.
const SPARK_COLOR = theme.colors.surface;

/**
 * Scattered stars through the gradient — the same idea as HomeHeader's own
 * "sparks" (a wink at "Yume"/dream). Fixed positions, not random, so the
 * screen renders identically every time rather than reshuffling on every
 * mount.
 */
const STARS: { top: number; left: number; size: number; opacity: number }[] = [
  { top: 58, left: 12, size: 2, opacity: 0.5 },
  { top: 44, left: 82, size: 2.5, opacity: 0.65 },
  { top: 132, left: 30, size: 2, opacity: 0.4 },
  { top: 170, left: 90, size: 2, opacity: 0.5 },
  { top: 216, left: 55, size: 3, opacity: 0.55 },
  { top: 258, left: 8, size: 2, opacity: 0.35 },
  { top: 300, left: 68, size: 2, opacity: 0.45 },
  { top: 20, left: 45, size: 2, opacity: 0.5 },
];

/** Suu's dot row, from the widgets' own dot language — the RN-view equivalent of `src/widgets/WidgetShell.tsx`'s `MoonPhaseRow` (that one is built from RemoteViews primitives and can't be reused here). */
const MOON_PHASE_OPACITY = [0.15, 0.4, 0.7, 1, 0.7, 0.4, 0.15];
function MoonPhaseRow() {
  return (
    <View style={styles.moonRow}>
      {MOON_PHASE_OPACITY.map((o, i) =>
        i === 3 ? (
          <View key={i} style={[styles.moonDot, styles.moonDotHighlight]} />
        ) : (
          <View key={i} style={[styles.moonDot, { backgroundColor: hexToRgba(theme.colors.ink, o) }]} />
        )
      )}
    </View>
  );
}

/**
 * Yume's own app-level lock gate (never a password of its own — see
 * `tryUnlock` below). Previously a flat cream background with everything
 * dead-centered, which on a tall screen read as mostly empty space around a
 * small illustration; a later pass then inverted it into a navy "night
 * mood" gradient, which ended up reading as an unrelated dark-mode screen
 * dropped into an app that otherwise never has one. This reuses two things
 * already built and approved elsewhere rather than inventing a new look:
 * the Home header's own "Dreamlight" gradient technique (`shade()` off the
 * user's accent, the exact same daytime values HomeHeader itself uses), and
 * the widgets' dot-matrix/moon-phase language. Content is anchored to the
 * bottom third, matching where Face ID's own system prompt actually sits.
 */
export function LockScreen({ onUnlocked }: { onUnlocked: () => void }) {
  const insets = useSafeAreaInsets();
  const { accent } = useAccent();
  const { setLockEnabled } = useAppLock();
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const [now, setNow] = useState(() => new Date());
  // See LockScreen's original comment (kept below on tryUnlock): an escape
  // hatch for when the phone itself no longer has any lock method at all.
  const [deviceUnsecured, setDeviceUnsecured] = useState(false);
  const mounted = useRef(true);
  useEffect(
    () => () => {
      mounted.current = false;
    },
    []
  );

  // A live clock — updates every 30s, which is plenty for a screen looked
  // at for a few seconds while unlocking, without a per-second re-render.
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(id);
  }, []);

  // Suu breathes slowly instead of sitting static — a subtle scale pulse,
  // easy on the eye (and battery) at this pace.
  const [breath] = useState(() => new Animated.Value(0));
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(breath, { toValue: 1, duration: 1600, useNativeDriver: true }),
        Animated.timing(breath, { toValue: 0, duration: 1600, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [breath]);
  const suuScale = breath.interpolate({ inputRange: [0, 1], outputRange: [1, 1.045] });

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

  // The exact same shade() call HomeHeader makes for its own "Dreamlight"
  // wash — one gradient formula for both screens instead of a separate
  // night-mode branch. Picking a different accent in Settings retints this
  // the same way it retints Home.
  const gradientTop = shade(accent, 88, 4);
  const gradientBottom = shade(accent, 96, 2);

  return (
    <View style={styles.container}>
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
        <YumeLogo size={15} tone="mono" color={theme.colors.textSecondary} />
        <Text style={styles.wordmarkText}>Yume</Text>
      </View>

      <View style={[styles.clock, { top: insets.top + 78 }]}>
        <Text style={styles.time}>
          {now.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}
        </Text>
        <Text style={styles.date}>
          {now.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' })}
        </Text>
      </View>

      <View style={[styles.lower, { paddingBottom: insets.bottom + 28 }]}>
        <MoonPhaseRow />
        <Animated.View style={{ transform: [{ scale: suuScale }] }}>
          <SuuIllustration size={92} pose="sleepy" />
        </Animated.View>
        <Text style={styles.title}>Yume is locked</Text>
        <Text style={styles.subtitle}>Unlock with your fingerprint, face, or device PIN.</Text>
        {failed && !deviceUnsecured && <Text style={styles.failedText}>That didn't work — try again.</Text>}
        {deviceUnsecured && (
          <Text style={styles.failedText}>
            Your device no longer has a screen lock set up, so Yume can't verify you this way. Set one up
            again in your phone's settings, or turn off Yume's lock below.
          </Text>
        )}
        <PrimaryButton
          title={busy ? 'Checking...' : 'Unlock'}
          variant="primary"
          onPress={tryUnlock}
          disabled={busy}
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
    </View>
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
  clock: { position: 'absolute', left: 0, right: 0, alignItems: 'center' },
  time: { fontFamily: theme.font.dotMatrix, fontSize: 46, color: theme.colors.textPrimary, letterSpacing: 1 },
  date: { fontFamily: theme.font.body, fontSize: 12, color: theme.colors.textMuted, marginTop: 2 },

  lower: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    paddingHorizontal: 28,
  },
  moonRow: { flexDirection: 'row', gap: 4, marginBottom: 18 },
  moonDot: { width: 6, height: 6, borderRadius: 3 },
  moonDotHighlight: {
    backgroundColor: theme.colors.primary,
    borderWidth: 1,
    borderColor: theme.colors.ink,
  },
  title: {
    fontFamily: theme.font.roundedBold,
    fontSize: 17,
    color: theme.colors.textPrimary,
    marginTop: 16,
  },
  subtitle: {
    fontFamily: theme.font.body,
    fontSize: 12.5,
    color: theme.colors.textMuted,
    marginTop: 6,
    textAlign: 'center',
  },
  // The same expense red every error/destructive bit of text in the app
  // uses — not a separate colour invented just for this screen.
  failedText: {
    fontFamily: theme.font.body,
    fontSize: 12,
    color: theme.colors.expense,
    marginTop: 14,
    textAlign: 'center',
    lineHeight: 17,
  },
  unlockBtn: { marginTop: 22, width: '100%' },
  turnOffBtn: { marginTop: 12, opacity: 0.85 },
});

import { useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import { Text } from '@/components/Text';
import ReanimatedAnimated, {
  FadeInDown,
  ReduceMotion,
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withDelay,
  cancelAnimation,
} from 'react-native-reanimated';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { theme } from '@/constants/theme';
import { useAccent } from '@/theme/AccentContext';
import { shade } from '@/lib/color';
import { useReduceMotion } from '@/lib/useReduceMotion';
import { ScallopedEdge } from '@/components/ScallopedEdge';
import { YumeLogo } from '@/components/YumeLogo';
import { HeaderIconButton, HeaderUserButton } from '@/components/AppHeader';
import { PeriodCursor } from '@/lib/period';
import { MonthPill } from './MonthPill';

function greetingWord(): string {
  const h = new Date().getHours();
  if (h < 12) return 'morning';
  if (h < 17) return 'afternoon';
  return 'evening';
}

// Four small "sparks" scattered through the gradient — a wink at "Yume"
// (dream) rather than a busy repeating pattern. `top` is a pixel offset from
// the start of the *content* area (i.e. below the status-bar inset, added
// separately) so they never land up in the status bar itself regardless of
// device. `left` is a plain percentage of the band's width.
const SPARKS: { top: number; left: number; size: number; opacity: number }[] = [
  { top: 4, left: 58, size: 5, opacity: 0.9 },
  { top: 26, left: 78, size: 3, opacity: 0.75 },
  { top: 58, left: 50, size: 4, opacity: 0.5 },
  { top: 12, left: 36, size: 3, opacity: 0.7 },
];

/**
 * One spark, gently breathing — scale and opacity loop up to a brighter
 * peak and back, staggered by `delay` so the four never pulse in sync (that
 * read as a single blinking cluster rather than an ambient scatter). Built
 * entirely on `react-native-reanimated`'s own shared values — never mixed
 * with core React Native's `Animated`, which is exactly the import
 * mismatch that crashed BudgetRow/GoalCard/GoalChip earlier this session.
 * `useReduceMotion` (not reanimated's `entering`-only `ReduceMotion`, which
 * doesn't cover a continuous loop like this) skips the loop entirely when
 * the OS setting is on, leaving the spark at its plain static opacity —
 * exactly what every spark already did before this change.
 */
export function Spark({
  top,
  left,
  size,
  opacity,
  delay,
}: {
  top: number;
  left: number;
  size: number;
  opacity: number;
  delay: number;
}) {
  const reduce = useReduceMotion();
  const scale = useSharedValue(1);
  const glow = useSharedValue(opacity);

  useEffect(() => {
    if (reduce) {
      // `useReduceMotion` starts at `false` and only flips to the real OS
      // value once its async check resolves — if that happened after the
      // loop below already started, this run's own cleanup (below) already
      // cancelled it by the time this branch executes; this just snaps the
      // values back to their plain static rest state.
      scale.value = 1;
      glow.value = opacity;
      return;
    }
    scale.value = withDelay(delay, withRepeat(withTiming(1.4, { duration: 1400 }), -1, true));
    glow.value = withDelay(delay, withRepeat(withTiming(1, { duration: 1400 }), -1, true));
    // Runs before every re-run of this effect (a reduce-motion flip) and on
    // unmount — an infinite (-1) loop otherwise keeps running on the UI
    // thread regardless: a normal navigate-away-and-back on Home would
    // silently pile up one more orphaned loop per Spark every time, forever.
    return () => {
      cancelAnimation(scale);
      cancelAnimation(glow);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reduce]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: glow.value,
  }));

  return (
    <ReanimatedAnimated.View
      style={[
        styles.spark,
        { top, left: `${left}%`, width: size, height: size, borderRadius: size / 2 },
        animatedStyle,
      ]}
    />
  );
}

/**
 * The Home screen's own header — a soft gradient from a light wash of the
 * user's accent down into the page's own cream, derived the same way the
 * Reports moon/heatmap are (`shade()`), so picking a different accent
 * retints the whole thing.
 *
 * Previously taller: Suu sat in the top-right corner, and the greeting sat
 * on its own row above a second row holding just the month pill. Suu is
 * gone (it had no job here beyond decoration, and competed with the
 * greeting for the same corner), and the greeting/tagline now share one row
 * with the month pill instead of stacking — together this takes the band
 * from roughly 230px down to about 120px of vertical space.
 */
export function HomeHeader({
  cursor,
  onChange,
  userName,
  hasAlerts,
}: {
  cursor: PeriodCursor;
  onChange: (next: PeriodCursor) => void;
  userName: string | null;
  hasAlerts: boolean;
}) {
  const { accent } = useAccent();
  const insets = useSafeAreaInsets();
  const gradientTop = shade(accent, 88, 4);
  const gradientBottom = shade(accent, 96, 2);
  const contentTop = insets.top + 10;

  return (
    <>
      <View style={[styles.band, { paddingTop: contentTop }]}>
        <LinearGradient
          colors={[gradientTop, gradientBottom]}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        />

        {SPARKS.map((s, i) => (
          <Spark
            key={i}
            top={contentTop + s.top}
            left={s.left}
            size={s.size}
            opacity={s.opacity}
            delay={i * 700}
          />
        ))}

        <View style={styles.row}>
          <View style={styles.brandRow}>
            <YumeLogo size={22} />
            <Text style={styles.brand}>Yume</Text>
          </View>
          <View style={styles.actions}>
            <HeaderIconButton
              icon="bell"
              onPress={() => router.push('/notifications')}
              label="Notifications"
              badge={hasAlerts}
              soft
            />
            <HeaderUserButton soft />
          </View>
        </View>

        <View style={styles.greetRow}>
          <ReanimatedAnimated.View
            style={styles.greetBlock}
            entering={FadeInDown.duration(420).springify().reduceMotion(ReduceMotion.System)}
          >
            <Text style={styles.greet} numberOfLines={1}>
              Good {greetingWord()}
              {userName ? `, ${userName}` : ''}
            </Text>
            <Text style={styles.tagline} numberOfLines={1}>
              Better money. Bigger dreams.
            </Text>
          </ReanimatedAnimated.View>
          <ReanimatedAnimated.View
            entering={FadeInDown.duration(420).delay(90).springify().reduceMotion(ReduceMotion.System)}
          >
            <MonthPill cursor={cursor} onChange={onChange} />
          </ReanimatedAnimated.View>
        </View>
      </View>
      <ScallopedEdge color={gradientBottom} height={14} />
    </>
  );
}

const styles = StyleSheet.create({
  band: { paddingHorizontal: 20, paddingBottom: 14, gap: 12, overflow: 'hidden' },
  spark: { position: 'absolute', backgroundColor: theme.colors.surface },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  brand: { fontFamily: theme.font.roundedBold, fontSize: 21, letterSpacing: 0.2, color: theme.colors.ink },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  greetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    marginTop: 16,
  },
  greetBlock: { flex: 1, minWidth: 0 },
  greet: { fontFamily: theme.font.roundedMedium, fontSize: 15, color: theme.colors.ink },
  tagline: { fontFamily: theme.font.body, fontSize: 11.5, color: theme.colors.inkSoft, marginTop: 1 },
});

import { useEffect, useState } from 'react';
import { View, StyleSheet, LayoutChangeEvent } from 'react-native';
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
  useAnimatedReaction,
  runOnJS,
  SharedValue,
} from 'react-native-reanimated';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { theme } from '@/constants/theme';
import { useAccent } from '@/theme/AccentContext';
import { shade } from '@/lib/color';
import { useReduceMotion } from '@/lib/useReduceMotion';
import { HeaderHills } from './HeaderHills';
import { YumeLogo } from '@/components/YumeLogo';
import { HeaderIconButton, HeaderUserButton } from '@/components/AppHeader';
import { PeriodCursor } from '@/lib/period';
import { MonthPill } from './MonthPill';
import { WrapButton } from './WrapButton';
import type { ReadyWrap } from '@/features/wrap/wrapWindow';
import { MOTION } from '@/lib/animation';

function greetingWord(): string {
  const h = new Date().getHours();
  if (h < 12) return 'morning';
  if (h < 17) return 'afternoon';
  return 'evening';
}

// Four small "sparks" in the gradient, a wink at "Yume" (dream) rather than a busy pattern.
// `top`: px below the status-bar inset (added separately), so none land in it; `left`: % of band width.
const SPARKS: { top: number; left: number; size: number; opacity: number }[] = [
  { top: 4, left: 58, size: 5, opacity: 0.9 },
  { top: 26, left: 78, size: 3, opacity: 0.75 },
  { top: 58, left: 50, size: 4, opacity: 0.5 },
  { top: 12, left: 36, size: 3, opacity: 0.7 },
];

/**
 * One spark breathing twice on Home open (scale+opacity), staggered by `delay` so the four never sync.
 * Reanimated only, never core Animated (that mix crashed BudgetRow/GoalCard); reduce-motion skips the loop.
 */
/** Out and back counts as two: 4 is two pulses, ending where it started. */
const SPARK_REPEATS = 4;

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
      // `useReduceMotion` starts `false` and flips after an async check; if that lands after the loop began,
      // the cleanup already cancelled it, so this just snaps values back to the static rest state.
      scale.value = 1;
      glow.value = opacity;
      return;
    }
    // Two pulses (out and back, twice) when Home opens, then still: constant
    // motion is the opposite of calm (the Quiet motion sign-off).
    scale.value = withDelay(delay, withRepeat(withTiming(1.4, { duration: 1400 }), SPARK_REPEATS, true));
    glow.value = withDelay(delay, withRepeat(withTiming(1, { duration: 1400 }), SPARK_REPEATS, true));
    // Runs before every re-run of this effect (a reduce-motion flip) and on
    // unmount, so a pulse still running when Home goes away stops with it.
    return () => {
      cancelAnimation(scale);
      cancelAnimation(glow);
    };
  }, [reduce, delay, opacity, scale, glow]);

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

// The collapsed band keeps just the brand row plus this much padding under it.
const COLLAPSED_BOTTOM_PAD = 10;

/**
 * Home header over the ScrollView (absolute; content padded by `onHeight`): accent-to-cream via `shade()`.
 * Scroll collapse = transforms only: band slides up, brand row counter-slides, compact month pill fades in.
 */
export function HomeHeader({
  cursor,
  onChange,
  userName,
  alertCount,
  scrollY,
  onHeight,
  wraps = [],
  onPlayWrap,
  children,
}: {
  cursor: PeriodCursor;
  onChange: (next: PeriodCursor) => void;
  userName: string | null;
  /** How many things need you — the bell shows it as a count. */
  alertCount: number;
  /** The Home ScrollView's vertical offset — drives the collapse. */
  scrollY: SharedValue<number>;
  /** The header's full (expanded) height, for the ScrollView's top padding. */
  onHeight: (height: number) => void;
  /** The Wraps ready today (wrapWindow.ts); the Wrap button shows only while there's one. */
  wraps?: ReadyWrap[];
  onPlayWrap?: (wrap: ReadyWrap) => void;
  children?: React.ReactNode;
}) {
  const { accent, secondary } = useAccent();
  const insets = useSafeAreaInsets();
  const gradientTop = shade(accent, 88, 4);
  const gradientBottom = shade(accent, 96, 2);
  const contentTop = insets.top + 10;

  // How far the band can travel: its full height minus the brand row and a little padding. Measured, not
  // hardcoded, so a larger system font still collapses to exactly the brand row.
  const [bandHeight, setBandHeight] = useState(0);
  const [rowBottom, setRowBottom] = useState(0);
  const distance = useSharedValue(0);
  useEffect(() => {
    distance.value =
      bandHeight > 0 && rowBottom > 0 ? Math.max(0, bandHeight - rowBottom - COLLAPSED_BOTTOM_PAD) : 0;
  }, [bandHeight, rowBottom, distance]);

  // Which month pill takes touches and screen-reader focus — the full one in
  // the greeting row, or the compact one in the brand row once collapsed.
  const [collapsed, setCollapsed] = useState(false);
  useAnimatedReaction(
    () => distance.value > 0 && scrollY.value > distance.value / 2,
    (now, prev) => {
      if (now !== prev) runOnJS(setCollapsed)(now);
    }
  );

  const bandStyle = useAnimatedStyle(() => {
    const d = distance.value;
    const shift = d > 0 ? Math.min(d, Math.max(0, scrollY.value)) : 0;
    return { transform: [{ translateY: -shift }] };
  });
  const rowStyle = useAnimatedStyle(() => {
    const d = distance.value;
    const shift = d > 0 ? Math.min(d, Math.max(0, scrollY.value)) : 0;
    return { transform: [{ translateY: shift }] };
  });
  const fadeStyle = useAnimatedStyle(() => {
    const d = distance.value;
    const p = d > 0 ? Math.min(1, Math.max(0, scrollY.value / d)) : 0;
    return { opacity: 1 - Math.min(1, p * 1.6), transform: [{ translateY: -p * 8 }] };
  });
  // Under the hills, only once the header has started to collapse: rows slide under a soft edge instead of
  // being cut by the hill line.
  const edgeStyle = useAnimatedStyle(() => {
    const d = distance.value;
    return { opacity: d > 0 ? Math.min(1, Math.max(0, scrollY.value / d)) : 0 };
  });
  const miniStyle = useAnimatedStyle(() => {
    const d = distance.value;
    const p = d > 0 ? Math.min(1, Math.max(0, scrollY.value / d)) : 0;
    const t = Math.min(1, Math.max(0, (p - 0.4) / 0.6));
    return { opacity: t, transform: [{ scale: 0.92 + 0.08 * t }] };
  });

  return (
    <ReanimatedAnimated.View
      style={[styles.root, bandStyle]}
      onLayout={(e: LayoutChangeEvent) => onHeight(e.nativeEvent.layout.height)}
    >
      <View
        style={[styles.band, { paddingTop: contentTop }]}
        onLayout={(e) => setBandHeight(e.nativeEvent.layout.height)}
      >
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

        <ReanimatedAnimated.View
          style={[styles.row, rowStyle]}
          onLayout={(e: LayoutChangeEvent) => {
            const { y, height } = e.nativeEvent.layout;
            setRowBottom(y + height);
          }}
        >
          <View style={styles.brandRow}>
            <YumeLogo size={22} />
            <Text style={styles.brand}>Yume</Text>
          </View>
          <ReanimatedAnimated.View
            style={[styles.miniSlot, miniStyle]}
            pointerEvents={collapsed ? 'auto' : 'none'}
            accessibilityElementsHidden={!collapsed}
            importantForAccessibility={collapsed ? 'auto' : 'no-hide-descendants'}
          >
            <MonthPill cursor={cursor} onChange={onChange} compact />
          </ReanimatedAnimated.View>
          <View style={styles.actions}>
            <HeaderIconButton
              icon="bell"
              onPress={() => router.push('/notifications')}
              label={alertCount > 0 ? `Needs you, ${alertCount}` : 'Needs you'}
              count={alertCount}
              soft
            />
            {onPlayWrap && <WrapButton wraps={wraps} onPlay={onPlayWrap} />}
            <HeaderUserButton soft />
          </View>
        </ReanimatedAnimated.View>

        {/* The greeting row and the shortcuts scroll away under the brand row together. */}
        <ReanimatedAnimated.View
          style={[styles.fading, fadeStyle]}
          pointerEvents={collapsed ? 'none' : 'auto'}
          accessibilityElementsHidden={collapsed}
          importantForAccessibility={collapsed ? 'no-hide-descendants' : 'auto'}
        >
          <View style={styles.greetRow}>
            <ReanimatedAnimated.View
              style={styles.greetBlock}
              entering={FadeInDown.duration(MOTION.enter)
                .easing(MOTION.ease)
                .reduceMotion(ReduceMotion.System)}
            >
              <Text style={styles.greet} numberOfLines={1}>
                Good {greetingWord()}
                {userName ? `, ${userName}` : ''}
              </Text>
            </ReanimatedAnimated.View>
            <ReanimatedAnimated.View
              entering={FadeInDown.duration(MOTION.enter)
                .delay(MOTION.enterStep)
                .easing(MOTION.ease)
                .reduceMotion(ReduceMotion.System)}
            >
              <MonthPill cursor={cursor} onChange={onChange} />
            </ReanimatedAnimated.View>
          </View>
          {children}
        </ReanimatedAnimated.View>
      </View>
      <HeaderHills sky={gradientBottom} primary={accent} secondary={secondary} />
      <ReanimatedAnimated.View style={[styles.edgeFade, edgeStyle]} pointerEvents="none">
        <LinearGradient colors={EDGE_FADE} style={StyleSheet.absoluteFill} />
      </ReanimatedAnimated.View>
    </ReanimatedAnimated.View>
  );
}

const EDGE_FADE = [`${theme.colors.background}F2`, `${theme.colors.background}00`] as const;

const styles = StyleSheet.create({
  edgeFade: { position: 'absolute', top: '100%', left: 0, right: 0, height: 14 },
  root: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10 },
  fading: { gap: 8 },
  miniSlot: { flex: 1, minWidth: 0, alignItems: 'flex-end' },
  band: { paddingHorizontal: 20, paddingBottom: 10, gap: 8, overflow: 'hidden' },
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
  },
  greetBlock: { flex: 1, minWidth: 0 },
  greet: { fontFamily: theme.font.roundedMedium, fontSize: 15, color: theme.colors.ink },
});

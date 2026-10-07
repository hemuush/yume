import { useEffect, useState } from 'react';
import { View, StyleSheet, LayoutChangeEvent } from 'react-native';
import { Text } from '@/components/Text';
import ReanimatedAnimated, {
  FadeInDown,
  ReduceMotion,
  useSharedValue,
  useAnimatedStyle,
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
import { HeaderHills } from './HeaderHills';
import { YumeLogo } from '@/components/YumeLogo';
import { HeaderIconButton, HeaderUserButton } from '@/components/AppHeader';
import { PeriodCursor } from '@/lib/period';
import { MonthPill } from './MonthPill';
import { WrapButton } from './WrapButton';
import type { ReadyWrap } from '@/features/wrap/wrapWindow';
import { MOTION } from '@/lib/animation';
import { Spark } from './Spark';

/** "Wednesday, 7 October" — above the greeting. */
function todayLabel(): string {
  return new Date().toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' });
}

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
  const gradientTop = shade(accent, 90, 4);
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
            <YumeLogo size={26} />
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
              size={40}
            />
            {onPlayWrap && <WrapButton wraps={wraps} onPlay={onPlayWrap} />}
            <HeaderUserButton soft size={40} />
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
              <Text style={styles.date} numberOfLines={1}>
                {todayLabel()}
              </Text>
              <Text style={styles.greet} numberOfLines={2}>
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
  fading: { gap: 12, paddingTop: 10 },
  miniSlot: { flex: 1, minWidth: 0, alignItems: 'flex-end' },
  band: { paddingHorizontal: 20, paddingBottom: 14, gap: 8, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  brand: { fontFamily: theme.font.roundedBold, fontSize: 22, letterSpacing: 0.2, color: theme.colors.ink },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  greetRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: 12,
  },
  greetBlock: { flex: 1, minWidth: 0 },
  date: { fontFamily: theme.font.bodyMedium, fontSize: 13, color: theme.colors.textSecondary },
  greet: {
    fontFamily: theme.font.roundedBold,
    fontSize: 25,
    lineHeight: 30,
    color: theme.colors.ink,
    marginTop: 2,
  },
});

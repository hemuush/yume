import { useState } from 'react';
import { View, Pressable, StyleSheet, LayoutChangeEvent } from 'react-native';
import ReanimatedAnimated, {
  useAnimatedReaction,
  useAnimatedStyle,
  useSharedValue,
  runOnJS,
  interpolate,
  Extrapolation,
} from 'react-native-reanimated';
import { router } from 'expo-router';
import Feather from '@expo/vector-icons/Feather';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text, MAX_FONT_SCALE } from '@/components/Text';
import { HeaderUserButton } from '@/components/AppHeader';
import { theme } from '@/constants/theme';
import { shade } from '@/lib/color';
import { useAccent } from '@/theme/AccentContext';
import { withPressed } from '@/lib/pressed';
import { useReduceMotion } from '@/lib/useReduceMotion';
import type { CollapsingHeader } from '@/lib/useCollapsingHeader';
import { HeaderHills } from './HeaderHills';
import { Spark } from './Spark';

// Two sparks: the band is short. `top` is below the status-bar inset.
const SPARKS = [
  { top: 4, left: 52, size: 4, opacity: 0.9 },
  { top: 24, left: 68, size: 3, opacity: 0.7 },
];

/** The title row's height; the band keeps just this row (plus BAR_PAD) once collapsed. */
const ROW = 40;
const BAR_PAD = 6;
/** The title steps down from 22 to 17 as the header collapses. */
const TITLE_SCALE = 17 / 22;

/**
 * The header every screen shares: a short sky band with a 22px title row (back button, title, actions,
 * profile), an optional line under it, anything passed as children (a period control, a search box), and a
 * 14px hill edge.
 *
 * Given `collapse` (useCollapsingHeader) it sits over the screen's list and shrinks as the list scrolls, 1:1
 * with the finger: the band slides up under the title row, which stays put; the title steps down to 17; the
 * line and children fade and lift; the hills fade and a soft shadow takes their place. `summary` (the screen's
 * key figure) writes itself in beside the title as the line leaves, and `collapsedAccessory` (Activity's
 * period chip) appears in the row. Without `collapse` it is a plain header in the page's flow (Add).
 */
export function SkyHeader({
  title,
  subtitle,
  actions,
  children,
  showBack,
  hideUser,
  collapse,
  summary,
  collapsedAccessory,
}: {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
  children?: React.ReactNode;
  showBack?: boolean;
  hideUser?: boolean;
  /** @deprecated Every title is 22px now; kept so callers needn't change. */
  compact?: boolean;
  collapse?: CollapsingHeader;
  /** A short line with the screen's key figure, shown beside the title once collapsed. */
  summary?: React.ReactNode;
  /** A control shown in the title row once collapsed (it stands in for `children`). */
  collapsedAccessory?: React.ReactNode;
}) {
  const { accent, secondary } = useAccent();
  const insets = useSafeAreaInsets();
  const reduce = useReduceMotion();
  const top = insets.top + 6;
  const gradientTop = shade(accent, 90, 4);
  const gradientBottom = shade(accent, 96, 2);

  // Measured, not hardcoded, so a larger system font still collapses to exactly the title row.
  const fallbackY = useSharedValue(0);
  const fallbackD = useSharedValue(0);
  const scrollY = collapse?.scrollY ?? fallbackY;
  const distance = collapse?.distance ?? fallbackD;
  const titleWidth = useSharedValue(0);
  const onRootLayout = (e: LayoutChangeEvent) => {
    const h = e.nativeEvent.layout.height;
    collapse?.onMeasure(h, Math.max(0, h - (top + ROW + BAR_PAD)));
  };

  // Which of the two states takes touches and screen-reader focus.
  const [collapsed, setCollapsed] = useState(false);
  useAnimatedReaction(
    () => distance.value > 0 && scrollY.value > distance.value / 2,
    (now, prev) => {
      if (now !== prev) runOnJS(setCollapsed)(now);
    }
  );

  const progress = () => {
    'worklet';
    const d = distance.value;
    return d > 0 ? Math.min(1, Math.max(0, scrollY.value / d)) : 0;
  };
  const rootStyle = useAnimatedStyle(() => {
    const d = distance.value;
    return { transform: [{ translateY: d > 0 ? -Math.min(d, Math.max(0, scrollY.value)) : 0 }] };
  });
  const rowStyle = useAnimatedStyle(() => {
    const d = distance.value;
    return { transform: [{ translateY: d > 0 ? Math.min(d, Math.max(0, scrollY.value)) : 0 }] };
  });
  const titleStyle = useAnimatedStyle(() => {
    const s = reduce ? 1 : interpolate(progress(), [0, 1], [1, TITLE_SCALE]);
    return { transform: [{ scale: s }] };
  });
  const fadeStyle = useAnimatedStyle(() => {
    const p = progress();
    return { opacity: 1 - Math.min(1, p * 1.8), transform: [{ translateY: reduce ? 0 : -p * 8 }] };
  });
  // Written in as the line leaves, just after the title has stepped down.
  const summaryStyle = useAnimatedStyle(() => {
    const p = progress();
    const t = interpolate(p, [0.55, 0.95], [0, 1], Extrapolation.CLAMP);
    const shrink = reduce ? 0 : titleWidth.value * (1 - TITLE_SCALE);
    return { opacity: t, transform: [{ translateX: -shrink + (reduce ? 0 : (1 - t) * 6) }] };
  });
  const accessoryStyle = useAnimatedStyle(() => {
    const t = interpolate(progress(), [0.5, 0.9], [0, 1], Extrapolation.CLAMP);
    return { opacity: t, transform: [{ translateY: reduce ? 0 : (1 - t) * 8 }] };
  });
  const hillsStyle = useAnimatedStyle(() => ({ opacity: 1 - progress() }));
  const shadowStyle = useAnimatedStyle(() => ({
    opacity: interpolate(progress(), [0.4, 1], [0, 1], Extrapolation.CLAMP),
  }));

  return (
    <ReanimatedAnimated.View
      style={[collapse && styles.over, rootStyle]}
      onLayout={collapse ? onRootLayout : undefined}
    >
      <View style={[styles.band, { paddingTop: top }]}>
        <LinearGradient
          colors={[gradientTop, gradientBottom]}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        />
        {SPARKS.map((s, i) => (
          <Spark key={i} top={top + s.top} left={s.left} size={s.size} opacity={s.opacity} delay={i * 700} />
        ))}
        <ReanimatedAnimated.View style={[styles.titleRow, rowStyle]}>
          {showBack && (
            <Pressable
              onPress={() => router.back()}
              hitSlop={12}
              style={withPressed(styles.backBtn)}
              accessibilityRole="button"
              accessibilityLabel="Back"
            >
              <Feather name="chevron-left" size={20} color={theme.colors.ink} />
            </Pressable>
          )}
          <View style={styles.titleBlock}>
            <ReanimatedAnimated.Text
              maxFontSizeMultiplier={MAX_FONT_SCALE}
              style={[styles.title, titleStyle]}
              accessibilityRole="header"
              numberOfLines={1}
              onLayout={(e) => {
                titleWidth.value = e.nativeEvent.layout.width;
              }}
            >
              {title}
            </ReanimatedAnimated.Text>
            {summary != null && collapse && (
              <ReanimatedAnimated.View
                style={[styles.summary, summaryStyle]}
                pointerEvents="none"
                accessibilityElementsHidden={!collapsed}
                importantForAccessibility={collapsed ? 'auto' : 'no-hide-descendants'}
              >
                {summary}
              </ReanimatedAnimated.View>
            )}
          </View>
          {collapsedAccessory != null && collapse && (
            <ReanimatedAnimated.View
              style={accessoryStyle}
              pointerEvents={collapsed ? 'auto' : 'none'}
              accessibilityElementsHidden={!collapsed}
              importantForAccessibility={collapsed ? 'auto' : 'no-hide-descendants'}
            >
              {collapsedAccessory}
            </ReanimatedAnimated.View>
          )}
          <View style={styles.actions}>
            {actions}
            {!hideUser && <HeaderUserButton soft size={36} />}
          </View>
        </ReanimatedAnimated.View>
        {(subtitle || children) && (
          <ReanimatedAnimated.View
            style={[styles.below, fadeStyle]}
            pointerEvents={collapsed ? 'none' : 'auto'}
            accessibilityElementsHidden={collapsed}
            importantForAccessibility={collapsed ? 'no-hide-descendants' : 'auto'}
          >
            {subtitle ? (
              <Text style={styles.subtitle} numberOfLines={1}>
                {subtitle}
              </Text>
            ) : null}
            {children}
          </ReanimatedAnimated.View>
        )}
      </View>
      {/* The hills fade into plain sky, so the collapsed bar ends in one clean edge. */}
      <View style={{ backgroundColor: gradientBottom }}>
        <ReanimatedAnimated.View style={hillsStyle}>
          <HeaderHills sky={gradientBottom} primary={accent} secondary={secondary} compact />
        </ReanimatedAnimated.View>
      </View>
      {collapse && (
        <ReanimatedAnimated.View style={[styles.shadow, shadowStyle]} pointerEvents="none">
          <LinearGradient colors={SHADOW} style={StyleSheet.absoluteFill} />
        </ReanimatedAnimated.View>
      )}
    </ReanimatedAnimated.View>
  );
}

// Under the collapsed bar: the sky deepened a little, fading to nothing.
const SHADOW = [`${theme.colors.link}29`, `${theme.colors.link}00`] as const;

const styles = StyleSheet.create({
  over: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10 },
  band: { paddingHorizontal: 20, paddingBottom: 8, overflow: 'hidden' },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    height: ROW,
    zIndex: 1,
  },
  titleBlock: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center' },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: {
    fontFamily: theme.font.roundedBold,
    fontSize: 22,
    color: theme.colors.ink,
    transformOrigin: 'left center',
    flexShrink: 1,
  },
  summary: { marginLeft: 10, flexShrink: 1, minWidth: 0 },
  below: { gap: 10, paddingBottom: 2 },
  backBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: -2,
    backgroundColor: `${theme.colors.surface}D9`,
  },
  subtitle: {
    fontFamily: theme.font.bodyMedium,
    fontSize: 13,
    color: theme.colors.textSecondary,
  },
  // Just under the header's bottom edge.
  shadow: { position: 'absolute', left: 0, right: 0, top: '100%', height: 14 },
});

/**
 * The line a collapsed SkyHeader shows beside its title: a dot in the screen's colour, the figure in bold
 * mono, then a few words ("₹23,249 due in 14 days").
 */
export function HeaderSummary({ figure, rest, dot }: { figure: string; rest: string; dot: string }) {
  return (
    <View style={summaryStyles.row}>
      <View style={[summaryStyles.dot, { backgroundColor: dot }]} />
      <Text style={summaryStyles.text} numberOfLines={1}>
        <Text style={summaryStyles.figure}>{figure}</Text> {rest}
      </Text>
    </View>
  );
}

const summaryStyles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 6, minWidth: 0 },
  dot: { width: 6, height: 6, borderRadius: 3 },
  text: { flexShrink: 1, fontFamily: theme.font.bodyMedium, fontSize: 12, color: theme.colors.textSecondary },
  figure: { fontFamily: theme.font.monoBold, fontSize: 12, color: theme.colors.textPrimary },
});

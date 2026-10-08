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
import { theme } from '@/constants/theme';
import { useAccent } from '@/theme/AccentContext';
import { SkyBackdrop } from './SkyBackdrop';
import { YumeLogo } from '@/components/YumeLogo';
import { HeaderIconButton, HeaderUserButton } from '@/components/AppHeader';
import { PeriodCursor } from '@/lib/period';
import { MonthPill } from './MonthPill';
import { WrapButton } from './WrapButton';
import type { ReadyWrap } from '@/features/wrap/wrapWindow';
import { MOTION } from '@/lib/animation';
import { wallpaperTop } from './HomeWallpaper';

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

// The collapsed band keeps just the brand row plus this much padding under it.
const COLLAPSED_BOTTOM_PAD = 10;

/**
 * Home header over the ScrollView (absolute; content padded by `onHeight`): the page colour with a faint theme
 * wash (SkyBackdrop). Scroll collapse = transforms only: band slides up, brand row counter-slides, compact month
 * pill fades in, and a solid bar takes over behind the brand row.
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
  line,
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
  /** Suu's line about the month, said right after the greeting. */
  line?: string;
  children?: React.ReactNode;
}) {
  const { accent } = useAccent();
  const insets = useSafeAreaInsets();
  // The same top spacing as every other screen's SkyHeader.
  const contentTop = insets.top + 6;

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
      <SkyBackdrop
        accent={accent}
        scrollY={scrollY}
        distance={distance}
        collapsedHeight={bandHeight > 0 && rowBottom > 0 ? rowBottom + COLLAPSED_BOTTOM_PAD : 0}
        wash={false}
        barColor={wallpaperTop(accent)}
      />
      <View
        style={[styles.band, { paddingTop: contentTop }]}
        onLayout={(e) => setBandHeight(e.nativeEvent.layout.height)}
      >
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
              size={40}
            />
            {onPlayWrap && <WrapButton wraps={wraps} onPlay={onPlayWrap} />}
            <HeaderUserButton size={40} />
          </View>
        </ReanimatedAnimated.View>

        {/* The greeting row and the shortcuts scroll away under the brand row together. */}
        <ReanimatedAnimated.View
          style={[styles.fading, fadeStyle]}
          pointerEvents={collapsed ? 'none' : 'auto'}
          accessibilityElementsHidden={collapsed}
          importantForAccessibility={collapsed ? 'no-hide-descendants' : 'auto'}
        >
          <ReanimatedAnimated.View
            entering={FadeInDown.duration(MOTION.enter).easing(MOTION.ease).reduceMotion(ReduceMotion.System)}
          >
            <Text style={styles.date} numberOfLines={1}>
              {todayLabel()}
            </Text>
            <Text style={styles.greet}>
              Good {greetingWord()}
              {userName ? (
                <>
                  , <Text style={styles.greetName}>{userName}</Text>
                </>
              ) : null}
              .{line ? ` ${line}` : ''}
            </Text>
          </ReanimatedAnimated.View>
          {children}
        </ReanimatedAnimated.View>
      </View>
    </ReanimatedAnimated.View>
  );
}

const styles = StyleSheet.create({
  root: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10 },
  fading: { gap: 12, paddingTop: 10 },
  miniSlot: { flex: 1, minWidth: 0, alignItems: 'flex-end' },
  band: { paddingHorizontal: 20, paddingBottom: 14, gap: 8, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  brand: { fontFamily: theme.font.roundedBold, fontSize: 22, letterSpacing: 0.2, color: theme.colors.ink },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  date: { fontFamily: theme.font.bodyMedium, fontSize: 13, color: theme.colors.textSecondary },
  greet: {
    fontFamily: theme.font.body,
    fontSize: 22,
    lineHeight: 29,
    letterSpacing: -0.3,
    color: theme.colors.ink,
    marginTop: 2,
  },
  greetName: { fontFamily: theme.font.bodyBold },
});

import { useEffect, useState } from 'react';
import { View, Pressable, StyleSheet, LayoutChangeEvent } from 'react-native';
import { Text } from '@/components/Text';
import ReanimatedAnimated, {
  FadeIn,
  ReduceMotion,
  useSharedValue,
  useDerivedValue,
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
import { HEADER } from '@/components/headerMetrics';
import { HeaderIconButton, HeaderUserButton } from '@/components/AppHeader';
import { PeriodCursor } from '@/lib/period';
import { MonthPill } from './MonthPill';
import { WrapButton } from './WrapButton';
import type { ReadyWrap } from '@/features/wrap/wrapWindow';
import { MOTION } from '@/lib/animation';
import { wallpaperTop } from './HomeWallpaper';
import { headerIsCollapsed } from './headerMotion';
import { useReduceMotion } from '@/lib/useReduceMotion';
import { withPressed } from '@/lib/pressed';

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
  onBrandPress,
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
  /** Tapping the Yume logo (Home scrolls back to the top). Without it the logo is only a picture. */
  onBrandPress?: () => void;
  children?: React.ReactNode;
}) {
  const { accent } = useAccent();
  const reduce = useReduceMotion();
  const insets = useSafeAreaInsets();
  // The same top spacing as every other screen's SkyHeader.
  const contentTop = insets.top + HEADER.topGap;

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
  const collapsedMotion = useSharedValue(false);
  const shift = useDerivedValue(() => Math.min(Math.max(0, distance.value), Math.max(0, scrollY.value)));
  const progress = useDerivedValue(() => (distance.value > 0 ? shift.value / distance.value : 0));
  useAnimatedReaction(
    () => {
      const p = progress.value;
      return headerIsCollapsed(p, collapsedMotion.value);
    },
    (now, prev) => {
      if (now !== prev) {
        collapsedMotion.value = now;
        runOnJS(setCollapsed)(now);
      }
    }
  );

  const bandStyle = useAnimatedStyle(() => {
    return { transform: [{ translateY: -shift.value }] };
  });
  const rowStyle = useAnimatedStyle(() => {
    return { transform: [{ translateY: shift.value }] };
  });
  const fadeStyle = useAnimatedStyle(() => {
    const p = progress.value;
    return { opacity: 1 - Math.min(1, p * 1.6), transform: [{ translateY: reduce ? 0 : -p * 8 }] };
  });
  const miniStyle = useAnimatedStyle(() => {
    const p = progress.value;
    const t = Math.min(1, Math.max(0, (p - 0.4) / 0.6));
    return { opacity: t, transform: [{ scale: reduce ? 1 : 0.92 + 0.08 * t }] };
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
          {onBrandPress ? (
            <Pressable
              onPress={onBrandPress}
              hitSlop={8}
              style={withPressed(styles.brandRow)}
              accessibilityRole="button"
              accessibilityLabel="Yume, scroll to top"
            >
              <YumeLogo size={26} />
              <Text style={styles.brand}>Yume</Text>
            </Pressable>
          ) : (
            <View style={styles.brandRow}>
              <YumeLogo size={26} />
              <Text style={styles.brand}>Yume</Text>
            </View>
          )}
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
              size={HEADER.actionSize}
              glass
            />
            {onPlayWrap && <WrapButton wraps={wraps} onPlay={onPlayWrap} />}
            <HeaderUserButton size={HEADER.actionSize} />
          </View>
        </ReanimatedAnimated.View>

        {/* The greeting scrolls away under the brand row. */}
        <ReanimatedAnimated.View
          style={[styles.fading, fadeStyle]}
          pointerEvents={collapsed ? 'none' : 'auto'}
          accessibilityElementsHidden={collapsed}
          importantForAccessibility={collapsed ? 'no-hide-descendants' : 'auto'}
        >
          <ReanimatedAnimated.View
            entering={FadeIn.duration(MOTION.enter).easing(MOTION.ease).reduceMotion(ReduceMotion.System)}
          >
            <Text style={styles.greet}>
              Good {greetingWord()}
              {userName ? (
                <>
                  , <Text style={styles.greetName}>{userName}</Text>
                </>
              ) : null}
              .
            </Text>
            <Text style={styles.date}>
              {new Date().toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' })}
            </Text>
            {line ? <Text style={styles.insight}>{line}</Text> : null}
          </ReanimatedAnimated.View>
          {children}
        </ReanimatedAnimated.View>
      </View>
    </ReanimatedAnimated.View>
  );
}

const styles = StyleSheet.create({
  root: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10 },
  // The band's gap above and its padding below are equal, so the greeting sits centred between the brand row and the card.
  fading: { gap: 8, paddingTop: 2 },
  miniSlot: { flex: 1, minWidth: 0, alignItems: 'flex-end' },
  band: { paddingHorizontal: HEADER.gutter, paddingBottom: 12, gap: 8, overflow: 'hidden' },
  row: {
    minHeight: HEADER.actionSize,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  brand: { fontFamily: theme.font.roundedBold, fontSize: 22, letterSpacing: 0.2, color: theme.colors.ink },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  date: {
    fontFamily: theme.font.body,
    fontSize: 10,
    lineHeight: 16,
    letterSpacing: 1,
    color: theme.colors.textMuted,
    marginBottom: 2,
  },
  greet: {
    fontFamily: theme.font.roundedMedium,
    fontSize: 18,
    lineHeight: 24,
    letterSpacing: -0.2,
    color: theme.colors.ink,
    marginTop: 1,
  },
  greetName: { fontFamily: theme.font.roundedBold },
  insight: {
    fontFamily: theme.font.body,
    fontSize: 12,
    lineHeight: 18,
    color: theme.colors.textSecondary,
    marginTop: 3,
  },
});

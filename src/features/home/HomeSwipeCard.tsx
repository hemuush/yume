import { useEffect, useRef, useState } from 'react';
import {
  View,
  ScrollView,
  Pressable,
  NativeSyntheticEvent,
  NativeScrollEvent,
  StyleSheet,
} from 'react-native';
import { Text } from '@/components/Text';
import ReanimatedAnimated, { useSharedValue, useAnimatedStyle, withTiming } from 'react-native-reanimated';
import { useReduceMotion } from '@/lib/useReduceMotion';
import { MOTION, timing } from '@/lib/animation';
import { theme } from '@/constants/theme';
import { Section } from '@/components/Section';
import { haptics } from '@/lib/haptics';
import { screenStyles } from '@/components/screenStyles';
import { SECTION_GAP } from '@/constants/textStyles';
import Feather from '@expo/vector-icons/Feather';
import { withPressed } from '@/lib/pressed';

export interface SwipePage {
  key: string;
  label: string;
  /** Something on this page wants action: its tab gets a red dot. */
  alert?: boolean;
  onSeeAll?: () => void;
  content: React.ReactNode;
}

/**
 * One card for Budgets/Upcoming/Goals: tab pills with a sliding highlight over a paged strip; empty pages
 * omitted. Height tracks the active page, not the tallest; a single page falls back to a plain Section.
 */
export function HomeSwipeCard({ pages }: { pages: SwipePage[] }) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [cardWidth, setCardWidth] = useState(0);
  const scrollRef = useRef<ScrollView>(null);
  // Target page of a tapped tab: scroll events en route are ignored, else the first (still on the old page)
  // flips the tab back and the highlight blinks old → new → old → new.
  const tapTarget = useRef<number | null>(null);
  const reduce = useReduceMotion();
  // Each page's natural height, by key — measured, since page content
  // (how many budgets, whether "+N more" shows) changes with the data.
  const [pageHeights, setPageHeights] = useState<Record<string, number>>({});
  const height = useSharedValue(0);
  const activeKey = pages[Math.min(activeIndex, Math.max(0, pages.length - 1))]?.key;
  const targetHeight = activeKey ? (pageHeights[activeKey] ?? 0) : 0;
  useEffect(() => {
    if (targetHeight <= 0) return;
    // The first measurement lands instantly — nothing to animate from yet.
    height.value =
      reduce || height.value === 0 ? targetHeight : withTiming(targetHeight, timing(MOTION.standard));
  }, [targetHeight, reduce, height]);
  const heightStyle = useAnimatedStyle(() => (height.value > 0 ? { height: height.value } : {}));
  // The tab highlight slides to the active tab.
  const [trackWidth, setTrackWidth] = useState(0);
  const tabX = useSharedValue(0);
  const tabCount = Math.max(1, pages.length);
  const tabWidth = trackWidth > 0 ? (trackWidth - TRACK_PAD * 2) / tabCount : 0;
  const shownIndex = Math.min(activeIndex, Math.max(0, pages.length - 1));
  useEffect(() => {
    const x = shownIndex * tabWidth;
    tabX.value = reduce || tabWidth === 0 ? x : withTiming(x, timing(MOTION.standard));
  }, [shownIndex, tabWidth, reduce, tabX]);
  const highlightStyle = useAnimatedStyle(() => ({ transform: [{ translateX: tabX.value }] }));
  // The card can be re-measured (split-screen, font scale, rotation): keep the strip on the active page
  // rather than leaving it between two at the old offset.
  useEffect(() => {
    if (cardWidth > 0) scrollRef.current?.scrollTo({ x: shownIndex * cardWidth, animated: false });
    // Only a width change should re-snap; a tab tap scrolls on its own.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cardWidth]);

  if (pages.length === 0) return null;

  if (pages.length === 1) {
    const only = pages[0];
    return (
      <Section title={only.label} onSeeAll={only.onSeeAll}>
        {only.content}
      </Section>
    );
  }

  const goToPage = (index: number) => {
    if (index !== activeIndex) haptics.tap();
    setActiveIndex(index);
    tapTarget.current = index;
    scrollRef.current?.scrollTo({ x: index * cardWidth, animated: true });
  };

  // Active page flips at the halfway point of a swipe so the tab and card height follow the finger.
  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (cardWidth <= 0) return;
    const index = Math.max(
      0,
      Math.min(pages.length - 1, Math.round(e.nativeEvent.contentOffset.x / cardWidth))
    );
    if (tapTarget.current != null) {
      if (index === tapTarget.current) tapTarget.current = null;
      return;
    }
    if (index !== activeIndex) {
      haptics.tap();
      setActiveIndex(index);
    }
  };

  // `activeIndex` outlives renders; if `pages` shrinks (e.g. last goal completed) it can point past the end,
  // so it's clamped to keep `pages[activeIndex]` from being `undefined`.
  const safeIndex = Math.min(activeIndex, pages.length - 1);
  const active = pages[safeIndex];

  return (
    <View style={styles.wrap}>
      <View style={[screenStyles.card, screenStyles.cardLifted]}>
        <View
          style={styles.track}
          accessibilityRole="tablist"
          onLayout={(e) => setTrackWidth(e.nativeEvent.layout.width)}
        >
          {tabWidth > 0 && (
            <ReanimatedAnimated.View style={[styles.highlight, { width: tabWidth }, highlightStyle]} />
          )}
          {pages.map((p, i) => (
            <Pressable
              key={p.key}
              onPress={() => goToPage(i)}
              style={withPressed(styles.tab)}
              // The pill is ~32dp tall; the slop brings the touch target to 48dp without changing the look.
              hitSlop={{ top: 8, bottom: 8 }}
              accessibilityRole="tab"
              accessibilityState={{ selected: i === safeIndex }}
              accessibilityLabel={p.alert ? `${p.label}, needs you` : p.label}
            >
              <Text style={[styles.tabText, i === safeIndex && styles.tabTextActive]}>{p.label}</Text>
              {p.alert && <View style={styles.alertDot} />}
            </Pressable>
          ))}
        </View>
        <ReanimatedAnimated.View
          style={heightStyle}
          onLayout={(e) => {
            const w = e.nativeEvent.layout.width;
            setCardWidth((prev) => (Math.abs(prev - w) < 0.5 ? prev : w));
          }}
        >
          {cardWidth > 0 && (
            <ScrollView
              ref={scrollRef}
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              onScroll={onScroll}
              // A finger on the strip takes over from a tapped tab's scroll.
              onScrollBeginDrag={() => {
                tapTarget.current = null;
              }}
              onMomentumScrollEnd={() => {
                tapTarget.current = null;
              }}
              scrollEventThrottle={16}
              contentContainerStyle={styles.pagesRow}
            >
              {pages.map((p, i) => (
                <View
                  key={p.key}
                  style={{ width: cardWidth }}
                  // Off-screen pages stay mounted for the swipe; a screen reader shouldn't reach into them.
                  accessibilityElementsHidden={i !== safeIndex}
                  importantForAccessibility={i === safeIndex ? 'auto' : 'no-hide-descendants'}
                >
                  <View
                    onLayout={(e) => {
                      const h = Math.round(e.nativeEvent.layout.height);
                      setPageHeights((prev) => (prev[p.key] === h ? prev : { ...prev, [p.key]: h }));
                    }}
                  >
                    {p.content}
                  </View>
                </View>
              ))}
            </ScrollView>
          )}
        </ReanimatedAnimated.View>
        {active.onSeeAll && (
          <Pressable
            onPress={active.onSeeAll}
            style={withPressed(styles.seeAll)}
            accessibilityRole="button"
            accessibilityLabel={`See all ${active.label.toLowerCase()}`}
          >
            <Text style={styles.seeAllText}>See all {active.label.toLowerCase()}</Text>
            <Feather name="arrow-right" size={13} color={theme.colors.textSecondary} />
          </Pressable>
        )}
      </View>
    </View>
  );
}

/** Space between the pill track's edge and its tabs. */
const TRACK_PAD = 3;

const styles = StyleSheet.create({
  wrap: { marginTop: SECTION_GAP.top, marginHorizontal: 0 },
  pagesRow: { alignItems: 'flex-start' },
  track: {
    flexDirection: 'row',
    margin: 12,
    marginBottom: 4,
    padding: TRACK_PAD,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.surfaceAlt,
  },
  highlight: {
    position: 'absolute',
    top: TRACK_PAD,
    bottom: TRACK_PAD,
    left: TRACK_PAD,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.surface,
    shadowColor: theme.colors.ink,
    shadowOpacity: 0.08,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  tab: { flex: 1, alignItems: 'center', paddingVertical: 7, borderRadius: theme.radius.pill },
  alertDot: {
    position: 'absolute',
    top: 6,
    right: '18%',
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: theme.colors.expense,
  },
  tabText: { fontFamily: theme.font.roundedMedium, fontSize: 13, color: theme.colors.textSecondary },
  tabTextActive: { color: theme.colors.textPrimary },
  seeAll: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 11,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: theme.colors.borderSoft,
  },
  seeAllText: { fontFamily: theme.font.roundedMedium, fontSize: 12.5, color: theme.colors.textSecondary },
});

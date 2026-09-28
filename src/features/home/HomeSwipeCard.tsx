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
import { HomeSection } from './HomeSection';
import { haptics } from '@/lib/haptics';
import { homeStyles } from './homeStyles';
import { SECTION_GAP } from '@/constants/textStyles';
import Feather from '@expo/vector-icons/Feather';
import { withPressed } from '@/lib/pressed';

export interface SwipePage {
  key: string;
  label: string;
  onSeeAll?: () => void;
  content: React.ReactNode;
}

/**
 * Budgets, Upcoming, and Savings goals used to each get their own stacked
 * `HomeSection` — three headers and three cards before Recent activity ever
 * showed up. This merges them into one card: a row of tab pills stands in
 * for the three section titles, and the body is a horizontally paged,
 * swipeable strip instead of three vertically stacked ones. A page that
 * would be empty is never included in `pages` by the caller (same rule the
 * three sections already followed individually), so the card quietly
 * shrinks to however many of the three actually have anything to show —
 * and renders nothing at all if none do.
 *
 * The tabs are one pill track at the top of the card itself, with a white
 * highlight that slides to the page you're on (the Home A sign-off), and a
 * page with its own list elsewhere ends in a "See all" row.
 *
 * The card is as tall as the page you're on, not the tallest page: a
 * horizontally paged ScrollView otherwise stretches every page to the
 * tallest one, which left two Upcoming rows sitting on top of a Budgets-
 * sized empty card. Each page reports its own natural height, and the card
 * eases to the active page's height as you switch.
 *
 * With exactly one page, tabs would have nothing to switch
 * between, so this falls back to a plain `HomeSection` instead — the same
 * shape a single section already had.
 */
export function HomeSwipeCard({ pages }: { pages: SwipePage[] }) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [cardWidth, setCardWidth] = useState(0);
  const scrollRef = useRef<ScrollView>(null);
  // The page a tapped tab is scrolling to. Until the strip gets there, the
  // scroll events it passes through on the way are ignored — otherwise the
  // first of them (still on the old page) flips the tab back, and the
  // highlight blinks old → new → old → new.
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

  if (pages.length === 0) return null;

  if (pages.length === 1) {
    const only = pages[0];
    return (
      <HomeSection title={only.label} onSeeAll={only.onSeeAll}>
        {only.content}
      </HomeSection>
    );
  }

  const goToPage = (index: number) => {
    if (index !== activeIndex) haptics.tap();
    setActiveIndex(index);
    tapTarget.current = index;
    scrollRef.current?.scrollTo({ x: index * cardWidth, animated: true });
  };

  // The active page flips as soon as a swipe crosses the halfway point, so
  // the tab and the card's height follow the finger instead of waiting for
  // the swipe to settle.
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

  // `activeIndex` is state that outlives any single render — if the last
  // page the user swiped to (e.g. Goals) loses its own content between
  // loads (its last goal gets completed/deleted), `pages` shrinks but this
  // component stays mounted with its old index still pointing past the end.
  // Clamped here rather than trusted as-is, so `pages[activeIndex]` can
  // never come back `undefined`.
  const safeIndex = Math.min(activeIndex, pages.length - 1);
  const active = pages[safeIndex];

  return (
    <View style={styles.wrap}>
      <View style={homeStyles.card}>
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
              accessibilityRole="tab"
              accessibilityState={{ selected: i === safeIndex }}
              accessibilityLabel={p.label}
            >
              <Text style={[styles.tabText, i === safeIndex && styles.tabTextActive]}>{p.label}</Text>
            </Pressable>
          ))}
        </View>
        <ReanimatedAnimated.View
          style={heightStyle}
          onLayout={(e) => {
            if (cardWidth === 0) setCardWidth(e.nativeEvent.layout.width);
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
              {pages.map((p) => (
                <View key={p.key} style={{ width: cardWidth }}>
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

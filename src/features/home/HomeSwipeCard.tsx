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
import { homeStyles } from './homeStyles';

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
 * The tabs sit in the section's heading slot (see HomeSection's `heading`),
 * so this card lines up with every other Home section instead of carrying
 * its own header row and page dots inside the card.
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
    setActiveIndex(index);
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
    if (index !== activeIndex) setActiveIndex(index);
  };

  // `activeIndex` is state that outlives any single render — if the last
  // page the user swiped to (e.g. Goals) loses its own content between
  // loads (its last goal gets completed/deleted), `pages` shrinks but this
  // component stays mounted with its old index still pointing past the end.
  // Clamped here rather than trusted as-is, so `pages[activeIndex]` can
  // never come back `undefined`.
  const safeIndex = Math.min(activeIndex, pages.length - 1);
  const active = pages[safeIndex];

  const tabs = (
    <View style={styles.tabs} accessibilityRole="tablist">
      {pages.map((p, i) => (
        <Pressable
          key={p.key}
          onPress={() => goToPage(i)}
          style={[styles.tab, i === safeIndex && styles.tabActive]}
          accessibilityRole="tab"
          accessibilityState={{ selected: i === safeIndex }}
          accessibilityLabel={p.label}
        >
          <Text style={[styles.tabText, i === safeIndex && styles.tabTextActive]}>{p.label}</Text>
        </Pressable>
      ))}
    </View>
  );

  return (
    <HomeSection title={active.label} heading={tabs} onSeeAll={active.onSeeAll}>
      <ReanimatedAnimated.View
        style={[homeStyles.card, heightStyle]}
        onLayout={(e) => {
          // Only set once — a width that keeps changing (e.g. a re-render
          // with a slightly different measured value) would fight
          // `goToPage`'s own scrollTo math mid-swipe.
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
            scrollEventThrottle={16}
            // Pages top-aligned: the card clips whatever is below the
            // active page's own height.
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
    </HomeSection>
  );
}

const styles = StyleSheet.create({
  pagesRow: { alignItems: 'flex-start' },
  tabs: {
    flexDirection: 'row',
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.borderSoft,
    padding: 3,
  },
  tab: { paddingHorizontal: 12, paddingVertical: 5, borderRadius: theme.radius.pill },
  tabActive: { backgroundColor: theme.colors.ink },
  tabText: { fontFamily: theme.font.bodyMedium, fontSize: 12, color: theme.colors.textSecondary },
  tabTextActive: { fontFamily: theme.font.bodyBold, color: theme.colors.surface },
});

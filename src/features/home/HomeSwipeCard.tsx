import { useRef, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  NativeSyntheticEvent,
  NativeScrollEvent,
  StyleSheet,
} from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { theme } from '@/constants/theme';
import { HomeSection } from './HomeSection';

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
 * With exactly one page, tabs and dots would have nothing to switch
 * between, so this falls back to a plain `HomeSection` instead — the same
 * shape a single section already had.
 */
export function HomeSwipeCard({ pages }: { pages: SwipePage[] }) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [cardWidth, setCardWidth] = useState(0);
  const scrollRef = useRef<ScrollView>(null);

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

  const onMomentumScrollEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (cardWidth <= 0) return;
    const index = Math.round(e.nativeEvent.contentOffset.x / cardWidth);
    setActiveIndex(Math.max(0, Math.min(pages.length - 1, index)));
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
      <View style={styles.card}>
        <View style={styles.head}>
          <View style={styles.tabs}>
            {pages.map((p, i) => (
              <Pressable
                key={p.key}
                onPress={() => goToPage(i)}
                style={[styles.tab, i === safeIndex && styles.tabActive]}
                accessibilityRole="button"
                accessibilityLabel={p.label}
              >
                <Text style={[styles.tabText, i === safeIndex && styles.tabTextActive]}>{p.label}</Text>
              </Pressable>
            ))}
          </View>
          {active.onSeeAll && (
            <Pressable
              onPress={active.onSeeAll}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel={`See all — ${active.label}`}
              style={styles.seeAll}
            >
              <Text style={styles.seeAllText}>See all</Text>
              <Feather name="arrow-right" size={13} color={theme.colors.textSecondary} />
            </Pressable>
          )}
        </View>

        <View
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
              onMomentumScrollEnd={onMomentumScrollEnd}
              scrollEventThrottle={16}
            >
              {pages.map((p) => (
                <View key={p.key} style={{ width: cardWidth }}>
                  {p.content}
                </View>
              ))}
            </ScrollView>
          )}
        </View>

        <View style={styles.dots}>
          {pages.map((p, i) => (
            <View key={p.key} style={[styles.dot, i === safeIndex && styles.dotActive]} />
          ))}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginTop: 22 },
  card: {
    marginHorizontal: 20,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.xl2,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.borderSoft,
    paddingTop: 12,
    paddingBottom: 14,
    overflow: 'hidden',
  },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    marginBottom: 10,
  },
  tabs: {
    flexDirection: 'row',
    backgroundColor: theme.colors.surfaceAlt,
    borderRadius: theme.radius.pill,
    padding: 3,
  },
  tab: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: theme.radius.pill },
  tabActive: { backgroundColor: theme.colors.ink },
  tabText: { fontFamily: theme.font.bodyMedium, fontSize: 11.5, color: theme.colors.textSecondary },
  tabTextActive: { fontFamily: theme.font.bodyBold, color: theme.colors.surface },
  seeAll: { flexDirection: 'row', alignItems: 'center', gap: 3, flexShrink: 0, marginLeft: 8 },
  seeAllText: { fontFamily: theme.font.bodyMedium, fontSize: 12, color: theme.colors.textSecondary },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 6, marginTop: 12 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: theme.colors.borderSoft },
  dotActive: { width: 16, backgroundColor: theme.colors.ink },
});

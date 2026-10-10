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
import ReanimatedAnimated, {
  cancelAnimation,
  useSharedValue,
  useAnimatedStyle,
  withTiming,
} from 'react-native-reanimated';
import { useReduceMotion } from '@/lib/useReduceMotion';
import { MOTION, timing } from '@/lib/animation';
import { theme } from '@/constants/theme';
import { Section } from '@/components/Section';
import { haptics } from '@/lib/haptics';
import { GLASS } from '@/components/Glass';
import { SECTION_GAP } from '@/constants/textStyles';
import Feather from '@expo/vector-icons/Feather';
import { withPressed } from '@/lib/pressed';

export interface SwipePage {
  key: string;
  label: string;
  /** Something on this page wants action: its tab's count turns red. */
  alert?: boolean;
  /** How many things the page holds, shown beside its tab's name. */
  count?: number;
  onSeeAll?: () => void;
  content: React.ReactNode;
}

/**
 * One card for Budgets/Upcoming/Goals: tab pills with a sliding highlight over a paged strip; empty pages
 * omitted. Height tracks the active page, not the tallest; a single page falls back to a plain Section.
 */
export function HomeSwipeCard({ pages }: { pages: SwipePage[] }) {
  const [selectedKey, setSelectedKey] = useState<string | undefined>(pages[0]?.key);
  const [settledKey, setSettledKey] = useState<string | undefined>(pages[0]?.key);
  const [moving, setMoving] = useState(false);
  const activeIndex = Math.max(
    0,
    pages.findIndex((p) => p.key === selectedKey)
  );
  const [cardWidth, setCardWidth] = useState(0);
  const scrollRef = useRef<ScrollView>(null);
  // Target page of a tapped tab: scroll events en route are ignored, else the first (still on the old page)
  // flips the tab back and the highlight blinks old → new → old → new.
  const tapTarget = useRef<string | null>(null);
  const reduce = useReduceMotion();
  // Each page's natural height, by key — measured, since page content
  // (how many budgets, whether "+N more" shows) changes with the data.
  const [pageHeights, setPageHeights] = useState<Record<string, number>>({});
  const height = useSharedValue(0);
  const heightKey = pages.some((p) => p.key === settledKey) ? settledKey : pages[0]?.key;
  const targetHeight = heightKey ? (pageHeights[heightKey] ?? 0) : 0;
  useEffect(() => {
    if (targetHeight <= 0 || moving) return;
    // The first measurement lands instantly — nothing to animate from yet.
    height.value =
      reduce || height.value === 0 ? targetHeight : withTiming(targetHeight, timing(MOTION.standard));
    return () => cancelAnimation(height);
  }, [targetHeight, reduce, moving, height]);
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
    return () => cancelAnimation(tabX);
  }, [shownIndex, tabWidth, reduce, tabX]);
  const highlightStyle = useAnimatedStyle(() => ({ transform: [{ translateX: tabX.value }] }));
  // The card can be re-measured (split-screen, font scale, rotation): keep the strip on the active page
  // rather than leaving it between two at the old offset.
  const pageKeys = pages.map((p) => p.key).join('\u0000');
  useEffect(() => {
    tapTarget.current = null;
    setMoving(false);
    setSelectedKey(pages[shownIndex]?.key);
    setSettledKey(pages[shownIndex]?.key);
    if (cardWidth > 0) scrollRef.current?.scrollTo({ x: shownIndex * cardWidth, animated: false });
    // Reconcile structure/width changes without interrupting an ordinary tab tap.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cardWidth, pageKeys, reduce]);

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
    const key = pages[index].key;
    setSelectedKey(key);
    setMoving(!reduce && cardWidth > 0);
    tapTarget.current = reduce || cardWidth <= 0 ? null : key;
    if (reduce || cardWidth <= 0) setSettledKey(key);
    scrollRef.current?.scrollTo({ x: index * cardWidth, animated: !reduce });
  };

  // Keep the outgoing height until paging settles; changing it halfway through a drag clips content.
  const settlePage = (e: NativeSyntheticEvent<NativeScrollEvent>, final: boolean) => {
    if (cardWidth <= 0) return;
    const index = Math.max(
      0,
      Math.min(pages.length - 1, Math.round(e.nativeEvent.contentOffset.x / cardWidth))
    );
    const key = pages[index]?.key;
    if (!key || (!final && Math.abs(e.nativeEvent.contentOffset.x - index * cardWidth) > 1)) return;
    if (tapTarget.current != null && key !== tapTarget.current) return;
    if (!final && tapTarget.current == null) return;
    tapTarget.current = null;
    setMoving(false);
    if (index !== activeIndex) {
      haptics.tap();
      setSelectedKey(key);
    }
    setSettledKey(key);
  };

  // `activeIndex` outlives renders; if `pages` shrinks (e.g. last goal completed) it can point past the end,
  // so it's clamped to keep `pages[activeIndex]` from being `undefined`.
  const safeIndex = Math.min(activeIndex, pages.length - 1);
  const active = pages[safeIndex];

  return (
    <View style={styles.wrap}>
      <View style={styles.card}>
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
              // The pill is 34dp tall; the slop brings the touch target to 44dp without changing the look.
              hitSlop={{ top: 5, bottom: 5 }}
              accessibilityRole="tab"
              accessibilityState={{ selected: i === safeIndex }}
              accessibilityLabel={p.alert ? `${p.label}, needs you` : p.label}
            >
              <Text style={[styles.tabText, i === safeIndex && styles.tabTextActive]} numberOfLines={1}>
                {p.label}
              </Text>
              {p.count != null && p.count > 0 ? (
                <View style={[styles.count, p.alert && styles.countAlert]}>
                  <Text style={[styles.countText, p.alert && styles.countTextAlert]}>{p.count}</Text>
                </View>
              ) : (
                p.alert && <View style={styles.alertDot} />
              )}
            </Pressable>
          ))}
        </View>
        <ReanimatedAnimated.View
          testID="home-swipe-pages"
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
              onScroll={(e) => settlePage(e, false)}
              // A finger on the strip takes over from a tapped tab's scroll.
              onScrollBeginDrag={() => {
                tapTarget.current = null;
                setMoving(true);
              }}
              onMomentumScrollEnd={(e) => settlePage(e, true)}
              onScrollEndDrag={(e) => {
                if (
                  Math.abs(
                    e.nativeEvent.contentOffset.x / cardWidth -
                      Math.round(e.nativeEvent.contentOffset.x / cardWidth)
                  ) < 0.003
                )
                  settlePage(e, true);
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
                    testID={`home-page-${p.key}`}
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
            <Feather name="arrow-right" size={14} color={theme.colors.link} />
          </Pressable>
        )}
      </View>
    </View>
  );
}

/** Space between the pill track's edge and its tabs. */
const TRACK_PAD = 4;

const styles = StyleSheet.create({
  wrap: { marginTop: SECTION_GAP.top, marginHorizontal: 0 },
  pagesRow: { alignItems: 'flex-start' },
  // Frosted, like the rest of Home.
  card: {
    marginHorizontal: 16,
    borderRadius: 24,
    overflow: 'hidden',
    backgroundColor: GLASS.fill,
    borderWidth: 1,
    borderColor: GLASS.edge,
    boxShadow: GLASS.shadow,
  },
  track: {
    flexDirection: 'row',
    margin: 12,
    marginBottom: 4,
    padding: TRACK_PAD,
    borderRadius: theme.radius.pill,
    backgroundColor: 'rgba(18,19,15,0.05)',
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
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    minHeight: 34,
    paddingHorizontal: 4,
    borderRadius: theme.radius.pill,
  },
  alertDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: theme.colors.expense },
  count: { minWidth: 20, height: 20, paddingHorizontal: 5, alignItems: 'center', justifyContent: 'center' },
  countAlert: { borderRadius: 10, backgroundColor: theme.colors.expenseTint },
  countText: { fontFamily: theme.font.monoBold, fontSize: 11, color: theme.colors.textMuted },
  countTextAlert: { color: theme.colors.expenseText },
  tabText: {
    flexShrink: 1,
    fontFamily: theme.font.bodyMedium,
    fontSize: 13,
    color: theme.colors.textSecondary,
  },
  tabTextActive: { fontFamily: theme.font.bodyBold, color: theme.colors.textPrimary },
  seeAll: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    minHeight: 44,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: theme.colors.borderSoft,
  },
  seeAllText: { fontFamily: theme.font.bodyMedium, fontSize: 14, color: theme.colors.link },
});

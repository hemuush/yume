import { useEffect, useRef, useState } from 'react';
import {
  View,
  Pressable,
  ScrollView,
  ScrollViewInstance,
  StyleSheet,
  type LayoutChangeEvent,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Feather from '@expo/vector-icons/Feather';
import { Text } from '@/components/Text';
import { theme } from '@/constants/theme';
import { formatMoney } from '@/lib/money';
import { shade } from '@/lib/color';
import { haptics } from '@/lib/haptics';
import { withPressed } from '@/lib/pressed';
import { useReduceMotion } from '@/lib/useReduceMotion';
import { UNCATEGORIZED_ID, type ChartLegendItem } from './spendChart';

/** The card behind the chips: the fade at the row's right edge ends in this colour. */
const FADE_FROM = 'rgba(255,253,248,0)';
const EDGE_PAD = 28;

/**
 * Under Activity's chart: one chip per category with its amount, in a single row that scrolls sideways, so the
 * card keeps the same height however many categories there are. A chip is also a filter: tapping one shows only
 * that category's entries, tapping it again shows everything. A fade marks that more chips lie off the edge,
 * and a picked chip is scrolled into view.
 */
export function CategorySplit({
  items,
  selectedIds,
  onToggle,
}: {
  /** Biggest first. Always the whole period's categories, so the others stay one tap away while one is picked. */
  items: ChartLegendItem[];
  selectedIds: readonly string[];
  onToggle: (categoryId: string) => void;
}) {
  const reduce = useReduceMotion();
  const scroller = useRef<ScrollViewInstance>(null);
  const offsets = useRef(new Map<string, number>());
  const [box, setBox] = useState({ view: 0, content: 0, x: 0 });
  const picked = new Set(selectedIds);
  const firstPicked = items.find((item) => picked.has(item.categoryId))?.categoryId;

  // A picked chip that sits off the edge (the fifth of six, say) is brought into view, so its ✕ is never hidden.
  useEffect(() => {
    if (!firstPicked) return;
    const x = offsets.current.get(firstPicked);
    if (x != null) scroller.current?.scrollTo({ x: Math.max(0, x - 16), animated: !reduce });
  }, [firstPicked, reduce]);

  if (items.length === 0) return null;
  const more = box.content - box.view - box.x > 4;
  return (
    <View style={styles.wrap}>
      <ScrollView
        ref={scroller}
        horizontal
        showsHorizontalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.row}
        scrollEventThrottle={32}
        onLayout={(e: LayoutChangeEvent) => setBox((b) => ({ ...b, view: e.nativeEvent.layout.width }))}
        onContentSizeChange={(w) => setBox((b) => ({ ...b, content: w }))}
        onScroll={(e) => {
          const x = e.nativeEvent.contentOffset.x;
          setBox((b) => (Math.abs(b.x - x) > 1 ? { ...b, x } : b));
        }}
        accessibilityRole="toolbar"
        accessibilityLabel="Filter by category"
      >
        {items.map((item) => {
          const on = picked.has(item.categoryId);
          const amount = formatMoney(item.totalMinor);
          const body = (
            <>
              <View style={[styles.dot, { backgroundColor: item.color }]} />
              <Text style={styles.name} numberOfLines={1}>
                {item.name}
              </Text>
              <Text style={styles.amount}>{amount}</Text>
              {on && <Feather name="x" size={12} color={theme.colors.textSecondary} />}
            </>
          );
          const onLayout = (e: LayoutChangeEvent) =>
            offsets.current.set(item.categoryId, e.nativeEvent.layout.x);
          // Entries with no category have nothing to filter by.
          if (item.categoryId === UNCATEGORIZED_ID) {
            return (
              <View
                key={item.categoryId}
                onLayout={onLayout}
                style={styles.chip}
                accessible
                accessibilityLabel={`${item.name}, ${amount}`}
              >
                {body}
              </View>
            );
          }
          return (
            <Pressable
              key={item.categoryId}
              onLayout={onLayout}
              onPress={() => {
                haptics.tap();
                onToggle(item.categoryId);
              }}
              hitSlop={{ top: 6, bottom: 6 }}
              accessibilityRole="button"
              accessibilityState={{ selected: on }}
              accessibilityLabel={`${item.name}, ${amount}`}
              accessibilityHint={on ? 'Shows every category again' : 'Shows only this category’s entries'}
              style={withPressed([
                styles.chip,
                on && { backgroundColor: shade(item.color, 90), borderColor: theme.colors.ink },
              ])}
            >
              {body}
            </Pressable>
          );
        })}
      </ScrollView>
      {more && (
        <LinearGradient
          pointerEvents="none"
          colors={[FADE_FROM, theme.colors.surface]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.fade}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginTop: 8 },
  row: { gap: 8, paddingRight: EDGE_PAD, paddingLeft: 2 },
  fade: { position: 'absolute', top: 0, bottom: 0, right: 0, width: 32 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    minHeight: 32,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.borderSoft,
  },
  dot: { width: 9, height: 9, borderRadius: 3 },
  name: { fontFamily: theme.font.body, fontSize: 12, color: theme.colors.textSecondary },
  amount: {
    fontFamily: theme.font.bodyMedium,
    fontSize: 12,
    color: theme.colors.textPrimary,
    fontVariant: ['tabular-nums'],
  },
});

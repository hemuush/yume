import { useState } from 'react';
import { View, Pressable, StyleSheet } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { Text } from '@/components/Text';
import { theme } from '@/constants/theme';
import { formatMoney } from '@/lib/money';
import { shade } from '@/lib/color';
import { haptics } from '@/lib/haptics';
import { withPressed } from '@/lib/pressed';
import { UNCATEGORIZED_ID, type ChartLegendItem } from './spendChart';

/**
 * "Where it went" under Activity's chart: the period's spending as one split bar, then a chip per category
 * with its amount. A chip is also a filter: tapping one shows only that category's entries, tapping it again
 * shows everything. With more categories than `max`, the rest fold behind "+N more".
 */
export function CategorySplit({
  items,
  selectedIds,
  onToggle,
  max = 4,
}: {
  /** Biggest first. Always the whole period's categories, so the others stay one tap away while one is picked. */
  items: ChartLegendItem[];
  selectedIds: readonly string[];
  onToggle: (categoryId: string) => void;
  max?: number;
}) {
  const [expandedKey, setExpandedKey] = useState<string | null>(null);
  const itemKey = items.map((item) => item.categoryId).join('|');
  if (items.length === 0) return null;
  const expanded = expandedKey === itemKey;
  const picked = new Set(selectedIds);
  const anyPicked = items.some((item) => picked.has(item.categoryId));
  const canExpand = items.length > max;
  // A picked category is never folded away: its chip is how the filter is cleared.
  const shown =
    canExpand && !expanded ? items.filter((item, i) => i < max || picked.has(item.categoryId)) : items;
  const more = items.length - shown.length;
  return (
    <View style={styles.wrap}>
      <View style={styles.head}>
        <Text style={styles.title}>Where it went</Text>
        <Text style={styles.hint}>{anyPicked ? 'Tap again to show all' : 'Tap one to filter'}</Text>
      </View>
      <View style={styles.bar} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        {items.map((item) => (
          <View
            key={item.categoryId}
            style={{
              flexGrow: Math.max(1, Math.round(item.totalMinor / 100)),
              backgroundColor: item.color,
              opacity: anyPicked && !picked.has(item.categoryId) ? 0.25 : 1,
            }}
          />
        ))}
      </View>
      <View style={styles.chips}>
        {shown.map((item) => {
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
          // Entries with no category have nothing to filter by.
          if (item.categoryId === UNCATEGORIZED_ID) {
            return (
              <View
                key={item.categoryId}
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
        {canExpand && (
          <Pressable
            onPress={() => setExpandedKey(expanded ? null : itemKey)}
            hitSlop={{ top: 6, bottom: 6 }}
            accessibilityRole="button"
            accessibilityState={{ expanded }}
            accessibilityLabel={expanded ? 'Show fewer categories' : `Show all ${items.length} categories`}
            style={withPressed([styles.chip, styles.more])}
          >
            <Text style={styles.moreText}>{expanded ? 'Show fewer' : `+${more} more`}</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: 7,
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: theme.colors.divider,
  },
  head: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    columnGap: 8,
  },
  title: { fontFamily: theme.font.body, fontSize: 12, color: theme.colors.textSecondary },
  hint: { fontFamily: theme.font.body, fontSize: 11, color: theme.colors.textMuted },
  bar: { flexDirection: 'row', gap: 2, height: 6, borderRadius: 3, overflow: 'hidden' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minHeight: 32,
    maxWidth: '100%',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.borderSoft,
  },
  dot: { width: 8, height: 8, borderRadius: 3 },
  name: { flexShrink: 1, fontFamily: theme.font.body, fontSize: 12, color: theme.colors.textSecondary },
  amount: {
    fontFamily: theme.font.bodyMedium,
    fontSize: 12,
    color: theme.colors.textPrimary,
    fontVariant: ['tabular-nums'],
  },
  more: { backgroundColor: theme.colors.surfaceAlt, borderColor: 'transparent' },
  moreText: { fontFamily: theme.font.bodyMedium, fontSize: 12, color: theme.colors.textPrimary },
});

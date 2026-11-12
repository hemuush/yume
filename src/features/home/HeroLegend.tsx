import { View, Pressable, StyleSheet, useWindowDimensions } from 'react-native';
import { Text } from '@/components/Text';
import { theme } from '@/constants/theme';
import { formatMoney } from '@/lib/money';

export interface LegendItem {
  key: string;
  label: string;
  color: string;
  minor: number;
  /** "66%", "<1%": its share of what the month had to spend. */
  share: string;
  onPress?: () => void;
  expanded?: boolean;
  /** What tapping it does, read after its name. */
  hint?: string;
  /** The slice picked on the line above: its figure turns bold. */
  selected?: boolean;
}

/** Below this font scale the columns sit in one row; above it they pair up so each keeps its figure whole. */
const PAIR_AT = 1.15;

/**
 * Under the month line, one column per slice of it (spent, saved, bills still to pay, free): its colour and
 * name and amount. Shares remain in the accessible label and month line, without a third row competing
 * with the main amount. Bills opens the sum.
 */
export function HeroLegend({ items, stacked = false }: { items: LegendItem[]; stacked?: boolean }) {
  const { width, fontScale } = useWindowDimensions();
  const pair = width < 360 || fontScale > PAIR_AT;
  return (
    <View style={stacked ? styles.stack : styles.row}>
      {items.map((it) => {
        const Container = it.onPress ? Pressable : View;
        const amount = formatMoney(it.minor);
        return (
          <Container
            key={it.key}
            onPress={it.onPress}
            accessibilityRole={it.onPress ? 'button' : undefined}
            accessibilityState={it.onPress ? { expanded: it.expanded, selected: it.selected } : undefined}
            accessibilityHint={it.onPress ? it.hint : undefined}
            // Stacked rows are short so four fit beside the ring; the touch area still reaches 44 dp.
            hitSlop={stacked ? { top: 8, bottom: 8 } : undefined}
            accessible
            accessibilityLabel={`${it.label}, ${amount}, ${it.share}`}
            style={[
              styles.col,
              { minWidth: Math.max(60, amount.length * 7) },
              !stacked && pair && styles.colPair,
              it.onPress && styles.tap,
              stacked && styles.colStacked,
            ]}
          >
            <View style={[styles.head, stacked && { flex: 1, minWidth: 0 }]}>
              <View style={[styles.dot, { backgroundColor: it.color }]} />
              <Text style={styles.label} numberOfLines={1}>
                {it.label}
              </Text>
            </View>
            <Text style={[styles.amount, it.selected && styles.amountOn]} numberOfLines={1}>
              {amount}
            </Text>
          </Container>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', columnGap: 8, rowGap: 4, marginTop: 12, marginBottom: 8 },
  // Beside the ring: one slice per line, name left and amount right.
  stack: { flex: 1, flexBasis: 130, minWidth: 0 },
  colStacked: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    flexBasis: 'auto',
    minHeight: 28,
  },
  col: { flexGrow: 1, flexBasis: 0, minWidth: 60, gap: 1 },
  colPair: { flexBasis: '45%' },
  tap: { minHeight: 44 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  label: {
    flexShrink: 1,
    fontFamily: theme.font.body,
    fontSize: 12,
    color: theme.colors.textSecondary,
  },
  amount: {
    fontFamily: theme.font.bodyMedium,
    fontSize: 14,
    color: theme.colors.textPrimary,
    fontVariant: ['tabular-nums'],
  },
  amountOn: { fontFamily: theme.font.bodyBold },
});

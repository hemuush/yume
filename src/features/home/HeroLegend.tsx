import { View, Pressable, StyleSheet, useWindowDimensions } from 'react-native';
import { Text } from '@/components/Text';
import { theme } from '@/constants/theme';
import { compactMoney } from '@/lib/compactMoney';
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
}

/** Below this font scale the columns sit in one row; above it they pair up so each keeps its figure whole. */
const PAIR_AT = 1.15;

/**
 * Under the month line, one column per slice of it (spent, saved, bills still to pay, free): its colour and
 * name, the amount and its share, so the line is the picture and this the key. Bills opens the sum.
 */
export function HeroLegend({ items }: { items: LegendItem[] }) {
  const { fontScale } = useWindowDimensions();
  const pair = fontScale > PAIR_AT;
  return (
    <View style={styles.row}>
      {items.map((it) => {
        const Container = it.onPress ? Pressable : View;
        return (
          <Container
            key={it.key}
            onPress={it.onPress}
            accessibilityRole={it.onPress ? 'button' : undefined}
            accessibilityState={it.onPress ? { expanded: it.expanded } : undefined}
            accessibilityHint={it.onPress ? 'Shows how this adds up' : undefined}
            accessible
            accessibilityLabel={`${it.label}, ${formatMoney(it.minor)}, ${it.share}`}
            style={[styles.col, pair && styles.colPair, it.onPress && styles.tap]}
          >
            <View style={styles.head}>
              <View style={[styles.dot, { backgroundColor: it.color }]} />
              <Text style={styles.label} numberOfLines={1}>
                {it.label}
              </Text>
            </View>
            <Text style={styles.amount} numberOfLines={1}>
              {compactMoney(it.minor)}
            </Text>
            <Text style={styles.share}>{it.share}</Text>
          </Container>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', columnGap: 8, rowGap: 4, marginTop: 10, marginBottom: 8 },
  col: { flexGrow: 1, flexBasis: 0, minWidth: 60, gap: 1 },
  colPair: { flexBasis: '45%' },
  tap: { minHeight: 44 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  dot: { width: 7, height: 7, borderRadius: 4 },
  label: {
    flexShrink: 1,
    fontFamily: theme.font.bodyMedium,
    fontSize: 12,
    color: theme.colors.textSecondary,
  },
  amount: {
    fontFamily: theme.font.bodyBold,
    fontSize: 14,
    color: theme.colors.textPrimary,
    fontVariant: ['tabular-nums'],
  },
  share: {
    fontFamily: theme.font.body,
    fontSize: 12,
    color: theme.colors.textMuted,
    fontVariant: ['tabular-nums'],
  },
});

import { View, Pressable, StyleSheet } from 'react-native';
import { Text } from '@/components/Text';
import { theme } from '@/constants/theme';
import { formatMoney } from '@/lib/money';
import { themedStyles } from '@/theme/themedStyles';

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

/**
 * One row per slice of the month (spent, saved, bills still to pay, free) under the ring: its colour dot and name on
 * the left, the amount and its share on the right, a hairline between rows. Bills opens the sum.
 */
export function HeroLegend({ items }: { items: LegendItem[] }) {
  return (
    <View style={styles.list}>
      {items.map((it, index) => {
        const Container = it.onPress ? Pressable : View;
        const amount = formatMoney(it.minor);
        return (
          <Container
            key={it.key}
            onPress={it.onPress}
            accessibilityRole={it.onPress ? 'button' : undefined}
            accessibilityState={it.onPress ? { expanded: it.expanded, selected: it.selected } : undefined}
            accessibilityHint={it.onPress ? it.hint : undefined}
            accessible
            accessibilityLabel={`${it.label}, ${amount}, ${it.share}`}
            style={[styles.row, index > 0 && styles.rowDivider]}
          >
            <View style={[styles.dot, { backgroundColor: it.color }]} />
            <Text style={styles.label} numberOfLines={1}>
              {it.label}
            </Text>
            <Text
              style={[styles.amount, it.selected && styles.amountOn]}
              numberOfLines={1}
              // A big figure shrinks to fit instead of being cut to "₹1,23,45…".
              adjustsFontSizeToFit
              minimumFontScale={0.75}
            >
              {amount}
            </Text>
            <Text style={styles.share} numberOfLines={1}>
              {it.share}
            </Text>
          </Container>
        );
      })}
    </View>
  );
}

const styles = themedStyles(() =>
  StyleSheet.create({
    list: { alignSelf: 'stretch', marginTop: 12 },
    row: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 10 },
    rowDivider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.colors.borderSoft },
    dot: { width: 8, height: 8, borderRadius: 4 },
    label: {
      flex: 1,
      minWidth: 0,
      fontFamily: theme.font.bodyMedium,
      fontSize: 14,
      color: theme.colors.textPrimary,
    },
    amount: {
      flexShrink: 1,
      fontFamily: theme.font.bodyMedium,
      fontSize: 14,
      color: theme.colors.textPrimary,
      fontVariant: ['tabular-nums'],
      textAlign: 'right',
    },
    amountOn: { fontFamily: theme.font.bodyBold },
    share: {
      minWidth: 34,
      textAlign: 'right',
      fontFamily: theme.font.body,
      fontSize: 12,
      color: theme.colors.textMuted,
      fontVariant: ['tabular-nums'],
    },
  })
);

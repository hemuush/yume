import { View, Pressable, StyleSheet } from 'react-native';
import { Text } from '@/components/Text';
import { theme } from '@/constants/theme';
import { formatMoney } from '@/lib/money';
import { themedStyles } from '@/theme/themedStyles';
import { useStacked } from '@/hooks/useStacked';

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
  /** The selected row also supplies the headline figure. */
  selected?: boolean;
}

/** Compact metrics under the balance, with a stacked list at larger text sizes. */
export function HeroLegend({ items }: { items: LegendItem[] }) {
  const stacked = useStacked();
  // Two figures fit label-and-amount on one line each; three keep the label above its amount.
  const inline = !stacked && items.length <= 2;
  return (
    <View style={[styles.list, stacked && styles.listStacked]}>
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
            accessible
            accessibilityLabel={`${it.label}, ${amount}, ${it.share}`}
            style={
              it.onPress
                ? ({ pressed }) => [
                    styles.metric,
                    inline && styles.metricInline,
                    stacked && styles.metricStacked,
                    it.selected && styles.selected,
                    pressed && styles.pressed,
                  ]
                : [styles.metric, inline && styles.metricInline, stacked && styles.metricStacked]
            }
          >
            <View style={[styles.labelRow, stacked && styles.labelRowStacked]}>
              <View style={[styles.dot, { backgroundColor: it.color }]} />
              <Text style={[styles.label, it.selected && styles.labelSelected]}>{it.label}</Text>
            </View>
            <Text
              style={[styles.amount, stacked && styles.amountStacked, it.selected && styles.amountOn]}
              numberOfLines={stacked ? undefined : 1}
              adjustsFontSizeToFit={!stacked}
              minimumFontScale={0.75}
            >
              {amount}
            </Text>
          </Container>
        );
      })}
    </View>
  );
}

const styles = themedStyles(() =>
  StyleSheet.create({
    list: {
      flexDirection: 'row',
      gap: 12,
      marginTop: 2,
    },
    listStacked: { flexDirection: 'column', gap: 0 },
    metric: {
      flex: 1,
      minWidth: 0,
      minHeight: 44,
      justifyContent: 'center',
      gap: 3,
      paddingHorizontal: 6,
      borderRadius: theme.radius.md,
    },
    selected: { backgroundColor: theme.colors.home.selected },
    pressed: { backgroundColor: theme.colors.home.pressed },
    metricInline: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'flex-start',
      gap: 8,
      minHeight: 40,
    },
    metricStacked: {
      flex: 0,
      flexDirection: 'row',
      flexWrap: 'wrap',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    labelRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
    labelRowStacked: { flexShrink: 1 },
    dot: { width: 6, height: 6, borderRadius: 3 },
    label: {
      flexShrink: 1,
      fontFamily: theme.font.bodyMedium,
      fontSize: 12,
      color: theme.colors.home.secondaryText,
    },
    labelSelected: { fontFamily: theme.font.bodyBold, color: theme.colors.textPrimary },
    amount: {
      fontFamily: theme.font.bodyMedium,
      fontSize: 16,
      color: theme.colors.textPrimary,
      fontVariant: ['tabular-nums'],
    },
    amountStacked: { flexShrink: 1, textAlign: 'right' },
    amountOn: { fontFamily: theme.font.bodyBold },
  })
);

import { View, Pressable, StyleSheet } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { Text } from '@/components/Text';
import { CountUpAmount } from '@/components/CountUpAmount';
import { theme } from '@/constants/theme';
import { formatMoney } from '@/lib/money';
import { withPressed } from '@/lib/pressed';
import { screenStyles } from '@/components/screenStyles';
import type { SpendBar } from './spendChart';

/** The tallest a mini bar is drawn; the rest are in proportion to the biggest day. */
const BAR_MAX = 34;

/**
 * Activity's summary as one slim strip: what was spent, how it compares with the period before, and a small
 * preview of the days. It is a button: tapping it opens the full chart and totals (Insights). Nothing in it
 * moves; the figure shows the real amount at once.
 */
export function ActivitySummaryStrip({
  periodKey,
  spentMinor,
  expenseChangeMinor,
  compareLabel,
  viewScope,
  bars,
  current,
  narrowedTo,
  onPress,
}: {
  periodKey: string;
  spentMinor: number;
  /** This period's spend less the comparison period's; null when there is nothing to compare. */
  expenseChangeMinor: number | null;
  /** What the change compares with: "last week", "October"… */
  compareLabel: string;
  viewScope: 'week' | 'month';
  bars: SpendBar[];
  /** The period shown is this week or month. */
  current: boolean;
  /** The category the list is narrowed to; the figure then counts only that, and the comparison steps aside. */
  narrowedTo: string | null;
  onPress: () => void;
}) {
  const counted = bars.filter((bar) => !bar.state);
  const peak = Math.max(1, ...counted.map((bar) => bar.totalMinor));
  const kicker = narrowedTo
    ? `Spent on ${narrowedTo}${current ? ` this ${viewScope}` : ''}`
    : current
      ? `Spent this ${viewScope}`
      : 'Spent';
  const change = narrowedTo ? null : expenseChangeMinor;
  const changeWords =
    change == null || change === 0
      ? null
      : `${formatMoney(Math.abs(change))} ${change > 0 ? 'more' : 'less'} than ${compareLabel}`;
  return (
    <Pressable
      onPress={onPress}
      style={withPressed([screenStyles.card, styles.strip])}
      accessibilityRole="button"
      accessibilityLabel={`${kicker}, ${formatMoney(spentMinor)}${changeWords ? `, ${changeWords}` : ''}. Open insights`}
    >
      <View style={styles.lead}>
        <Text style={styles.kicker}>{kicker}</Text>
        <View style={styles.figureRow}>
          <CountUpAmount
            key={`${periodKey}:${narrowedTo ?? ''}`}
            minor={spentMinor}
            style={styles.figure}
            numberOfLines={1}
            adjustsFontSizeToFit
          />
          {changeWords && change != null && (
            <View style={styles.change}>
              <Feather
                name={change > 0 ? 'arrow-up-right' : 'arrow-down-right'}
                size={12}
                color={change > 0 ? theme.colors.expenseText : theme.colors.incomeText}
              />
              <Text style={[styles.changeText, change > 0 ? styles.more : styles.less]} numberOfLines={2}>
                {changeWords}
              </Text>
            </View>
          )}
        </View>
      </View>
      <View
        style={styles.preview}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      >
        <View style={styles.bars}>
          {bars.map((bar) => (
            <View
              key={bar.key}
              style={[
                styles.bar,
                {
                  height: bar.state ? 4 : Math.max(4, Math.round((BAR_MAX * bar.totalMinor) / peak)),
                  backgroundColor: bar.isCurrent
                    ? theme.colors.ink
                    : bar.state || bar.totalMinor === 0
                      ? theme.colors.trayTrack
                      : theme.colors.slice.free,
                },
              ]}
            />
          ))}
        </View>
        <Text style={styles.caption}>{viewScope === 'week' ? 'This week' : 'By week'}</Text>
      </View>
      <Feather name="chevron-right" size={18} color={theme.colors.textMuted} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  strip: {
    marginHorizontal: 16,
    marginTop: 8,
    minHeight: 64,
    paddingHorizontal: 14,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  lead: { flex: 1, minWidth: 0 },
  kicker: { fontFamily: theme.font.body, fontSize: 12, color: theme.colors.textSecondary },
  figureRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'baseline', columnGap: 8 },
  figure: {
    fontFamily: theme.font.bodyMedium,
    fontSize: 20,
    lineHeight: 26,
    letterSpacing: -0.2,
    fontVariant: ['tabular-nums'],
    color: theme.colors.textPrimary,
  },
  change: { flexDirection: 'row', alignItems: 'center', gap: 2, flexShrink: 1 },
  changeText: { fontFamily: theme.font.bodyMedium, fontSize: 12, flexShrink: 1 },
  more: { color: theme.colors.expenseText },
  less: { color: theme.colors.incomeText },
  preview: { alignItems: 'flex-end', gap: 3 },
  bars: { flexDirection: 'row', alignItems: 'flex-end', gap: 3, height: BAR_MAX, width: 64 },
  bar: { flex: 1, borderRadius: 3 },
  caption: { fontFamily: theme.font.body, fontSize: 11, color: theme.colors.textMuted },
});

import { View, Pressable, StyleSheet } from 'react-native';
import ReanimatedAnimated from 'react-native-reanimated';
import Feather from '@expo/vector-icons/Feather';
import { Text } from '@/components/Text';
import { CountUpAmount } from '@/components/CountUpAmount';
import { theme } from '@/constants/theme';
import { formatMoney } from '@/lib/money';
import { withPressed } from '@/lib/pressed';
import { screenStyles } from '@/components/screenStyles';
import { useStacked } from '@/lib/useStacked';
import type { SpendBar } from './spendChart';
import { usePeriodSlide } from './usePeriodSlide';

/** The tallest a mini bar is drawn; the rest are in proportion to the biggest. */
const BAR_MAX = 40;
/** The bars and the letters under them share this width, so a week's seven and a month's five fill it alike. */
const PREVIEW_W = 96;

/**
 * Activity's summary as one compact card: what was spent, a chip for how it compares with the period before, and a
 * small labelled preview of the period (M T W… for a week's days, W1–W5 for a month's weeks). It is a button: tapping
 * it opens the full chart and totals (Insights). The figure is the real amount at once (it never counts up); the card's
 * contents glide in with the period, like Insights (usePeriodSlide).
 */
export function ActivitySummaryStrip({
  periodKey,
  direction,
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
  /** The step that led here (+1 forward, -1 back, 0 for a picked period): which way the figures glide in. */
  direction: -1 | 0 | 1;
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
  const slideStyle = usePeriodSlide(periodKey, direction);
  // Large text has no room beside the figure for the preview: it is only a picture of what the figure says.
  const showPreview = !useStacked();
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
  const more = change != null && change > 0;
  return (
    <Pressable
      onPress={onPress}
      style={withPressed([screenStyles.card, styles.strip])}
      accessibilityRole="button"
      accessibilityLabel={`${kicker}, ${formatMoney(spentMinor)}${changeWords ? `, ${changeWords}` : ''}. Open insights`}
    >
      <ReanimatedAnimated.View style={[styles.glide, slideStyle]}>
        <View style={styles.lead}>
          <Text style={styles.kicker}>{kicker}</Text>
          <CountUpAmount
            key={`${periodKey}:${narrowedTo ?? ''}`}
            minor={spentMinor}
            style={styles.figure}
            numberOfLines={1}
            adjustsFontSizeToFit
          />
          {changeWords && change != null && (
            <View style={styles.changeRow}>
              <View style={[styles.chip, more ? styles.chipMore : styles.chipLess]}>
                <Feather
                  name={more ? 'arrow-up' : 'arrow-down'}
                  size={12}
                  color={more ? theme.colors.expenseText : theme.colors.incomeText}
                />
                <Text style={[styles.chipText, more ? styles.more : styles.less]} numberOfLines={1}>
                  {formatMoney(Math.abs(change))}
                </Text>
              </View>
              <Text style={styles.changeText} numberOfLines={2}>
                {more ? 'more' : 'less'} than {compareLabel}
              </Text>
            </View>
          )}
        </View>
        {showPreview && (
          <View
            style={styles.preview}
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
          >
            <View style={styles.bars}>
              {bars.map((bar, i) => {
                const future = isFuture(bar, i, bars, current);
                return (
                  <View key={bar.key} style={styles.col}>
                    <View
                      style={[
                        styles.bar,
                        { height: barHeight(bar, future, viewScope === 'month', peak) },
                        future ? styles.barFuture : { backgroundColor: barColor(bar) },
                      ]}
                    />
                  </View>
                );
              })}
            </View>
            {/* Spread across the same width as the bars: each word is under its bar to within a dp or two, and a wider
                word ("W1", "W") never has to fit its bar's own column. */}
            <View style={styles.labels}>
              {bars.map((bar, i) => (
                <Text key={bar.key} style={[styles.label, bar.isCurrent && styles.labelNow]}>
                  {viewScope === 'month' ? `W${i + 1}` : bar.label}
                </Text>
              ))}
            </View>
          </View>
        )}
      </ReanimatedAnimated.View>
      <Feather name="chevron-right" size={18} color={theme.colors.textMuted} />
    </Pressable>
  );
}

/** A bar that has not happened yet: a week's later days, or the weeks of this month still to come. */
function isFuture(bar: SpendBar, index: number, bars: SpendBar[], current: boolean) {
  if (bar.state === 'future') return true;
  if (bar.state || !current) return false;
  const now = bars.findIndex((b) => b.isCurrent);
  return now >= 0 && index > now;
}

/**
 * A day's bar is in proportion to the busiest day. A month is one big week and four small ones, so its bars are drawn
 * on a square-root scale: the small weeks stay readable and the order is the same. A period with no spend is a short tick.
 */
function barHeight(bar: SpendBar, future: boolean, monthly: boolean, peak: number) {
  if (future || bar.state) return 4;
  if (bar.totalMinor <= 0) return 3;
  if (monthly) return Math.round(8 + (BAR_MAX - 8) * Math.sqrt(bar.totalMinor / peak));
  return Math.max(4, Math.round((BAR_MAX * bar.totalMinor) / peak));
}

function barColor(bar: SpendBar) {
  if (bar.isCurrent) return theme.colors.ink;
  return bar.state || bar.totalMinor === 0 ? theme.colors.trayTrack : theme.colors.slice.free;
}

const styles = StyleSheet.create({
  strip: {
    marginHorizontal: 16,
    marginTop: 8,
    // The same side padding as Home's month card and as this card's loading placeholder.
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  // The figure, its comparison and the bars glide together; the chevron stays put.
  glide: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 12 },
  lead: { flex: 1, minWidth: 0, gap: 2 },
  kicker: { fontFamily: theme.font.body, fontSize: 12, lineHeight: 16, color: theme.colors.textSecondary },
  figure: {
    fontFamily: theme.font.bodyBold,
    fontSize: 24,
    lineHeight: 30,
    letterSpacing: -0.3,
    fontVariant: ['tabular-nums'],
    color: theme.colors.textPrimary,
  },
  changeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    columnGap: 6,
    rowGap: 2,
    marginTop: 2,
  },
  chip: {
    minHeight: 22,
    paddingLeft: 6,
    paddingRight: 8,
    borderRadius: 11,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  chipLess: { backgroundColor: theme.colors.incomeTint },
  chipMore: { backgroundColor: theme.colors.expenseTint },
  chipText: { fontFamily: theme.font.bodyBold, fontSize: 12, fontVariant: ['tabular-nums'] },
  more: { color: theme.colors.expenseText },
  less: { color: theme.colors.incomeText },
  changeText: { flexShrink: 1, fontFamily: theme.font.body, fontSize: 12, color: theme.colors.textSecondary },
  preview: { width: PREVIEW_W, gap: 3 },
  bars: { flexDirection: 'row', alignItems: 'flex-end', gap: 4, height: BAR_MAX },
  col: { flex: 1, alignItems: 'center', justifyContent: 'flex-end' },
  bar: { width: '100%', maxWidth: 16, borderRadius: 4 },
  // Not here yet: an outline, not a bar, so it never reads as a day with nothing spent.
  barFuture: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: theme.colors.inkOff,
  },
  labels: { flexDirection: 'row', justifyContent: 'space-between' },
  label: {
    fontFamily: theme.font.bodyMedium,
    fontSize: 11,
    lineHeight: 14,
    color: theme.colors.textMuted,
  },
  labelNow: { fontFamily: theme.font.bodyBold, color: theme.colors.textPrimary },
});

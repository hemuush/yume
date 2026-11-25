import { View, Pressable, StyleSheet } from 'react-native';
import ReanimatedAnimated from 'react-native-reanimated';
import Feather from '@expo/vector-icons/Feather';
import { SummaryGradient, summaryInk } from '@/components/SummaryGradient';
import { Text } from '@/components/Text';
import { CountUpAmount } from '@/components/CountUpAmount';
import { theme } from '@/constants/theme';
import { formatMoney } from '@/lib/money';
import { compactMoney } from '@/lib/compactMoney';
import { withPressed } from '@/lib/pressed';
import { useStacked } from '@/hooks/useStacked';
import type { SpendBar } from './spendChart';
import { usePeriodSlide } from './usePeriodSlide';
import { themedStyles } from '@/theme/themedStyles';

/** The tallest a mini bar is drawn; the rest are in proportion to the biggest. */
const BAR_MAX = 40;
/** The bars and the letters under them share this width, so a week's seven and a month's five fill it alike. */
const PREVIEW_W = 96;

/**
 * Activity's summary as one compact card: what was spent, a chip for how it compares with the period before, and a
 * small labelled preview of the period (M T Wâ€¦ for a week's days, W1â€“W5 for a month's weeks). It is a button: tapping
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
  /** What the change compares with: "last week", "October"â€¦ */
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
  // The first heaviest bar (a tie goes to the earlier one); no spend, no label. Hidden bars carry no spend already.
  const peakIndex = peak > 1 ? bars.findIndex((bar) => !bar.state && bar.totalMinor === peak) : -1;
  const peakWords =
    peakIndex >= 0 ? `Heaviest ${viewScope === 'month' ? 'week' : 'day'}, ${formatMoney(peak)}` : null;
  const kicker = narrowedTo
    ? `${narrowedTo === 'matching entries' ? 'Spent in' : 'Spent on'} ${narrowedTo}${current ? ` this ${viewScope}` : ''}`
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
      style={withPressed(styles.strip)}
      accessibilityRole="button"
      accessibilityLabel={`${kicker}, ${formatMoney(spentMinor)}${changeWords ? `, ${changeWords}` : ''}${peakWords ? `. ${peakWords}` : ''}. Open insights`}
    >
      <SummaryGradient />
      <ReanimatedAnimated.View style={[styles.glide, slideStyle]}>
        <View style={styles.lead}>
          <Text style={styles.kicker}>{kicker}</Text>
          <CountUpAmount
            key={`${periodKey}:${narrowedTo ?? ''}`}
            minor={spentMinor}
            style={styles.figure}
            numberOfLines={showPreview ? 1 : undefined}
            adjustsFontSizeToFit={showPreview}
            minimumFontScale={0.75}
          />
          {/* The row’s room is kept while the comparison loads or when there is none: it landing a moment after the
              figure grew the card and pushed the whole list down. */}
          {!(changeWords && change != null) && <View style={styles.changeRow} />}
          {changeWords && change != null && (
            <View style={styles.changeRow}>
              <View style={[styles.chip, more ? styles.chipMore : styles.chipLess]}>
                <Feather
                  name={more ? 'arrow-up' : 'arrow-down'}
                  size={12}
                  color={more ? summaryInk.negative : summaryInk.positive}
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
                    {i === peakIndex && !future && (
                      <Text
                        style={[
                          styles.peakLabel,
                          { bottom: barHeight(bar, false, viewScope === 'month', peak) + 1 },
                        ]}
                        numberOfLines={1}
                      >
                        {compactMoney(bar.totalMinor)}
                      </Text>
                    )}
                  </View>
                );
              })}
            </View>
            {/* Spread across the same width as the bars: each word is under its bar to within a dp or two, and a wider
                word ("W1", "W") never has to fit the column of its bar. */}
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
      <Feather name="chevron-right" size={18} color={summaryInk.link} />
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
  if (bar.isCurrent) return summaryInk.text;
  return bar.state || bar.totalMinor === 0 ? summaryInk.divider : summaryInk.faint;
}

const styles = themedStyles(() =>
  StyleSheet.create({
    strip: {
      marginHorizontal: 16,
      marginTop: 8,
      backgroundColor: summaryInk.background,
      borderRadius: theme.radius.xl,
      overflow: 'hidden',
      // The same side padding as Home's month card and as this card's loading placeholder.
      paddingHorizontal: 16,
      paddingVertical: 8,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    // The figure, its comparison and the bars glide together; the chevron stays put.
    glide: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 12 },
    lead: { flex: 1, minWidth: 0, gap: 2 },
    kicker: {
      fontFamily: theme.font.bodyMedium,
      fontSize: 13,
      lineHeight: 18,
      color: summaryInk.secondary,
    },
    figure: {
      fontFamily: theme.font.bodyBold,
      fontSize: 24,
      lineHeight: 30,
      letterSpacing: -0.5,
      fontVariant: ['tabular-nums'],
      color: summaryInk.text,
    },
    changeRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      alignItems: 'center',
      columnGap: 6,
      rowGap: 2,
      marginTop: 2,
      minHeight: 22,
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
    chipLess: { backgroundColor: summaryInk.chip },
    chipMore: { backgroundColor: summaryInk.chip },
    chipText: { fontFamily: theme.font.bodyBold, fontSize: 12, fontVariant: ['tabular-nums'] },
    more: { color: summaryInk.negative },
    less: { color: summaryInk.positive },
    changeText: {
      flexShrink: 1,
      fontFamily: theme.font.body,
      fontSize: 12,
      color: summaryInk.secondary,
    },
    preview: { width: PREVIEW_W, gap: 3 },
    bars: { flexDirection: 'row', alignItems: 'flex-end', gap: 4, height: BAR_MAX },
    col: { flex: 1, alignItems: 'center', justifyContent: 'flex-end' },
    // Over the heaviest bar, in the card's spare room above the preview; centred and wider than its column.
    peakLabel: {
      position: 'absolute',
      left: -12,
      right: -12,
      textAlign: 'center',
      fontFamily: theme.font.bodyMedium,
      fontSize: 11,
      lineHeight: 13,
      color: summaryInk.secondary,
      fontVariant: ['tabular-nums'],
    },
    bar: { width: '100%', maxWidth: 16, borderRadius: 4 },
    // Not here yet: an outline, not a bar, so it never reads as a day with nothing spent.
    barFuture: {
      backgroundColor: 'transparent',
      borderWidth: 1,
      borderStyle: 'dashed',
      borderColor: summaryInk.faint,
    },
    labels: { flexDirection: 'row', justifyContent: 'space-between' },
    label: {
      fontFamily: theme.font.bodyMedium,
      fontSize: 11,
      lineHeight: 14,
      color: summaryInk.secondary,
    },
    labelNow: { fontFamily: theme.font.bodyBold, color: summaryInk.text },
  })
);

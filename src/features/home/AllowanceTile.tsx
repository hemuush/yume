import { View, StyleSheet } from 'react-native';
import { Text } from '@/components/Text';
import { summaryInk } from '@/components/SummaryGradient';
import { theme } from '@/constants/theme';
import { formatMoney } from '@/lib/money';
import { themedStyles } from '@/theme/themedStyles';

/**
 * What can be spent a day from here on, under the main figure. It is an estimate,
 * separate from the user's daily spending goal. Current month only.
 */
export function AllowanceTile({
  perDayMinor,
  daysLeft,
  todaySpentMinor = null,
  todayBudgetMinor,
}: {
  perDayMinor: number | null;
  daysLeft: number;
  /** What went out today: shown against the daily figure, so the day can be read at a glance. */
  todaySpentMinor?: number | null;
  /**
   * Today's own share: what was free this morning over the days left counting today. Today is set against this,
   * not against `perDayMinor`, which is what is left over the days after today, once today's spend is already out of it.
   */
  todayBudgetMinor?: number | null;
}) {
  const days = `${daysLeft} ${daysLeft === 1 ? 'day' : 'days'}`;
  const showToday = todaySpentMinor != null;
  const spentToday = Math.max(0, todaySpentMinor ?? 0);
  const budget = todayBudgetMinor ?? perDayMinor ?? 0;
  const share = budget > 0 ? Math.min(1, spentToday / budget) : spentToday > 0 ? 1 : 0;
  const remainingToday = budget - spentToday;
  const over = remainingToday < 0;
  const todayStatus = over
    ? `${formatMoney(-remainingToday)} over pace`
    : `${formatMoney(remainingToday)} left today`;
  return (
    <View
      style={styles.tile}
      accessible
      accessibilityLabel={[
        showToday ? `${todayStatus}. Today ${formatMoney(spentToday)} spent` : null,
        perDayMinor != null ? `${days} left, about ${formatMoney(perDayMinor)} a day` : null,
      ]
        .filter(Boolean)
        .join('. ')}
    >
      {showToday && (
        <View style={styles.today}>
          <View style={styles.todayRow}>
            <Text style={[styles.perDay, over && styles.todayOver]}>{todayStatus}</Text>
            <Text style={styles.todayText}>{formatMoney(spentToday)} spent</Text>
          </View>
          <View style={styles.track}>
            {share > 0 && <View style={[styles.fill, over && styles.fillOver, { flex: share }]} />}
            <View style={{ flex: 1 - share }} />
          </View>
        </View>
      )}
      {perDayMinor != null && (
        <Text style={styles.text}>
          About <Text style={!showToday && styles.perDay}>{formatMoney(perDayMinor)} a day</Text> for {days}
        </Text>
      )}
    </View>
  );
}

const styles = themedStyles(() =>
  StyleSheet.create({
    tile: {
      alignSelf: 'stretch',
      flexShrink: 1,
      paddingBottom: 2,
      gap: 4,
    },
    today: { gap: 4 },
    todayRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      alignItems: 'baseline',
      justifyContent: 'space-between',
      columnGap: 8,
      rowGap: 2,
    },
    todayOver: { fontFamily: theme.font.bodyBold, color: summaryInk.negative },
    track: {
      flexDirection: 'row',
      height: 4,
      borderRadius: 2,
      overflow: 'hidden',
      backgroundColor: 'rgba(255,255,255,0.55)',
    },
    fill: { borderRadius: 2, backgroundColor: summaryInk.text },
    fillOver: { backgroundColor: summaryInk.negative },
    todayText: { fontFamily: theme.font.body, fontSize: 13, color: summaryInk.secondary },
    text: {
      flexShrink: 1,
      fontFamily: theme.font.body,
      fontSize: 13,
      lineHeight: 18,
      color: summaryInk.secondary,
    },
    // The figure to act on each day: second only to the headline, not the same small size as its caption.
    perDay: {
      fontFamily: theme.font.bodyBold,
      fontSize: 16,
      color: summaryInk.text,
      fontVariant: ['tabular-nums'],
    },
  })
);

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
  perDayMinor: number;
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
  const showToday = todaySpentMinor != null && todaySpentMinor > 0;
  const budget = todayBudgetMinor && todayBudgetMinor > 0 ? todayBudgetMinor : perDayMinor;
  const share = showToday ? Math.min(1, todaySpentMinor / budget) : 0;
  const over = showToday && todaySpentMinor > budget;
  return (
    <View
      style={styles.tile}
      accessible
      accessibilityLabel={`${days} left, about ${formatMoney(perDayMinor)} a day${
        showToday
          ? `. Today ${formatMoney(todaySpentMinor)} spent, ${formatMoney(Math.abs(todaySpentMinor - budget))} ${over ? 'over' : 'under'} that pace`
          : ''
      }`}
    >
      <Text style={styles.text}>
        About <Text style={styles.perDay}>{formatMoney(perDayMinor)} a day</Text> for {days}
      </Text>
      {showToday && (
        <View style={styles.today}>
          {/* What today came to and how that sits against the pace, in words: a full red bar alone says "bad", not
              by how much. */}
          <View style={styles.todayRow}>
            <Text style={styles.todayText}>
              Today <Text style={styles.amount}>{formatMoney(todaySpentMinor)}</Text>
            </Text>
            <Text style={[styles.todayText, over && styles.todayOver]}>
              {over
                ? `${formatMoney(todaySpentMinor - budget)} over pace`
                : `${formatMoney(budget - todaySpentMinor)} under pace`}
            </Text>
          </View>
          <View style={styles.track}>
            <View style={[styles.fill, over && styles.fillOver, { flex: Math.max(0.02, share) }]} />
            <View style={{ flex: Math.max(0, 1 - Math.max(0.02, share)) }} />
          </View>
        </View>
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
      gap: 8,
    },
    today: { gap: 5 },
    todayRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 10 },
    todayOver: { fontFamily: theme.font.bodyBold, color: summaryInk.negative },
    track: {
      flexDirection: 'row',
      height: 6,
      borderRadius: 3,
      overflow: 'hidden',
      backgroundColor: 'rgba(255,255,255,0.55)',
    },
    fill: { borderRadius: 3, backgroundColor: summaryInk.text },
    fillOver: { backgroundColor: summaryInk.negative },
    todayText: { fontFamily: theme.font.body, fontSize: 13, color: summaryInk.secondary },
    text: {
      flexShrink: 1,
      fontFamily: theme.font.body,
      fontSize: 13,
      lineHeight: 22,
      color: summaryInk.secondary,
    },
    // The figure to act on each day: second only to the headline, not the same small size as its caption.
    perDay: {
      fontFamily: theme.font.bodyBold,
      fontSize: 16,
      color: summaryInk.text,
      fontVariant: ['tabular-nums'],
    },
    amount: {
      fontFamily: theme.font.bodyBold,
      fontSize: 13,
      color: summaryInk.text,
      fontVariant: ['tabular-nums'],
    },
  })
);

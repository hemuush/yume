import { View, StyleSheet } from 'react-native';
import { Text } from '@/components/Text';
import { theme } from '@/constants/theme';
import { EYEBROW } from '@/constants/textStyles';
import { StripCard, KickerDot } from '@/components/StripCard';
import { formatMoney } from '@/lib/money';
import { weekdayDayMonth } from '@/lib/dateLabels';
import type { SubscriptionTotals } from '@/db/subscriptions';
import { CostShare, topShareLine } from './recurring.helpers';

/**
 * The top of Recurring: what running expense rules cost a month and a year (₹299/month reads smaller than
 * ₹3,588/year), the split, and when the next is due. With none running, just a line on what the page does.
 */
export function RecurringHero({
  totals,
  shares,
  nextDate,
}: {
  totals: SubscriptionTotals;
  shares: CostShare[];
  /** The earliest next run among running rules. */
  nextDate: string | null;
}) {
  const running = totals.count > 0;
  const caption = [
    topShareLine(shares),
    `${totals.count} running`,
    nextDate ? `Next: ${weekdayDayMonth(nextDate)}` : null,
  ]
    .filter(Boolean)
    .join(' · ');
  return (
    // Keyed like the Loans hero, so it can't lose its children.
    <StripCard key={running ? 'totals' : 'intro'} tone={theme.colors.slice.free} style={styles.card}>
      {running ? (
        <>
          <View style={styles.head}>
            <View style={styles.headText}>
              <View style={styles.kickerRow}>
                <KickerDot color={theme.colors.link} />
                <Text style={styles.kicker}>Subscriptions & bills</Text>
              </View>
              <Text style={styles.amount} numberOfLines={1}>
                {formatMoney(totals.monthlyMinor)}
                <Text style={styles.per}> / month</Text>
              </Text>
            </View>
            <View style={styles.side}>
              <Text style={styles.sideLabel}>A year</Text>
              <Text style={styles.sideValue} numberOfLines={1}>
                {formatMoney(totals.yearlyMinor)}
              </Text>
            </View>
          </View>
          {shares.length > 1 && (
            <View style={styles.stack}>
              {shares.map((s) => (
                <View key={s.key} style={{ flex: s.minor, backgroundColor: s.color }} />
              ))}
            </View>
          )}
          <Text style={styles.caption}>{caption}</Text>
        </>
      ) : (
        <>
          <View style={styles.kickerRow}>
            <KickerDot color={theme.colors.link} />
            <Text style={styles.kicker}>Subscriptions & bills</Text>
          </View>
          <Text style={styles.intro}>
            Set up rent, a subscription or your salary once, and Yume logs it on schedule, like any entry you
            typed yourself.
          </Text>
        </>
      )}
    </StripCard>
  );
}

const styles = StyleSheet.create({
  card: {
    marginBottom: 4,
    paddingTop: 18,
    paddingBottom: 16,
    paddingHorizontal: 16,
  },
  kickerRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  head: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  headText: { flex: 1, minWidth: 0 },
  kicker: { ...EYEBROW, color: theme.colors.textSecondary },
  amount: { fontFamily: theme.font.monoBold, fontSize: 28, color: theme.colors.textPrimary, marginTop: 2 },
  per: { fontFamily: theme.font.body, fontSize: 13, color: theme.colors.textSecondary },
  side: { alignItems: 'flex-end', flexShrink: 0, maxWidth: '45%' },
  sideLabel: { ...EYEBROW, color: theme.colors.textSecondary },
  sideValue: { fontFamily: theme.font.monoBold, fontSize: 14, color: theme.colors.textPrimary, marginTop: 4 },
  stack: {
    flexDirection: 'row',
    height: 10,
    gap: 2,
    marginTop: 10,
    borderRadius: theme.radius.pill,
    overflow: 'hidden',
  },
  caption: { fontFamily: theme.font.body, fontSize: 12.5, color: theme.colors.textSecondary, marginTop: 8 },
  intro: {
    fontFamily: theme.font.body,
    fontSize: 12.5,
    lineHeight: 17,
    color: theme.colors.textSecondary,
    marginTop: 8,
  },
});

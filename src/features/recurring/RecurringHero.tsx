import { View, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Text } from '@/components/Text';
import { theme } from '@/constants/theme';
import { EYEBROW } from '@/constants/textStyles';
import { shade } from '@/lib/color';
import { formatMoney } from '@/lib/money';
import { weekdayDayMonth } from '@/lib/dateLabels';
import type { SubscriptionTotals } from '@/db/subscriptions';
import { CostShare, topShareLine } from './recurring.helpers';

const HUE = theme.colors.idTeal;

/**
 * The top of Recurring: what the running expense rules cost a month and a
 * year (₹299 a month reads smaller than ₹3,588 a year), how that splits
 * between them, and when the next one is due. With no expense rule running
 * it is just a line saying what this page does.
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
    // Keyed and given a solid ground like the Loans hero, so it can't lose its children.
    <View key={running ? 'totals' : 'intro'} style={[styles.card, { backgroundColor: shade(HUE, 93) }]}>
      <LinearGradient
        colors={[shade(HUE, 93), shade(HUE, 85)]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <View style={styles.circle} />
      {running ? (
        <>
          <View style={styles.head}>
            <View style={styles.headText}>
              <Text style={styles.kicker}>Subscriptions & bills</Text>
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
          <Text style={styles.kicker}>Subscriptions & bills</Text>
          <Text style={styles.intro}>
            Set up rent, a subscription or your salary once, and Yume logs it on schedule, like any entry you
            typed yourself.
          </Text>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginBottom: 4,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: theme.radius.xl2,
    overflow: 'hidden',
  },
  circle: {
    position: 'absolute',
    right: -34,
    top: -46,
    width: 130,
    height: 130,
    borderRadius: 65,
    backgroundColor: 'rgba(255,255,255,0.35)',
  },
  head: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  headText: { flex: 1, minWidth: 0 },
  kicker: { ...EYEBROW, color: theme.colors.textSecondary },
  amount: { fontFamily: theme.font.monoBold, fontSize: 26, color: theme.colors.textPrimary, marginTop: 2 },
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
  caption: { fontFamily: theme.font.body, fontSize: 12, color: theme.colors.textSecondary, marginTop: 8 },
  intro: {
    fontFamily: theme.font.body,
    fontSize: 12.5,
    lineHeight: 17,
    color: theme.colors.textSecondary,
    marginTop: 8,
  },
});

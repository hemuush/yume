import { View, StyleSheet } from 'react-native';
import { Text } from '@/components/Text';
import { CountUpAmount } from '@/components/CountUpAmount';
import { GrowFill } from '@/components/GrowFill';
import { theme } from '@/constants/theme';
import { EYEBROW } from '@/constants/textStyles';
import { StripCard, KickerDot } from '@/components/StripCard';
import { formatMoney, formatMaskableMoney } from '@/lib/money';
import { usePrivacy } from '@/theme/PrivacyContext';
import type { GoalsTotals } from './goalPlan';

/**
 * First block on Savings goals: total saved across active goals and what they need monthly to finish on
 * time. With savings amounts hidden, figures and progress are withheld, as on each goal card.
 */
export function GoalsHero({ totals }: { totals: GoalsTotals }) {
  const { hideAmounts } = usePrivacy();
  return (
    <StripCard tone={theme.colors.slice.saved} style={styles.card}>
      <View style={styles.head}>
        <View style={styles.headText}>
          <View style={styles.kickerRow}>
            <KickerDot color={theme.colors.secondaryDeep} />
            <Text style={styles.kicker}>Saved toward goals</Text>
          </View>
          {hideAmounts ? (
            <Text style={styles.amount}>{formatMaskableMoney(totals.savedMinor, { masked: true })}</Text>
          ) : (
            <CountUpAmount
              minor={totals.savedMinor}
              countFromZero={false}
              style={styles.amount}
              numberOfLines={1}
              adjustsFontSizeToFit
            />
          )}
        </View>
        {!hideAmounts && (
          <View style={styles.side}>
            <Text style={styles.sideLabel}>Saved</Text>
            <Text style={styles.sideValue}>{Math.round(totals.percent)}%</Text>
          </View>
        )}
      </View>
      {!hideAmounts && (
        <View style={styles.track}>
          <GrowFill animKey="goals:hero" pct={totals.percent} style={styles.fill} />
        </View>
      )}
      <Text style={styles.sub}>
        of {formatMoney(totals.targetMinor)} · {totals.goalCount} {totals.goalCount === 1 ? 'goal' : 'goals'}
        {!hideAmounts && totals.perMonthMinor > 0 && (
          <>
            {' · '}
            <Text style={styles.subBold}>{formatMoney(totals.perMonthMinor)}</Text> a month to stay on pace
          </>
        )}
      </Text>
    </StripCard>
  );
}

const styles = StyleSheet.create({
  card: {
    marginHorizontal: 20,
    marginBottom: 10,
    paddingTop: 18,
    paddingBottom: 14,
    paddingHorizontal: 16,
  },
  kickerRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  head: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  headText: { flex: 1, minWidth: 0 },
  kicker: { ...EYEBROW, color: theme.colors.textSecondary },
  amount: { fontFamily: theme.font.monoBold, fontSize: 28, color: theme.colors.textPrimary, marginTop: 2 },
  side: { alignItems: 'flex-end', flexShrink: 0 },
  sideLabel: { ...EYEBROW, color: theme.colors.textSecondary },
  sideValue: {
    fontFamily: theme.font.roundedBold,
    fontSize: 17,
    color: theme.colors.textPrimary,
    marginTop: 2,
  },
  track: {
    height: 8,
    borderRadius: 4,
    backgroundColor: theme.colors.divider,
    marginTop: 10,
    overflow: 'hidden',
  },
  fill: { height: '100%', borderRadius: 4, backgroundColor: theme.colors.slice.saved },
  sub: { fontFamily: theme.font.body, fontSize: 12.5, color: theme.colors.textSecondary, marginTop: 8 },
  subBold: { fontFamily: theme.font.bodyBold, color: theme.colors.textPrimary },
});

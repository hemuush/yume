import { View, StyleSheet } from 'react-native';
import { Text } from '@/components/Text';
import { CountUpAmount } from '@/components/CountUpAmount';
import { GrowFill } from '@/components/GrowFill';
import { SCREEN, screenStyles } from '@/components/screenStyles';
import { theme } from '@/constants/theme';
import { formatMoney, formatMaskableMoney } from '@/lib/money';
import { usePrivacy } from '@/theme/PrivacyContext';
import type { GoalsTotals } from './goalPlan';

/**
 * First card on Savings goals, the same flat summary card as Home, Activity, Reports and Loans: total saved
 * across active goals, the share of their targets, and the monthly amount that keeps them on pace. With
 * savings amounts hidden, the figure is masked and the share, bar and pace are withheld, as on each goal row.
 */
export function GoalsHero({ totals }: { totals: GoalsTotals }) {
  const { hideAmounts } = usePrivacy();
  const goals = `${totals.goalCount} ${totals.goalCount === 1 ? 'goal' : 'goals'}`;
  return (
    <View style={[screenStyles.card, styles.hero]}>
      <View style={styles.top}>
        <View style={styles.topMain}>
          <Text style={styles.label}>Saved toward goals</Text>
          {hideAmounts ? (
            <Text style={styles.figure}>{formatMaskableMoney(totals.savedMinor, { masked: true })}</Text>
          ) : (
            <CountUpAmount
              minor={totals.savedMinor}
              countFromZero={false}
              style={styles.figure}
              numberOfLines={1}
              adjustsFontSizeToFit
            />
          )}
        </View>
        <Text style={styles.side}>
          {!hideAmounts && <Text style={styles.bold}>{Math.round(totals.percent)}%</Text>}
          {!hideAmounts && ' '}of {formatMoney(totals.targetMinor)}
        </Text>
      </View>
      {!hideAmounts && (
        <View style={styles.track}>
          <GrowFill
            animKey="goals:hero"
            pct={Math.max(0, Math.min(100, totals.percent))}
            style={styles.fill}
          />
        </View>
      )}
      <Text style={styles.note}>
        {!hideAmounts && totals.perMonthMinor > 0 && (
          <>
            <Text style={styles.bold}>{formatMoney(totals.perMonthMinor)}</Text> a month to stay on pace
            ·{' '}
          </>
        )}
        {goals}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  hero: {
    marginHorizontal: SCREEN.gutter,
    marginTop: 0,
    marginBottom: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 8,
    boxShadow: '0px 1px 2px rgba(18,19,15,0.04), 0px 8px 24px rgba(18,19,15,0.05)',
    overflow: 'visible',
  },
  top: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    columnGap: 12,
    rowGap: 2,
  },
  topMain: { flexShrink: 1, minWidth: 0 },
  label: { fontFamily: theme.font.body, fontSize: 12, color: theme.colors.textSecondary },
  figure: {
    fontFamily: theme.font.bodyMedium,
    fontSize: 20,
    lineHeight: 26,
    letterSpacing: -0.2,
    fontVariant: ['tabular-nums'],
    color: theme.colors.textPrimary,
  },
  side: { fontFamily: theme.font.body, fontSize: 12, color: theme.colors.textMuted, flexShrink: 1 },
  bold: { fontFamily: theme.font.bodyBold, color: theme.colors.textPrimary },
  track: { height: 6, borderRadius: 3, backgroundColor: theme.colors.trayTrack, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 3, backgroundColor: theme.colors.slice.saved },
  note: { fontFamily: theme.font.body, fontSize: 12, lineHeight: 17, color: theme.colors.textSecondary },
});

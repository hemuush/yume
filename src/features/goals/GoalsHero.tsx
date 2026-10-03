import { View, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Text } from '@/components/Text';
import { CountUpAmount } from '@/components/CountUpAmount';
import { GrowFill } from '@/components/GrowFill';
import { theme } from '@/constants/theme';
import { EYEBROW } from '@/constants/textStyles';
import { shade } from '@/lib/color';
import { formatMoney, formatMaskableMoney } from '@/lib/money';
import { usePrivacy } from '@/theme/PrivacyContext';
import type { GoalsTotals } from './goalPlan';

/**
 * The first block on Savings goals: what is saved across the active goals,
 * and what they need each month to finish on time. With savings amounts
 * hidden, the figures and the progress are withheld, as on each goal card.
 */
export function GoalsHero({ totals }: { totals: GoalsTotals }) {
  const { hideAmounts } = usePrivacy();
  const hue = theme.colors.secondary;
  return (
    <View style={styles.card}>
      <LinearGradient
        colors={[shade(hue, 93), shade(hue, 85)]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <View style={styles.circle} />
      <View style={styles.head}>
        <View style={styles.headText}>
          <Text style={styles.kicker}>Saved toward goals</Text>
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
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginHorizontal: 20,
    marginBottom: 10,
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
    backgroundColor: 'rgba(255,255,255,0.6)',
    marginTop: 10,
    overflow: 'hidden',
  },
  fill: { height: '100%', borderRadius: 4, backgroundColor: theme.colors.ink },
  sub: { fontFamily: theme.font.body, fontSize: 12, color: theme.colors.textSecondary, marginTop: 8 },
  subBold: { fontFamily: theme.font.bodyBold, color: theme.colors.textPrimary },
});

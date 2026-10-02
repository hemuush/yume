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

function Chip({ bold, rest }: { bold: string; rest: string }) {
  return (
    <View style={styles.chip}>
      <Text style={styles.chipText} numberOfLines={1}>
        <Text style={styles.chipBold}>{bold}</Text> {rest}
      </Text>
    </View>
  );
}

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
      <Text style={styles.sub}>
        of {formatMoney(totals.targetMinor)} · {totals.goalCount} {totals.goalCount === 1 ? 'goal' : 'goals'}
      </Text>
      {!hideAmounts && (
        <>
          <View style={styles.track}>
            <GrowFill animKey="goals:hero" pct={totals.percent} style={styles.fill} />
          </View>
          <View style={styles.chips}>
            <Chip bold={`${Math.round(totals.percent)}%`} rest="saved" />
            {totals.perMonthMinor > 0 && (
              <Chip bold={formatMoney(totals.perMonthMinor)} rest="a month to stay on pace" />
            )}
          </View>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginHorizontal: 20,
    marginBottom: 10,
    padding: 16,
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
  kicker: { ...EYEBROW, color: theme.colors.textSecondary },
  amount: { fontFamily: theme.font.monoBold, fontSize: 28, color: theme.colors.textPrimary, marginTop: 4 },
  sub: { fontFamily: theme.font.body, fontSize: 12.5, color: theme.colors.textSecondary, marginTop: 2 },
  track: {
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.6)',
    marginTop: 12,
    overflow: 'hidden',
  },
  fill: { height: '100%', borderRadius: 3, backgroundColor: theme.colors.ink },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 12 },
  chip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: theme.radius.pill,
    backgroundColor: 'rgba(255,255,255,0.6)',
  },
  chipText: { fontFamily: theme.font.body, fontSize: 12, color: theme.colors.textSecondary },
  chipBold: { fontFamily: theme.font.bodyBold, color: theme.colors.textPrimary },
});

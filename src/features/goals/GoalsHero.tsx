import { View } from 'react-native';
import { Text } from '@/components/Text';
import { CountUpAmount } from '@/components/CountUpAmount';
import { Glass } from '@/components/Glass';
import { Kicker, PaceBar, frost } from '@/components/Frost';
import { theme } from '@/constants/theme';
import { formatMoney, formatMaskableMoney } from '@/lib/money';
import { usePrivacy } from '@/theme/PrivacyContext';
import type { GoalsTotals } from './goalPlan';

/**
 * First card on Savings goals: total saved across active goals, the share of their targets, and what they
 * need monthly to finish on time. With savings amounts hidden, figures and progress are withheld, as on
 * each goal card.
 */
export function GoalsHero({ totals }: { totals: GoalsTotals }) {
  const { hideAmounts } = usePrivacy();
  return (
    <Glass radius={28} tone="strong" style={[frost.hero, { marginTop: 0, marginBottom: 12 }]}>
      <View style={frost.heroRow}>
        <View style={frost.heroMain}>
          <Kicker icon="flag">Saved toward goals</Kicker>
          {hideAmounts ? (
            <Text style={frost.bigValue}>{formatMaskableMoney(totals.savedMinor, { masked: true })}</Text>
          ) : (
            <CountUpAmount
              minor={totals.savedMinor}
              countFromZero={false}
              symbolStyle={frost.bigSymbol}
              style={frost.bigValue}
              numberOfLines={1}
              adjustsFontSizeToFit
            />
          )}
        </View>
        {!hideAmounts && (
          <View style={frost.side}>
            <Text style={frost.sideLabel}>Saved</Text>
            <Text style={frost.sideValue}>{Math.round(totals.percent)}%</Text>
          </View>
        )}
      </View>
      {!hideAmounts && <PaceBar animKey="goals:hero" pct={totals.percent} color={theme.colors.slice.saved} />}
      <Text style={frost.sub}>
        of <Text style={frost.subBold}>{formatMoney(totals.targetMinor)}</Text> · {totals.goalCount}{' '}
        {totals.goalCount === 1 ? 'goal' : 'goals'}
        {!hideAmounts && totals.perMonthMinor > 0 && (
          <>
            {' · '}
            <Text style={frost.subBold}>{formatMoney(totals.perMonthMinor)}</Text> a month to stay on pace
          </>
        )}
      </Text>
    </Glass>
  );
}

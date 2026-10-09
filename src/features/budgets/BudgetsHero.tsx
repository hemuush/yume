import { View } from 'react-native';
import { Text } from '@/components/Text';
import { CountUpAmount } from '@/components/CountUpAmount';
import { Glass } from '@/components/Glass';
import { Kicker, FrostChip, PaceBar, frost } from '@/components/Frost';
import { theme } from '@/constants/theme';
import { formatMoney } from '@/lib/money';
import type { BudgetsHeroFigures, BudgetsTone } from './budgetsOverview';

/** The bar's fill takes the month's tone: calm green, amber once ahead of pace, coral once over. */
const FILL: Record<BudgetsTone, string> = {
  ok: theme.colors.slice.saved,
  ahead: theme.colors.slice.due,
  over: theme.colors.slice.spent,
};

/**
 * First card on Budgets: what's left across all limits this month (or what's over), the daily allowance,
 * and a pace bar with a tick where an even month would be today. Chips name what's over or ahead of pace.
 */
export function BudgetsHero({ figures: h }: { figures: BudgetsHeroFigures }) {
  const over = h.spentMinor > h.limitMinor;
  const sub = [
    h.daysLeft === 0 ? 'last day' : `${h.daysLeft} ${h.daysLeft === 1 ? 'day' : 'days'} left`,
    `${h.budgetCount} ${h.budgetCount === 1 ? 'category' : 'categories'}`,
  ].join(' · ');

  return (
    <Glass radius={28} tone="strong" style={frost.hero}>
      <View style={frost.heroRow}>
        <View style={frost.heroMain}>
          <Kicker icon="pie-chart">{over ? 'Over this month' : 'Left this month'}</Kicker>
          <CountUpAmount
            minor={over ? h.overMinor : h.leftMinor}
            countFromZero={false}
            symbolStyle={frost.bigSymbol}
            style={[frost.bigValue, over && { color: theme.colors.expenseText }]}
            numberOfLines={1}
            adjustsFontSizeToFit
          />
        </View>
        {h.perDayMinor != null && (
          <View style={frost.side}>
            <Text style={frost.sideLabel}>A day</Text>
            <Text style={frost.sideValue} numberOfLines={1} adjustsFontSizeToFit>
              {formatMoney(h.perDayMinor)}
            </Text>
          </View>
        )}
      </View>
      <Text style={frost.sub} numberOfLines={2}>
        of <Text style={frost.subBold}>{formatMoney(h.limitMinor)}</Text> · {sub}
      </Text>
      <PaceBar animKey="budgets:hero" pct={h.usedPct} color={FILL[h.tone]} marker={h.expectedPct} />
      <Text style={frost.note2} numberOfLines={1}>
        {formatMoney(h.spentMinor)} spent · the tick is where an even month would be today
      </Text>
      <View style={frost.chips}>
        {h.overCount > 0 && (
          <FrostChip icon="alert-triangle" tone="bad">
            {h.overCount} over
          </FrostChip>
        )}
        {h.aheadCount > 0 && (
          <FrostChip icon="trending-up" tone="warn">
            {h.aheadCount} ahead of pace
          </FrostChip>
        )}
        {h.overCount === 0 && h.aheadCount === 0 && (
          <FrostChip icon="check" tone="ok">
            On track
          </FrostChip>
        )}
      </View>
    </Glass>
  );
}

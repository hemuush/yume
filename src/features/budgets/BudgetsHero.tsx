import { View, StyleSheet } from 'react-native';
import { Text } from '@/components/Text';
import { CountUpAmount } from '@/components/CountUpAmount';
import { GrowFill } from '@/components/GrowFill';
import { theme } from '@/constants/theme';
import { EYEBROW } from '@/constants/textStyles';
import { StripCard, KickerDot } from '@/components/StripCard';
import { formatMoney } from '@/lib/money';
import type { BudgetsHeroFigures, BudgetsTone } from './budgetsOverview';

/** The strip and bar take the month's tone; the kicker's dot its deeper shade. */
const TONE: Record<BudgetsTone, { strip: string; dot: string; fill: string }> = {
  ok: { strip: theme.colors.slice.saved, dot: theme.colors.secondaryDeep, fill: theme.colors.slice.saved },
  ahead: { strip: theme.colors.slice.due, dot: theme.colors.idGoldDeep, fill: theme.colors.idGoldDeep },
  over: { strip: theme.colors.slice.spent, dot: theme.colors.idCoralDeep, fill: theme.colors.expense },
};

function Chip({ bold, rest, warn }: { bold: string; rest?: string; warn?: boolean }) {
  return (
    <View style={[styles.chip, warn && styles.chipWarn]}>
      <Text style={[styles.chipText, warn && styles.chipWarnText]} numberOfLines={1}>
        <Text style={styles.chipBold}>{bold}</Text>
        {rest ? ` ${rest}` : ''}
      </Text>
    </View>
  );
}

function status(h: BudgetsHeroFigures): string {
  if (h.overCount > 0) return `${h.overCount} over`;
  if (h.aheadCount > 0) return `${h.aheadCount} ahead`;
  return 'On track';
}

/**
 * First block on Budgets: what's left across all limits this month, the per-day allowance, and whether
 * spending keeps to the even line (ink tick). The strip warms to gold when ahead of pace, coral once over.
 */
export function BudgetsHero({ figures: h }: { figures: BudgetsHeroFigures }) {
  const tone = TONE[h.tone];
  const over = h.spentMinor > h.limitMinor;
  const sub = [
    `of ${formatMoney(h.limitMinor)}`,
    h.daysLeft === 0 ? 'last day' : `${h.daysLeft} ${h.daysLeft === 1 ? 'day' : 'days'} left`,
    `${h.budgetCount} ${h.budgetCount === 1 ? 'category' : 'categories'}`,
  ].join(' · ');

  return (
    <StripCard tone={tone.strip} style={styles.card}>
      <View style={styles.kickerRow}>
        <KickerDot color={tone.dot} />
        <Text style={styles.kicker}>{over ? 'Over this month' : 'Left this month'}</Text>
      </View>
      <CountUpAmount
        minor={over ? h.overMinor : h.leftMinor}
        countFromZero={false}
        style={styles.amount}
        numberOfLines={1}
        adjustsFontSizeToFit
      />
      <Text style={styles.sub} numberOfLines={1}>
        {sub}
      </Text>
      <View style={styles.trackWrap}>
        <View style={styles.track}>
          <GrowFill
            animKey="budgets:hero"
            pct={h.usedPct}
            style={[styles.fill, { backgroundColor: tone.fill }]}
          />
        </View>
        <View style={[styles.marker, { left: `${Math.min(100, h.expectedPct)}%` }]} />
      </View>
      <View style={styles.chips}>
        {h.perDayMinor != null && <Chip bold={formatMoney(h.perDayMinor)} rest="a day" />}
        <Chip bold={formatMoney(h.spentMinor)} rest="spent" />
        <Chip bold={status(h)} warn={h.overCount > 0} />
      </View>
    </StripCard>
  );
}

const styles = StyleSheet.create({
  card: {
    marginHorizontal: 20,
    marginTop: theme.layout.screenTopGap,
    padding: 16,
    paddingTop: 18,
  },
  kickerRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  kicker: { ...EYEBROW, color: theme.colors.textSecondary },
  amount: { fontFamily: theme.font.monoBold, fontSize: 28, color: theme.colors.textPrimary, marginTop: 4 },
  sub: { fontFamily: theme.font.body, fontSize: 12.5, color: theme.colors.textSecondary, marginTop: 2 },
  trackWrap: { marginTop: 14, justifyContent: 'center' },
  track: {
    height: 6,
    borderRadius: 3,
    backgroundColor: theme.colors.divider,
    overflow: 'hidden',
  },
  fill: { height: '100%', borderRadius: 3 },
  marker: {
    position: 'absolute',
    top: -3,
    bottom: -3,
    width: 2,
    marginLeft: -1,
    borderRadius: 1,
    backgroundColor: theme.colors.ink,
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 12 },
  chip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.surfaceAlt,
  },
  chipWarn: { backgroundColor: theme.colors.expenseTint },
  chipText: { fontFamily: theme.font.body, fontSize: 12, color: theme.colors.textSecondary },
  chipBold: { fontFamily: theme.font.bodyBold, color: theme.colors.textPrimary },
  chipWarnText: { color: theme.colors.expenseText },
});

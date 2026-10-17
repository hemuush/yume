import { StyleSheet } from 'react-native';
import { Text } from '@/components/Text';
import { Amount } from '@/components/Amount';
import { Glass } from '@/components/Glass';
import { cardSurface } from '@/components/CardSurface';
import { theme } from '@/constants/theme';
import { formatMoney } from '@/lib/money';

/**
 * Days opens with the period's total: what was spent, how that compares with the period before (only once
 * the period is over, since a month in progress against a full one would always read as "less"), and the
 * daily average. Every figure is one this screen already computes.
 */
export function DaysSummary({
  periodName,
  inProgress,
  spentMinor,
  changeMinor,
  comparedTo,
  perDayMinor,
}: {
  periodName: string;
  inProgress: boolean;
  spentMinor: number;
  /** Spent less the previous period's total; null when there is nothing to compare or the period is running. */
  changeMinor: number | null;
  comparedTo: string;
  /** Spent per day over the days so far; null when there are none yet. */
  perDayMinor: number | null;
}) {
  const change =
    changeMinor != null && changeMinor !== 0
      ? `${formatMoney(Math.abs(changeMinor))} ${changeMinor > 0 ? 'more' : 'less'} than ${comparedTo}`
      : null;
  const perDay = perDayMinor != null && perDayMinor > 0 ? `${formatMoney(perDayMinor)} a day` : null;
  return (
    <Glass radius={28} style={[s.card, cardSurface.summary]}>
      <Text style={s.kicker}>{`Spent in ${periodName}${inProgress ? ' so far' : ''}`}</Text>
      <Amount minor={spentMinor} style={s.figure} numberOfLines={1} adjustsFontSizeToFit />
      {(change || perDay) && (
        <Text style={s.line}>
          {change && <Text style={changeMinor! > 0 ? s.up : s.down}>{change}</Text>}
          {change && perDay ? ' · ' : ''}
          {perDay}
        </Text>
      )}
    </Glass>
  );
}

const s = StyleSheet.create({
  card: { padding: 16, gap: 4, marginBottom: 12 },
  kicker: { fontFamily: theme.font.bodyMedium, fontSize: 13, color: theme.colors.textSecondary },
  figure: {
    fontFamily: theme.font.bodyLight,
    fontSize: theme.typeSize.headline,
    lineHeight: 40,
    letterSpacing: -1.1,
    color: theme.colors.textPrimary,
    fontVariant: ['tabular-nums'],
  },
  line: { fontFamily: theme.font.bodyMedium, fontSize: 12, color: theme.colors.textSecondary },
  up: { color: theme.colors.expenseText },
  down: { color: theme.colors.incomeText },
});

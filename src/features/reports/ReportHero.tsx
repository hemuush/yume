import { View, StyleSheet } from 'react-native';
import { Text } from '@/components/Text';
import { Amount } from '@/components/Amount';
import { CountUpAmount } from '@/components/CountUpAmount';
import { screenStyles as h } from '@/components/screenStyles';
import { theme } from '@/constants/theme';
import { formatMoney } from '@/lib/money';
import { roundedMinor } from '@/lib/round';
import { hexToRgba } from '@/lib/color';
import { useAccent } from '@/theme/AccentContext';
import { themeInk } from '@/theme/interactionColors';
import type { BudgetCover } from './reportsInsights';

const money = (minor: number) => formatMoney(roundedMinor(minor));

/** Under this share of the budget the bar is calm; from here to the limit it warns; past it, it turns red. */
const NEAR_BUDGET = 0.85;

/**
 * Reports' first card, kept to what answers "how is the month going": what was spent, the pace, the budget
 * as one bar (when there is one), then income and what was kept. The day-by-day picture is the calendar
 * under it, so this card carries no chart.
 */
export function ReportHero({
  periodName,
  inProgress,
  spentMinor,
  perDayMinor,
  budget,
  incomeMinor,
  previousIncomeMinor,
  comparedTo,
  animKey,
}: {
  periodName: string;
  inProgress: boolean;
  spentMinor: number;
  perDayMinor: number | null;
  /** The month's budgets and what has been spent inside them (not the whole month's spending). */
  budget: BudgetCover | null;
  incomeMinor: number;
  previousIncomeMinor: number;
  comparedTo: string;
  animKey: string;
}) {
  const { accent } = useAccent();
  const ink = themeInk(accent);
  const used = budget ? budget.spentMinor / budget.limitMinor : 0;
  const over = budget != null && used > 1;
  const near = budget != null && !over && used >= NEAR_BUDGET;
  const barColor = over ? theme.colors.expense : near ? theme.colors.slice.due : accent;
  const kept = incomeMinor - spentMinor;
  const keptPct = incomeMinor > 0 ? Math.round((kept / incomeMinor) * 100) : null;
  const incomeChange =
    previousIncomeMinor > 0 ? Math.round((incomeMinor / previousIncomeMinor - 1) * 100) : null;
  return (
    <View style={styles.card}>
      <Text style={styles.label}>{`Spent in ${periodName}${inProgress ? ' so far' : ''}`}</Text>
      <CountUpAmount
        minor={roundedMinor(spentMinor)}
        countFromZero
        style={styles.figure}
        symbolStyle={styles.symbol}
        numberOfLines={1}
        adjustsFontSizeToFit
      />
      {perDayMinor != null && perDayMinor > 0 && (
        <Text style={styles.sub}>{`${money(perDayMinor)} a day`}</Text>
      )}
      {budget && (
        <View style={styles.budget} accessible accessibilityLabel={budgetSpoken(budget)}>
          <View style={[styles.track, { backgroundColor: hexToRgba(ink, 0.1) }]}>
            <View
              key={animKey}
              style={[styles.fill, { width: `${Math.min(100, used * 100)}%`, backgroundColor: barColor }]}
            />
          </View>
          <Text style={[styles.budgetText, over && styles.bad]}>
            {`${budget.count} budget${budget.count === 1 ? '' : 's'}: ${money(budget.spentMinor)} of ${money(budget.limitMinor)}`}
            {over ? ` · ${money(budget.spentMinor - budget.limitMinor)} over` : ''}
          </Text>
        </View>
      )}
      <View style={styles.kpis}>
        <View style={styles.kpi}>
          <Text style={styles.kpiLabel}>Income</Text>
          <Amount
            minor={roundedMinor(incomeMinor)}
            style={styles.kpiValue}
            numberOfLines={1}
            adjustsFontSizeToFit
          />
          {incomeChange != null && incomeChange !== 0 && (
            <Text style={[styles.kpiSub, incomeChange > 0 && styles.good]}>
              {`${incomeChange > 0 ? '↑' : '↓'} ${Math.abs(incomeChange)}% vs ${comparedTo}`}
            </Text>
          )}
        </View>
        <View style={[styles.kpi, h.dividerLeft, styles.kpiRight]}>
          <Text style={styles.kpiLabel}>Kept</Text>
          <Text
            style={[styles.kpiValue, kept < 0 ? styles.bad : styles.good]}
            numberOfLines={1}
            adjustsFontSizeToFit
          >
            {kept < 0 ? '−' : ''}
            {money(Math.abs(kept))}
          </Text>
          <Text style={styles.kpiSub}>
            {keptPct != null ? `${keptPct}% of income` : 'income minus spending'}
          </Text>
        </View>
      </View>
    </View>
  );
}

const budgetSpoken = (b: BudgetCover) =>
  `${b.count} budget${b.count === 1 ? '' : 's'}: ${money(b.spentMinor)} of ${money(b.limitMinor)} used`;

const styles = StyleSheet.create({
  card: { ...h.card, marginHorizontal: 0, marginBottom: 12, paddingHorizontal: 16, paddingVertical: 14 },
  label: { fontFamily: theme.font.bodyMedium, fontSize: 13, color: theme.colors.textSecondary },
  figure: {
    fontFamily: theme.font.bodyLight,
    fontSize: theme.typeSize.headline,
    lineHeight: 40,
    letterSpacing: -1.1,
    color: theme.colors.textPrimary,
    fontVariant: ['tabular-nums'],
  },
  symbol: { fontFamily: theme.font.body, fontSize: 22, letterSpacing: 0, color: theme.colors.textMuted },
  sub: { fontFamily: theme.font.body, fontSize: 13, color: theme.colors.textSecondary, marginTop: 2 },
  budget: { marginTop: 12, gap: 6 },
  track: { height: 8, borderRadius: 4, overflow: 'hidden' },
  fill: { height: 8, borderRadius: 4 },
  budgetText: { fontFamily: theme.font.bodyMedium, fontSize: 12, color: theme.colors.textSecondary },
  kpis: {
    flexDirection: 'row',
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: theme.colors.borderSoft,
  },
  kpi: { flex: 1, minWidth: 0, paddingRight: 14, gap: 2 },
  kpiRight: { paddingLeft: 14 },
  kpiLabel: { fontFamily: theme.font.body, fontSize: 12, color: theme.colors.textSecondary },
  kpiValue: {
    fontFamily: theme.font.bodyBold,
    fontSize: 16,
    color: theme.colors.textPrimary,
    fontVariant: ['tabular-nums'],
  },
  kpiSub: { fontFamily: theme.font.body, fontSize: 12, color: theme.colors.textMuted },
  good: { color: theme.colors.incomeText },
  bad: { color: theme.colors.expenseText },
});

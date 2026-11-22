import { View, StyleSheet } from 'react-native';
import { Text } from '@/components/Text';
import { Amount } from '@/components/Amount';
import { CountUpAmount } from '@/components/CountUpAmount';
import { theme } from '@/constants/theme';
import { formatMoney } from '@/lib/money';
import { roundedMinor } from '@/lib/round';
import { SummaryGradient, summaryInk } from '@/components/SummaryGradient';
import type { BudgetCover } from './reportsInsights';
import { useStacked } from '@/hooks/useStacked';
import { themedStyles } from '@/theme/themedStyles';

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
  const stacked = useStacked();
  const used = budget ? budget.spentMinor / budget.limitMinor : 0;
  const over = budget != null && used > 1;
  const near = budget != null && !over && used >= NEAR_BUDGET;
  const barColor = over ? summaryInk.negative : near ? theme.colors.warnInk : summaryInk.text;
  // Side by side, the three columns share the row; stacked (a narrow phone or large text) they are as tall as
  // their own content. A zero flex basis in a column has no height to share, so the lines drew over each other.
  const share = (grow: number) => (stacked ? null : { flexGrow: grow, flexShrink: 1, flexBasis: 0 });
  const kept = incomeMinor - spentMinor;
  const keptPct = incomeMinor > 0 ? Math.round((kept / incomeMinor) * 100) : null;
  const incomeChange =
    previousIncomeMinor > 0 ? Math.round((incomeMinor / previousIncomeMinor - 1) * 100) : null;
  // The period is named in the header; a screen reader still hears it with the figure.
  const spentSpoken = `Spent in ${periodName}${inProgress ? ' so far' : ''}, ${money(spentMinor)}${
    perDayMinor != null && perDayMinor > 0 ? `, ${money(perDayMinor)} a day` : ''
  }`;
  return (
    <View style={styles.card}>
      <SummaryGradient />
      <View style={styles.lead}>
        <View style={styles.kpi} accessible accessibilityLabel={spentSpoken}>
          <Text style={styles.kpiLabel}>{`Spent${inProgress ? ' so far' : ''}`}</Text>
          <CountUpAmount
            minor={roundedMinor(spentMinor)}
            style={styles.figure}
            numberOfLines={stacked ? undefined : 1}
            adjustsFontSizeToFit={!stacked}
          />
          {perDayMinor != null && perDayMinor > 0 && (
            <Text style={styles.kpiSub}>{`${money(perDayMinor)} a day`}</Text>
          )}
        </View>
      </View>
      <View style={[styles.kpis, stacked && styles.kpisStacked]}>
        <View style={[styles.kpi, share(1.25)]}>
          <Text style={styles.kpiLabel}>Income</Text>
          <Amount
            minor={roundedMinor(incomeMinor)}
            style={styles.kpiValue}
            numberOfLines={stacked ? undefined : 1}
            adjustsFontSizeToFit={!stacked}
          />
          {/* A period still going is not like for like with the whole one before, so a percentage ("↓ 65%") would alarm
              for nothing: it says what the other one came to, and the reader sets the two side by side. */}
          {inProgress && previousIncomeMinor > 0 && (
            <Text style={styles.kpiSub}>{`${money(previousIncomeMinor)} in ${comparedTo}`}</Text>
          )}
          {!inProgress && incomeChange != null && incomeChange !== 0 && (
            <Text style={[styles.kpiSub, incomeChange > 0 && styles.good]}>
              {`${incomeChange > 0 ? '↑' : '↓'} ${Math.abs(incomeChange)}% vs ${comparedTo}`}
            </Text>
          )}
        </View>
        <View style={[styles.kpi, share(1)]}>
          <Text style={styles.kpiLabel}>Kept</Text>
          <Text
            style={[styles.kpiValue, kept < 0 ? styles.bad : styles.good]}
            numberOfLines={stacked ? undefined : 1}
            adjustsFontSizeToFit={!stacked}
          >
            {kept < 0 ? '−' : ''}
            {money(Math.abs(kept))}
          </Text>
          <Text style={styles.kpiSub}>
            {keptPct != null ? `${keptPct}% of income` : 'income minus spending'}
          </Text>
        </View>
      </View>
      {budget && (
        <View style={styles.budget} accessible accessibilityLabel={budgetSpoken(budget)}>
          <View style={styles.track}>
            <View
              key={animKey}
              style={[
                styles.fill,
                { width: `${Math.max(0, Math.min(100, used * 100))}%`, backgroundColor: barColor },
              ]}
            />
          </View>
          <Text style={[styles.budgetText, over && styles.bad]}>
            {`${budget.count} budget${budget.count === 1 ? '' : 's'}: ${money(budget.spentMinor)} of ${money(budget.limitMinor)}`}
            {over ? ` · ${money(budget.spentMinor - budget.limitMinor)} over` : ''}
          </Text>
        </View>
      )}
    </View>
  );
}

const budgetSpoken = (b: BudgetCover) =>
  `${b.count} budget${b.count === 1 ? '' : 's'}: ${money(b.spentMinor)} of ${money(b.limitMinor)} used`;

const styles = themedStyles(() =>
  StyleSheet.create({
    card: {
      backgroundColor: summaryInk.background,
      overflow: 'hidden',
      borderRadius: theme.radius.xl,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: summaryInk.divider,
      marginBottom: 12,
      paddingHorizontal: 14,
      paddingVertical: 12,
    },
    lead: { marginBottom: 8 },
    figure: {
      fontFamily: theme.font.bodyBold,
      fontSize: 28,
      lineHeight: 34,
      letterSpacing: -0.2,
      color: summaryInk.text,
      fontVariant: ['tabular-nums'],
    },
    budget: { marginTop: 8, gap: 5 },
    track: { backgroundColor: summaryInk.divider, height: 6, borderRadius: 3, overflow: 'hidden' },
    fill: { height: 6, borderRadius: 3 },
    budgetText: { fontFamily: theme.font.bodyMedium, fontSize: 12, color: summaryInk.secondary },
    kpis: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 12,
      paddingTop: 8,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: summaryInk.divider,
    },
    kpisStacked: { flexDirection: 'column', alignItems: 'stretch', gap: 8 },
    // Income gets the most room (1.25): it carries the long line ("↑ 8% so far vs the month before"), which needs that
    // width to stay on two lines at 360 dp; Spent leads (1.1). See `share`.
    kpi: { minWidth: 0 },
    kpiLabel: { fontFamily: theme.font.body, fontSize: 12, color: summaryInk.secondary },
    kpiValue: {
      fontFamily: theme.font.bodyMedium,
      fontSize: 15,
      lineHeight: 26,
      color: summaryInk.text,
      fontVariant: ['tabular-nums'],
    },
    kpiSub: { fontFamily: theme.font.body, fontSize: 12, lineHeight: 17, color: summaryInk.secondary },
    good: { color: summaryInk.positive },
    bad: { color: summaryInk.negative },
  })
);

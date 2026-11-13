import { View, StyleSheet, useWindowDimensions } from 'react-native';
import { Text } from '@/components/Text';
import { Amount } from '@/components/Amount';
import { CountUpAmount } from '@/components/CountUpAmount';
import { screenStyles as h } from '@/components/screenStyles';
import { theme } from '@/constants/theme';
import { formatMoney } from '@/lib/money';
import { roundedMinor } from '@/lib/round';
import { hexToRgba, shade } from '@/lib/color';
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
  const { width, fontScale } = useWindowDimensions();
  const stacked = width < 360 || fontScale > 1.2;
  const ink = themeInk(accent);
  const used = budget ? budget.spentMinor / budget.limitMinor : 0;
  const over = budget != null && used > 1;
  const near = budget != null && !over && used >= NEAR_BUDGET;
  // Calm is a deeper shade of the theme colour: the plain pastel barely shows on the track.
  const barColor = over ? theme.colors.expense : near ? theme.colors.slice.due : shade(accent, 68);
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
      <View style={[styles.kpis, stacked && styles.kpisStacked]}>
        <View style={[styles.kpi, share(1.1)]} accessible accessibilityLabel={spentSpoken}>
          <Text style={styles.kpiLabel}>{`Spent${inProgress ? ' so far' : ''}`}</Text>
          <CountUpAmount
            minor={roundedMinor(spentMinor)}
            style={styles.figure}
            numberOfLines={1}
            adjustsFontSizeToFit
          />
          {perDayMinor != null && perDayMinor > 0 && (
            <Text style={styles.kpiSub}>{`${money(perDayMinor)} a day`}</Text>
          )}
        </View>
        <View style={[styles.kpi, share(1.25)]}>
          <Text style={styles.kpiLabel}>Income</Text>
          <Amount
            minor={roundedMinor(incomeMinor)}
            style={styles.kpiValue}
            numberOfLines={1}
            adjustsFontSizeToFit
          />
          {incomeChange != null && incomeChange !== 0 && (
            <Text style={[styles.kpiSub, incomeChange > 0 && styles.good]}>
              {/* A period in progress is set against the whole one before: "so far" says it is not like for like. */}
              {`${incomeChange > 0 ? '↑' : '↓'} ${Math.abs(incomeChange)}%${inProgress ? ' so far' : ''} vs ${comparedTo}`}
            </Text>
          )}
        </View>
        <View style={[styles.kpi, share(1)]}>
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
    </View>
  );
}

const budgetSpoken = (b: BudgetCover) =>
  `${b.count} budget${b.count === 1 ? '' : 's'}: ${money(b.spentMinor)} of ${money(b.limitMinor)} used`;

const styles = StyleSheet.create({
  card: { ...h.card, marginHorizontal: 0, marginBottom: 10, paddingHorizontal: 14, paddingVertical: 12 },
  // Compact: Spent leads at 20, Income and Kept beside it at 14, each with one small line under it.
  figure: {
    fontFamily: theme.font.bodyMedium,
    fontSize: 20,
    lineHeight: 26,
    letterSpacing: -0.2,
    color: theme.colors.textPrimary,
    fontVariant: ['tabular-nums'],
  },
  budget: { marginTop: 10, gap: 5 },
  track: { height: 6, borderRadius: 3, overflow: 'hidden' },
  fill: { height: 6, borderRadius: 3 },
  budgetText: { fontFamily: theme.font.bodyMedium, fontSize: 12, color: theme.colors.textSecondary },
  kpis: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  kpisStacked: { flexDirection: 'column', alignItems: 'stretch', gap: 8 },
  // Income gets the most room (1.25): it carries the long line ("↑ 8% so far vs the month before"), which needs that
  // width to stay on two lines at 360 dp; Spent leads (1.1). See `share`.
  kpi: { minWidth: 0 },
  kpiLabel: { fontFamily: theme.font.body, fontSize: 12, color: theme.colors.textSecondary },
  kpiValue: {
    fontFamily: theme.font.bodyMedium,
    fontSize: 14,
    lineHeight: 26,
    color: theme.colors.textPrimary,
    fontVariant: ['tabular-nums'],
  },
  kpiSub: { fontFamily: theme.font.body, fontSize: 12, lineHeight: 17, color: theme.colors.textMuted },
  good: { color: theme.colors.incomeText },
  bad: { color: theme.colors.expenseText },
});

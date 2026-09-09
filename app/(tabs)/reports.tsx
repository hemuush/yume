import { useCallback, useState } from 'react';
import { View, Text, ScrollView, ActivityIndicator, Pressable } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  getRangeComparison,
  PeriodComparison,
  findTopGrowingCategory,
  getMonthlyExpenseTrend,
  getIncomeExpenseTrend,
  getNetWorthTrend,
  getSubcategoryBreakdown,
  TrendPoint,
  IncomeExpensePoint,
  NetWorthPoint,
  CategoryBreakdownItem,
} from '@/db/reports';
import { ModalSheet } from '@/components/ModalSheet';
import { formatMoney } from '@/lib/money';
import { formatPctChange } from '@/lib/format';
import { roundedMinor, allocateRoundedMinor } from '@/lib/round';
import { SegmentedControl } from '@/components/SegmentedControl';
import { SectionLabel } from '@/components/SectionLabel';
import { InsightCard } from '@/components/InsightCard';
import { HorizontalBarList } from '@/components/HorizontalBarList';
import { PieChartDoodle } from '@/components/PieChartDoodle';
import { LineChartDoodle } from '@/components/LineChartDoodle';
import { DualLineChartDoodle } from '@/components/DualLineChartDoodle';
import { AppHeader } from '@/components/AppHeader';
import { PeriodNavigator } from '@/components/PeriodNavigator';
import {
  CURRENT_PERIOD,
  PeriodCursor,
  periodRange,
  previousPeriodRange,
  previousPeriodLabel,
  periodLabel,
} from '@/lib/period';
import { parseLocalIsoDate } from '@/lib/date';
import { theme } from '@/constants/theme';
import { NeoTile } from '@/components/NeoTile';
import { styles } from '@/features/reports/reports.styles';
import { SavingsRing } from '@/features/reports/SavingsRing';

const BREAKDOWN_VIEWS: { label: string; value: 'bars' | 'pie' }[] = [
  { label: 'Bars', value: 'bars' },
  { label: 'Pie', value: 'pie' },
];

const TREND_VIEWS: { label: string; value: 'spend' | 'io' | 'net' }[] = [
  { label: 'Spending', value: 'spend' },
  { label: 'Income/Exp', value: 'io' },
  { label: 'Net worth', value: 'net' },
];

export default function ReportsScreen() {
  const insets = useSafeAreaInsets();
  const [cursor, setCursor] = useState<PeriodCursor>(CURRENT_PERIOD);
  const [comparison, setComparison] = useState<PeriodComparison | null>(null);
  const [trend, setTrend] = useState<TrendPoint[]>([]);
  const [incomeExpenseTrend, setIncomeExpenseTrend] = useState<IncomeExpensePoint[]>([]);
  const [netWorthTrend, setNetWorthTrend] = useState<NetWorthPoint[]>([]);
  const [breakdownView, setBreakdownView] = useState<'bars' | 'pie'>('bars');
  const [trendView, setTrendView] = useState<'spend' | 'io' | 'net'>('spend');
  // Distinguishes "still loading" from "loaded, but this month has no data"
  // from "the query failed" — previously all three rendered as a blank page
  // with no way to tell which had happened.
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [errorText, setErrorText] = useState<string | null>(null);
  // A rolled-up category (one with subcategories) can be drilled into — this
  // holds which one and its own split, fetched on demand rather than
  // upfront for every category on the screen.
  const [drillDown, setDrillDown] = useState<{ categoryId: string; name: string } | null>(null);
  const [drillItems, setDrillItems] = useState<CategoryBreakdownItem[] | null>(null);

  const openDrillDown = useCallback(
    async (cat: { categoryId: string; name: string }) => {
      setDrillDown(cat);
      setDrillItems(null);
      const items = await getSubcategoryBreakdown(cat.categoryId, periodRange(cursor));
      setDrillItems(items);
    },
    [cursor]
  );

  const load = useCallback(async (c: PeriodCursor) => {
    const range = periodRange(c);
    // Trends run backwards from the end of whatever period is being viewed,
    // so browsing to March 2025 shows the months leading up to March 2025 —
    // not the six months before today.
    const anchor = parseLocalIsoDate(range.end);
    const trendMonths = c.granularity === 'year' ? 12 : 6;
    try {
      setStatus((s) => (s === 'ready' ? s : 'loading'));
      const [cmp, tr, iet, nwt] = await Promise.all([
        getRangeComparison(range, previousPeriodRange(c), c.granularity),
        getMonthlyExpenseTrend(trendMonths, anchor),
        getIncomeExpenseTrend(trendMonths, anchor),
        getNetWorthTrend(trendMonths, anchor),
      ]);
      setComparison(cmp);
      setTrend(tr);
      setIncomeExpenseTrend(iet);
      setNetWorthTrend(nwt);
      setStatus('ready');
      setErrorText(null);
    } catch (e: any) {
      setErrorText(String(e?.message ?? e));
      setStatus('error');
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load(cursor);
    }, [load, cursor])
  );

  const header = (
    <>
      <AppHeader title="Reports" />
      <PeriodNavigator cursor={cursor} onChange={setCursor} />
    </>
  );

  if (status === 'error') {
    return (
      <View style={styles.container}>
        {header}
        <View style={styles.centerBox}>
          <Text style={styles.errorTitle}>Couldn't build your report</Text>
          <Text style={styles.errorDetail}>{errorText}</Text>
        </View>
      </View>
    );
  }

  if (!comparison) {
    return (
      <View style={styles.container}>
        {header}
        <View style={styles.centerBox}>
          <ActivityIndicator color={theme.colors.ink} />
        </View>
      </View>
    );
  }

  const { current, previous, incomeChangePct, expenseChangePct } = comparison;
  const comparisonLabel = previousPeriodLabel(cursor);
  // current.netMinor already excludes money moved into savings this period
  // (see reports.ts) — so this is "how much of my income is still
  // uncommitted", not "how much did I keep in total" (which would also
  // count what was already moved to savings).
  const savingsRate = current.incomeMinor > 0 ? (current.netMinor / current.incomeMinor) * 100 : 0;
  // A single large one-off expense (a loan disbursement, a big purchase)
  // against modest income produces a mathematically-correct but nonsense
  // reading like "-4280%" — clamped to a sane range so the ring/label stays
  // legible instead of turning into a four-digit number nobody can use.
  const savingsRateClamped = Math.max(-100, Math.min(100, savingsRate));
  const savingsRateLabel =
    savingsRate > 999 ? '>999%' : savingsRate < -999 ? '<-999%' : `${Math.round(savingsRate)}%`;
  const topCategories = current.categoryBreakdown.slice(0, 6);
  const topGrowing = findTopGrowingCategory(current.categoryBreakdown, previous.categoryBreakdown);
  const hasAnyActivity = current.incomeMinor > 0 || current.expenseMinor > 0;
  // Every figure on this screen is shown rounded to whole rupees; derive the
  // ones that are sums/differences from those same rounded parts so "Net"
  // always equals shown Income − shown Expenses − shown "moved to savings",
  // and the category rows add up to the shown total spend.
  const dispIncome = roundedMinor(current.incomeMinor);
  const dispExpense = roundedMinor(current.expenseMinor);
  const dispSavings = roundedMinor(current.savingsContributionMinor);
  const dispNet = dispIncome - dispExpense - dispSavings;
  const categoryBreakdownDisp = allocateRoundedMinor(
    current.categoryBreakdown.map((c) => c.totalMinor),
    dispExpense
  );

  const netIsPositive = dispNet >= 0;
  const netColor = netIsPositive ? theme.colors.income : theme.colors.expense;

  const insight = topGrowing
    ? {
        icon: '⚠️',
        tone: 'warn' as const,
        text: `${topGrowing.name} is up ${formatPctChange(topGrowing.pctChange)} vs ${comparisonLabel} — the biggest jump.`,
      }
    : expenseChangePct == null
      ? {
          icon: '🐦',
          tone: 'default' as const,
          text: "Log a few more days and I'll start spotting trends here.",
        }
      : {
          icon: '🐦',
          tone: 'default' as const,
          text:
            expenseChangePct <= 0
              ? `spending is down ${formatPctChange(expenseChangePct)} vs ${comparisonLabel} — steady as she goes.`
              : `spending is up ${formatPctChange(expenseChangePct)} vs ${comparisonLabel}.`,
        };

  const trendValues = trend.map((t) => t.totalMinor);
  const netWorthValues = netWorthTrend.map((t) => t.netWorthMinor);
  const ioValues = incomeExpenseTrend.flatMap((t) => [t.incomeMinor, t.expenseMinor]);

  return (
    <View style={styles.container}>
      {header}

      <ScrollView contentContainerStyle={{ paddingBottom: 110 + insets.bottom }}>
        {!hasAnyActivity && (
          <View style={styles.emptyBanner}>
            <Text style={styles.emptyBannerText}>
              Nothing was recorded in this period. Use ‹ › above to look back at a month that has data.
            </Text>
          </View>
        )}

        {/* Net leads — one number that actually answers "how did this month
            go?" — with Income/Expenses as supporting detail underneath,
            instead of three separate boxes fighting for equal attention.
            Stays a plain white card rather than a colored one — Net's own
            sign already carries the good/bad meaning (green or red), so a
            fixed identity color here would just fight that instead of
            reinforcing it. */}
        <NeoTile borderRadius={theme.radius.xl} style={styles.heroCard}>
          <View style={styles.heroTop}>
            <Text style={styles.heroLabel}>NET · {previousPeriodLabelCaps(cursor)}</Text>
            <SavingsRing
              pct={savingsRateClamped}
              color={savingsRate === 0 ? theme.colors.textMuted : netColor}
            />
          </View>
          <Text style={[styles.heroValue, { color: netColor }]} numberOfLines={1} adjustsFontSizeToFit>
            {formatMoney(dispNet)}
          </Text>
          <Text style={styles.heroSub}>
            {current.incomeMinor > 0
              ? `${savingsRateLabel} of income still uncommitted`
              : 'No income logged this period'}
          </Text>
          <View style={styles.heroSplit}>
            <View style={styles.splitItem}>
              <View style={styles.splitLabelRow}>
                <View style={[styles.splitDot, { backgroundColor: theme.colors.income }]} />
                <Text style={styles.splitLabel}>Income</Text>
              </View>
              <Text
                style={[styles.splitValue, { color: theme.colors.income }]}
                numberOfLines={1}
                adjustsFontSizeToFit
              >
                {formatMoney(dispIncome)}
              </Text>
              {incomeChangePct != null && (
                <Text style={styles.splitTrend}>
                  {incomeChangePct >= 0 ? '↑' : '↓'} {formatPctChange(incomeChangePct)} vs {comparisonLabel}
                </Text>
              )}
            </View>
            <View style={styles.splitDivider} />
            <View style={styles.splitItem}>
              <View style={styles.splitLabelRow}>
                <View style={[styles.splitDot, { backgroundColor: theme.colors.expense }]} />
                <Text style={styles.splitLabel}>Expenses</Text>
              </View>
              <Text
                style={[styles.splitValue, { color: theme.colors.expense }]}
                numberOfLines={1}
                adjustsFontSizeToFit
              >
                {formatMoney(dispExpense)}
              </Text>
              {expenseChangePct != null && (
                <Text style={styles.splitTrend}>
                  {expenseChangePct >= 0 ? '↑' : '↓'} {formatPctChange(expenseChangePct)} vs {comparisonLabel}
                </Text>
              )}
            </View>
          </View>
        </NeoTile>

        {dispSavings !== 0 && (
          <View style={styles.savingsRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.savingsLabel}>Moved to savings</Text>
              <Text style={styles.savingsHint}>New transfers this period only, not your running balance</Text>
            </View>
            <Text style={styles.savingsValue}>{formatMoney(dispSavings)}</Text>
          </View>
        )}

        <InsightCard icon={insight.icon} boldPrefix="Flynn says:" text={insight.text} tone={insight.tone} />

        <SectionLabel color={theme.colors.accent} tint={theme.colors.accentTint}>
          WHERE IT WENT
        </SectionLabel>
        {topCategories.length === 0 ? (
          <Text style={styles.emptyText}>No expenses recorded for this period.</Text>
        ) : (
          <>
            <View style={styles.chartToggleWrap}>
              <SegmentedControl options={BREAKDOWN_VIEWS} value={breakdownView} onChange={setBreakdownView} />
            </View>
            <NeoTile style={styles.chartCard}>
              {breakdownView === 'bars' ? (
                <HorizontalBarList
                  items={current.categoryBreakdown.map((c, i) => ({
                    label: c.name,
                    value: categoryBreakdownDisp[i],
                    color: c.color,
                    onPress: c.hasSubcategories ? () => openDrillDown(c) : undefined,
                    sensitive: c.isSensitive,
                  }))}
                />
              ) : (
                <View style={styles.pieView}>
                  <PieChartDoodle
                    size={112}
                    slices={topCategories.map((c) => ({ value: c.totalMinor, color: c.color }))}
                    centerValue={formatMoney(dispExpense)}
                    centerLabel="Spent"
                  />
                  <View style={styles.pieLegend}>
                    {/* Matches exactly what's drawn — topCategories, not the
                        full breakdown — so every legend row has a real slice
                        behind it and the percentages sum to what the pie
                        actually shows. */}
                    {topCategories.map((cat) => {
                      const row = (
                        <View style={styles.pieLegendRow}>
                          <View style={[styles.dot, { backgroundColor: cat.color }]} />
                          <Text style={styles.pieLegendName} numberOfLines={1}>
                            {cat.name}
                            {cat.hasSubcategories ? ' ›' : ''}
                          </Text>
                          <Text style={styles.pieLegendPct}>
                            {Math.round((cat.totalMinor / Math.max(1, current.expenseMinor)) * 100)}%
                          </Text>
                        </View>
                      );
                      return cat.hasSubcategories ? (
                        <Pressable key={cat.categoryId} onPress={() => openDrillDown(cat)}>
                          {row}
                        </Pressable>
                      ) : (
                        <View key={cat.categoryId}>{row}</View>
                      );
                    })}
                  </View>
                </View>
              )}
            </NeoTile>
          </>
        )}

        <SectionLabel color={theme.colors.flatBlue} tint={theme.colors.secondaryTint}>
          TRENDS
        </SectionLabel>
        <View style={styles.chartToggleWrap}>
          <SegmentedControl options={TREND_VIEWS} value={trendView} onChange={setTrendView} />
        </View>
        <NeoTile style={styles.chartCard}>
          {trendView === 'spend' ? (
            <>
              <Text style={styles.trendTotal}>{formatMoney(dispExpense)}</Text>
              <Text style={styles.trendSub}>
                Expenses, last {trend.length} months · {formatMoney(Math.min(...trendValues, 0))} to{' '}
                {formatMoney(Math.max(...trendValues, 0))}
              </Text>
              <LineChartDoodle points={trend.map((t) => ({ label: t.label, value: t.totalMinor }))} />
            </>
          ) : trendView === 'io' ? (
            <>
              <View style={styles.legendRow}>
                <View style={styles.legendItem}>
                  <View style={[styles.legendDot, { backgroundColor: theme.colors.income }]} />
                  <Text style={styles.legendLabel}>Income</Text>
                </View>
                <View style={styles.legendItem}>
                  <View style={[styles.legendDot, { backgroundColor: theme.colors.expense }]} />
                  <Text style={styles.legendLabel}>Expense</Text>
                </View>
              </View>
              <Text style={styles.trendSub}>
                Last {incomeExpenseTrend.length} months · up to {formatMoney(Math.max(...ioValues, 0))}
              </Text>
              <DualLineChartDoodle
                points={incomeExpenseTrend.map((t) => ({
                  label: t.label,
                  a: t.incomeMinor,
                  b: t.expenseMinor,
                }))}
              />
            </>
          ) : (
            <>
              <Text
                style={[
                  styles.trendTotal,
                  {
                    color:
                      (netWorthTrend[netWorthTrend.length - 1]?.netWorthMinor ?? 0) >= 0
                        ? theme.colors.income
                        : theme.colors.expense,
                  },
                ]}
              >
                {formatMoney(netWorthTrend[netWorthTrend.length - 1]?.netWorthMinor ?? 0)}
              </Text>
              <Text style={styles.trendSub}>
                Accounts + loans + people, last {netWorthTrend.length} months ·{' '}
                {formatMoney(Math.min(...netWorthValues, 0))} to {formatMoney(Math.max(...netWorthValues, 0))}
              </Text>
              <LineChartDoodle
                points={netWorthTrend.map((t) => ({ label: t.label, value: t.netWorthMinor }))}
              />
            </>
          )}
        </NeoTile>
      </ScrollView>

      <ModalSheet visible={!!drillDown} onClose={() => setDrillDown(null)} title={drillDown?.name}>
        {drillItems === null ? (
          <ActivityIndicator color={theme.colors.ink} />
        ) : drillItems.length === 0 ? (
          <Text style={styles.emptyText}>Nothing logged here this period.</Text>
        ) : (
          <HorizontalBarList
            items={drillItems.map((c) => ({
              label: c.name,
              value: c.totalMinor,
              color: c.color,
              sensitive: c.isSensitive,
            }))}
          />
        )}
      </ModalSheet>
    </View>
  );
}

/**
 * Uppercased period label for the hero, e.g. "SEPTEMBER" or "2026" — reuses
 * `periodLabel` (anchored to day 1 of the target month) rather than
 * `new Date().setMonth(...)` against *today's* day-of-month, which rolls
 * into the wrong month once today is the 29th-31st and the target month is
 * shorter (e.g. browsing back from Aug 31 to February would land on March).
 */
function previousPeriodLabelCaps(cursor: PeriodCursor): string {
  return periodLabel(cursor).toUpperCase();
}

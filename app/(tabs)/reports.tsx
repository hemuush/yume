import { useCallback, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  ActivityIndicator,
  Pressable,
  StyleSheet,
  LayoutChangeEvent,
  NativeScrollEvent,
  NativeSyntheticEvent,
} from 'react-native';
import ReanimatedAnimated, { FadeIn } from 'react-native-reanimated';
import { useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Feather from '@expo/vector-icons/Feather';
import {
  getRangeComparison,
  PeriodComparison,
  findTopGrowingCategory,
  getMonthlyExpenseTrend,
  getNetWorthTrend,
  getSubcategoryBreakdown,
  getDailyExpenseTotals,
  TrendPoint,
  NetWorthPoint,
  DailyExpensePoint,
  CategoryBreakdownItem,
} from '@/db/reports';
import { listTransactions, listCategories } from '@/db/ledger';
import { Transaction, Category } from '@/types';
import { ModalSheet } from '@/components/ModalSheet';
import { AppHeader } from '@/components/AppHeader';
import { Amount } from '@/components/Amount';
import { CategoryIcon } from '@/components/CategoryIcon';
import { SuuIllustration } from '@/components/SuuIllustration';
import { CountUpAmount } from '@/components/CountUpAmount';
import { formatMoney } from '@/lib/money';
import { formatPctChange } from '@/lib/format';
import { roundedMinor, allocateRoundedMinor } from '@/lib/round';
import {
  CURRENT_PERIOD,
  PeriodCursor,
  periodLabel,
  periodRange,
  previousPeriodRange,
  previousPeriodLabel,
  stepPeriod,
  setGranularity,
  canStepForward,
} from '@/lib/period';
import { parseLocalIsoDate } from '@/lib/date';
import { theme } from '@/constants/theme';
import { useAccent } from '@/theme/AccentContext';
import { shade, spendHeatScale } from '@/lib/color';
import { useSwipeStep } from '@/lib/useSwipeStep';
import { SpendHeatmap, HeatCell } from '@/features/reports/SpendHeatmap';
import { MoonPhase, moonPhaseShades } from '@/features/reports/MoonPhase';
import { SkylineRibbon } from '@/features/reports/SkylineRibbon';
import { AnimatedCategoryFill } from '@/features/reports/AnimatedCategoryFill';
import { ReportsSkeleton } from '@/features/reports/ReportsSkeleton';
import {
  heatLevel,
  baselineFromTrend,
  recurringVsDiscretionary,
  categoryDeltas,
  describeSpendingPattern,
  summariseDayTotal,
} from '@/features/reports/reportsInsights';

const WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const CAT_COLLAPSE_COUNT = 5;

export default function ReportsScreen() {
  const insets = useSafeAreaInsets();
  const { accent } = useAccent();
  const [cursor, setCursor] = useState<PeriodCursor>(CURRENT_PERIOD);
  const [comparison, setComparison] = useState<PeriodComparison | null>(null);
  const [trend, setTrend] = useState<TrendPoint[]>([]);
  const [netWorthTrend, setNetWorthTrend] = useState<NetWorthPoint[]>([]);
  const [daily, setDaily] = useState<DailyExpensePoint[]>([]);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [errorText, setErrorText] = useState<string | null>(null);

  const [drill, setDrill] = useState<{ categoryId: string; name: string } | null>(null);
  const [drillItems, setDrillItems] = useState<CategoryBreakdownItem[] | null>(null);
  const [daySheet, setDaySheet] = useState<string | null>(null);
  const [dayTx, setDayTx] = useState<Transaction[] | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  // "Where it went" shows the top 5 categories by default, like every other
  // long list in the app — reset whenever the period changes so switching
  // months never leaves a stale month's list expanded.
  const [catExpanded, setCatExpanded] = useState(false);

  // A category with no subcategories used to be a dead tap — `openDrill`
  // only ever made sense for one with children to show a split for. This is
  // that same tap for the flat case: the actual transaction list, reusing
  // the day-detail sheet's own row rendering just filtered by category
  // instead of date.
  const [catTxSheet, setCatTxSheet] = useState<{
    categoryId: string;
    name: string;
    isSensitive: boolean;
  } | null>(null);
  const [catTx, setCatTx] = useState<Transaction[] | null>(null);

  // The jump bar below (Overview / Categories / Trends) — `sectionY` is
  // filled in by each section's own onLayout, not measured up front, since
  // heights here depend on real data (how many categories, whether the
  // moon card even renders this period).
  const scrollRef = useRef<ScrollView>(null);
  const sectionY = useRef<Record<string, number>>({});
  const [activeSection, setActiveSection] = useState<'overview' | 'categories' | 'trends'>('overview');
  const onSectionLayout = (key: string) => (e: LayoutChangeEvent) => {
    sectionY.current[key] = e.nativeEvent.layout.y;
  };
  // A tap-to-jump animates the scroll over ~300ms, and onScroll keeps firing
  // throughout that animation with every intermediate position it passes
  // through on the way — left unguarded, the chip you just tapped would
  // flicker through whichever section happens to scroll by mid-animation
  // before landing on the right one. This suppresses onScroll's own
  // recompute for as long as a jump is in flight, so the tapped chip stays
  // lit the whole time instead of visibly flickering through the others.
  const jumpingRef = useRef(false);
  const jumpTo = (key: string) => {
    jumpingRef.current = true;
    setActiveSection(key as 'overview' | 'categories' | 'trends');
    scrollRef.current?.scrollTo({ y: Math.max(0, (sectionY.current[key] ?? 0) - 8), animated: true });
    setTimeout(() => {
      jumpingRef.current = false;
    }, 500);
  };
  // Whichever section's top has scrolled past (with a little lead-in so the
  // switch feels like it happens as that section arrives, not once it's
  // already filled the screen) is the active one — checked in layout order
  // so a section further down never wins over one still above it.
  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (jumpingRef.current) return;
    const y = e.nativeEvent.contentOffset.y;
    let current: 'overview' | 'categories' | 'trends' = 'overview';
    for (const key of ['overview', 'categories', 'trends'] as const) {
      if (y >= (sectionY.current[key] ?? Infinity) - 60) current = key;
    }
    setActiveSection(current);
  };

  const load = useCallback(async (c: PeriodCursor) => {
    setCatExpanded(false);
    const range = periodRange(c);
    const anchor = parseLocalIsoDate(range.end);
    const trendMonths = c.granularity === 'year' ? 12 : 7;
    try {
      setStatus((s) => (s === 'ready' ? s : 'loading'));
      const [cmp, tr, nw, dy, cats] = await Promise.all([
        getRangeComparison(range, previousPeriodRange(c), c.granularity),
        getMonthlyExpenseTrend(trendMonths, anchor),
        getNetWorthTrend(trendMonths, anchor),
        getDailyExpenseTotals(range),
        listCategories(),
      ]);
      setComparison(cmp);
      setTrend(tr);
      setNetWorthTrend(nw);
      setDaily(dy);
      setCategories(cats);
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

  const openDrill = useCallback(
    async (cat: { categoryId: string; name: string }) => {
      setDrill(cat);
      setDrillItems(null);
      setDrillItems(await getSubcategoryBreakdown(cat.categoryId, periodRange(cursor)));
    },
    [cursor]
  );

  const openDay = useCallback(async (iso: string) => {
    setDaySheet(iso);
    setDayTx(null);
    setDayTx(await listTransactions({ fromDate: iso, toDate: iso }));
  }, []);

  const openCategoryTx = useCallback(
    async (cat: { categoryId: string; name: string; isSensitive: boolean }) => {
      setCatTxSheet(cat);
      setCatTx(null);
      const r = periodRange(cursor);
      setCatTx(await listTransactions({ categoryId: cat.categoryId, fromDate: r.start, toDate: r.end }));
    },
    [cursor]
  );

  const dailyByDate = useMemo(() => new Map(daily.map((d) => [d.date, d.totalMinor])), [daily]);
  const catById = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);

  // Pinned (outside the ScrollView, not scrolled away) rather than the
  // jump bar living inline in the scrolling content — it stays reachable
  // and keeps showing which section you're in no matter how far down
  // you've scrolled, not just at the top of the page.
  const header = (
    <>
      <AppHeader title="Reports" />
      <PeriodRow cursor={cursor} onChange={setCursor} />
      {comparison && comparison.current.expenseMinor > 0 && (
        <View style={styles.jumpBar}>
          {(
            [
              ['overview', 'Overview'],
              ['categories', 'Categories'],
              ['trends', 'Trends'],
            ] as const
          ).map(([key, label]) => (
            <Pressable
              key={key}
              onPress={() => jumpTo(key)}
              style={[styles.jumpChip, activeSection === key && styles.jumpChipOn]}
            >
              <Text style={[styles.jumpChipText, activeSection === key && styles.jumpChipTextOn]}>
                {label}
              </Text>
            </Pressable>
          ))}
        </View>
      )}
    </>
  );

  if (status === 'error') {
    return (
      <View style={styles.container}>
        {header}
        <View style={styles.center}>
          <Text style={styles.errTitle}>Couldn&rsquo;t build your report</Text>
          <Text style={styles.errDetail}>{errorText}</Text>
        </View>
      </View>
    );
  }
  if (!comparison) {
    return (
      <View style={styles.container}>
        {header}
        <ReportsSkeleton />
      </View>
    );
  }

  const { current, previous } = comparison;
  const comparisonLabel = previousPeriodLabel(cursor);
  const dispExpense = roundedMinor(current.expenseMinor);
  const hasSpend = current.expenseMinor > 0;

  const range = periodRange(cursor);
  const rangeStart = parseLocalIsoDate(range.start);
  const rangeEnd = parseLocalIsoDate(range.end);
  const daysInPeriod = Math.round((rangeEnd.getTime() - rangeStart.getTime()) / 86400000) + 1;

  const baseline = baselineFromTrend(trend);
  const vsUsualPct = baseline && baseline > 0 ? ((current.expenseMinor - baseline) / baseline) * 100 : null;
  const perDay = daysInPeriod > 0 ? Math.round(dispExpense / daysInPeriod) : 0;
  const spendDays = daily.filter((d) => d.totalMinor > 0).length;

  const reads = describeSpendingPattern(daily, daysInPeriod);

  const { recurringMinor, discretionaryMinor } = recurringVsDiscretionary(current.categoryBreakdown);
  const rTotal = recurringMinor + discretionaryMinor;
  // The moon card's own colours: two shades of the user's accent hue rather
  // than fixed ones. moonShades.dark (a pale tint) is right for the disc and
  // the small legend dot, but too light to read as body text on a cream
  // card — moonTextShades.dark is a mid-dark version of the same hue for
  // the "Discretionary" figure specifically.
  const moonShades = moonPhaseShades(accent);
  const heatScale = spendHeatScale(accent);
  const moonTextShades = { dark: shade(accent, 55, -2) };

  const deltas = categoryDeltas(current.categoryBreakdown, previous.categoryBreakdown);
  const catDisp = allocateRoundedMinor(
    current.categoryBreakdown.map((c) => c.totalMinor),
    dispExpense
  );
  const maxCat = Math.max(1, ...current.categoryBreakdown.map((c) => c.totalMinor));

  const topGrowing = findTopGrowingCategory(current.categoryBreakdown, previous.categoryBreakdown);
  const moverPrev = topGrowing
    ? (previous.categoryBreakdown.find((c) => c.categoryId === topGrowing.categoryId)?.totalMinor ?? 0)
    : 0;
  const moverCur = topGrowing
    ? (current.categoryBreakdown.find((c) => c.categoryId === topGrowing.categoryId)?.totalMinor ?? 0)
    : 0;

  // ---- heatmap cells ----
  let heatCells: HeatCell[] = [];
  let leadingPad = 0;
  let heatCols = 7;
  let heatWeekdays: string[] | undefined = WEEKDAYS;
  if (cursor.granularity === 'year') {
    heatCols = 4;
    heatWeekdays = undefined;
    const maxMonth = Math.max(1, ...trend.map((t) => t.totalMinor));
    heatCells = trend.map((t, i) => ({
      key: `m-${i}`,
      label: t.label,
      level: heatLevel(t.totalMinor, maxMonth),
    }));
  } else {
    const y = rangeStart.getFullYear();
    const m = rangeStart.getMonth();
    const daysInMonth = new Date(y, m + 1, 0).getDate();
    leadingPad = new Date(y, m, 1).getDay();
    const maxDay = Math.max(1, ...daily.map((d) => d.totalMinor));
    heatCells = Array.from({ length: daysInMonth }, (_, i) => {
      const day = i + 1;
      const iso = `${y}-${String(m + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const total = dailyByDate.get(iso) ?? 0;
      const dow = new Date(y, m, day).getDay();
      return {
        key: iso,
        label: String(day),
        level: heatLevel(total, maxDay),
        isWeekend: dow === 0 || dow === 6,
        onPress: total > 0 ? () => openDay(iso) : undefined,
      };
    });
  }

  return (
    <View style={styles.container}>
      {header}
      <ScrollView
        ref={scrollRef}
        onScroll={onScroll}
        scrollEventThrottle={32}
        contentContainerStyle={{
          paddingHorizontal: 20,
          paddingBottom: theme.layout.tabScreenScrollPad + insets.bottom,
        }}
      >
        {!hasSpend ? (
          <Text style={styles.empty}>
            Nothing spent in this period. Use the arrows above to look back at a month with data.
          </Text>
        ) : (
          <>
            {/* ============ overview ============ */}
            <View onLayout={onSectionLayout('overview')}>
              {/* headline */}
              <View style={styles.headlineRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.eyebrow}>Spent in {periodLabel(cursor)}</Text>
                  <CountUpAmount
                    minor={dispExpense}
                    style={styles.big}
                    numberOfLines={1}
                    adjustsFontSizeToFit
                  />
                </View>
                {vsUsualPct != null && (
                  <View
                    style={[
                      styles.vsBadge,
                      {
                        backgroundColor: vsUsualPct > 0 ? theme.colors.expenseTint : theme.colors.incomeTint,
                      },
                    ]}
                  >
                    <Feather
                      name={vsUsualPct > 0 ? 'arrow-up-right' : 'arrow-down-right'}
                      size={12}
                      color={vsUsualPct > 0 ? theme.colors.expense : theme.colors.income}
                    />
                    <Text
                      style={[
                        styles.vsBadgeText,
                        { color: vsUsualPct > 0 ? theme.colors.expense : theme.colors.income },
                      ]}
                    >
                      {formatPctChange(vsUsualPct)} {vsUsualPct > 0 ? 'above' : 'below'} usual
                    </Text>
                  </View>
                )}
              </View>
              <Text style={styles.headlineSub}>
                {formatMoney(perDay)} / day · {spendDays} spending {spendDays === 1 ? 'day' : 'days'}
                {daysInPeriod - spendDays > 0 ? ` · ${daysInPeriod - spendDays} no-spend` : ''}
              </Text>

              {/* heatmap */}
              <View style={styles.hmTitleRow}>
                <Text style={styles.blockTitle}>{periodLabel(cursor)}</Text>
                <View style={styles.legend}>
                  <Text style={styles.legendText}>less</Text>
                  {[0, 1, 2, 3, 4].map((l) => (
                    <View
                      key={l}
                      style={[
                        styles.legendSwatch,
                        l === 0
                          ? { borderWidth: StyleSheet.hairlineWidth, borderColor: theme.colors.borderSoft }
                          : { backgroundColor: heatScale[l] },
                      ]}
                    />
                  ))}
                  <Text style={styles.legendText}>more</Text>
                </View>
              </View>
              <SpendHeatmap
                cells={heatCells}
                leadingPad={leadingPad}
                columns={heatCols}
                weekdayLabels={heatWeekdays}
              />
              {reads.length > 0 && (
                <View style={styles.reads}>
                  {reads.map((r, i) => (
                    <View key={i} style={styles.readRow}>
                      <Text style={styles.readBullet}>▸</Text>
                      <Text style={styles.readText}>{r}</Text>
                    </View>
                  ))}
                </View>
              )}
            </View>

            <View style={styles.rule} />

            {/* ============ categories ============ */}
            <View onLayout={onSectionLayout('categories')}>
              {/* recurring vs discretionary — a moon phase, not a bar: the lit
                fraction of the disc is drawn to the exact recurring/total
                ratio (see MoonPhase's lune construction). Both the moon and
                its legend are shades of the user's own accent colour, not
                fixed hues, so it's always in the same colour family as the
                rest of the app instead of clashing with whatever accent is
                picked. */}
              {rTotal > 0 && (
                <>
                  <View style={styles.moonCard}>
                    <Text style={styles.moonEyebrow}>
                      This month&rsquo;s {formatMoney(roundedMinor(rTotal))}
                    </Text>
                    <MoonPhase litFraction={recurringMinor / rTotal} size={132} accent={accent} />
                    <View style={styles.moonFigs}>
                      <View style={styles.moonFig}>
                        <View style={styles.moonFigLabelRow}>
                          <View style={[styles.rdDot, { backgroundColor: moonShades.lit }]} />
                          <Text style={styles.moonFigLabel}>Recurring</Text>
                        </View>
                        <Text style={[styles.moonFigValue, { color: moonShades.lit }]}>
                          {formatMoney(roundedMinor(recurringMinor))}
                        </Text>
                      </View>
                      <View style={styles.moonFig}>
                        <View style={styles.moonFigLabelRow}>
                          {/* moonShades.dark (the raw moon-disc tint) reads too
                            close to the card's own cream background at this
                            tiny size — moonTextShades.dark is the same darker
                            shade the figure text right below already uses for
                            legibility, reused here for the dot too. */}
                          <View style={[styles.rdDot, { backgroundColor: moonTextShades.dark }]} />
                          <Text style={styles.moonFigLabel}>Discretionary</Text>
                        </View>
                        <Text style={[styles.moonFigValue, { color: moonTextShades.dark }]}>
                          {formatMoney(roundedMinor(discretionaryMinor))}
                        </Text>
                      </View>
                    </View>
                    <Text style={styles.moonCaption}>
                      {formatPctChange((recurringMinor / rTotal) * 100)} of what you spent this month was
                      already spoken for — EMI, rent, subscriptions &amp; insurance.
                    </Text>
                  </View>
                  <View style={styles.rule} />
                </>
              )}

              {/* where it went */}
              <Text style={styles.blockTitle}>Where it went</Text>
              <SkylineRibbon categories={current.categoryBreakdown} totalMinor={dispExpense} />
              <View style={styles.catCard}>
                {(catExpanded
                  ? current.categoryBreakdown
                  : current.categoryBreakdown.slice(0, CAT_COLLAPSE_COUNT)
                ).map((c) => {
                  const i = current.categoryBreakdown.indexOf(c);
                  const d = deltas.get(c.categoryId);
                  const pct = dispExpense > 0 ? Math.round((c.totalMinor / dispExpense) * 100) : 0;
                  return (
                    <Pressable
                      key={c.categoryId}
                      onPress={() =>
                        c.hasSubcategories
                          ? openDrill(c)
                          : openCategoryTx({
                              categoryId: c.categoryId,
                              name: c.name,
                              isSensitive: c.isSensitive,
                            })
                      }
                      style={styles.catRow}
                    >
                      <View style={styles.catTop}>
                        <View style={[styles.catDot, { backgroundColor: c.color }]} />
                        <Text style={styles.catName} numberOfLines={1}>
                          {c.name}
                          {c.hasSubcategories ? ' ›' : ''}
                        </Text>
                        <Text style={styles.catPct}>{pct}%</Text>
                        <View style={styles.catRight}>
                          <Amount minor={catDisp[i]} sensitive={c.isSensitive} style={styles.catAmt} />
                          {d != null && Math.abs(d) >= 10 && (
                            <Text
                              style={[
                                styles.catDelta,
                                { color: d > 0 ? theme.colors.expense : theme.colors.income },
                              ]}
                            >
                              {d > 0 ? '↑' : '↓'}
                              {formatPctChange(d)}
                            </Text>
                          )}
                        </View>
                      </View>
                      <View style={styles.catTrack}>
                        <AnimatedCategoryFill
                          targetPct={Math.max(3, (c.totalMinor / maxCat) * 100)}
                          color={c.color}
                          delay={Math.min(i, 8) * 60}
                        />
                      </View>
                    </Pressable>
                  );
                })}
                {current.categoryBreakdown.length > CAT_COLLAPSE_COUNT && (
                  <Pressable onPress={() => setCatExpanded((v) => !v)} style={styles.catMore}>
                    <Text style={styles.catMoreText}>
                      {catExpanded
                        ? 'Show less ︿'
                        : `${current.categoryBreakdown.length - CAT_COLLAPSE_COUNT} more ⌄`}
                    </Text>
                  </Pressable>
                )}
              </View>
            </View>

            {/* ============ trends ============ */}
            <View onLayout={onSectionLayout('trends')}>
              {trend.length >= 3 && (
                <>
                  <View style={styles.rule} />
                  <Text style={styles.blockTitle}>Against your last {trend.length} months</Text>
                  <Sparkline
                    values={trend.map((t) => t.totalMinor)}
                    labels={trend.map((t) => t.label)}
                    baseline={baseline}
                  />
                  {baseline != null && (
                    <Text style={styles.rdNote}>
                      The dashed line is your average.{' '}
                      {current.expenseMinor > baseline
                        ? `${periodLabel(cursor)} is above it.`
                        : `${periodLabel(cursor)} is below it.`}
                    </Text>
                  )}
                </>
              )}

              {topGrowing && (
                <>
                  <View style={styles.rule} />
                  <View style={styles.mover}>
                    <View style={styles.moverIcon}>
                      <Feather name="trending-up" size={14} color={theme.colors.ink} />
                    </View>
                    <Text style={styles.moverText}>
                      <Text style={styles.moverBold}>{topGrowing.name}</Text> is the mover —{' '}
                      {formatMoney(roundedMinor(moverPrev))} → {formatMoney(roundedMinor(moverCur))} (
                      {formatPctChange(topGrowing.pctChange)} vs {comparisonLabel}).
                    </Text>
                  </View>
                </>
              )}

              {netWorthTrend.length >= 3 && (
                <>
                  <View style={styles.rule} />
                  <Text style={styles.blockTitle}>Net worth</Text>
                  <Sparkline
                    values={netWorthTrend.map((t) => t.netWorthMinor)}
                    labels={netWorthTrend.map((t) => t.label)}
                    baseline={null}
                    emphasisColor={
                      netWorthTrend[netWorthTrend.length - 1].netWorthMinor >= 0
                        ? theme.colors.income
                        : theme.colors.expense
                    }
                  />
                  {(() => {
                    const first = netWorthTrend[0].netWorthMinor;
                    const last = netWorthTrend[netWorthTrend.length - 1].netWorthMinor;
                    const delta = last - first;
                    return (
                      <Text style={styles.rdNote}>
                        {delta >= 0 ? '↑ ' : '↓ '}
                        <Text style={{ color: delta >= 0 ? theme.colors.income : theme.colors.expense }}>
                          {formatMoney(Math.abs(roundedMinor(delta)))}
                        </Text>{' '}
                        over the last {netWorthTrend.length} months
                      </Text>
                    );
                  })()}
                </>
              )}
            </View>
          </>
        )}
      </ScrollView>

      <ModalSheet
        visible={!!drill}
        onClose={() => setDrill(null)}
        variant="center"
        showClose
        scrollable={false}
        title={drill?.name}
        footer={
          drillItems && drillItems.length > 0 ? (
            <View style={styles.dayTotalRow}>
              <Text style={styles.dayTotalLabel}>Total</Text>
              <Text style={styles.dayTotalValue}>
                {formatMoney(drillItems.reduce((s, c) => s + c.totalMinor, 0))}
              </Text>
            </View>
          ) : undefined
        }
      >
        {drillItems === null ? (
          <ActivityIndicator color={theme.colors.ink} style={styles.daySpinner} />
        ) : drillItems.length === 0 ? (
          <View style={styles.dayEmpty}>
            <SuuIllustration size={64} pose="sleepy" />
            <Text style={styles.empty}>Nothing logged here this period.</Text>
          </View>
        ) : (
          drillItems.map((c, i) => (
            <View key={c.categoryId} style={[styles.dayRow, i === 0 && styles.dayRowFirst]}>
              <View style={[styles.catDot, { backgroundColor: c.color }]} />
              <View style={styles.dayMid}>
                <Text style={styles.dayName} numberOfLines={1}>
                  {c.name}
                </Text>
              </View>
              <Amount minor={c.totalMinor} sensitive={c.isSensitive} style={styles.dayAmt} />
            </View>
          ))
        )}
      </ModalSheet>

      <ModalSheet
        visible={!!daySheet}
        onClose={() => setDaySheet(null)}
        variant="center"
        showClose
        scrollable={false}
        title={
          daySheet
            ? parseLocalIsoDate(daySheet).toLocaleDateString(undefined, { day: 'numeric', month: 'long' })
            : ''
        }
        subtitle={
          dayTx && dayTx.length > 0
            ? `${dayTx.length} transaction${dayTx.length === 1 ? '' : 's'}`
            : undefined
        }
        footer={dayTx && dayTx.length > 0 ? <DayTotal txs={dayTx} /> : undefined}
      >
        {dayTx === null ? (
          <ActivityIndicator color={theme.colors.ink} style={styles.daySpinner} />
        ) : dayTx.length === 0 ? (
          <View style={styles.dayEmpty}>
            <SuuIllustration size={72} pose="sleepy" />
            <Text style={styles.empty}>Nothing on this day.</Text>
          </View>
        ) : (
          dayTx.map((tx, i) => {
            const cat = tx.categoryId ? catById.get(tx.categoryId) : undefined;
            const primary =
              cat?.name ??
              (tx.type === 'transfer' ? 'Transfer' : tx.type === 'income' ? 'Income' : 'Expense');
            const note = tx.note && tx.note !== primary ? tx.note : null;
            const sign = tx.type === 'expense' ? '−' : tx.type === 'income' ? '+' : '';
            return (
              <View key={tx.id} style={[styles.dayRow, i === 0 && styles.dayRowFirst]}>
                <CategoryIcon name={cat?.icon ?? 'swap-horizontal'} color={cat?.color} square={34} />
                <View style={styles.dayMid}>
                  <Text style={styles.dayName} numberOfLines={1}>
                    {primary}
                  </Text>
                  {note ? (
                    <Text style={styles.daySub} numberOfLines={1}>
                      {note}
                    </Text>
                  ) : null}
                </View>
                <Text
                  style={[
                    styles.dayAmt,
                    tx.type === 'income' && { color: theme.colors.income },
                    tx.type === 'expense' && { color: theme.colors.idCoralDeep },
                    tx.type === 'transfer' && { color: theme.colors.textSecondary },
                  ]}
                >
                  {sign}
                  <Amount minor={tx.amountMinor} sensitive={cat?.isSensitive} />
                </Text>
              </View>
            );
          })
        )}
      </ModalSheet>

      <ModalSheet
        visible={!!catTxSheet}
        onClose={() => setCatTxSheet(null)}
        variant="center"
        showClose
        scrollable={false}
        title={catTxSheet?.name}
        subtitle={
          catTx && catTx.length > 0
            ? `${catTx.length} transaction${catTx.length === 1 ? '' : 's'}`
            : undefined
        }
        footer={catTx && catTx.length > 0 ? <DayTotal txs={catTx} /> : undefined}
      >
        {catTx === null ? (
          <ActivityIndicator color={theme.colors.ink} style={styles.daySpinner} />
        ) : catTx.length === 0 ? (
          <View style={styles.dayEmpty}>
            <SuuIllustration size={72} pose="sleepy" />
            <Text style={styles.empty}>Nothing logged in this category this period.</Text>
          </View>
        ) : (
          catTx.map((tx, i) => (
            <View key={tx.id} style={[styles.dayRow, i === 0 && styles.dayRowFirst]}>
              <View style={styles.dayMid}>
                <Text style={styles.dayName} numberOfLines={1}>
                  {parseLocalIsoDate(tx.date).toLocaleDateString(undefined, {
                    day: 'numeric',
                    month: 'short',
                  })}
                </Text>
                {tx.note ? (
                  <Text style={styles.daySub} numberOfLines={1}>
                    {tx.note}
                  </Text>
                ) : null}
              </View>
              <Text style={[styles.dayAmt, { color: theme.colors.idCoralDeep }]}>
                −<Amount minor={tx.amountMinor} sensitive={catTxSheet?.isSensitive} />
              </Text>
            </View>
          ))
        )}
      </ModalSheet>
    </View>
  );
}

/** The pinned footer of the day-detail popup — the day's net, or its total spend. */
function DayTotal({ txs }: { txs: Transaction[] }) {
  const { label, amountMinor, sign } = summariseDayTotal(txs);
  return (
    <View style={styles.dayTotalRow}>
      <Text style={styles.dayTotalLabel}>{label}</Text>
      <Text
        style={[
          styles.dayTotalValue,
          { color: sign === '+' ? theme.colors.income : theme.colors.idCoralDeep },
        ]}
      >
        {sign}
        {formatMoney(amountMinor)}
      </Text>
    </View>
  );
}

function PeriodRow({ cursor, onChange }: { cursor: PeriodCursor; onChange: (c: PeriodCursor) => void }) {
  const fwd = canStepForward(cursor);
  // A drag anywhere on the pill steps the period the same as tapping its own
  // chevrons, without needing to land on the small 36px arrow itself.
  const swipe = useSwipeStep(
    () => onChange(stepPeriod(cursor, -1)),
    () => fwd && onChange(stepPeriod(cursor, 1))
  );
  return (
    <View style={styles.periodRow}>
      <View style={styles.periodPill} {...swipe.panHandlers}>
        <Pressable onPress={() => onChange(stepPeriod(cursor, -1))} hitSlop={8} style={styles.periodArrow}>
          <Feather name="chevron-left" size={16} color={theme.colors.ink} />
        </Pressable>
        <ReanimatedAnimated.Text
          key={periodLabel(cursor)}
          entering={FadeIn.duration(150)}
          style={styles.periodLabel}
        >
          {periodLabel(cursor)}
        </ReanimatedAnimated.Text>
        <Pressable
          onPress={() => onChange(stepPeriod(cursor, 1))}
          disabled={!fwd}
          hitSlop={8}
          style={[styles.periodArrow, !fwd && { opacity: 0.25 }]}
        >
          <Feather name="chevron-right" size={16} color={theme.colors.ink} />
        </Pressable>
      </View>
      <View style={styles.gran}>
        {(['month', 'year'] as const).map((g) => {
          const active = cursor.granularity === g;
          return (
            <Pressable
              key={g}
              onPress={() => onChange(setGranularity(cursor, g))}
              style={[styles.granBtn, active && styles.granBtnOn]}
            >
              <Text style={[styles.granText, active && styles.granTextOn]}>
                {g === 'month' ? 'Month' : 'Year'}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

/** ₹21,079 → "21k", ₹4,82,600 → "4.8L" — full rupee formatting doesn't fit above a ~35px-wide bar. */
function compactRupees(minor: number): string {
  const rupees = Math.abs(minor) / 100;
  const sign = minor < 0 ? '-' : '';
  if (rupees >= 100000) return `${sign}₹${(rupees / 100000).toFixed(rupees % 100000 === 0 ? 0 : 1)}L`;
  if (rupees >= 1000) return `${sign}₹${Math.round(rupees / 1000)}k`;
  return `${sign}₹${Math.round(rupees)}`;
}

const BAR_MAX_HEIGHT = 56;

/**
 * The month-over-month trend, drawn as a plain labeled bar per month — the
 * signed-off replacement for the previous "constellation" dot-and-line
 * chart, which read as a shape but never told you what a given month
 * actually was without close inspection. Every bar carries its own value;
 * the current month's bar and label pick up `emphasisColor`. Same
 * `values`/`labels`/`baseline`/`emphasisColor` signature as before, so both
 * call sites (spend trend, net worth) are untouched.
 */
function Sparkline({
  values,
  labels,
  baseline,
  emphasisColor = theme.colors.idCoralDeep,
}: {
  values: number[];
  labels: string[];
  baseline: number | null;
  /** Color of the current (last) bar + its value label — defaults to the
   *  same coral every existing caller (the spend trend, always non-negative)
   *  already uses. Net worth passes its own sign-aware color instead, since
   *  unlike a spend trend, net worth's sign is actually meaningful. */
  emphasisColor?: string;
}) {
  const max = Math.max(1, ...values);
  const min = Math.min(...values, 0);
  const span = Math.max(1, max - min);
  const barHeight = (v: number) => Math.max(3, ((v - min) / span) * BAR_MAX_HEIGHT);
  const lastIndex = values.length - 1;
  const baseBottom = baseline != null ? ((baseline - min) / span) * BAR_MAX_HEIGHT : null;
  // A 12-point year view would crowd every month's initial under the chart —
  // thin the axis to every other label past 8 points, always keeping the
  // current (last) one.
  const showLabel = (i: number) => values.length <= 8 || i === lastIndex || i % 2 === 0;
  return (
    <View>
      <View style={styles.barChart}>
        {baseBottom != null && <View style={[styles.barBaseline, { bottom: baseBottom }]} />}
        {values.map((v, i) => (
          <View key={i} style={styles.barCol}>
            <Text
              style={[styles.barValue, i === lastIndex && { color: emphasisColor }]}
              numberOfLines={1}
              adjustsFontSizeToFit
            >
              {compactRupees(v)}
            </Text>
            <View
              style={[
                styles.bar,
                {
                  height: barHeight(v),
                  backgroundColor: i === lastIndex ? emphasisColor : theme.colors.borderSoft,
                },
              ]}
            />
          </View>
        ))}
      </View>
      <View style={styles.sparkAxis}>
        {labels.map((label, i) => (
          <Text
            key={i}
            style={[styles.sparkAxisLabel, i === lastIndex && styles.sparkAxisLabelOn]}
            numberOfLines={1}
          >
            {showLabel(i) ? label : ''}
          </Text>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  errTitle: { fontFamily: theme.font.bodyBold, fontSize: 14, color: theme.colors.expense },
  errDetail: { fontSize: 12, color: theme.colors.textSecondary, marginTop: 4, textAlign: 'center' },
  empty: { fontSize: 13, color: theme.colors.textMuted, marginVertical: 16 },

  periodRow: { flexDirection: 'row', gap: 8, paddingHorizontal: 20, marginBottom: 16 },
  periodPill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.borderSoft,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.pill,
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  periodArrow: { width: 28, height: 28, alignItems: 'center', justifyContent: 'center' },
  periodLabel: { fontFamily: theme.font.roundedBold, fontSize: 13, color: theme.colors.textPrimary },
  gran: {
    flexDirection: 'row',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.borderSoft,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.pill,
    padding: 3,
  },
  granBtn: { paddingHorizontal: 11, paddingVertical: 6, borderRadius: theme.radius.pill },
  granBtnOn: { backgroundColor: theme.colors.secondaryTint },
  granText: { fontFamily: theme.font.bodyMedium, fontSize: 11, color: theme.colors.textMuted },
  granTextOn: { color: theme.colors.textPrimary },

  // The Overview/Categories/Trends jump bar — pinned in `header`, outside
  // the ScrollView, so it's reachable and shows the current section no
  // matter how far down the page you've scrolled.
  jumpBar: { flexDirection: 'row', gap: 8, paddingHorizontal: 20, marginBottom: 14 },
  jumpChip: {
    paddingHorizontal: 13,
    paddingVertical: 7,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.borderSoft,
  },
  jumpChipOn: { backgroundColor: theme.colors.ink, borderColor: theme.colors.ink },
  jumpChipText: { fontFamily: theme.font.bodyBold, fontSize: 11.5, color: theme.colors.textSecondary },
  jumpChipTextOn: { color: theme.colors.surface },

  headlineRow: { flexDirection: 'row', alignItems: 'flex-end', marginTop: 4 },
  eyebrow: {
    fontFamily: theme.font.mono,
    fontSize: 9,
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: theme.colors.textMuted,
  },
  big: { fontFamily: theme.font.monoBold, fontSize: 30, color: theme.colors.textPrimary, marginTop: 2 },
  // Same red/green + arrow badge language This Month's KPI tiles and the
  // stat cards already use, instead of a small two-line corner label.
  vsBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: theme.radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginBottom: 3,
  },
  vsBadgeText: { fontFamily: theme.font.bodyBold, fontSize: 11.5 },
  headlineSub: {
    fontFamily: theme.font.body,
    fontSize: 10.5,
    color: theme.colors.textMuted,
    marginTop: 4,
    marginBottom: 22,
  },

  blockTitle: {
    fontFamily: theme.font.roundedBold,
    fontSize: 12,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    color: theme.colors.textSecondary,
    marginBottom: 10,
  },
  hmTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginBottom: 9,
  },
  legend: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  legendText: { fontFamily: theme.font.body, fontSize: 8, color: theme.colors.textMuted },
  legendSwatch: { width: 9, height: 9, borderRadius: 3 },

  reads: { marginTop: 14, gap: 6 },
  readRow: { flexDirection: 'row', gap: 6 },
  readBullet: { fontSize: 10, color: theme.colors.idCoralDeep, lineHeight: 16 },
  readText: {
    flex: 1,
    fontFamily: theme.font.body,
    fontSize: 11.5,
    color: theme.colors.textSecondary,
    lineHeight: 16,
  },

  rule: { height: StyleSheet.hairlineWidth, backgroundColor: theme.colors.borderSoft, marginVertical: 22 },

  // The recurring/discretionary dot is the one style still shared with the
  // moon-split card's legend below.
  rdDot: { width: 8, height: 8, borderRadius: 3 },
  rdNote: { fontFamily: theme.font.body, fontSize: 9.5, color: theme.colors.textMuted, marginTop: 6 },

  moonCard: {
    backgroundColor: theme.colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.borderSoft,
    borderRadius: theme.radius.xl2,
    padding: 18,
    alignItems: 'center',
  },
  moonEyebrow: {
    fontFamily: theme.font.bodyBold,
    fontSize: 11,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    color: theme.colors.textMuted,
    marginBottom: 10,
  },
  moonFigs: { flexDirection: 'row', gap: 22, marginTop: 14 },
  moonFig: { alignItems: 'flex-start' },
  moonFigLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  moonFigLabel: { fontFamily: theme.font.bodyMedium, fontSize: 11, color: theme.colors.textSecondary },
  moonFigValue: { fontFamily: theme.font.monoBold, fontSize: 15, marginTop: 3 },
  moonCaption: {
    fontFamily: theme.font.body,
    fontSize: 11,
    color: theme.colors.textMuted,
    textAlign: 'center',
    lineHeight: 16,
    marginTop: 14,
    maxWidth: 260,
  },

  catCard: {
    backgroundColor: theme.colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.borderSoft,
    borderRadius: theme.radius.xl,
    paddingHorizontal: 14,
  },
  catRow: { paddingVertical: 10 },
  catTop: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 },
  catName: { flex: 1, fontFamily: theme.font.bodyMedium, fontSize: 11.5, color: theme.colors.textPrimary },
  catDot: { width: 8, height: 8, borderRadius: 4 },
  catPct: {
    fontFamily: theme.font.mono,
    fontSize: 9,
    color: theme.colors.textMuted,
    width: 28,
    textAlign: 'right',
  },
  catRight: { flexDirection: 'row', alignItems: 'center', gap: 5, marginLeft: 8 },
  catAmt: { fontFamily: theme.font.monoBold, fontSize: 10.5, color: theme.colors.textPrimary },
  catDelta: { fontFamily: theme.font.mono, fontSize: 8 },
  catTrack: {
    height: 5,
    borderRadius: 3,
    backgroundColor: theme.colors.inkWash,
    overflow: 'hidden',
  },
  catMore: { paddingVertical: 12, alignItems: 'center' },
  catMoreText: { fontFamily: theme.font.bodyMedium, fontSize: 11.5, color: theme.colors.textMuted },

  barChart: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 6,
    height: BAR_MAX_HEIGHT + 18,
    marginTop: 4,
  },
  barBaseline: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: StyleSheet.hairlineWidth,
    backgroundColor: theme.colors.borderSoft,
  },
  barCol: { flex: 1, alignItems: 'center', justifyContent: 'flex-end' },
  barValue: {
    fontFamily: theme.font.mono,
    fontSize: 8,
    color: theme.colors.textMuted,
    marginBottom: 3,
  },
  bar: { width: '68%', borderRadius: 3, minHeight: 3 },
  sparkAxis: { flexDirection: 'row', marginTop: 4 },
  sparkAxisLabel: {
    flex: 1,
    fontFamily: theme.font.mono,
    fontSize: 8.5,
    color: theme.colors.textMuted,
    textAlign: 'center',
  },
  sparkAxisLabelOn: { color: theme.colors.idCoralDeep, fontFamily: theme.font.monoBold },

  mover: { flexDirection: 'row', gap: 9, alignItems: 'flex-start' },
  moverIcon: {
    width: 26,
    height: 26,
    borderRadius: 8,
    backgroundColor: theme.colors.goldTint,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.borderSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  moverText: {
    flex: 1,
    fontFamily: theme.font.body,
    fontSize: 11,
    color: theme.colors.textSecondary,
    lineHeight: 16,
  },
  moverBold: { fontFamily: theme.font.bodyBold, color: theme.colors.textPrimary },

  // day-detail / drill popup
  dayRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 9,
    paddingHorizontal: 18,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: theme.colors.borderSoft,
  },
  dayRowFirst: { borderTopWidth: 0 },
  dayMid: { flex: 1, minWidth: 0 },
  dayName: {
    fontFamily: theme.font.bodyBold,
    fontSize: 12.5,
    color: theme.colors.textPrimary,
  },
  daySub: {
    fontFamily: theme.font.body,
    fontSize: 10,
    color: theme.colors.textMuted,
    marginTop: 1,
  },
  dayAmt: { fontFamily: theme.font.monoBold, fontSize: 12, color: theme.colors.textPrimary },
  daySpinner: { paddingVertical: 24 },
  dayEmpty: { alignItems: 'center', paddingVertical: 8, gap: 4 },
  dayTotalRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  dayTotalLabel: {
    fontFamily: theme.font.bodyMedium,
    fontSize: 11.5,
    color: theme.colors.textSecondary,
  },
  dayTotalValue: { fontFamily: theme.font.monoBold, fontSize: 13, color: theme.colors.textPrimary },
});

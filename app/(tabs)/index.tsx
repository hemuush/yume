import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, StyleSheet, RefreshControl } from 'react-native';
import Animated, { useSharedValue, useAnimatedScrollHandler } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Appear } from '@/components/Appear';
import { PrimaryButton } from '@/components/PrimaryButton';
import { Section } from '@/components/Section';
import { Text } from '@/components/Text';
import { SCREEN } from '@/components/screenStyles';
import { theme } from '@/constants/theme';
import {
  homeRowEntering,
  homeSectionEntering,
  hasPlayedHomeOpening,
  markHomeOpeningPlayed,
  ROW_LAYOUT,
} from '@/lib/animation';
import { categorySentence } from '@/lib/categoryLabel';
import { toLocalIsoDate } from '@/lib/date';
import { investmentIdsOf } from '@/lib/investment';
import { monthPace } from '@/lib/pace';
import { CURRENT_PERIOD, PeriodCursor, periodRange, stepPeriod, canStepForward } from '@/lib/period';
import { recurringRulesInCurrency } from '@/lib/recurringScope';
import { roundedMinor } from '@/lib/round';
import { useStableSet, useStableValue } from '@/lib/stableData';
import { useReduceMotion } from '@/lib/useReduceMotion';
import { useTabScrollPad } from '@/lib/uiScale';
import { savingsAccountIdsOf } from '@/lib/account';
import { useAccent } from '@/theme/AccentContext';
import { HomeHeader } from '@/features/home/HomeHeader';
import { ThisMonthHero } from '@/features/home/ThisMonthHero';
import { ThisMonthHeroSkeleton, AccountTilesSkeleton, CardRowsSkeleton } from '@/features/home/HomeSkeleton';
import { MonthPill } from '@/features/home/MonthPill';
import { HomeAccounts } from '@/features/home/HomeAccounts';
import { HomeComingUp } from '@/features/home/HomeComingUp';
import { HomeRecentActivity } from '@/features/home/HomeRecentActivity';
import { HomeSheets } from '@/features/home/HomeSheets';
import { createHomeSheets } from '@/features/home/homeSheetsStore';
import { SuuRefreshBadge } from '@/features/home/SuuRefreshBadge';
import { buildUpcomingItems } from '@/features/home/upcomingItems';
import type { ComingUpFilter } from '@/features/home/comingUp';
import { viewAllTarget } from '@/features/home/recentActivity';
import { useHomeData } from '@/features/home/useHomeData';
import { useOpenRefund } from '@/features/home/useOpenRefund';
import { buildLoansSummary } from '@/features/plan/planOverview';
import type { Transaction } from '@/types';
import { themedStyles } from '@/theme/themedStyles';

/** Scrolled past this, the month card's own period pill is under the header: the change came from the header's chip. */
const CARD_OUT_OF_VIEW = 80;

// Each section of the page compares its props by identity and is drawn again only when one of them changed: the page
// hands them values that keep their identity until what is in them changes (see useHomeData).
const Header = memo(HomeHeader);
const MonthCard = memo(ThisMonthHero);
const Accounts = memo(HomeAccounts);
const ComingUp = memo(HomeComingUp);

const openAccounts = () => router.push('/profile');

const openComingUp = (filter: ComingUpFilter) => {
  if (filter === 'budget') router.navigate('/budgets');
  else if (filter === 'goal') router.navigate('/savings-goals');
  else router.navigate({ pathname: '/plan', params: { tab: 'upcoming' } });
};

const openSpendingReports = (key: string) => {
  const [kind, offset] = key.split(':');
  const shown: PeriodCursor = { granularity: kind === 'year' ? 'year' : 'month', offset: Number(offset) };
  const range = periodRange(shown);
  router.navigate({
    pathname: '/reports',
    params:
      shown.granularity === 'month' ? { month: String(shown.offset) } : { from: range.start, to: range.end },
  });
};

const rowEntering = (i: number) => homeRowEntering(i, !hasPlayedHomeOpening());
const sectionEntering = (i: number) => homeSectionEntering(i, !hasPlayedHomeOpening());

export default function DashboardScreen() {
  const insets = useSafeAreaInsets();
  const tabScrollPad = useTabScrollPad();
  const { accent, secondary } = useAccent();
  const [refreshing, setRefreshing] = useState(false);
  const [cursor, setCursor] = useState<PeriodCursor>(CURRENT_PERIOD);
  // The period the header's chip shows: the month card turns its page on it, so a new month name never shows the old
  // month's numbers.
  const [displayedPeriodKey, setDisplayedPeriodKey] = useState('month:0');
  const displayedCursor = useMemo<PeriodCursor>(() => {
    const [kind, offset] = displayedPeriodKey.split(':');
    return { granularity: kind === 'year' ? 'year' : 'month', offset: Number(offset) };
  }, [displayedPeriodKey]);
  // Hero slide direction on month change: +1/-1 for a same-granularity step, else 0 (crossfade). State, not
  // a ref (ThisMonthHero reads it in render); set with `setCursor` so one re-render carries both.
  const [heroDirection, setHeroDirection] = useState<-1 | 0 | 1>(0);

  const data = useHomeData(cursor);
  const {
    accounts,
    historyAccounts,
    categories,
    recent,
    loans,
    budgets,
    goals,
    recurringRules,
    summary,
    carryInMinor,
    loanProgress,
    cardBills,
    currency,
    refunds,
    refundError,
    dailySpend,
    todaySpendMinor,
    dailyGoalMinor,
    paceInputs,
    stillToPayMinor,
    needsYouCount,
    readyWraps,
    userName,
    loadedCursor,
    loadError,
    comingUpError,
    comingUpReady,
    hideAmounts,
    loaded,
    reload,
  } = data;

  // The sheets (an account's summary and edit form, an entry's detail, the new-account form): which is open is kept
  // outside React state, so opening or closing one does not redraw the page behind it.
  const [sheets] = useState(createHomeSheets);
  const openRefund = useOpenRefund(sheets);
  const { cancel: cancelOpeningRefund, open: openRefundPurchase } = openRefund;
  const openEntry = useCallback(
    (tx: Transaction) => {
      cancelOpeningRefund();
      sheets.openEntry(tx);
    },
    [cancelOpeningRefund, sheets]
  );

  // The staggered opening fade plays only on the first load after app open; later rows (new month, refresh)
  // get one quick fade. Marked played shortly after the first load, once the opening rows have mounted. Read from the
  // module's own flag, not React state: turning it over must not redraw the whole page for nothing.
  useEffect(() => {
    if (!loaded || hasPlayedHomeOpening()) return;
    const t = setTimeout(markHomeOpeningPlayed, 800);
    return () => clearTimeout(t);
  }, [loaded]);

  // The header overlays the ScrollView and collapses on scroll (see HomeHeader); its expanded height pads
  // the content so nothing hides under it. The estimate only covers the first frame before it measures.
  const scrollY = useSharedValue(0);
  // Tapping the logo scrolls Home back to the top.
  const scrollRef = useRef<Animated.ScrollView>(null);
  const reduceMotion = useReduceMotion();
  // Also re-read the offset where the list stops: a throttled last scroll event can miss it, which would leave the
  // header a little collapsed with the list at its top (see useCollapsingHeader).
  const onScroll = useAnimatedScrollHandler({
    onScroll: (e) => {
      scrollY.value = e.contentOffset.y;
    },
    onEndDrag: (e) => {
      scrollY.value = e.contentOffset.y;
    },
    onMomentumEnd: (e) => {
      scrollY.value = e.contentOffset.y;
    },
  });
  const [headerHeight, setHeaderHeight] = useState(insets.top + 200);

  // Read through a ref so the handlers below keep one identity as the period changes: the sections that take them
  // would otherwise be drawn again for nothing.
  const cursorRef = useRef(cursor);
  useEffect(() => {
    cursorRef.current = cursor;
  });
  const handleCursorChange = useCallback(
    (next: PeriodCursor) => {
      const current = cursorRef.current;
      // Changed from the shrunk header's month chip, the month card it describes is scrolled out of sight: bring
      // it back, or the new month would change only what is lower down. Changed on the card itself (its own pill or
      // a swipe), the page stays where it is.
      if (scrollY.get() > CARD_OUT_OF_VIEW) scrollRef.current?.scrollTo({ y: 0, animated: !reduceMotion });
      setHeroDirection(
        next.granularity !== current.granularity
          ? 0
          : next.offset > current.offset
            ? 1
            : next.offset < current.offset
              ? -1
              : 0
      );
      setCursor(next);
    },
    [scrollY, reduceMotion]
  );
  const stepHero = useCallback(
    (dir: -1 | 1) => handleCursorChange(stepPeriod(cursorRef.current, dir)),
    [handleCursorChange]
  );
  const scrollToTop = useCallback(
    () => scrollRef.current?.scrollTo({ y: 0, animated: !reduceMotion }),
    [reduceMotion]
  );
  const renderPeriod = useCallback(
    (key: string) => {
      const [kind, offset] = key.split(':');
      return (
        <MonthPill
          cursor={{ granularity: kind === 'year' ? 'year' : 'month', offset: Number(offset) }}
          onChange={handleCursorChange}
        />
      );
    },
    [handleCursorChange]
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await reload();
    setRefreshing(false);
  };

  // What the sections below say of accounts, categories and savings: only names, currencies and which are savings or
  // investments. Balances move with every entry, and must not redraw sections that do not show them.
  const categoriesById = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);
  const accountLabels = useStableValue(
    historyAccounts.map((a) => ({ id: a.id, name: a.name, currency: a.currency }))
  );
  const accountsById = useMemo(() => new Map(accountLabels.map((a) => [a.id, a])), [accountLabels]);
  const savingsIds = useStableSet(useMemo(() => savingsAccountIdsOf(historyAccounts), [historyAccounts]));
  const investIds = useStableSet(useMemo(() => investmentIdsOf(historyAccounts), [historyAccounts]));

  const dispIncome = roundedMinor(summary?.incomeMinor ?? 0);
  const savedExpenseIds = useMemo(
    () =>
      recent
        .filter(
          (entry) =>
            entry.type === 'expense' &&
            !entry.isRefund &&
            accountsById.get(entry.accountId)?.currency === currency &&
            (!hideAmounts ||
              (entry.categoryId && categoriesById.get(entry.categoryId)?.isSensitive === false))
        )
        .map((entry) => entry.id),
    [recent, accountsById, currency, hideAmounts, categoriesById]
  );
  const dispExpense = roundedMinor(summary?.expenseMinor ?? 0);
  // Where this month is heading — the current month only, and only once
  // there's enough of it to go on (monthPace returns null before the 5th).
  const todayIso = toLocalIsoDate(new Date());
  const isThisMonth = loadedCursor.granularity === 'month' && loadedCursor.offset === 0;
  const paceMinor =
    paceInputs && summary && isThisMonth
      ? monthPace({ spentMinor: summary.expenseMinor, ...paceInputs, today: todayIso })
      : null;
  const monthEndLabel = (() => {
    const [y, m] = todayIso.split('-').map(Number);
    return new Date(y, m, 0).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
  })();
  const savingsInPeriod = roundedMinor(summary?.savingsContributionMinor ?? 0);
  // Income − expense − whatever was already moved into savings this period.
  const carryIn = roundedMinor(carryInMinor);
  // What's free to use: what earlier months left over, plus this period's own surplus.
  const surplusInPeriod = carryIn + dispIncome - dispExpense - savingsInPeriod;

  // Handed to the month card as objects, kept the same until what is in them changes, so a redraw of the page that
  // changed none of them does not redraw the card.
  const spendingTrend = useMemo(
    () =>
      loadedCursor.granularity === 'month'
        ? {
            daily: dailySpend,
            today: loadedCursor.offset === 0 ? todayIso : periodRange(loadedCursor).end,
            mode: (loadedCursor.offset === 0 ? 'week' : 'month') as 'week' | 'month',
          }
        : null,
    [loadedCursor, dailySpend, todayIso]
  );
  const recaps = useMemo(
    () =>
      readyWraps.map((w) => ({
        key: `${w.period}:${w.key}`,
        label: w.label,
        onPress: () => router.push(`/wrap?period=${w.period}`),
      })),
    [readyWraps]
  );
  const todayGoal = useMemo(
    () =>
      dailyGoalMinor != null && loadedCursor.offset === 0
        ? { spentMinor: todaySpendMinor, goalMinor: dailyGoalMinor }
        : null,
    [dailyGoalMinor, loadedCursor.offset, todaySpendMinor]
  );
  const pace = useMemo(
    () => (paceMinor != null ? { projectedMinor: paceMinor, byLabel: monthEndLabel } : null),
    [paceMinor, monthEndLabel]
  );

  // Rebuilt only when its inputs change, not on every swipe or scroll-driven render.
  const upcoming = useMemo(() => {
    const cat = (id: string | null) => (id ? categoriesById.get(id) : undefined);
    return buildUpcomingItems({
      investmentIds: investIds,
      loans: buildLoansSummary(loans, loanProgress).rows.flatMap((row) =>
        row.direction === 'borrowed' && row.nextDueDate && row.nextEmiMinor != null
          ? [{ id: row.id, name: row.name, nextDueDate: row.nextDueDate, nextEmiMinor: row.nextEmiMinor }]
          : []
      ),
      cardBills,
      rules: recurringRulesInCurrency(recurringRules, accountLabels, currency),
      accent,
      secondary,
      accountName: (id) => (id ? accountsById.get(id)?.name : undefined),
      categoryName: (id) => {
        const c = cat(id);
        const parentId = c?.parentId;
        return c && categorySentence(c.name, parentId ? cat(parentId)?.name : undefined);
      },
      categoryColor: (id) => cat(id)?.color,
    });
  }, [
    loans,
    loanProgress,
    cardBills,
    recurringRules,
    accent,
    secondary,
    categoriesById,
    accountsById,
    accountLabels,
    investIds,
    currency,
  ]);

  const retryLoad = useCallback(() => void reload(), [reload]);
  const openRecentInActivity = useCallback(
    // Carry Home's month through to the Activity list.
    () => router.push(viewAllTarget(loadedCursor)),
    [loadedCursor]
  );
  const openRefundById = useCallback((id: string) => void openRefundPurchase(id), [openRefundPurchase]);

  return (
    <View style={styles.container}>
      {/* Balance and daily allowance, grouped accounts, largest upcoming outgoings and recent activity. */}
      <Animated.ScrollView
        ref={scrollRef}
        style={styles.scroll}
        onScroll={onScroll}
        scrollEventThrottle={16}
        contentContainerStyle={{
          paddingTop: headerHeight,
          paddingBottom: tabScrollPad + insets.bottom + 24,
        }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={accent}
            colors={[accent]}
            // Android draws the spinner at the ScrollView's top edge, which is
            // under the header — start it below the header instead.
            progressViewOffset={headerHeight}
          />
        }
      >
        {loadError && (
          <Appear style={styles.errorBanner}>
            <Text style={styles.errorTitle}>Couldn&rsquo;t load your data</Text>
            <Text style={styles.errorDetail}>{loadError}</Text>
            {/* Pulling down also retries, but nothing says so: offer it where the problem is said. */}
            <PrimaryButton
              title="Try again"
              compact
              variant="secondary"
              onPress={retryLoad}
              style={styles.errorRetry}
            />
          </Appear>
        )}

        <View style={styles.heroGap}>
          {loaded && historyAccounts.length === 0 ? null : loaded ? (
            <Animated.View entering={sectionEntering(0)} layout={ROW_LAYOUT}>
              <MonthCard
                periodKey={`${loadedCursor.granularity}:${loadedCursor.offset}`}
                direction={heroDirection}
                renderPeriod={renderPeriod}
                onPeriodDisplayed={setDisplayedPeriodKey}
                canStepForward={canStepForward(cursor)}
                onStep={stepHero}
                spendingTrend={spendingTrend}
                onSeeInsights={openSpendingReports}
                incomeMinor={dispIncome}
                spentMinor={dispExpense}
                savingsMinor={savingsInPeriod}
                surplusMinor={surplusInPeriod}
                carryMinor={carryIn}
                dueMinor={isThisMonth ? roundedMinor(stillToPayMinor) : null}
                recaps={recaps}
                // Today is always about today — only alongside the current period.
                today={todayGoal}
                pace={pace}
                savedExpenseIds={isThisMonth ? savedExpenseIds : undefined}
              />
            </Animated.View>
          ) : (
            <ThisMonthHeroSkeleton />
          )}
        </View>

        {!loaded && (
          <>
            <View style={{ marginTop: SCREEN.sectionGap }}>
              <AccountTilesSkeleton />
            </View>
            {/* Coming up is what follows the accounts on the loaded page; Recent activity is below it. */}
            <Section title="Coming up">
              <CardRowsSkeleton rows={3} subtitle />
            </Section>
          </>
        )}

        {/* Accounts remain directly below the balance area. After a failed first load nothing is known yet, so
            the "fresh start" card would tell someone with accounts that they have none. */}
        {loaded && !(loadError && historyAccounts.length === 0) && (
          <Animated.View entering={sectionEntering(1)} layout={ROW_LAYOUT}>
            <Accounts
              accounts={accounts}
              currency={currency}
              onOpenAccounts={openAccounts}
              onOpenAccount={sheets.openAccount}
              onAddAccount={sheets.openAddAccount}
            />
          </Animated.View>
        )}

        {/* Next payments and pending refunds stay visible without tabs. */}
        {loaded && historyAccounts.length > 0 && !comingUpReady && (
          <Section title="Coming up">
            <CardRowsSkeleton rows={3} subtitle />
          </Section>
        )}
        {loaded && historyAccounts.length > 0 && comingUpReady && (
          <Animated.View entering={sectionEntering(2)} layout={ROW_LAYOUT}>
            <ComingUp
              upcoming={upcoming}
              budgets={budgets}
              goals={goals}
              today={todayIso}
              refunds={refunds}
              refundError={refundError}
              openingRefund={openRefund.opening}
              onOpenRefund={openRefundById}
              onRetryRefunds={retryLoad}
              rowEntering={rowEntering}
              onSeeAll={openComingUp}
              stillToPayMinor={roundedMinor(stillToPayMinor)}
              loadFailed={comingUpError}
              onRetry={retryLoad}
            />
          </Animated.View>
        )}

        {loaded && historyAccounts.length > 0 && (
          <Animated.View entering={sectionEntering(4)} layout={ROW_LAYOUT}>
            <HomeRecentActivity
              recent={recent}
              cursor={loadedCursor}
              today={todayIso}
              todaySpendMinor={todaySpendMinor}
              categoriesById={categoriesById}
              accountsById={accountsById}
              savingsIds={savingsIds}
              investIds={investIds}
              rowEntering={rowEntering}
              onOpenEntry={openEntry}
              onSeeAll={openRecentInActivity}
            />
          </Animated.View>
        )}
      </Animated.ScrollView>

      <Header
        cursor={displayedCursor}
        onChange={handleCursorChange}
        userName={userName}
        alertCount={needsYouCount}
        scrollY={scrollY}
        onHeight={setHeaderHeight}
        onBrandPress={scrollToTop}
      />
      <SuuRefreshBadge refreshing={refreshing} />

      <HomeSheets
        sheets={sheets}
        cursor={cursor}
        accounts={accounts}
        historyAccounts={historyAccounts}
        categories={categories}
        reload={reload}
      />
    </View>
  );
}

const styles = themedStyles(() =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.colors.home.background },
    scroll: { flex: 1 },
    heroGap: { marginTop: 4 },
    errorBanner: {
      marginHorizontal: SCREEN.gutter,
      marginTop: 16,
      padding: 16,
      borderRadius: theme.radius.md,
      backgroundColor: theme.colors.expenseTint,
      borderWidth: theme.border.thin,
      borderColor: theme.colors.expense,
    },
    errorTitle: { fontFamily: theme.font.bodyBold, fontSize: 13, color: theme.colors.expenseText },
    errorDetail: {
      fontFamily: theme.font.body,
      fontSize: 12,
      color: theme.colors.textSecondary,
      marginTop: 4,
      lineHeight: 16,
    },
    errorRetry: { marginTop: 10, alignSelf: 'flex-start' },
  })
);

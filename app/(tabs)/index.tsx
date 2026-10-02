import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, StyleSheet, RefreshControl } from 'react-native';
import { Text } from '@/components/Text';
import Animated, { useSharedValue, useAnimatedScrollHandler } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, useFocusEffect } from 'expo-router';
import { listAccounts, listCategories, listTransactions } from '@/db/ledger';
import { listLoans, getLoanProgress } from '@/db/loans';
import { listCardCycles } from '@/db/cardCycles';
import { listRecurringRules } from '@/db/recurring';
import {
  getRangeComparison,
  PeriodComparison,
  findTopGrowingCategory,
  getTodaySpend,
  getMonthPaceInputs,
  getStillToPayThisMonth,
  getCarryInMinor,
} from '@/db/reports';
import { monthPace } from '@/lib/pace';
import { getUserName, getDailySpendingGoal } from '@/db/settings';
import { listBudgetsForMonth, BudgetProgress } from '@/db/budgets';
import { listSavingsGoals } from '@/db/savingsGoals';
import { savingsAccountIdsOf } from '@/lib/account';
import { privateComparison, isSavingsEntry } from '@/lib/privateSummary';
import { roundedMinor } from '@/lib/round';
import { savingsRatePct } from '@/lib/savingsRate';
import { Account, Category, Transaction, Loan, RecurringRule, SavingsGoal } from '@/types';
import { theme } from '@/constants/theme';
import { useAccent } from '@/theme/AccentContext';
import { usePrivacy } from '@/theme/PrivacyContext';
import { EmptyState } from '@/components/EmptyState';
import {
  CURRENT_PERIOD,
  PeriodCursor,
  periodRange,
  previousPeriodRange,
  stepPeriod,
  canStepForward,
} from '@/lib/period';
import {
  homeRowEntering,
  hasPlayedHomeOpening,
  markHomeOpeningPlayed,
  ROW_LAYOUT,
  ROW_EXIT,
} from '@/lib/animation';
import { HomeHeader } from '@/features/home/HomeHeader';
import { ThisMonthHero } from '@/features/home/ThisMonthHero';
import { ThisMonthHeroSkeleton, CardRowsSkeleton, AccountStackSkeleton } from '@/features/home/HomeSkeleton';
import { QuickActionsRow } from '@/features/home/QuickActionsRow';
import { SuuRefreshBadge } from '@/features/home/SuuRefreshBadge';
import { HomeSection } from '@/features/home/HomeSection';
import { homeStyles, HOME } from '@/features/home/homeStyles';
import { HomeGlance, buildUpcomingItems } from '@/features/home/HomeGlance';
import { buildLoansSummary } from '@/features/plan/planOverview';
import { RecentTransactionRow } from '@/features/home/RecentTransactionRow';
import { AccountStack } from '@/features/home/AccountStack';
import { AccountSummarySheet } from '@/features/home/AccountSummarySheet';
import { AccountDetailModal } from '@/features/profile/AccountDetailModal';
import { suuLine } from '@/features/home/suuLine';
import { loadReadyWraps, ReadyWrap } from '@/features/wrap/wrapWindow';
import { NeedsYouItem } from '@/features/home/needsYou';
import { loadNeedsYou } from '@/features/home/needsYouData';
import { AddAccountModal } from '@/features/profile/AddAccountModal';
import { PrimaryButton } from '@/components/PrimaryButton';
import { toLocalIsoDate } from '@/lib/date';
import { onTransactionsChanged } from '@/lib/dataEvents';
import { errorMessage } from '@/lib/errorMessage';
import { payCardRoute } from '@/lib/payCard';

export default function DashboardScreen() {
  const insets = useSafeAreaInsets();
  const { hideAmounts } = usePrivacy();
  const { accent } = useAccent();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [recent, setRecent] = useState<Transaction[]>([]);
  const [loans, setLoans] = useState<Loan[]>([]);
  const [recurringRules, setRecurringRules] = useState<RecurringRule[]>([]);
  const [rawComparison, setComparison] = useState<PeriodComparison | null>(null);
  // What earlier months left over (or, when negative, ran short by) — added to the period's own free-to-use.
  const [carryInMinor, setCarryInMinor] = useState(0);
  const comparison = useMemo(
    () => privateComparison(rawComparison, hideAmounts),
    [rawComparison, hideAmounts]
  );
  const [loanProgress, setLoanProgress] = useState<Awaited<ReturnType<typeof getLoanProgress>>>([]);
  const [cardBills, setCardBills] = useState<Awaited<ReturnType<typeof listCardCycles>>>([]);
  const [budgets, setBudgets] = useState<BudgetProgress[]>([]);
  const [goals, setGoals] = useState<SavingsGoal[]>([]);
  // Both are "always about today", not whatever period the cursor is
  // browsing — same reasoning as Budgets/Goals below. `dailyGoal` stays
  // `null` (the strip renders nothing) until the user actually sets one in
  // Settings → Money.
  const [todaySpendMinor, setTodaySpendMinor] = useState(0);
  const [dailyGoalMinor, setDailyGoalMinor] = useState<number | null>(null);
  // Inputs to the month forecast under the moon (see lib/pace.ts).
  const [paceInputs, setPaceInputs] = useState<{
    everydaySpentMinor: number;
    dueRestOfMonthMinor: number;
  } | null>(null);
  // Unpaid EMIs and bills left this month, for the card's "Free after bills".
  const [stillToPayMinor, setStillToPayMinor] = useState(0);
  // Everything that needs you (see features/home/needsYou.ts). The bell opens
  // the list and shows the count; Home itself only flags the Budgets tab.
  const [needsYou, setNeedsYou] = useState<NeedsYouItem[]>([]);
  const [addAccountVisible, setAddAccountVisible] = useState(false);
  // Tapping an account card opens its summary; "Edit account" there swaps
  // it for the full edit form.
  const [summaryAccount, setSummaryAccount] = useState<Account | null>(null);
  const [editAccount, setEditAccount] = useState<Account | null>(null);
  // Last week's Wrap on a Monday, last month's on the 1st–7th: the header's Wrap button (wrapWindow.ts).
  const [readyWraps, setReadyWraps] = useState<ReadyWrap[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [userName, setUserNameState] = useState<string | null>(null);
  const [cursor, setCursor] = useState<PeriodCursor>(CURRENT_PERIOD);
  // The period the figures on screen actually belong to. `cursor` moves the
  // moment the month is changed; this only catches up once that month's data
  // has loaded — the hero turns its page on this, so it never slides in with
  // the previous month's numbers under the new month's name.
  const [loadedCursor, setLoadedCursor] = useState<PeriodCursor>(CURRENT_PERIOD);
  const [loadError, setLoadError] = useState<string | null>(null);
  // The data below all starts at its own default ([], 0, null) — genuinely
  // indistinguishable from "actually loaded and this period really is
  // empty" — so this is the one flag the skeleton below gates on, set once
  // the very first `load()` finishes (success or failure) and never reset
  // afterward: a pull-to-refresh or period change re-fetches in place, it
  // doesn't send the screen back to a loading state a user already passed.
  const [loaded, setLoaded] = useState(false);
  // The staggered opening fade plays on the first load after the app opens
  // only; rows that appear after that (a new month, a refresh) get one quick
  // fade instead. Flipped a moment after the first load, once the opening
  // rows have mounted with their stagger.
  const [openingDone, setOpeningDone] = useState(hasPlayedHomeOpening);
  useEffect(() => {
    if (!loaded || openingDone) return;
    const t = setTimeout(() => {
      markHomeOpeningPlayed();
      setOpeningDone(true);
    }, 800);
    return () => clearTimeout(t);
  }, [loaded, openingDone]);
  const rowEntering = (i: number) => homeRowEntering(i, !openingDone);
  // Which way the hero should slide when the month changes — +1/-1 for a
  // step within the same granularity, 0 for anything else (a month↔year
  // toggle, or "jump to this month"), where a plain crossfade reads better
  // than a slide in an arbitrary direction. State, not a ref: ThisMonthHero
  // needs "which way did we just move" as a prop, and a ref can't be read
  // during render. Set in the same event as `setCursor` below, so React
  // batches both into the one re-render that also carries the new data.
  const [heroDirection, setHeroDirection] = useState<-1 | 0 | 1>(0);

  // The header sits over the ScrollView and collapses as it scrolls (see
  // HomeHeader). Its expanded height pads the content so nothing starts
  // hidden under it; the estimate only covers the first frame before the
  // header measures itself.
  const scrollY = useSharedValue(0);
  const onScroll = useAnimatedScrollHandler((e) => {
    scrollY.value = e.contentOffset.y;
  });
  const [headerHeight, setHeaderHeight] = useState(insets.top + 200);

  const handleCursorChange = useCallback(
    (next: PeriodCursor) => {
      setHeroDirection(
        next.granularity !== cursor.granularity
          ? 0
          : next.offset > cursor.offset
            ? 1
            : next.offset < cursor.offset
              ? -1
              : 0
      );
      setCursor(next);
    },
    [cursor]
  );

  // Stepping the period quickly starts overlapping loads; each is a long
  // chain through the app-wide statement queue, so an earlier one can finish
  // last. Only the most recent one may write state — otherwise last month's
  // data could land under this month's label. Two counters: the figures that
  // belong to a period (periodSeq), and everything else on the page (fullSeq).
  const periodSeq = useRef(0);
  const fullSeq = useRef(0);
  // The cursor the latest period fetch was started for, so the effect below
  // only fires for a real change and never doubles up a full load.
  const fetchedCursor = useRef<PeriodCursor>(CURRENT_PERIOD);
  const cursorRef = useRef(cursor);
  useEffect(() => {
    cursorRef.current = cursor;
  });

  // The three things that change with the period: its entries, its totals
  // against the one before, and what carried over into it.
  const fetchPeriod = useCallback(
    (c: PeriodCursor) => {
      const range = periodRange(c);
      return Promise.all([
        // Scoped to the same period as the navigator above it — showing the
        // single most-recent transactions regardless of period previously
        // made "Recent Activity" contradict whatever month/year was selected.
        listTransactions({ fromDate: range.start, toDate: range.end, limit: 30 }),
        getRangeComparison(range, previousPeriodRange(c), c.granularity),
        getCarryInMinor(range.start, hideAmounts),
      ]);
    },
    [hideAmounts]
  );

  // Stepping to another month only needs those three — accounts, loans,
  // budgets, bills and the rest don't depend on it, so they stay as they are.
  const loadPeriod = useCallback(
    async (c: PeriodCursor) => {
      fetchedCursor.current = c;
      const seq = ++periodSeq.current;
      try {
        const [tx, cmp, carry] = await fetchPeriod(c);
        if (seq !== periodSeq.current) return;
        setRecent(tx);
        setComparison(cmp);
        setCarryInMinor(carry);
        setLoadedCursor(c);
        setLoadError(null);
        setLoaded(true);
      } catch (e) {
        if (seq === periodSeq.current) setLoadError(errorMessage(e));
      }
    },
    [fetchPeriod]
  );

  const load = useCallback(
    async (c: PeriodCursor) => {
      fetchedCursor.current = c;
      const pSeq = ++periodSeq.current;
      const fSeq = ++fullSeq.current;
      let periodWritten = false;
      let failed = false;
      try {
        const [
          period,
          accs,
          cats,
          ln,
          rules,
          progress,
          cycles,
          name,
          budgetList,
          goalList,
          todaySpend,
          dailyGoal,
          paceIn,
          stillToPay,
          needs,
          wraps,
        ] = await Promise.all([
          fetchPeriod(c),
          listAccounts(),
          listCategories(),
          listLoans(),
          listRecurringRules(),
          getLoanProgress(),
          listCardCycles().catch(() => []),
          getUserName(),
          // Budgets and goals are always about *now*, not whatever period the
          // cursor above is browsing — a budget is inherently this calendar
          // month, and a goal has no period at all. Same for today's spend and
          // the daily goal.
          listBudgetsForMonth(undefined, hideAmounts),
          listSavingsGoals(),
          getTodaySpend(undefined, hideAmounts),
          getDailySpendingGoal(),
          getMonthPaceInputs(),
          getStillToPayThisMonth(),
          loadNeedsYou(),
          loadReadyWraps(),
        ]);
        if (pSeq === periodSeq.current) {
          const [tx, cmp, carry] = period;
          setRecent(tx);
          setComparison(cmp);
          setCarryInMinor(carry);
          setLoadedCursor(c);
          periodWritten = true;
        }
        if (fSeq !== fullSeq.current) return;
        setAccounts(accs);
        setCategories(cats);
        // A defaulted loan is still real money owed (or owed to you) — only a
        // 'closed' loan (fully paid off) should ever drop out of these totals.
        setLoans(ln.filter((l) => l.status !== 'closed'));
        setRecurringRules(
          hideAmounts
            ? rules.filter(
                (r) => !isSavingsEntry(r, new Map(cats.map((c) => [c.id, c])), savingsAccountIdsOf(accs))
              )
            : rules
        );
        setLoanProgress(progress);
        setCardBills(cycles);
        setUserNameState(name);
        setBudgets(budgetList);
        setGoals(goalList);
        setTodaySpendMinor(todaySpend);
        setDailyGoalMinor(dailyGoal);
        setPaceInputs(paceIn);
        setStillToPayMinor(stillToPay);
        setNeedsYou(needs.shown);
        setReadyWraps(wraps);
        setLoadError(null);
      } catch (e) {
        if (fSeq !== fullSeq.current) return;
        // Guard the throw so a transient DB error shows a banner instead of
        // freezing stale data + a stuck pull-to-refresh spinner.
        failed = true;
        setLoadError(errorMessage(e));
      } finally {
        // Not "loaded" until a period's figures have landed, so the card never
        // shows an empty month for a moment — a newer period fetch sets it too.
        if (fSeq === fullSeq.current && (periodWritten || failed)) setLoaded(true);
      }
    },
    [hideAmounts, fetchPeriod]
  );

  useFocusEffect(
    useCallback(() => {
      load(cursorRef.current);
    }, [load])
  );
  // A save that doesn't leave Home (the + long-press sheet) — reload in place.
  useEffect(() => onTransactionsChanged(() => void load(cursorRef.current)), [load]);
  // A new month or year: just that period's figures.
  useEffect(() => {
    if (fetchedCursor.current !== cursor) void loadPeriod(cursor);
  }, [cursor, loadPeriod]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load(cursor);
    setRefreshing(false);
  };

  const categoryFor = (id: string | null) => categories.find((c) => c.id === id);
  const accountName = (id: string | null | undefined) => accounts.find((a) => a.id === id)?.name;
  const savingsIds = savingsAccountIdsOf(accounts);
  const isSavingsTransfer = (tx: Transaction) =>
    tx.type === 'transfer' &&
    (savingsIds.has(tx.accountId) || (!!tx.toAccountId && savingsIds.has(tx.toAccountId)));

  const totalOutstandingLoans = loans
    .filter((l) => l.direction === 'borrowed')
    .reduce((sum, l) => sum + l.outstandingPrincipalMinor, 0);

  // Fires the Debt tile's celebration only on the real crossing — going
  // from a real positive balance to zero within this session (e.g. the
  // final EMI was just marked paid) — never on a plain re-render/refresh
  // while it's already zero, and never on first load either (`prevDebtRef`
  // starts at `null`, not 0, so a user who's never carried debt at all
  // never sees it fire).
  const prevDebtRef = useRef<number | null>(null);
  const [justClearedDebt, setJustClearedDebt] = useState(false);
  useEffect(() => {
    const prev = prevDebtRef.current;
    prevDebtRef.current = totalOutstandingLoans;
    if (prev != null && prev > 0 && totalOutstandingLoans === 0) {
      setJustClearedDebt(true);
      const t = setTimeout(() => setJustClearedDebt(false), 1500);
      return () => clearTimeout(t);
    }
  }, [totalOutstandingLoans]);

  const dispIncome = roundedMinor(comparison?.current.incomeMinor ?? 0);
  const dispExpense = roundedMinor(comparison?.current.expenseMinor ?? 0);
  // Where this month is heading — the current month only, and only once
  // there's enough of it to go on (monthPace returns null before the 5th).
  const todayIso = toLocalIsoDate(new Date());
  const paceMinor =
    paceInputs && comparison && loadedCursor.granularity === 'month' && loadedCursor.offset === 0
      ? monthPace({ spentMinor: comparison.current.expenseMinor, ...paceInputs, today: todayIso })
      : null;
  const monthEndLabel = (() => {
    const [y, m] = todayIso.split('-').map(Number);
    return new Date(y, m, 0).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
  })();
  const savingsInPeriod = roundedMinor(comparison?.current.savingsContributionMinor ?? 0);
  // Income − expense − whatever was already moved into savings this period.
  const carryIn = roundedMinor(carryInMinor);
  // What's free to use: what earlier months left over, plus this period's own surplus.
  const surplusInPeriod = carryIn + dispIncome - dispExpense - savingsInPeriod;

  const expenseChangePct = comparison?.expenseChangePct;

  const topGrowing =
    comparison &&
    findTopGrowingCategory(comparison.current.categoryBreakdown, comparison.previous.categoryBreakdown);

  // "Saved" = income not spent (kept in any account), so the bar reflects
  // aggressive savers instead of reading 0% when they sweep cash into a pot.
  // The spend-is-up nudge (previously its own SpendingAlertCard, which just
  // repeated this hero's own "N% vs last" figure) is now folded into Suu's
  // line itself — see suuLine's own comment for why that takes priority.
  const savingsPct = savingsRatePct(dispIncome - dispExpense, dispIncome);
  const suu = suuLine(
    savingsPct,
    expenseChangePct ?? null,
    topGrowing?.name ?? null,
    new Date().getHours(),
    hideAmounts
  );

  const upcoming = buildUpcomingItems({
    loans: buildLoansSummary(loans, loanProgress).rows.flatMap((row) =>
      row.direction === 'borrowed' && row.nextDueDate && row.nextEmiMinor != null
        ? [{ id: row.id, name: row.name, nextDueDate: row.nextDueDate, nextEmiMinor: row.nextEmiMinor }]
        : []
    ),
    cardBills,
    rules: recurringRules,
    accent,
    accountName,
    categoryName: (id) => categoryFor(id)?.name,
    categoryColor: (id) => categoryFor(id)?.color,
  });

  return (
    <View style={styles.container}>
      {/* Top to bottom, the "arranged Home" sign-off: the header (with the
          quick actions in it), your month, what needs you, your plans, then
          history — recent activity and accounts. */}
      <Animated.ScrollView
        style={styles.scroll}
        onScroll={onScroll}
        scrollEventThrottle={16}
        contentContainerStyle={{
          paddingTop: headerHeight,
          paddingBottom: theme.layout.tabScreenScrollPad + insets.bottom,
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
          <View style={styles.errorBanner}>
            <Text style={styles.errorTitle}>Couldn&rsquo;t load your data</Text>
            <Text style={styles.errorDetail}>{loadError}</Text>
          </View>
        )}

        <View style={styles.heroGap}>
          {loaded ? (
            <ThisMonthHero
              periodKey={`${loadedCursor.granularity}:${loadedCursor.offset}`}
              direction={heroDirection}
              title={
                loadedCursor.offset === 0
                  ? loadedCursor.granularity === 'year'
                    ? 'This year'
                    : 'This month'
                  : 'Looking back'
              }
              canStepForward={canStepForward(cursor)}
              onStep={(dir) => handleCursorChange(stepPeriod(cursor, dir))}
              incomeMinor={dispIncome}
              spentMinor={dispExpense}
              savingsMinor={savingsInPeriod}
              surplusMinor={surplusInPeriod}
              carryMinor={carryIn}
              dueMinor={
                loadedCursor.granularity === 'month' && loadedCursor.offset === 0
                  ? roundedMinor(stillToPayMinor)
                  : 0
              }
              outstandingLoansMinor={roundedMinor(totalOutstandingLoans)}
              suu={suu}
              celebrateDebtCleared={justClearedDebt}
              // Today is always about today — only alongside the current period.
              today={
                dailyGoalMinor != null && loadedCursor.offset === 0
                  ? { spentMinor: todaySpendMinor, goalMinor: dailyGoalMinor }
                  : null
              }
              pace={paceMinor != null ? { projectedMinor: paceMinor, byLabel: monthEndLabel } : null}
            />
          ) : (
            <ThisMonthHeroSkeleton />
          )}
        </View>

        {!loaded && (
          <>
            <View style={{ marginTop: HOME.sectionGap }}>
              <CardRowsSkeleton rows={2} meter />
            </View>
            <HomeSection title="Recent activity">
              <CardRowsSkeleton rows={3} subtitle />
            </HomeSection>
            <HomeSection title="Your accounts">
              <AccountStackSkeleton />
            </HomeSection>
          </>
        )}

        {loaded && (
          <HomeGlance
            upcoming={upcoming}
            budgets={budgets}
            goals={goals}
            budgetAlert={needsYou.some((i) => i.action === 'budgets')}
            rowEntering={rowEntering}
            onSeeMoreUpcoming={() => router.navigate({ pathname: '/plan', params: { section: 'coming-up' } })}
          />
        )}

        {loaded && (
          <HomeSection title="Recent activity" onSeeAll={() => router.push('/transactions')}>
            {recent.length === 0 ? (
              <EmptyState
                title="Nothing logged in this period"
                subtitle="Use the month pill above to check another period."
              />
            ) : (
              <View style={[homeStyles.card, homeStyles.cardLifted]}>
                {recent.slice(0, 4).map((tx, i) => (
                  <Animated.View key={tx.id} entering={rowEntering(i)} layout={ROW_LAYOUT} exiting={ROW_EXIT}>
                    <RecentTransactionRow
                      tx={tx}
                      category={categoryFor(tx.categoryId) ?? undefined}
                      accountName={accountName(tx.accountId)}
                      toAccountName={accountName(tx.toAccountId)}
                      savingsTransfer={isSavingsTransfer(tx)}
                      divider={i > 0}
                    />
                  </Animated.View>
                ))}
              </View>
            )}
          </HomeSection>
        )}

        {loaded && (
          <HomeSection title="Your accounts" onSeeAll={() => router.push('/profile')}>
            {accounts.length === 0 ? (
              // Opens the same Add Account form Profile uses, right here — the
              // old hint sent a brand-new user three taps away to find it.
              <View>
                <EmptyState
                  title="No accounts yet"
                  subtitle="Add where your money lives: a bank account, cash, or a UPI wallet."
                />
                <PrimaryButton
                  title="Add an account"
                  onPress={() => setAddAccountVisible(true)}
                  style={styles.emptyCta}
                />
              </View>
            ) : (
              <AccountStack accounts={accounts} onOpen={setSummaryAccount} opening={!openingDone} />
            )}
          </HomeSection>
        )}
      </Animated.ScrollView>

      <HomeHeader
        cursor={cursor}
        onChange={handleCursorChange}
        userName={userName}
        alertCount={needsYou.length}
        scrollY={scrollY}
        onHeight={setHeaderHeight}
        wraps={readyWraps}
        onPlayWrap={(w) => router.push(`/wrap?period=${w.period}`)}
      >
        <QuickActionsRow />
      </HomeHeader>
      <SuuRefreshBadge refreshing={refreshing} />

      <AccountSummarySheet
        account={summaryAccount}
        cursor={cursor}
        accounts={accounts}
        categories={categories}
        onClose={() => setSummaryAccount(null)}
        onAdd={(acc) => {
          setSummaryAccount(null);
          router.push(
            `/add-transaction?type=${acc.type === 'savings' ? 'transfer' : 'expense'}&accountId=${acc.id}`
          );
        }}
        onEdit={(acc) => {
          setSummaryAccount(null);
          setEditAccount(acc);
        }}
        onChanged={() => load(cursor)}
        onPayBill={(acc, amountMinor) => {
          setSummaryAccount(null);
          router.push(payCardRoute(acc.id, amountMinor));
        }}
        onSeeAll={(acc) => {
          setSummaryAccount(null);
          const month =
            cursor.granularity === 'month' ? `&month=${periodRange(cursor).start.slice(0, 7)}` : '';
          router.navigate(`/transactions?account=${acc.id}${month}`);
        }}
      />

      <AccountDetailModal
        account={editAccount}
        onClose={() => setEditAccount(null)}
        onChanged={async () => {
          setEditAccount(null);
          await load(cursor);
        }}
      />

      <AddAccountModal
        visible={addAccountVisible}
        onClose={() => setAddAccountVisible(false)}
        onCreated={async () => {
          setAddAccountVisible(false);
          await load(cursor);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  scroll: { flex: 1 },
  heroGap: { marginTop: 18 },
  errorBanner: {
    marginHorizontal: 20,
    marginTop: 18,
    padding: 14,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.expenseTint,
    borderWidth: theme.border.thin,
    borderColor: theme.colors.expense,
  },
  errorTitle: { fontFamily: theme.font.bodyBold, fontSize: 13, color: theme.colors.expenseText },
  errorDetail: {
    fontFamily: theme.font.body,
    fontSize: 11.5,
    color: theme.colors.textSecondary,
    marginTop: 3,
    lineHeight: 16,
  },
  emptyCta: { marginHorizontal: 40, marginTop: -8 },
});

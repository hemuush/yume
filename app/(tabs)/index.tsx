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
import { Section } from '@/components/Section';
import { screenStyles, SCREEN } from '@/components/screenStyles';
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
import { dayLabel, toLocalIsoDate } from '@/lib/date';
import { categorySentence } from '@/lib/categoryLabel';
import { onTransactionsChanged } from '@/lib/dataEvents';
import { useFreshness } from '@/lib/useFreshness';
import { errorMessage } from '@/lib/errorMessage';
import { payCardRoute } from '@/lib/payCard';

/** Home shows this many of the period's latest entries; fetch no more than that. */
const RECENT_ROWS = 4;

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
  // Both are always about today, not the browsed period (like Budgets/Goals below); `dailyGoal` stays
  // `null` (strip renders nothing) until the user sets one in Settings → Money.
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
  // The period the on-screen figures belong to: `cursor` moves at once, this catches up once that month's
  // data loads. The hero turns its page on it, so a new month name never shows the old month's numbers.
  const [loadedCursor, setLoadedCursor] = useState<PeriodCursor>(CURRENT_PERIOD);
  const [loadError, setLoadError] = useState<string | null>(null);
  // Defaults ([], 0, null) look like a genuinely empty period, so the skeleton gates on this flag: set once
  // after the first `load()` (success or failure), never reset; later fetches update in place.
  const [loaded, setLoaded] = useState(false);
  // The staggered opening fade plays only on the first load after app open; later rows (new month, refresh)
  // get one quick fade. Flipped shortly after the first load, once the opening rows have mounted.
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
  // Hero slide direction on month change: +1/-1 for a same-granularity step, else 0 (crossfade). State, not
  // a ref (ThisMonthHero reads it in render); set with `setCursor` so one re-render carries both.
  const [heroDirection, setHeroDirection] = useState<-1 | 0 | 1>(0);

  // The header overlays the ScrollView and collapses on scroll (see HomeHeader); its expanded height pads
  // the content so nothing hides under it. The estimate only covers the first frame before it measures.
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

  // Quick period stepping starts overlapping loads that can finish out of order; only the latest may write
  // state, or last month's data lands under this month's label (periodSeq/fullSeq).
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
        // Scoped to the navigator's period; unscoped most-recent rows contradicted the selected month/year.
        listTransactions({ fromDate: range.start, toDate: range.end, limit: RECENT_ROWS }),
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
          // Budgets, goals, today's spend and the daily goal are always about *now*, not the browsed period
          // (a budget is this calendar month; a goal has no period).
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
        if (fSeq !== fullSeq.current) return false;
        setAccounts(accs);
        setCategories(cats);
        // A defaulted loan is still real money owed (or owed to you) — only a
        // 'closed' loan (fully paid off) should ever drop out of these totals.
        setLoans(ln.filter((l) => l.status !== 'closed'));
        if (hideAmounts) {
          const catById = new Map(cats.map((cat) => [cat.id, cat]));
          const savingsIds = savingsAccountIdsOf(accs);
          setRecurringRules(rules.filter((r) => !isSavingsEntry(r, catById, savingsIds)));
        } else {
          setRecurringRules(rules);
        }
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
        if (fSeq !== fullSeq.current) return false;
        // Guard the throw so a transient DB error shows a banner instead of
        // freezing stale data + a stuck pull-to-refresh spinner.
        failed = true;
        setLoadError(errorMessage(e));
      } finally {
        // Not "loaded" until a period's figures have landed, so the card never
        // shows an empty month for a moment — a newer period fetch sets it too.
        if (fSeq === fullSeq.current && (periodWritten || failed)) setLoaded(true);
      }
      return !failed && fSeq === fullSeq.current;
    },
    [hideAmounts, fetchPeriod]
  );

  // Coming back to Home with nothing changed (no write, same day, same settings) shows what's already here
  // instead of re-running every query.
  const freshness = useFreshness();
  useFocusEffect(
    useCallback(() => {
      if (freshness.isFresh([load])) return;
      const started = freshness.start([load]);
      void load(cursorRef.current).then((ok) => {
        if (ok) freshness.commit(started);
      });
    }, [load, freshness])
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
  const parentNameFor = (id: string | null) => {
    const parentId = categoryFor(id)?.parentId;
    return parentId ? categoryFor(parentId)?.name : undefined;
  };
  const accountName = (id: string | null | undefined) => accounts.find((a) => a.id === id)?.name;
  const savingsIds = savingsAccountIdsOf(accounts);
  const isSavingsTransfer = (tx: Transaction) =>
    tx.type === 'transfer' &&
    (savingsIds.has(tx.accountId) || (!!tx.toAccountId && savingsIds.has(tx.toAccountId)));

  const totalOutstandingLoans = loans
    .filter((l) => l.direction === 'borrowed')
    .reduce((sum, l) => sum + l.outstandingPrincipalMinor, 0);

  // Fires the Debt tile's celebration only on a real positive→zero crossing this session, not on re-render
  // while zero or first load: `prevDebtRef` starts `null`, so users who never had debt never see it.
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

  // "Saved" = income not spent (in any account), so savers who sweep cash into a pot don't read 0%. The
  // spend-up nudge is folded into Suu's line (see suuLine's comment for why it takes priority).
  const savingsPct = savingsRatePct(dispIncome - dispExpense, dispIncome);
  // Memoised: the line is picked at random, so recomputing it every render would reshuffle it on each re-render.
  const topGrowingName = topGrowing?.name ?? null;
  const changePct = expenseChangePct ?? null;
  const hour = new Date().getHours();
  const suu = useMemo(
    () => suuLine(savingsPct, changePct, topGrowingName, hour, hideAmounts),
    [savingsPct, changePct, topGrowingName, hour, hideAmounts]
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
    categoryName: (id) => {
      const cat = categoryFor(id);
      return cat && categorySentence(cat.name, parentNameFor(id));
    },
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

        {/* Add shortcuts sit right under the month card, in thumb reach. */}
        <QuickActionsRow />

        {!loaded && (
          <>
            <View style={{ marginTop: SCREEN.sectionGap }}>
              <CardRowsSkeleton rows={2} meter />
            </View>
            <Section title="Recent activity">
              <CardRowsSkeleton rows={3} subtitle />
            </Section>
            <Section title="Your accounts">
              <AccountStackSkeleton />
            </Section>
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
          <Section title="Recent activity" onSeeAll={() => router.push('/transactions')}>
            {recent.length === 0 ? (
              <EmptyState
                title="Nothing logged in this period"
                subtitle="Use the month pill above to check another period."
              />
            ) : (
              <View style={[screenStyles.card, screenStyles.cardLifted]}>
                {recent.slice(0, RECENT_ROWS).map((tx, i, rows) => {
                  // Rows come newest first; a new day gets its own small heading ("Today", "Yesterday", "1 Oct").
                  const newDay = i === 0 || rows[i - 1].date !== tx.date;
                  return (
                    <Animated.View
                      key={tx.id}
                      entering={rowEntering(i)}
                      layout={ROW_LAYOUT}
                      exiting={ROW_EXIT}
                    >
                      {newDay && (
                        <Text style={[styles.dayHead, i > 0 && styles.dayHeadDivider]}>
                          {dayLabel(tx.date)}
                        </Text>
                      )}
                      <RecentTransactionRow
                        tx={tx}
                        category={categoryFor(tx.categoryId) ?? undefined}
                        parentName={parentNameFor(tx.categoryId)}
                        accountName={accountName(tx.accountId)}
                        toAccountName={accountName(tx.toAccountId)}
                        savingsTransfer={isSavingsTransfer(tx)}
                        divider={!newDay}
                        showDay={false}
                      />
                    </Animated.View>
                  );
                })}
              </View>
            )}
          </Section>
        )}

        {loaded && (
          <Section title="Your accounts" onSeeAll={() => router.push('/profile')}>
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
              <AccountStack accounts={accounts} onOpen={setSummaryAccount} />
            )}
          </Section>
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
      />
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
  heroGap: { marginTop: 12 },
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
  dayHead: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 2,
    fontFamily: theme.font.bodyBold,
    fontSize: 12,
    color: theme.colors.textMuted,
  },
  dayHeadDivider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.colors.divider },
});

import { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet, RefreshControl } from 'react-native';
import Animated, { FadeIn, ReduceMotion } from 'react-native-reanimated';
import Feather from '@expo/vector-icons/Feather';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, useFocusEffect } from 'expo-router';
import { listAccounts, listCategories, listTransactions, countTransactions } from '@/db/ledger';
import { listLoans, getNextDueInstallment, NextDueInstallment } from '@/db/loans';
import { listRecurringRules } from '@/db/recurring';
import { getRangeComparison, PeriodComparison, findTopGrowingCategory, getTodaySpend } from '@/db/reports';
import {
  getUserName,
  getDailySpendingGoal,
  getLocalBackupFolderUri,
  getLastLocalBackupResult,
  getBackupNudgeSnoozedUntil,
  setBackupNudgeSnoozedUntil,
  BackupOutcome,
} from '@/db/settings';
import { listBudgetsForMonth, BudgetProgress } from '@/db/budgets';
import { listSavingsGoals } from '@/db/savingsGoals';
import { roundedMinor } from '@/lib/round';
import { savingsRatePct } from '@/lib/savingsRate';
import { Account, Category, Transaction, Loan, RecurringRule, SavingsGoal } from '@/types';
import { theme } from '@/constants/theme';
import { useAccent } from '@/theme/AccentContext';
import { hexToRgba } from '@/lib/color';
import { EmptyState } from '@/components/EmptyState';
import { CURRENT_PERIOD, PeriodCursor, periodRange, previousPeriodRange } from '@/lib/period';
import { dueDateLabel, isDueUrgent } from '@/lib/dueDate';
import { MAX_LIST_STAGGER_MS } from '@/lib/animation';
import { HomeHeader } from '@/features/home/HomeHeader';
import { ThisMonthHero } from '@/features/home/ThisMonthHero';
import { ThisMonthHeroSkeleton, CardRowsSkeleton, StripSkeleton } from '@/features/home/HomeSkeleton';
import { TodaySpendStrip } from '@/features/home/TodaySpendStrip';
import { QuickActionsRow } from '@/features/home/QuickActionsRow';
import { SuuRefreshBadge } from '@/features/home/SuuRefreshBadge';
import { HomeSection } from '@/features/home/HomeSection';
import { HomeSwipeCard, SwipePage } from '@/features/home/HomeSwipeCard';
import { UpcomingRow, UpcomingMoreRow } from '@/features/home/UpcomingRow';
import { useCappedList } from '@/lib/useCappedList';
import { RecentTransactionRow } from '@/features/home/RecentTransactionRow';
import { AccountChip } from '@/features/home/AccountChip';
import { suuLine } from '@/features/home/suuLine';
import { BudgetRow } from '@/features/budgets/BudgetRow';
import { GoalChip } from '@/features/goals/GoalChip';
import { NeedsYouCard } from '@/features/home/NeedsYouCard';
import { buildNeedsYouItems, NeedsYouItem } from '@/features/home/needsYou';
import { AddAccountModal } from '@/features/profile/AddAccountModal';
import { PrimaryButton } from '@/components/PrimaryButton';
import { toLocalIsoDate } from '@/lib/date';

export default function DashboardScreen() {
  const insets = useSafeAreaInsets();
  const { accent } = useAccent();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [recent, setRecent] = useState<Transaction[]>([]);
  const [loans, setLoans] = useState<Loan[]>([]);
  const [recurringRules, setRecurringRules] = useState<RecurringRule[]>([]);
  const [comparison, setComparison] = useState<PeriodComparison | null>(null);
  const [nextDue, setNextDue] = useState<NextDueInstallment | null>(null);
  const [budgets, setBudgets] = useState<BudgetProgress[]>([]);
  const [goals, setGoals] = useState<SavingsGoal[]>([]);
  // Both are "always about today", not whatever period the cursor is
  // browsing — same reasoning as Budgets/Goals below. `dailyGoal` stays
  // `null` (the strip renders nothing) until the user actually sets one in
  // Settings → Money.
  const [todaySpendMinor, setTodaySpendMinor] = useState(0);
  const [dailyGoalMinor, setDailyGoalMinor] = useState<number | null>(null);
  // Inputs to the Needs you row (see features/home/needsYou.ts) — backup
  // health and whether there's enough data yet for a missing backup to matter.
  const [backupFolderUri, setBackupFolderUri] = useState<string | null>(null);
  const [lastBackupResult, setLastBackupResult] = useState<BackupOutcome | null>(null);
  const [backupNudgeSnoozedUntil, setBackupNudgeSnoozedUntilState] = useState<string | null>(null);
  const [transactionCount, setTransactionCount] = useState(0);
  const [addAccountVisible, setAddAccountVisible] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [userName, setUserNameState] = useState<string | null>(null);
  const [cursor, setCursor] = useState<PeriodCursor>(CURRENT_PERIOD);
  const [loadError, setLoadError] = useState<string | null>(null);
  // The data below all starts at its own default ([], 0, null) — genuinely
  // indistinguishable from "actually loaded and this period really is
  // empty" — so this is the one flag the skeleton below gates on, set once
  // the very first `load()` finishes (success or failure) and never reset
  // afterward: a pull-to-refresh or period change re-fetches in place, it
  // doesn't send the screen back to a loading state a user already passed.
  const [loaded, setLoaded] = useState(false);
  // Which way the hero should slide when the month changes — +1/-1 for a
  // step within the same granularity, 0 for anything else (a month↔year
  // toggle, or "jump to this month"), where a plain crossfade reads better
  // than a slide in an arbitrary direction. State, not a ref: ThisMonthHero
  // needs "which way did we just move" as a prop, and a ref can't be read
  // during render. Set in the same event as `setCursor` below, so React
  // batches both into the one re-render that also carries the new data.
  const [heroDirection, setHeroDirection] = useState<-1 | 0 | 1>(0);
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
  // last. Only the most recent load may write state — otherwise last month's
  // data could land under this month's label.
  const loadSeq = useRef(0);
  const load = useCallback(async (c: PeriodCursor) => {
    const seq = ++loadSeq.current;
    const range = periodRange(c);
    try {
      const [
        accs,
        cats,
        tx,
        ln,
        rules,
        cmp,
        due,
        name,
        budgetList,
        goalList,
        todaySpend,
        dailyGoal,
        folderUri,
        lastBackup,
        nudgeSnoozedUntil,
        txCount,
      ] = await Promise.all([
        listAccounts(),
        listCategories(),
        // Scoped to the same period as the navigator above it — showing the
        // single most-recent transactions regardless of period previously
        // made "Recent Activity" contradict whatever month/year was selected.
        listTransactions({ fromDate: range.start, toDate: range.end, limit: 30 }),
        listLoans(),
        listRecurringRules(),
        getRangeComparison(range, previousPeriodRange(c), c.granularity),
        getNextDueInstallment(),
        getUserName(),
        // Budgets and goals are always about *now*, not whatever period the
        // cursor above is browsing — a budget is inherently this calendar
        // month, and a goal has no period at all. Same for today's spend and
        // the daily goal.
        listBudgetsForMonth(),
        listSavingsGoals(),
        getTodaySpend(),
        getDailySpendingGoal(),
        getLocalBackupFolderUri(),
        getLastLocalBackupResult(),
        getBackupNudgeSnoozedUntil(),
        countTransactions(),
      ]);
      if (seq !== loadSeq.current) return;
      setAccounts(accs);
      setCategories(cats);
      setRecent(tx);
      // A defaulted loan is still real money owed (or owed to you) — only a
      // 'closed' loan (fully paid off) should ever drop out of these totals.
      setLoans(ln.filter((l) => l.status !== 'closed'));
      setRecurringRules(rules);
      setComparison(cmp);
      setNextDue(due);
      setUserNameState(name);
      setBudgets(budgetList);
      setGoals(goalList);
      setTodaySpendMinor(todaySpend);
      setDailyGoalMinor(dailyGoal);
      setBackupFolderUri(folderUri);
      setLastBackupResult(lastBackup);
      setBackupNudgeSnoozedUntilState(nudgeSnoozedUntil);
      setTransactionCount(txCount);
      setLoadError(null);
    } catch (e: any) {
      if (seq !== loadSeq.current) return;
      // Guard the throw so a transient DB error shows a banner instead of
      // freezing stale data + a stuck pull-to-refresh spinner.
      setLoadError(String(e?.message ?? e));
    } finally {
      if (seq === loadSeq.current) setLoaded(true);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load(cursor);
    }, [load, cursor])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await load(cursor);
    setRefreshing(false);
  };

  const categoryFor = (id: string | null) => categories.find((c) => c.id === id);
  const accountName = (id: string | null | undefined) => accounts.find((a) => a.id === id)?.name;

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
  const savingsInPeriod = roundedMinor(comparison?.current.savingsContributionMinor ?? 0);
  // Income − expense − whatever was already moved into savings this period.
  const surplusInPeriod = dispIncome - dispExpense - savingsInPeriod;

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
  const suu = suuLine(savingsPct, expenseChangePct ?? null, topGrowing?.name ?? null, new Date().getHours());

  const hasAlerts = nextDue !== null || !!topGrowing;

  // "Upcoming" used to show only the next loan EMI — every recurring rule
  // (rent, subscriptions, salary) was invisible on Home even though it's
  // exactly the kind of thing "what's coming up" should answer. Merged into
  // one list here, soonest first, so a bill isn't a surprise just because
  // it happens to be a recurring one rather than a loan.
  interface UpcomingItem {
    key: string;
    icon: React.ComponentProps<typeof Feather>['name'];
    iconBg: string;
    iconColor?: string;
    title: string;
    subtitle: string;
    amountMinor: number;
    sign: '+' | '-' | '';
    sortDate: string;
    onPress: () => void;
    urgent: boolean;
  }
  const upcomingItems: UpcomingItem[] = [];
  if (nextDue) {
    upcomingItems.push({
      key: 'loan',
      icon: 'calendar',
      // Was a fixed gold tint, unrelated to anything the user picked — now a
      // light wash of their own accent, so the one card that keeps a colour
      // uses the user's colour rather than an arbitrary one.
      iconBg: hexToRgba(accent, 0.18),
      iconColor: accent,
      title: `${nextDue.counterparty} EMI`,
      subtitle: dueDateLabel(nextDue.dueDate),
      amountMinor: nextDue.emiAmountMinor,
      sign: '-',
      sortDate: nextDue.dueDate,
      onPress: () => router.push('/loans'),
      urgent: isDueUrgent(nextDue.dueDate),
    });
  }
  for (const rule of recurringRules) {
    if (!rule.active) continue;
    const isTransfer = rule.type === 'transfer';
    upcomingItems.push({
      key: rule.id,
      icon: isTransfer ? 'repeat' : rule.type === 'income' ? 'arrow-down-right' : 'arrow-up-right',
      iconBg: theme.colors.secondaryTint,
      title: isTransfer
        ? `${accountName(rule.accountId) ?? '—'} → ${accountName(rule.toAccountId) ?? '—'}`
        : rule.note || categoryFor(rule.categoryId)?.name || 'Recurring',
      subtitle: dueDateLabel(rule.nextRunDate),
      amountMinor: rule.amountMinor,
      sign: rule.type === 'income' ? '+' : rule.type === 'expense' ? '-' : '',
      sortDate: rule.nextRunDate,
      onPress: () => router.push('/recurring'),
      urgent: isDueUrgent(rule.nextRunDate),
    });
  }
  upcomingItems.sort((a, b) => (a.sortDate < b.sortDate ? -1 : a.sortDate > b.sortDate ? 1 : 0));
  const {
    shown: visibleUpcoming,
    hidden: hiddenUpcoming,
    expand: expandUpcoming,
  } = useCappedList(upcomingItems, 3);

  // Already sorted most-urgent (closest to or over its limit) first.
  const topBudgets = budgets.slice(0, 3);
  const activeGoals = goals.filter((g) => !g.archived);
  // Capped rather than its own horizontal ScrollView — nesting a
  // horizontal-scrolling strip inside the swipe card's own horizontal
  // pager would fight the page-swipe gesture on the same axis, so this
  // page shows as many chips as comfortably fit and a "+N" tile for the
  // rest instead, the same cap-and-link pattern Budgets/Upcoming use.
  const topGoals = activeGoals.slice(0, 2);
  const hiddenGoalsCount = activeGoals.length - topGoals.length;

  const homeSwipePages: SwipePage[] = [
    ...(topBudgets.length > 0
      ? [
          {
            key: 'budgets',
            label: 'Budgets',
            onSeeAll: () => router.push('/budgets'),
            content: (
              <View style={styles.pageList}>
                {topBudgets.map((progress, i) => (
                  <Animated.View
                    key={progress.budget.id}
                    entering={FadeIn.delay(Math.min(i * 60, MAX_LIST_STAGGER_MS))
                      .duration(280)
                      .reduceMotion(ReduceMotion.System)}
                  >
                    <BudgetRow progress={progress} divider={i > 0} onPress={() => router.push('/budgets')} />
                  </Animated.View>
                ))}
              </View>
            ),
          },
        ]
      : []),
    ...(visibleUpcoming.length > 0
      ? [
          {
            key: 'upcoming',
            label: 'Upcoming',
            // No single "see all" destination — this mixes loan EMIs (Loans
            // tab) and recurring rules (Recurring screen); each row already
            // deep-links to where it actually lives.
            content: (
              <View style={styles.pageList}>
                {visibleUpcoming.map((item, i) => (
                  <Animated.View
                    key={item.key}
                    entering={FadeIn.delay(Math.min(i * 60, MAX_LIST_STAGGER_MS))
                      .duration(280)
                      .reduceMotion(ReduceMotion.System)}
                  >
                    <UpcomingRow
                      icon={item.icon}
                      iconBg={item.iconBg}
                      iconColor={item.iconColor}
                      title={item.title}
                      subtitle={item.subtitle}
                      amountMinor={item.amountMinor}
                      sign={item.sign}
                      onPress={item.onPress}
                      divider={i > 0}
                      urgent={item.urgent}
                    />
                  </Animated.View>
                ))}
                {hiddenUpcoming.length > 0 && (
                  <UpcomingMoreRow count={hiddenUpcoming.length} divider onPress={expandUpcoming} />
                )}
              </View>
            ),
          },
        ]
      : []),
    ...(topGoals.length > 0
      ? [
          {
            key: 'goals',
            label: 'Goals',
            onSeeAll: () => router.push('/savings-goals'),
            content: (
              <View style={styles.goalsPageRow}>
                {topGoals.map((goal, i) => (
                  <Animated.View
                    key={goal.id}
                    entering={FadeIn.delay(Math.min(i * 60, MAX_LIST_STAGGER_MS))
                      .duration(280)
                      .reduceMotion(ReduceMotion.System)}
                  >
                    <GoalChip goal={goal} onPress={() => router.push('/savings-goals')} />
                  </Animated.View>
                ))}
                {hiddenGoalsCount > 0 && (
                  <Pressable
                    onPress={() => router.push('/savings-goals')}
                    style={styles.goalsMoreTile}
                    accessibilityRole="button"
                    accessibilityLabel={`${hiddenGoalsCount} more goals`}
                  >
                    <Text style={styles.goalsMoreText}>+{hiddenGoalsCount} more</Text>
                  </Pressable>
                )}
              </View>
            ),
          },
        ]
      : []),
  ];

  const now = new Date();
  const needsYouItems = buildNeedsYouItems({
    nextDue,
    budgets,
    backup: {
      folderUri: backupFolderUri,
      lastResult: lastBackupResult,
      snoozedUntil: backupNudgeSnoozedUntil,
    },
    transactionCount,
    today: toLocalIsoDate(now),
    now,
  });
  const openNeedsYou = (item: NeedsYouItem) => {
    if (item.action === 'loans') router.push('/loans');
    else if (item.action === 'budgets') router.push('/budgets');
    else router.push('/backup');
  };
  // Hides the "No backup yet" reminder for 30 days. Shown as hidden straight
  // away; a failed write only means it may reappear on the next load.
  const snoozeNeedsYou = () => {
    const until = new Date(Date.now() + 30 * 86400000).toISOString();
    setBackupNudgeSnoozedUntilState(until);
    setBackupNudgeSnoozedUntil(until).catch(() => {});
  };

  return (
    <View style={styles.container}>
      <HomeHeader cursor={cursor} onChange={handleCursorChange} userName={userName} hasAlerts={hasAlerts} />
      <SuuRefreshBadge refreshing={refreshing} />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={{
          paddingTop: 14,
          paddingBottom: theme.layout.tabScreenScrollPad + insets.bottom,
        }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={accent}
            colors={[accent]}
          />
        }
      >
        {loadError && (
          <View style={styles.errorBanner}>
            <Text style={styles.errorTitle}>Couldn&rsquo;t load your data</Text>
            <Text style={styles.errorDetail}>{loadError}</Text>
          </View>
        )}

        <QuickActionsRow />

        {loaded ? (
          <ThisMonthHero
            periodKey={`${cursor.granularity}:${cursor.offset}`}
            direction={heroDirection}
            incomeMinor={dispIncome}
            spentMinor={dispExpense}
            surplusMinor={surplusInPeriod}
            outstandingLoansMinor={roundedMinor(totalOutstandingLoans)}
            suu={suu}
            celebrateDebtCleared={justClearedDebt}
          />
        ) : (
          <ThisMonthHeroSkeleton />
        )}

        {dailyGoalMinor != null && (
          <TodaySpendStrip spentMinor={todaySpendMinor} goalMinor={dailyGoalMinor} />
        )}

        {loaded && <NeedsYouCard items={needsYouItems} onOpen={openNeedsYou} onSnooze={snoozeNeedsYou} />}

        {!loaded && (
          <>
            <View style={{ marginTop: 22 }}>
              <CardRowsSkeleton rows={2} meter />
            </View>
            <HomeSection title="Recent activity">
              <CardRowsSkeleton rows={3} subtitle />
            </HomeSection>
            <HomeSection title="Your accounts">
              <StripSkeleton count={2} />
            </HomeSection>
          </>
        )}

        {loaded && <HomeSwipeCard pages={homeSwipePages} />}

        {loaded && (
          <HomeSection title="Recent activity" onSeeAll={() => router.push('/transactions')}>
            {recent.length === 0 ? (
              <EmptyState
                title="Nothing logged in this period"
                subtitle="Use the month pill above to check another period."
              />
            ) : (
              <View style={styles.card}>
                {recent.slice(0, 4).map((tx, i) => (
                  <Animated.View
                    key={tx.id}
                    entering={FadeIn.delay(Math.min(i * 60, MAX_LIST_STAGGER_MS))
                      .duration(280)
                      .reduceMotion(ReduceMotion.System)}
                  >
                    <RecentTransactionRow
                      tx={tx}
                      category={categoryFor(tx.categoryId) ?? undefined}
                      accountName={accountName(tx.accountId)}
                      toAccountName={accountName(tx.toAccountId)}
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
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.accountStrip}
              >
                {accounts.map((acc, i) => (
                  <Animated.View
                    key={acc.id}
                    entering={FadeIn.delay(Math.min(i * 60, MAX_LIST_STAGGER_MS))
                      .duration(280)
                      .reduceMotion(ReduceMotion.System)}
                  >
                    <AccountChip account={acc} />
                  </Animated.View>
                ))}
              </ScrollView>
            )}
          </HomeSection>
        )}
      </ScrollView>

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
  errorBanner: {
    marginHorizontal: 20,
    marginBottom: 14,
    padding: 14,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.expenseTint,
    borderWidth: theme.border.thin,
    borderColor: theme.colors.expense,
  },
  errorTitle: { fontFamily: theme.font.bodyBold, fontSize: 13, color: theme.colors.expense },
  errorDetail: { fontSize: 11.5, color: theme.colors.textSecondary, marginTop: 3, lineHeight: 16 },
  card: {
    marginHorizontal: 20,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.xl2,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.borderSoft,
    overflow: 'hidden',
  },
  accountStrip: { paddingHorizontal: 20, gap: 12, paddingBottom: 4 },
  emptyCta: { marginHorizontal: 40, marginTop: -8 },
  // Rows inside a HomeSwipeCard page — no outer border/background of their
  // own (the card already draws that), BudgetRow/UpcomingRow already carry
  // their own horizontal padding.
  pageList: { paddingHorizontal: 2 },
  goalsPageRow: { flexDirection: 'row', gap: 10, paddingHorizontal: 14 },
  goalsMoreTile: {
    width: 90,
    borderRadius: theme.radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.borderSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  goalsMoreText: { fontFamily: theme.font.bodyBold, fontSize: 12, color: theme.colors.textSecondary },
});

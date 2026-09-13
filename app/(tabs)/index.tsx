import { useCallback, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, RefreshControl } from 'react-native';
import Animated, { FadeInDown, FadeIn, ReduceMotion } from 'react-native-reanimated';
import Feather from '@expo/vector-icons/Feather';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, useFocusEffect } from 'expo-router';
import { listAccounts, listCategories, listTransactions } from '@/db/ledger';
import { listLoans, getNextDueInstallment, NextDueInstallment } from '@/db/loans';
import { listRecurringRules } from '@/db/recurring';
import { getRangeComparison, PeriodComparison, findTopGrowingCategory } from '@/db/reports';
import { getUserName } from '@/db/settings';
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
import { dueDateLabel } from '@/lib/dueDate';
import { MAX_LIST_STAGGER_MS } from '@/lib/animation';
import { HomeHeader } from '@/features/home/HomeHeader';
import { ThisMonthHero } from '@/features/home/ThisMonthHero';
import { QuickActionsRow } from '@/features/home/QuickActionsRow';
import { MoneyStatCard } from '@/features/home/MoneyStatCard';
import { HomeSection } from '@/features/home/HomeSection';
import { UpcomingRow, UpcomingMoreRow } from '@/features/home/UpcomingRow';
import { useCappedList } from '@/lib/useCappedList';
import { RecentTransactionRow } from '@/features/home/RecentTransactionRow';
import { AccountChip } from '@/features/home/AccountChip';
import { suuLine } from '@/features/home/suuLine';
import { BudgetRow } from '@/features/budgets/BudgetRow';
import { GoalChip } from '@/features/goals/GoalChip';

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
  const [refreshing, setRefreshing] = useState(false);
  const [userName, setUserNameState] = useState<string | null>(null);
  const [cursor, setCursor] = useState<PeriodCursor>(CURRENT_PERIOD);
  const [loadError, setLoadError] = useState<string | null>(null);

  const load = useCallback(async (c: PeriodCursor) => {
    const range = periodRange(c);
    try {
      const [accs, cats, tx, ln, rules, cmp, due, name, budgetList, goalList] = await Promise.all([
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
        // month, and a goal has no period at all.
        listBudgetsForMonth(),
        listSavingsGoals(),
      ]);
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
      setLoadError(null);
    } catch (e: any) {
      // Guard the throw so a transient DB error shows a banner instead of
      // freezing stale data + a stuck pull-to-refresh spinner.
      setLoadError(String(e?.message ?? e));
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

  const dispIncome = roundedMinor(comparison?.current.incomeMinor ?? 0);
  const dispExpense = roundedMinor(comparison?.current.expenseMinor ?? 0);
  const savingsInPeriod = roundedMinor(comparison?.current.savingsContributionMinor ?? 0);
  // Income − expense − whatever was already moved into savings this period.
  const surplusInPeriod = dispIncome - dispExpense - savingsInPeriod;

  const incomeChangePct = comparison?.incomeChangePct;
  const expenseChangePct = comparison?.expenseChangePct;

  const prevSurplus = comparison
    ? comparison.previous.incomeMinor -
      comparison.previous.expenseMinor -
      comparison.previous.savingsContributionMinor
    : 0;
  const surplusChangePct =
    !comparison || prevSurplus === 0
      ? surplusInPeriod === 0
        ? 0
        : null
      : ((surplusInPeriod - prevSurplus) / Math.abs(prevSurplus)) * 100;

  const topGrowing =
    comparison &&
    findTopGrowingCategory(comparison.current.categoryBreakdown, comparison.previous.categoryBreakdown);

  // "Saved" = income not spent (kept in any account), so the bar reflects
  // aggressive savers instead of reading 0% when they sweep cash into a pot.
  // The spend-is-up nudge (previously its own SpendingAlertCard, which just
  // repeated this hero's own "N% vs last" figure) is now folded into Suu's
  // line itself — see suuLine's own comment for why that takes priority.
  const savingsPct = savingsRatePct(dispIncome - dispExpense, dispIncome);
  const suu = suuLine(savingsPct, expenseChangePct ?? null, topGrowing?.name ?? null);

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
      subtitle: `Due ${dueDateLabel(nextDue.dueDate)}`,
      amountMinor: nextDue.emiAmountMinor,
      sign: '-',
      sortDate: nextDue.dueDate,
      onPress: () => router.push('/loans'),
    });
  }
  for (const rule of recurringRules) {
    if (!rule.active) continue;
    const isTransfer = rule.type === 'transfer';
    upcomingItems.push({
      key: rule.id,
      icon: isTransfer ? 'repeat' : rule.type === 'income' ? 'arrow-up-right' : 'arrow-down-right',
      iconBg: theme.colors.secondaryTint,
      title: isTransfer
        ? `${accountName(rule.accountId) ?? '—'} → ${accountName(rule.toAccountId) ?? '—'}`
        : rule.note || categoryFor(rule.categoryId)?.name || 'Recurring',
      subtitle: `Due ${dueDateLabel(rule.nextRunDate)}`,
      amountMinor: rule.amountMinor,
      sign: rule.type === 'income' ? '+' : rule.type === 'expense' ? '-' : '',
      sortDate: rule.nextRunDate,
      onPress: () => router.push('/recurring'),
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

  return (
    <View style={styles.container}>
      <HomeHeader cursor={cursor} onChange={setCursor} userName={userName} hasAlerts={hasAlerts} />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={{
          paddingTop: 14,
          paddingBottom: theme.layout.tabScreenScrollPad + insets.bottom,
        }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {loadError && (
          <View style={styles.errorBanner}>
            <Text style={styles.errorTitle}>Couldn&rsquo;t load your data</Text>
            <Text style={styles.errorDetail}>{loadError}</Text>
          </View>
        )}

        <QuickActionsRow />

        <ThisMonthHero
          incomeMinor={dispIncome}
          spentMinor={dispExpense}
          incomeChangePct={incomeChangePct}
          expenseChangePct={expenseChangePct}
          suu={suu}
        />

        <View style={styles.statRow}>
          <Animated.View
            style={{ flex: 1 }}
            entering={FadeInDown.duration(360).springify().reduceMotion(ReduceMotion.System)}
          >
            <MoneyStatCard
              label="Surplus"
              amountMinor={surplusInPeriod}
              changePct={surplusChangePct}
              tone={surplusInPeriod < 0 ? 'watch' : 'good'}
            />
          </Animated.View>
          <Animated.View
            style={{ flex: 1 }}
            entering={FadeInDown.duration(360).delay(60).springify().reduceMotion(ReduceMotion.System)}
          >
            <MoneyStatCard
              label="Debt left"
              amountMinor={roundedMinor(totalOutstandingLoans)}
              tone={totalOutstandingLoans === 0 ? 'good' : 'neutral'}
              footnote={totalOutstandingLoans === 0 ? '✓ All clear' : undefined}
            />
          </Animated.View>
        </View>

        {topBudgets.length > 0 && (
          <HomeSection title="Budgets" onSeeAll={() => router.push('/budgets')}>
            <View style={styles.card}>
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
          </HomeSection>
        )}

        {visibleUpcoming.length > 0 && (
          // No single "see all" destination now that this mixes loan EMIs
          // (Loans tab) and recurring rules (Recurring screen) — each row
          // already deep-links to where it actually lives.
          <HomeSection title="Upcoming">
            <View style={styles.card}>
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
                  />
                </Animated.View>
              ))}
              {hiddenUpcoming.length > 0 && (
                <UpcomingMoreRow count={hiddenUpcoming.length} divider onPress={expandUpcoming} />
              )}
            </View>
          </HomeSection>
        )}

        {activeGoals.length > 0 && (
          <HomeSection title="Savings goals" onSeeAll={() => router.push('/savings-goals')}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.accountStrip}
            >
              {activeGoals.map((goal, i) => (
                <Animated.View
                  key={goal.id}
                  entering={FadeIn.delay(Math.min(i * 60, MAX_LIST_STAGGER_MS))
                    .duration(280)
                    .reduceMotion(ReduceMotion.System)}
                >
                  <GoalChip goal={goal} onPress={() => router.push('/savings-goals')} />
                </Animated.View>
              ))}
            </ScrollView>
          </HomeSection>
        )}

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

        <HomeSection title="Your accounts" onSeeAll={() => router.push('/profile')}>
          {accounts.length === 0 ? (
            <EmptyState title="No accounts yet" subtitle="Add one from your profile." />
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
      </ScrollView>
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
  statRow: { flexDirection: 'row', gap: 10, marginHorizontal: 20, marginTop: 12 },
  card: {
    marginHorizontal: 20,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.xl2,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.borderSoft,
    overflow: 'hidden',
  },
  accountStrip: { paddingHorizontal: 20, gap: 12, paddingBottom: 4 },
});

import { useCallback, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, RefreshControl, Animated } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFadeIn } from '@/lib/useFadeIn';
import { router, useFocusEffect } from 'expo-router';
import { listAccounts, listCategories, listTransactions } from '@/db/ledger';
import { listLoans, getNextDueInstallment, NextDueInstallment } from '@/db/loans';
import { getRangeComparison, PeriodComparison, findTopGrowingCategory } from '@/db/reports';
import { getUserName } from '@/db/settings';
import { roundedMinor } from '@/lib/round';
import { savingsRatePct } from '@/lib/savingsRate';
import { Account, Category, Transaction, Loan } from '@/types';
import { theme, ID_PALETTE } from '@/constants/theme';
import { EmptyState } from '@/components/EmptyState';
import {
  CURRENT_PERIOD,
  PeriodCursor,
  periodRange,
  previousPeriodLabel,
  previousPeriodRange,
} from '@/lib/period';
import { daysUntilIsoDate } from '@/lib/date';
import { HomeHeader } from '@/features/home/HomeHeader';
import { ThisMonthHero } from '@/features/home/ThisMonthHero';
import { MoneyStatCard } from '@/features/home/MoneyStatCard';
import { SpendingAlertCard } from '@/features/home/SpendingAlertCard';
import { HomeSection } from '@/features/home/HomeSection';
import { UpcomingRow } from '@/features/home/UpcomingRow';
import { RecentTransactionRow } from '@/features/home/RecentTransactionRow';
import { AccountChip } from '@/features/home/AccountChip';
import { suuLine } from '@/features/home/suuLine';

/** "today" / "in N days" for a near due date; the actual calendar date once it's
 * far enough out that a raw day-count reads as broken rather than useful. */
function dueDateLabel(dateStr: string): string {
  const days = daysUntilIsoDate(dateStr);
  if (days <= 0) return 'today';
  if (days <= 90) return `in ${days} days`;
  return `on ${dateStr}`;
}

export default function DashboardScreen() {
  const insets = useSafeAreaInsets();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [recent, setRecent] = useState<Transaction[]>([]);
  const [loans, setLoans] = useState<Loan[]>([]);
  const [comparison, setComparison] = useState<PeriodComparison | null>(null);
  const [nextDue, setNextDue] = useState<NextDueInstallment | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [userName, setUserNameState] = useState<string | null>(null);
  const [cursor, setCursor] = useState<PeriodCursor>(CURRENT_PERIOD);
  const [loadError, setLoadError] = useState<string | null>(null);

  const load = useCallback(async (c: PeriodCursor) => {
    const range = periodRange(c);
    try {
      const [accs, cats, tx, ln, cmp, due, name] = await Promise.all([
        listAccounts(),
        listCategories(),
        // Scoped to the same period as the navigator above it — showing the
        // single most-recent transactions regardless of period previously
        // made "Recent Activity" contradict whatever month/year was selected.
        listTransactions({ fromDate: range.start, toDate: range.end, limit: 30 }),
        listLoans(),
        getRangeComparison(range, previousPeriodRange(c), c.granularity),
        getNextDueInstallment(),
        getUserName(),
      ]);
      setAccounts(accs);
      setCategories(cats);
      setRecent(tx);
      // A defaulted loan is still real money owed (or owed to you) — only a
      // 'closed' loan (fully paid off) should ever drop out of these totals.
      setLoans(ln.filter((l) => l.status !== 'closed'));
      setComparison(cmp);
      setNextDue(due);
      setUserNameState(name);
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
  const comparisonLabel = previousPeriodLabel(cursor);

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

  // "Saved" = income not spent (kept in any account), so the bar reflects
  // aggressive savers instead of reading 0% when they sweep cash into a pot.
  const savingsPct = savingsRatePct(dispIncome - dispExpense, dispIncome);
  const suu = suuLine(savingsPct, expenseChangePct ?? null);

  const topGrowing =
    comparison &&
    findTopGrowingCategory(comparison.current.categoryBreakdown, comparison.previous.categoryBreakdown);
  const showAlert = expenseChangePct != null && expenseChangePct > 0;
  const hasAlerts = nextDue !== null || !!topGrowing;

  const recentFadeStyle = useFadeIn([recent]);

  return (
    <View style={styles.container}>
      <HomeHeader cursor={cursor} onChange={setCursor} userName={userName} hasAlerts={hasAlerts} />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={{ paddingTop: 14, paddingBottom: 60 + insets.bottom }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {loadError && (
          <View style={styles.errorBanner}>
            <Text style={styles.errorTitle}>Couldn&rsquo;t load your data</Text>
            <Text style={styles.errorDetail}>{loadError}</Text>
          </View>
        )}

        <ThisMonthHero
          incomeMinor={dispIncome}
          spentMinor={dispExpense}
          incomeChangePct={incomeChangePct}
          expenseChangePct={expenseChangePct}
          suu={suu}
        />

        {showAlert && (
          <SpendingAlertCard
            changePct={expenseChangePct}
            comparisonLabel={comparisonLabel}
            topCategoryName={topGrowing?.name}
          />
        )}

        <View style={styles.statRow}>
          <MoneyStatCard
            label="Surplus"
            amountMinor={surplusInPeriod}
            changePct={surplusChangePct}
            tone={surplusInPeriod < 0 ? 'watch' : 'good'}
          />
          <MoneyStatCard
            label="Debt left"
            amountMinor={roundedMinor(totalOutstandingLoans)}
            tone={totalOutstandingLoans === 0 ? 'good' : 'neutral'}
            footnote={totalOutstandingLoans === 0 ? '✓ All clear' : undefined}
          />
        </View>

        {nextDue && (
          <HomeSection title="Upcoming" onSeeAll={() => router.push('/loans')}>
            <UpcomingRow
              counterparty={nextDue.counterparty}
              dueLabel={dueDateLabel(nextDue.dueDate)}
              amountMinor={nextDue.emiAmountMinor}
              onPress={() => router.push('/loans')}
            />
          </HomeSection>
        )}

        <HomeSection title="Recent activity" onSeeAll={() => router.push('/transactions')}>
          {recent.length === 0 ? (
            <EmptyState
              title="Nothing logged in this period"
              subtitle="Use the month pill above to check another period."
            />
          ) : (
            <Animated.View style={[styles.card, recentFadeStyle]}>
              {recent.slice(0, 4).map((tx, i) => (
                <RecentTransactionRow
                  key={tx.id}
                  tx={tx}
                  category={categoryFor(tx.categoryId) ?? undefined}
                  accountName={accountName(tx.accountId)}
                  toAccountName={accountName(tx.toAccountId)}
                  divider={i > 0}
                />
              ))}
            </Animated.View>
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
                <AccountChip key={acc.id} account={acc} fill={ID_PALETTE[i % ID_PALETTE.length]} />
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

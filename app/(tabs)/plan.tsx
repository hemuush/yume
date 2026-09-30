import { useCallback, useEffect, useRef, useState } from 'react';
import { View, ScrollView, StyleSheet } from 'react-native';
import { Text } from '@/components/Text';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { listBudgetsForMonth } from '@/db/budgets';
import { listSavingsGoals } from '@/db/savingsGoals';
import { listRecurringRules } from '@/db/recurring';
import { listLoans, getLoanProgress, getLoanPaymentContext, LoanPaymentContext } from '@/db/loans';
import { listPeople } from '@/db/people';
import { listAccounts, listCategories } from '@/db/ledger';
import { getDailyGoalStreakSeries, getCategoryMonthlyAverages } from '@/db/reports';
import { getDailySpendingGoal } from '@/db/settings';
import { Account, SavingsGoal } from '@/types';
import { theme } from '@/constants/theme';
import { toLocalIsoDate } from '@/lib/date';
import { AppHeader } from '@/components/AppHeader';
import { CardRowsSkeleton } from '@/components/ListSkeleton';
import { useScreenLoad } from '@/lib/useScreenLoad';
import { HOME } from '@/features/home/homeStyles';
import {
  buildLoansSummary,
  buildDueItems,
  buildDueSoon,
  buildDueDays,
  groupDueItems,
  buildBudgetsSummary,
  buildPeopleState,
  buildHabitState,
  LoansSummary,
  DueSoon,
  DueDay,
  DueGroup,
  BudgetsSummary,
  PeopleState,
  HabitState,
  PlanRoute,
} from '@/features/plan/planOverview';
import { PayInstallmentSheet } from '@/features/loans/PayInstallmentSheet';
import {
  TileRow,
  DueTile,
  EmiTile,
  BudgetTile,
  DebtTile,
  PeopleTile,
  HabitTile,
  SavingTile,
} from '@/features/plan/PlanTiles';
import { ComingUpSection } from '@/features/plan/ComingUpSection';
import { listCardCycles } from '@/db/cardCycles';

interface PlanData {
  loans: LoansSummary;
  dueSoon: DueSoon;
  dueDays: DueDay[];
  dueGroups: DueGroup[];
  savingsAccounts: Account[];
  budgets: BudgetsSummary;
  people: PeopleState;
  goals: SavingsGoal[];
  whatIf: { categoryName: string; avgMonthlyMinor: number } | null;
  habit: HabitState | null;
  dailyGoalMinor: number | null;
}

/**
 * Everything you're planning, at a glance: a bento of tiles (the Plan
 * sign-off, direction A), one per topic, then Coming up in full. The next
 * 14 days leads; then EMIs and Budgets side by side, the road to debt-free,
 * Friends & Family and the daily habit side by side, and Saving toward with
 * What-if. Every tile opens its own screen, and an empty one says what to
 * do next instead of disappearing. What each tile says is decided in
 * planOverview.ts.
 */
export default function PlanScreen() {
  const insets = useSafeAreaInsets();
  const [data, setData] = useState<PlanData | null>(null);

  const loadPlan = useCallback(async () => {
    const [
      budgets,
      goals,
      rules,
      loans,
      progress,
      people,
      categories,
      accounts,
      dailyGoal,
      averages,
      cardCycles,
    ] = await Promise.all([
      listBudgetsForMonth(),
      listSavingsGoals(),
      listRecurringRules(),
      listLoans(),
      getLoanProgress(),
      listPeople(),
      listCategories(),
      listAccounts(),
      getDailySpendingGoal(),
      getCategoryMonthlyAverages(3),
      listCardCycles().catch(() => []),
    ]);
    const streak = dailyGoal != null ? await getDailyGoalStreakSeries(dailyGoal, 5) : null;

    const accountName = (id: string | null) => accounts.find((a) => a.id === id)?.name ?? '—';
    const loansSummary = buildLoansSummary(loans, progress);
    // Same label Home's Upcoming list uses for a rule.
    const dueItems = buildDueItems(
      loansSummary.rows,
      rules.map((r) => ({
        id: r.id,
        type: r.type,
        active: r.active,
        nextRunDate: r.nextRunDate,
        amountMinor: r.amountMinor,
        label:
          r.type === 'transfer'
            ? `${accountName(r.accountId)} → ${accountName(r.toAccountId)}`
            : r.note || categories.find((c) => c.id === r.categoryId)?.name || 'Recurring',
      })),
      cardCycles
    );
    // The category with the most spend lately (already sorted biggest first)
    // that a spending cut could actually apply to: not a built-in category
    // like Loan EMI, which the app files automatically — "spend 10% less on
    // your EMI" isn't a choice anyone has.
    const top = averages.find(
      (c) => c.totalMinor > 0 && !categories.find((cat) => cat.id === c.categoryId)?.isSystem
    );

    const today = toLocalIsoDate(new Date());
    setData({
      loans: loansSummary,
      dueSoon: buildDueSoon(dueItems, today),
      dueDays: buildDueDays(dueItems, today),
      dueGroups: groupDueItems(dueItems, today),
      savingsAccounts: accounts.filter((a) => a.type === 'savings' && !a.archived),
      budgets: buildBudgetsSummary(
        budgets.map((b) => ({
          id: b.budget.id,
          categoryName: b.categoryName,
          spentMinor: b.spentMinor,
          effectiveLimitMinor: b.effectiveLimitMinor,
          remainingMinor: b.remainingMinor,
          percentUsed: b.percentUsed,
          overBudget: b.overBudget,
        }))
      ),
      people: buildPeopleState(people),
      goals,
      whatIf: top ? { categoryName: top.name, avgMonthlyMinor: top.totalMinor } : null,
      habit: streak ? buildHabitState(streak) : null,
      dailyGoalMinor: dailyGoal,
    });
  }, []);
  const { loaded, loadError, reload } = useScreenLoad(loadPlan);
  // The EMI being paid from Coming up, with the account and category it goes on.
  const [paying, setPaying] = useState<LoanPaymentContext | null>(null);
  const payEmi = async (loanId: string) => setPaying(await getLoanPaymentContext(loanId));
  const open = (route: PlanRoute) => router.push(route);
  // The 14-day tile jumps down to Coming up.
  const scrollRef = useRef<ScrollView>(null);
  const comingUpY = useRef(0);
  // Home's "+N more this week" lands here, already scrolled to Coming up.
  const { section } = useLocalSearchParams<{ section?: string }>();
  useEffect(() => {
    if (section !== 'coming-up' || !loaded || !data) return;
    const t = setTimeout(() => {
      scrollRef.current?.scrollTo({ y: Math.max(0, comingUpY.current - 8), animated: true });
      router.setParams({ section: undefined });
    }, 60);
    return () => clearTimeout(t);
  }, [section, loaded, data]);

  return (
    <View style={styles.container}>
      <AppHeader title="Plan" />
      <ScrollView
        ref={scrollRef}
        contentContainerStyle={{ paddingBottom: theme.layout.tabScreenScrollPad + insets.bottom }}
      >
        {loadError && (
          <View style={styles.errorBanner}>
            <Text style={styles.errorTitle}>Couldn&rsquo;t load your plans</Text>
            <Text style={styles.errorDetail}>{loadError}</Text>
          </View>
        )}

        {!loaded || !data ? (
          <View style={{ marginTop: HOME.sectionGap / 2, gap: HOME.sectionGap }}>
            <CardRowsSkeleton rows={3} meter />
            <CardRowsSkeleton rows={2} subtitle />
          </View>
        ) : (
          <>
            <DueTile
              dueSoon={data.dueSoon}
              days={data.dueDays}
              next={data.dueGroups.find((g) => g.outMinor > 0) ?? null}
              onPress={() =>
                scrollRef.current?.scrollTo({ y: Math.max(0, comingUpY.current - 8), animated: true })
              }
            />
            <TileRow>
              <EmiTile
                dueSoon={data.dueSoon}
                groups={data.dueGroups}
                loans={data.loans}
                onOpen={() => open('/loans')}
              />
              <BudgetTile summary={data.budgets} onOpen={() => open('/budgets')} />
            </TileRow>
            <DebtTile loans={data.loans} onOpen={() => open('/loans')} />
            <TileRow>
              <PeopleTile state={data.people} onOpen={() => open('/people')} />
              <HabitTile habit={data.habit} goalMinor={data.dailyGoalMinor} onOpen={() => open('/garden')} />
            </TileRow>
            <SavingTile
              goals={data.goals}
              savingsAccounts={data.savingsAccounts}
              whatIf={data.whatIf}
              onOpenGoals={() => open('/savings-goals')}
              onOpenWhatIf={() => open('/whatif')}
            />
            <View onLayout={(e) => (comingUpY.current = e.nativeEvent.layout.y)}>
              <ComingUpSection groups={data.dueGroups} onOpen={open} onPay={(id) => void payEmi(id)} />
            </View>
          </>
        )}
      </ScrollView>
      {paying && (
        <PayInstallmentSheet
          installment={paying.installment}
          account={paying.account}
          categoryId={paying.categoryId}
          onClose={() => setPaying(null)}
          onPaid={reload}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  errorBanner: {
    marginHorizontal: 20,
    marginBottom: 14,
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
});

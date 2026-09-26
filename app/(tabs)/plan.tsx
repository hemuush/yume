import { useCallback, useState } from 'react';
import { View, ScrollView, StyleSheet } from 'react-native';
import { Text } from '@/components/Text';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { listBudgetsForMonth } from '@/db/budgets';
import { listSavingsGoals } from '@/db/savingsGoals';
import { listRecurringRules } from '@/db/recurring';
import { listLoans, getLoanProgress } from '@/db/loans';
import { listPeople } from '@/db/people';
import { listAccounts, listCategories } from '@/db/ledger';
import { getDailyGoalStreakSeries, getCategoryMonthlyAverages } from '@/db/reports';
import { getDailySpendingGoal } from '@/db/settings';
import { SavingsGoal } from '@/types';
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
  buildBudgetsSummary,
  buildPeopleState,
  buildHabitState,
  LoansSummary,
  PlanDueItem,
  DueSoon,
  BudgetsSummary,
  PeopleState,
  HabitState,
  PlanRoute,
} from '@/features/plan/planOverview';
import {
  LoansSection,
  DueSoonCard,
  ComingUpSection,
  BudgetsSection,
  PeopleSection,
  SavingSection,
  HabitSection,
} from '@/features/plan/PlanSections';

interface PlanData {
  loans: LoansSummary;
  dueItems: PlanDueItem[];
  dueSoon: DueSoon;
  budgets: BudgetsSummary;
  people: PeopleState;
  goals: SavingsGoal[];
  whatIf: { categoryName: string; avgMonthlyMinor: number } | null;
  habit: HabitState | null;
  dailyGoalMinor: number | null;
}

/**
 * Everything you're planning, as a look ahead rather than a menu — every
 * section shows its own real numbers and opens its full screen. Ordered by
 * priority (the Plan sign-off): Loans, what's due in the next two weeks,
 * Coming up, Budgets, Friends & Family, Saving toward (Goals + What-if),
 * then the daily habit (Suu's Garden). All seven of the old tiles' screens
 * stay one tap away — an empty section says what to do next instead of
 * disappearing. What each section says is decided in planOverview.ts.
 */
export default function PlanScreen() {
  const insets = useSafeAreaInsets();
  const [data, setData] = useState<PlanData | null>(null);

  const loadPlan = useCallback(async () => {
    const [budgets, goals, rules, loans, progress, people, categories, accounts, dailyGoal, averages] =
      await Promise.all([
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
      }))
    );
    // The category with the most spend lately (already sorted biggest first)
    // that a spending cut could actually apply to: not a built-in category
    // like Loan EMI, which the app files automatically — "spend 10% less on
    // your EMI" isn't a choice anyone has.
    const top = averages.find(
      (c) => c.totalMinor > 0 && !categories.find((cat) => cat.id === c.categoryId)?.isSystem
    );

    setData({
      loans: loansSummary,
      dueItems,
      dueSoon: buildDueSoon(dueItems, toLocalIsoDate(new Date())),
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
  const { loaded, loadError } = useScreenLoad(loadPlan);
  const open = (route: PlanRoute) => router.push(route);

  return (
    <View style={styles.container}>
      <AppHeader title="Plan" />
      <ScrollView contentContainerStyle={{ paddingBottom: theme.layout.tabScreenScrollPad + insets.bottom }}>
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
            <LoansSection summary={data.loans} onOpen={() => open('/loans')} />
            <DueSoonCard dueSoon={data.dueSoon} />
            <ComingUpSection items={data.dueItems} onOpen={open} />
            <BudgetsSection summary={data.budgets} onOpen={() => open('/budgets')} />
            <PeopleSection state={data.people} onOpen={() => open('/people')} />
            <SavingSection
              goals={data.goals}
              whatIf={data.whatIf}
              onOpenGoals={() => open('/savings-goals')}
              onOpenWhatIf={() => open('/whatif')}
            />
            <HabitSection habit={data.habit} goalMinor={data.dailyGoalMinor} onOpen={() => open('/garden')} />
          </>
        )}
      </ScrollView>
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
  errorTitle: { fontFamily: theme.font.bodyBold, fontSize: 13, color: theme.colors.expense },
  errorDetail: {
    fontFamily: theme.font.body,
    fontSize: 11.5,
    color: theme.colors.textSecondary,
    marginTop: 3,
    lineHeight: 16,
  },
});

import { useCallback, useEffect, useRef, useState } from 'react';
import { View, StyleSheet } from 'react-native';
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
import { usePrivacy } from '@/theme/PrivacyContext';
import { isSavingsEntry } from '@/lib/privateSummary';
import { savingsAccountIdsOf } from '@/lib/account';
import { Account, SavingsGoal } from '@/types';
import { theme } from '@/constants/theme';
import { useTabScrollPad } from '@/lib/uiScale';
import { addDaysToIsoDate, toLocalIsoDate } from '@/lib/date';
import { SkyHeader, HeaderSummary } from '@/features/home/SkyHeader';
import ReanimatedAnimated from 'react-native-reanimated';
import { useCollapsingHeader } from '@/lib/useCollapsingHeader';
import { formatMoney } from '@/lib/money';
import { CardRowsSkeleton } from '@/components/ListSkeleton';
import { useScreenLoad } from '@/lib/useScreenLoad';
import { categorySentence, parentNameOf } from '@/lib/categoryLabel';
import { SCREEN } from '@/components/screenStyles';
import { Section } from '@/components/Section';
import { SECTION_GAP } from '@/constants/textStyles';
import {
  buildLoansSummary,
  buildDueItems,
  buildDueSoon,
  buildDueDays,
  groupDueItems,
  buildBudgetsSummary,
  buildPeopleState,
  buildHabitState,
  DUE_SOON_DAYS,
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
  TileGroup,
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
import { showAlert } from '@/components/AppDialog';
import { errorMessage } from '@/lib/errorMessage';
import { useTabScrollToTop } from '@/lib/useTabScrollToTop';

interface PlanData {
  loans: LoansSummary;
  dueSoon: DueSoon;
  dueDays: DueDay[];
  dueGroups: DueGroup[];
  today: string;
  savingsAccounts: Account[];
  budgets: BudgetsSummary;
  people: PeopleState;
  goals: SavingsGoal[];
  whatIf: { categoryName: string; avgMonthlyMinor: number } | null;
  habit: HabitState | null;
  dailyGoalMinor: number | null;
}

/**
 * Everything you're planning: one tile per topic in titled groups (next 14 days, Where you stand, Goals,
 * People & habit), then Coming up. Tiles open their screen; empty ones say what to do (planOverview.ts).
 */
export default function PlanScreen() {
  const insets = useSafeAreaInsets();
  const tabScrollPad = useTabScrollPad();
  const { hideAmounts } = usePrivacy();
  const [data, setData] = useState<PlanData | null>(null);

  const loadPlan = useCallback(async () => {
    const dailyGoalRead = getDailySpendingGoal();
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
      streak,
    ] = await Promise.all([
      listBudgetsForMonth(undefined, hideAmounts),
      listSavingsGoals(),
      listRecurringRules(),
      listLoans(),
      getLoanProgress(),
      listPeople(),
      listCategories(),
      listAccounts(),
      dailyGoalRead,
      getCategoryMonthlyAverages(3),
      listCardCycles().catch(() => []),
      // The streak only needs the goal value, so it chains off the same read instead of waiting for the batch.
      dailyGoalRead.then((goal) => (goal != null ? getDailyGoalStreakSeries(goal, 5) : null)),
    ]);

    const categoriesById = new Map(categories.map((c) => [c.id, c]));
    const categoryLabelOf = (id: string | null) => {
      const cat = id ? categoriesById.get(id) : undefined;
      return cat ? categorySentence(cat.name, parentNameOf(id, categoriesById)) : undefined;
    };
    const savingsIds = savingsAccountIdsOf(accounts);
    const accountName = (id: string | null) => accounts.find((a) => a.id === id)?.name ?? '—';
    const loansSummary = buildLoansSummary(loans, progress);
    // Same label Home's Upcoming list uses for a rule.
    const dueItems = buildDueItems(
      loansSummary.rows,
      rules
        .filter((r) => !hideAmounts || !isSavingsEntry(r, categoriesById, savingsIds))
        .map((r) => ({
          id: r.id,
          type: r.type,
          active: r.active,
          nextRunDate: r.nextRunDate,
          frequency: r.frequency,
          intervalCount: r.intervalCount,
          endDate: r.endDate,
          amountMinor: r.amountMinor,
          label:
            r.type === 'transfer'
              ? `${accountName(r.accountId)} → ${accountName(r.toAccountId)}`
              : r.note || categoryLabelOf(r.categoryId) || 'Recurring',
        })),
      cardCycles,
      // Every run in the fortnight Plan shows: a weekly bill is due twice in it, not once.
      addDaysToIsoDate(toLocalIsoDate(new Date()), DUE_SOON_DAYS - 1)
    );
    // The top-spend category (sorted biggest first) a cut could apply to: not a built-in like Loan EMI,
    // which the app files automatically — "spend 10% less on your EMI" isn't a real choice.
    const top = averages.find(
      (c) =>
        c.totalMinor > 0 &&
        !(hideAmounts && c.isSensitive) &&
        !categories.find((cat) => cat.id === c.categoryId)?.isSystem
    );

    const today = toLocalIsoDate(new Date());
    setData({
      loans: loansSummary,
      dueSoon: buildDueSoon(dueItems, today),
      dueDays: buildDueDays(dueItems, today),
      dueGroups: groupDueItems(dueItems, today),
      today,
      savingsAccounts: accounts.filter((a) => a.type === 'savings' && !a.archived),
      budgets: buildBudgetsSummary(
        budgets.map((b) => ({
          id: b.budget.id,
          categoryName: categorySentence(b.categoryName, b.parentName),
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
  }, [hideAmounts]);
  const { loaded, loadError, reload } = useScreenLoad(loadPlan, { skipWhenUnchanged: true });
  // The EMI being paid from Coming up, with the account and category it goes on.
  const [paying, setPaying] = useState<LoanPaymentContext | null>(null);
  const payEmi = async (loanId: string) => {
    try {
      const context = await getLoanPaymentContext(loanId);
      if (context) setPaying(context);
      else showAlert('Nothing to pay', 'This loan has no installment due right now.');
    } catch (e) {
      showAlert("Couldn't open the payment", errorMessage(e));
    }
  };
  const open = (route: PlanRoute) => router.push(route);
  // The header shrinks as the page scrolls; the 14-day tile jumps down to Coming up.
  const { collapse, headerHeight, collapsedHeight, scrollHandler, scrollRef } = useCollapsingHeader();
  useTabScrollToTop(scrollRef);
  // A jump lands just under the collapsed header, which sits over the page.
  const underHeader = () => collapsedHeight;
  const comingUpY = useRef(0);
  // Where Coming up's card and each day's group sit, for the strip's jump.
  const cardY = useRef(0);
  const groupYs = useRef<Record<string, number>>({});
  const scrollToComingUp = useCallback(
    () =>
      scrollRef.current?.scrollTo({ y: Math.max(0, comingUpY.current - underHeader() - 8), animated: true }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [collapsedHeight]
  );
  // A day on the strip lands on its group; today also covers anything overdue,
  // which sits under its own earlier date, so fall back to the earliest group.
  const scrollToDay = (date: string) => {
    const dates = data?.dueGroups.map((g) => g.date) ?? [];
    const target = dates.includes(date) ? date : dates[0];
    const groupY = target == null ? undefined : groupYs.current[target];
    if (groupY == null) return scrollToComingUp();
    scrollRef.current?.scrollTo({
      y: Math.max(0, comingUpY.current + SECTION_GAP.top + cardY.current + groupY - underHeader() - 8),
      animated: true,
    });
  };
  // Home's "+N more this week" lands here, already scrolled to Coming up.
  const { section } = useLocalSearchParams<{ section?: string }>();
  useEffect(() => {
    if (section !== 'coming-up' || !loaded || !data) return;
    const t = setTimeout(() => {
      scrollToComingUp();
      router.setParams({ section: undefined });
    }, 60);
    return () => clearTimeout(t);
  }, [section, loaded, data, scrollToComingUp]);

  return (
    <View style={styles.container}>
      <ReanimatedAnimated.ScrollView
        ref={scrollRef}
        onScroll={scrollHandler}
        scrollEventThrottle={16}
        contentContainerStyle={{
          paddingTop: headerHeight,
          paddingBottom: tabScrollPad + insets.bottom,
        }}
      >
        {loadError && (
          <View style={styles.errorBanner}>
            <Text style={styles.errorTitle}>Couldn&rsquo;t load your plans</Text>
            <Text style={styles.errorDetail}>{loadError}</Text>
          </View>
        )}

        {!loaded || !data ? (
          <View style={{ marginTop: theme.layout.screenTopGap, gap: SCREEN.sectionGap }}>
            <CardRowsSkeleton rows={3} meter />
            <CardRowsSkeleton rows={2} subtitle />
          </View>
        ) : (
          <>
            <TileGroup first>
              <DueTile
                dueSoon={data.dueSoon}
                days={data.dueDays}
                next={data.dueGroups.find((g) => g.outMinor > 0) ?? null}
                onPress={scrollToComingUp}
                onJumpToDay={scrollToDay}
              />
            </TileGroup>
            <Section title="Where you stand">
              <TileGroup>
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
              </TileGroup>
            </Section>
            <Section title="Goals" onSeeAll={() => open('/savings-goals')}>
              <TileGroup>
                <SavingTile
                  goals={data.goals}
                  savingsAccounts={data.savingsAccounts}
                  whatIf={data.whatIf}
                  onOpenGoals={() => open('/savings-goals')}
                  onOpenWhatIf={() => open('/whatif')}
                />
              </TileGroup>
            </Section>
            <Section title="People & habit">
              <TileGroup>
                <TileRow>
                  <PeopleTile state={data.people} onOpen={() => open('/people')} />
                  <HabitTile
                    habit={data.habit}
                    goalMinor={data.dailyGoalMinor}
                    onOpen={() => open('/garden')}
                  />
                </TileRow>
              </TileGroup>
            </Section>
            <View onLayout={(e) => (comingUpY.current = e.nativeEvent.layout.y)}>
              <ComingUpSection
                groups={data.dueGroups}
                today={data.today}
                onOpen={open}
                onPay={(id) => void payEmi(id)}
                onCardLayout={(y) => (cardY.current = y)}
                onGroupLayout={(date, y) => (groupYs.current[date] = y)}
              />
            </View>
          </>
        )}
      </ReanimatedAnimated.ScrollView>
      <SkyHeader
        title="Plan"
        subtitle="What’s ahead, and where you stand"
        collapse={collapse}
        summary={
          data && data.dueSoon.count > 0 ? (
            <HeaderSummary
              figure={formatMoney(data.dueSoon.totalMinor)}
              rest="due in 14 days"
              dot={theme.colors.slice.due}
            />
          ) : undefined
        }
      />
      {paying && (
        <PayInstallmentSheet
          installment={paying.installment}
          account={paying.account}
          categoryId={paying.categoryId}
          linkedAccountMissing={paying.linkedAccountMissing}
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
    marginTop: theme.layout.screenTopGap,
    marginBottom: 12,
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

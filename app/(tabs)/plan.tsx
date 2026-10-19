import { useCallback, useEffect, useRef, useState } from 'react';
import { View, Pressable, StyleSheet, useWindowDimensions } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { Text } from '@/components/Text';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { listBudgetsForMonth } from '@/db/budgets';
import { listSavingsGoals } from '@/db/savingsGoals';
import { listRecurringRules } from '@/db/recurring';
import { listLoans, getLoanProgress, getLoanPaymentContext, LoanPaymentContext } from '@/db/loans';
import { listPeople } from '@/db/people';
import { listAccounts, listCategories } from '@/db/ledger';
import { getDailyGoalStreakSeries, getCategoryMonthlyAverages } from '@/db/reports';
import { getDailySpendingGoal, getDefaultCurrency } from '@/db/settings';
import { usePrivacy } from '@/theme/PrivacyContext';
import { isSavingsEntry } from '@/lib/privateSummary';
import { recurringRulesInCurrency } from '@/lib/recurringScope';
import { savingsAccountIdsOf } from '@/lib/account';
import { Account, Category, Loan, SavingsGoal, RecurringRule, Transaction } from '@/types';
import type { BudgetProgress } from '@/db/budgets';
import type { PersonWithBalance } from '@/db/people';
import { AddBudgetModal } from '@/features/budgets/AddBudgetModal';
import { RuleModal } from '@/features/recurring/RuleModal';
import { BudgetDetailModal } from '@/features/budgets/BudgetDetailModal';
import { LoanDetailModal } from '@/features/loans/LoanDetailModal';
import { loanHues } from '@/features/loans/loanIdentity';
import { PersonDetailModal } from '@/features/people/PersonDetailModal';
import { theme } from '@/constants/theme';
import { useTabScrollPad } from '@/lib/uiScale';
import { addDaysToIsoDate, toLocalIsoDate } from '@/lib/date';
import { SkyHeader, HeaderSummary } from '@/features/home/SkyHeader';
import ReanimatedAnimated from 'react-native-reanimated';
import { useCollapsingHeader } from '@/lib/useCollapsingHeader';
import { formatMoney } from '@/lib/money';
import { useAccent } from '@/theme/AccentContext';
import { HomeWallpaper } from '@/features/home/HomeWallpaper';
import { CardRowsSkeleton } from '@/components/ListSkeleton';
import { useScreenLoad } from '@/lib/useScreenLoad';
import { categorySentence, parentNameOf } from '@/lib/categoryLabel';
import { SCREEN } from '@/components/screenStyles';
import { Section } from '@/components/Section';
import {
  buildLoansSummary,
  buildDueItems,
  buildDueSoon,
  groupDueItems,
  buildBudgetsSummary,
  buildPeopleState,
  buildHabitState,
  PLAN_DAYS,
  LoansSummary,
  DueSoon,
  DueGroup,
  BudgetsSummary,
  PeopleState,
  HabitState,
  PlanRoute,
} from '@/features/plan/planOverview';
import { PayInstallmentSheet } from '@/features/loans/PayInstallmentSheet';
import { PeopleTile, HabitTile, PlanPerson, PEOPLE_SHOWN } from '@/features/plan/PlanTiles';
import { RunwayCard } from '@/features/plan/RunwayCard';
import { BudgetJars } from '@/features/plan/BudgetJars';
import { DebtPath } from '@/features/plan/DebtPath';
import { DebtLoans } from '@/features/plan/DebtLoans';
import { PlanStats } from '@/features/plan/PlanStats';
import { SegmentedControl } from '@/components/SegmentedControl';
import { GoalOverviewModal } from '@/features/goals/GoalOverviewModal';
import { AddGoalModal } from '@/features/goals/AddGoalModal';
import { GoalsStrip, WhatIfCard } from '@/features/plan/PlanGoals';
import { buildRunway, isRunwayAccount, runwayStartMinor, Runway } from '@/features/plan/runway';
import { styles as planStyles } from '@/features/plan/plan.styles';
import { ComingUpSection } from '@/features/plan/ComingUpSection';
import { listCardCycles } from '@/db/cardCycles';
import { showAlert } from '@/components/AppDialog';
import { errorMessage } from '@/lib/errorMessage';
import { useTabScrollToTop } from '@/lib/useTabScrollToTop';
import { withPressed } from '@/lib/pressed';
import { PrimaryButton } from '@/components/PrimaryButton';
import { TransactionDetailModal } from '@/features/transactions/TransactionDetailModal';
import { PendingRefunds } from '@/features/transactions/PendingRefunds';

interface PlanData {
  hideAmounts: boolean;
  currency: string;
  accounts: Account[];
  categories: Category[];
  budgetDetails: BudgetProgress[];
  loanDetails: Loan[];
  personDetails: PersonWithBalance[];
  ruleDetails: RecurringRule[];
  loans: LoansSummary;
  dueSoon: DueSoon;
  dueGroups: DueGroup[];
  runway: Runway;
  /** Whether a bank, cash or wallet account holds the balance the runway starts from. */
  hasAccounts: boolean;
  /** Payment-sheet balances, by account id. */
  balances: Record<string, number>;
  today: string;
  savingsAccounts: Account[];
  budgets: BudgetsSummary;
  people: PeopleState;
  topPeople: PlanPerson[];
  goals: SavingsGoal[];
  whatIf: { categoryId: string; categoryName: string; avgMonthlyMinor: number } | null;
  habit: HabitState | null;
  dailyGoalMinor: number | null;
}

type PlanTab = 'overview' | 'upcoming' | 'goals' | 'debt';
const TABS: { label: string; value: PlanTab }[] = [
  { label: 'Overview', value: 'overview' },
  { label: 'Upcoming', value: 'upcoming' },
  { label: 'Goals', value: 'goals' },
  { label: 'Debt', value: 'debt' },
];
/** Overview shows one row of budget and goal tiles and this many payments; the tabs hold the rest. */
const PREVIEW_PAYMENTS = 3;
const PREVIEW_TILES = 3;

/** Plan previews open item sheets directly; collection links keep the full-screen routes. */
export default function PlanScreen() {
  const { width, fontScale } = useWindowDimensions();
  const stackTiles = width < 360 || fontScale > 1.2;
  const insets = useSafeAreaInsets();
  const tabScrollPad = useTabScrollPad();
  const { hideAmounts } = usePrivacy();
  const { accent, secondary } = useAccent();
  const [data, setData] = useState<PlanData | null>(null);
  const request = useRef(0);
  const paymentRequest = useRef(0);
  const openingPayment = useRef(false);
  const [detail, setDetail] = useState<{
    kind: 'loan' | 'budget' | 'person' | 'goal' | 'new-goal' | 'new-budget' | 'rule';
    id: string;
  } | null>(null);
  const [refundTx, setRefundTx] = useState<Transaction | null>(null);
  const [tab, setTab] = useState<PlanTab>('overview');
  // Home's "See all upcoming" arrives with ?tab=upcoming; the param is spent once it has picked the tab.
  const { tab: tabParam } = useLocalSearchParams<{ tab?: string }>();
  useEffect(() => {
    if (tabParam == null) return;
    const picked = TABS.find((t) => t.value === tabParam);
    if (picked) setTab(picked.value);
    router.setParams({ tab: undefined });
  }, [tabParam]);
  useFocusEffect(
    useCallback(
      () => () => {
        paymentRequest.current++;
        openingPayment.current = false;
      },
      []
    )
  );

  const loadPlan = useCallback(async () => {
    const call = ++request.current;
    const today = toLocalIsoDate(new Date());
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
      currency,
    ] = await Promise.all([
      listBudgetsForMonth(undefined, hideAmounts),
      listSavingsGoals(),
      listRecurringRules(),
      listLoans(),
      getLoanProgress(),
      listPeople(),
      listCategories(true),
      listAccounts(),
      dailyGoalRead,
      getCategoryMonthlyAverages(3),
      listCardCycles(),
      // The streak only needs the goal value, so it chains off the same read instead of waiting for the batch.
      dailyGoalRead.then((goal) => (goal != null ? getDailyGoalStreakSeries(goal, 5) : null)),
      getDefaultCurrency(),
    ]);

    if (call !== request.current) return;
    const categoriesById = new Map(categories.map((c) => [c.id, c]));
    const categoryLabelOf = (id: string | null) => {
      const cat = id ? categoriesById.get(id) : undefined;
      return cat ? categorySentence(cat.name, parentNameOf(id, categoriesById)) : undefined;
    };
    const savingsIds = savingsAccountIdsOf(accounts);
    const accountName = (id: string | null) => accounts.find((a) => a.id === id)?.name ?? '—';
    const loansSummary = buildLoansSummary(loans, progress);
    // Same label Home's Upcoming list uses for a rule.
    const toRuleInput = (r: (typeof rules)[number], type: 'income' | 'expense' | 'transfer' = r.type) => ({
      id: r.id,
      type,
      active: r.active,
      nextRunDate: r.nextRunDate,
      frequency: r.frequency,
      intervalCount: r.intervalCount,
      anchorDay: r.anchorDay,
      endDate: r.endDate,
      amountMinor: r.amountMinor,
      label:
        r.type === 'transfer'
          ? `${accountName(r.accountId)} → ${accountName(r.toAccountId)}`
          : r.note || categoryLabelOf(r.categoryId) || 'Recurring',
    });
    const visibleRules = recurringRulesInCurrency(
      rules.filter((r) => !hideAmounts || !isSavingsEntry(r, categoriesById, savingsIds)),
      accounts,
      currency
    );
    const until = addDaysToIsoDate(today, PLAN_DAYS - 1);
    // Every run in the fortnight Plan shows: a weekly bill is due twice in it, not once.
    const dueItems = buildDueItems(
      loansSummary.rows,
      visibleRules.map((r) => toRuleInput(r)),
      cardCycles,
      until
    );
    // The runway only moves with money in and out of bank, cash and wallets: a bill charged to a card waits for
    // the card's own bill, and a transfer counts when it crosses in or out of those accounts (a SIP to an
    // investment account goes out; a sweep from savings comes in).
    const runwayIds = new Set(accounts.filter((a) => isRunwayAccount(a, currency)).map((a) => a.id));
    const runwayRules = visibleRules.flatMap((r) => {
      const from = runwayIds.has(r.accountId);
      if (r.type !== 'transfer') return from ? [toRuleInput(r)] : [];
      const to = r.toAccountId != null && runwayIds.has(r.toAccountId);
      if (from && !to) return [toRuleInput(r, 'expense')];
      if (!from && to) return [toRuleInput(r, 'income')];
      return [];
    });
    const runwayItems = buildDueItems(loansSummary.rows, runwayRules, cardCycles, until);
    // The top-spend category (sorted biggest first) a cut could apply to: not a built-in like Loan EMI,
    // which the app files automatically — "spend 10% less on your EMI" isn't a real choice.
    const top = averages.find(
      (c) =>
        c.totalMinor > 0 &&
        !(hideAmounts && c.isSensitive) &&
        !categories.find((cat) => cat.id === c.categoryId)?.isSystem
    );

    setData({
      hideAmounts,
      currency,
      accounts,
      categories,
      budgetDetails: budgets,
      loanDetails: loans,
      personDetails: people,
      ruleDetails: visibleRules,
      loans: loansSummary,
      dueSoon: buildDueSoon(dueItems, today, PLAN_DAYS),
      dueGroups: groupDueItems(dueItems, today, PLAN_DAYS),
      runway: buildRunway(runwayStartMinor(accounts, currency), runwayItems, today, PLAN_DAYS),
      hasAccounts: accounts.some((a) => isRunwayAccount(a, currency)),
      // A savings balance stays hidden in privacy mode, so the pay sheet doesn't show it either.
      balances: Object.fromEntries(
        accounts
          .filter((a) => !(hideAmounts && a.type === 'savings'))
          .map((a) => [a.id, a.currentBalanceMinor])
      ),
      today,
      savingsAccounts: accounts.filter((a) => a.type === 'savings' && !a.archived),
      budgets: buildBudgetsSummary(
        budgets.map((b) => ({
          id: b.budget.id,
          categoryName: categorySentence(b.categoryName, b.parentName),
          categoryIcon: b.categoryIcon,
          categoryColor: b.categoryColor,
          spentMinor: b.spentMinor,
          effectiveLimitMinor: b.effectiveLimitMinor,
          remainingMinor: b.remainingMinor,
          percentUsed: b.percentUsed,
          overBudget: b.overBudget,
        }))
      ),
      people: buildPeopleState(people),
      topPeople: [...people]
        .filter((p) => p.balanceMinor !== 0)
        .sort((a, b) => Math.abs(b.balanceMinor) - Math.abs(a.balanceMinor))
        .slice(0, PEOPLE_SHOWN)
        .map((p) => ({ id: p.id, name: p.name, balanceMinor: p.balanceMinor })),
      goals,
      whatIf: top
        ? { categoryId: top.categoryId, categoryName: top.name, avgMonthlyMinor: top.totalMinor }
        : null,
      habit: streak ? buildHabitState(streak) : null,
      dailyGoalMinor: dailyGoal,
    });
  }, [hideAmounts]);
  // Time changes the 14-day window even when nobody writes to the ledger.
  const { loaded, loadError, reload } = useScreenLoad(loadPlan);
  useEffect(
    () => () => {
      request.current++;
      paymentRequest.current++;
    },
    []
  );
  // The EMI being paid from Coming up, with the account and category it goes on.
  const [paying, setPaying] = useState<LoanPaymentContext | null>(null);
  const payEmi = async (loanId: string) => {
    if (openingPayment.current) return;
    openingPayment.current = true;
    const ticket = ++paymentRequest.current;
    setDetail(null);
    setRefundTx(null);
    try {
      const context = await getLoanPaymentContext(loanId);
      if (ticket !== paymentRequest.current) return;
      if (context) setPaying(context);
      else showAlert('Nothing to pay', 'This loan has no installment due right now.');
    } catch (e) {
      if (ticket === paymentRequest.current) showAlert("Couldn't open the payment", errorMessage(e));
    } finally {
      if (ticket === paymentRequest.current) openingPayment.current = false;
    }
  };
  const openDetail = (
    kind: 'loan' | 'budget' | 'person' | 'goal' | 'new-goal' | 'new-budget' | 'rule',
    id: string
  ) => {
    // A slow earlier Pay lookup must not cover a detail the user opened more recently.
    paymentRequest.current++;
    openingPayment.current = false;
    setPaying(null);
    setRefundTx(null);
    setDetail({ kind, id });
  };
  const open = (route: PlanRoute) => router.push(route);
  // The header shrinks as the page scrolls.
  const { collapse, headerHeight, scrollHandler, scrollRef } = useCollapsingHeader();
  useTabScrollToTop(scrollRef);

  const scoped = data?.hideAmounts === hideAmounts ? data : null;
  const selectedLoan =
    detail?.kind === 'loan'
      ? scoped?.loanDetails.find((l) => l.id === detail.id && l.status !== 'closed')
      : undefined;
  const selectedBudget =
    detail?.kind === 'budget' ? scoped?.budgetDetails.find((b) => b.budget.id === detail.id) : undefined;
  const selectedPerson =
    detail?.kind === 'person' ? scoped?.personDetails.find((p) => p.id === detail.id) : undefined;
  const selectedRule =
    detail?.kind === 'rule' ? scoped?.ruleDetails.find((r) => r.id === detail.id) : undefined;
  const selectedGoal =
    detail?.kind === 'goal' ? scoped?.goals.find((g) => g.id === detail.id && !g.archived) : undefined;
  useEffect(() => {
    if (scoped && ((detail?.kind === 'goal' && !selectedGoal) || (detail?.kind === 'rule' && !selectedRule)))
      setDetail(null);
  }, [detail, scoped, selectedGoal, selectedRule]);

  // With no loan yet the Debt card is the "Track an EMI" prompt: it goes straight to Loans, not to a tab of it.
  const openDebt = () => (scoped && scoped.loans.rows.length > 0 ? setTab('debt') : open('/loans'));
  const nextPayment = (() => {
    const first = scoped?.dueGroups.find((g) => g.outMinor > 0);
    const item = first?.items.find((i) => i.kind === 'emi' || i.kind === 'bill');
    return first && item ? { date: first.date, title: item.title } : null;
  })();
  const upcoming = (limit?: number) =>
    scoped && (
      <ComingUpSection
        groups={scoped.dueGroups}
        today={scoped.today}
        limit={limit}
        onOpen={open}
        onPay={(id) => void payEmi(id)}
        onLoan={(id) => openDetail('loan', id)}
        onRule={(id) => openDetail('rule', id)}
      />
    );

  return (
    <View style={styles.container}>
      <HomeWallpaper accent={accent} secondary={secondary} />
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
            <Text style={styles.errorDetail}>The forecast may be incomplete until this is resolved.</Text>
            <PrimaryButton title="Try again" onPress={() => void reload()} />
          </View>
        )}

        {!loaded || !data || data.hideAmounts !== hideAmounts ? (
          loadError ? null : (
            <View style={{ marginTop: theme.layout.screenTopGap, gap: SCREEN.sectionGap }}>
              <CardRowsSkeleton rows={3} meter />
              <CardRowsSkeleton rows={2} subtitle />
            </View>
          )
        ) : (
          <>
            <View style={styles.tabs}>
              <SegmentedControl options={TABS} value={tab} onChange={setTab} onBand />
            </View>
            <RunwayCard
              dueSoon={data.dueSoon}
              runway={data.runway}
              hasAccounts={data.hasAccounts}
              days={PLAN_DAYS}
              showChart={tab === 'upcoming'}
            />
            {tab === 'overview' && (
              <>
                <PlanStats
                  stack={stackTiles}
                  count={data.dueSoon.count}
                  days={PLAN_DAYS}
                  next={nextPayment}
                  onOpen={() => setTab('upcoming')}
                />
                <View style={{ marginHorizontal: 16 }}>
                  <PendingRefunds
                    refreshToken={data}
                    onOpen={(tx) => {
                      paymentRequest.current++;
                      openingPayment.current = false;
                      setPaying(null);
                      setDetail(null);
                      setRefundTx(tx);
                    }}
                  />
                </View>
                {data.dueGroups.length > 0 && (
                  <Section compact title="Upcoming payments" onSeeAll={() => setTab('upcoming')}>
                    {upcoming(PREVIEW_PAYMENTS)}
                  </Section>
                )}
                <Section compact title="Budgets" onSeeAll={() => open('/budgets')}>
                  <BudgetJars
                    summary={data.budgets}
                    onOpen={() => open('/budgets')}
                    onBudget={(id) => openDetail('budget', id)}
                    onAdd={() => openDetail('new-budget', '')}
                    limit={PREVIEW_TILES}
                  />
                </Section>
                <Section compact title="Goals" onSeeAll={() => setTab('goals')}>
                  <GoalsStrip
                    goals={data.goals}
                    savingsAccounts={data.savingsAccounts}
                    onOpen={() => open('/savings-goals')}
                    onGoal={(id) => openDetail('goal', id)}
                    onAdd={() => openDetail('new-goal', '')}
                    limit={PREVIEW_TILES}
                  />
                </Section>
                <Section compact title="Debt" onSeeAll={openDebt}>
                  <DebtPath loans={data.loans} today={data.today} onOpen={openDebt} />
                </Section>
                <Section compact title="People & habit">
                  <View style={[planStyles.row, stackTiles && planStyles.rowStack]}>
                    <PeopleTile
                      state={data.people}
                      people={data.topPeople}
                      onOpen={() => open('/people')}
                      onPerson={(id) => openDetail('person', id)}
                    />
                    <HabitTile
                      habit={data.habit}
                      goalMinor={data.dailyGoalMinor}
                      today={data.today}
                      onOpen={() => open('/garden')}
                    />
                  </View>
                </Section>
              </>
            )}
            {tab === 'upcoming' && (
              <Section
                compact
                title="Upcoming payments"
                right={
                  <Pressable
                    onPress={() => open('/recurring')}
                    hitSlop={8}
                    style={withPressed(styles.headLink)}
                    accessibilityRole="button"
                    accessibilityLabel="Recurring"
                  >
                    <Text style={styles.headLinkText}>Recurring</Text>
                    <Feather name="arrow-right" size={14} color={theme.colors.link} />
                  </Pressable>
                }
              >
                {upcoming()}
              </Section>
            )}
            {tab === 'goals' && (
              <>
                <Section compact title="Goals" onSeeAll={() => open('/savings-goals')}>
                  <GoalsStrip
                    goals={data.goals}
                    savingsAccounts={data.savingsAccounts}
                    onOpen={() => open('/savings-goals')}
                    onGoal={(id) => openDetail('goal', id)}
                    onAdd={() => openDetail('new-goal', '')}
                  />
                </Section>
                <Section compact title="Ideas">
                  <WhatIfCard
                    whatIf={data.whatIf}
                    onOpen={(cut) =>
                      data.whatIf
                        ? router.push({
                            pathname: '/whatif',
                            params: { category: data.whatIf.categoryId, cut: String(cut) },
                          })
                        : open('/whatif')
                    }
                  />
                </Section>
              </>
            )}
            {tab === 'debt' && (
              <>
                <Section compact title="Debt">
                  <DebtPath loans={data.loans} today={data.today} onOpen={() => open('/loans')} />
                </Section>
                {data.loans.rows.length > 0 && (
                  <Section compact title="Loans" onSeeAll={() => open('/loans')}>
                    <DebtLoans loans={data.loans} onLoan={(id) => openDetail('loan', id)} />
                  </Section>
                )}
              </>
            )}
          </>
        )}
      </ReanimatedAnimated.ScrollView>
      <SkyHeader
        title="Plan"
        subtitle="Upcoming, goals, debt and more"
        collapse={collapse}
        wallpaper
        summary={
          data && data.hideAmounts === hideAmounts && data.dueSoon.count > 0 ? (
            <HeaderSummary
              figure={formatMoney(data.dueSoon.totalMinor)}
              rest={`due in ${PLAN_DAYS} days`}
              dot={theme.colors.slice.due}
            />
          ) : undefined
        }
      />
      {selectedLoan && scoped && (
        <LoanDetailModal
          key={selectedLoan.id}
          loan={selectedLoan}
          hue={loanHues(scoped.loanDetails)[selectedLoan.id]}
          onClose={() => setDetail(null)}
          onChanged={() => void reload()}
        />
      )}
      {selectedBudget && scoped && (
        <BudgetDetailModal
          key={selectedBudget.budget.id}
          progress={selectedBudget}
          accounts={scoped.accounts}
          categories={scoped.categories}
          currency={scoped.currency}
          onClose={() => setDetail(null)}
          onChanged={() => void reload()}
        />
      )}
      {selectedPerson && (
        <PersonDetailModal
          key={selectedPerson.id}
          person={selectedPerson}
          initialTab="history"
          onClose={() => setDetail(null)}
          onChanged={() => void reload()}
        />
      )}
      {selectedGoal && scoped && (
        <GoalOverviewModal
          key={selectedGoal.id}
          goal={selectedGoal}
          accounts={scoped.accounts}
          onClose={() => setDetail(null)}
          onChanged={() => void reload()}
          onMoveMoney={(accountId) => {
            setDetail(null);
            router.push({
              pathname: '/add-transaction',
              params: { type: 'transfer', toAccountId: accountId },
            });
          }}
        />
      )}
      {detail?.kind === 'new-goal' && scoped && (
        <AddGoalModal
          visible
          accounts={scoped.accounts}
          onClose={() => setDetail(null)}
          onCreated={() => {
            setDetail(null);
            void reload();
          }}
        />
      )}
      {detail?.kind === 'new-budget' && scoped && (
        <AddBudgetModal
          visible
          editing={null}
          categories={scoped.categories.filter(
            (c) => !c.archived && c.kind === 'expense' && !(hideAmounts && c.isSensitive)
          )}
          budgetedCategoryIds={new Set(scoped.budgetDetails.map((b) => b.budget.categoryId))}
          onClose={() => setDetail(null)}
          onSaved={() => {
            setDetail(null);
            void reload();
          }}
        />
      )}
      {selectedRule && scoped && (
        <RuleModal
          key={selectedRule.id}
          visible
          editing={selectedRule}
          accounts={scoped.accounts}
          categories={scoped.categories}
          onClose={() => setDetail(null)}
          onSaved={() => {
            setDetail(null);
            void reload();
          }}
          onDeleted={() => {
            setDetail(null);
            void reload();
          }}
        />
      )}
      {refundTx && scoped && (
        <TransactionDetailModal
          key={refundTx.id}
          tx={refundTx}
          accounts={scoped.accounts}
          categories={scoped.categories}
          onClose={() => setRefundTx(null)}
          onEdit={(tx) => {
            setRefundTx(null);
            router.push({ pathname: '/add-transaction', params: { id: tx.id } });
          }}
          onChanged={() => {
            setRefundTx(null);
            void reload();
          }}
        />
      )}
      {paying && (
        <PayInstallmentSheet
          installment={paying.installment}
          account={paying.account}
          categoryId={paying.categoryId}
          linkedAccountMissing={paying.linkedAccountMissing}
          balanceMinor={
            paying.account
              ? data?.hideAmounts === hideAmounts
                ? data.balances[paying.account.id]
                : undefined
              : undefined
          }
          onClose={() => setPaying(null)}
          onPaid={reload}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  tabs: { marginHorizontal: 16, marginTop: theme.layout.screenTopGap },
  headLink: { flexDirection: 'row', alignItems: 'center', gap: 4, minHeight: 48 },
  headLinkText: { fontFamily: theme.font.bodyMedium, fontSize: 13, color: theme.colors.link },
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
    fontSize: 12,
    color: theme.colors.textSecondary,
    marginTop: 3,
    lineHeight: 16,
  },
});

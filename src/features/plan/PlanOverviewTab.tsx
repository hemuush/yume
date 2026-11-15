import { memo, useCallback } from 'react';
import { View } from 'react-native';
import { Section } from '@/components/Section';
import { PendingRefunds } from '@/features/transactions/PendingRefunds';
import type { PlanActions } from './planActions';
import type { PlanData } from './planData';
import { PLAN_DAYS } from './planOverview';
import { PlanOverviewPanels } from './PlanOverviewPanels';
import { PlanPeopleHabit } from './PlanPeopleHabit';
import { RunwayCard } from './RunwayCard';

/**
 * Plan's "Overview": the runway, the panels (budgets, what is due, debt, goals, investments, people), the pending
 * refunds and the daily-goal habit. It compares its props by identity, so it is drawn again only when what it shows, or
 * the reload that refreshes the pending refunds (`refreshToken`), changes.
 */
// The sections compare their props by identity; the tab hands them values that keep theirs until what is in them changes.
const Runway = memo(RunwayCard);
const Panels = memo(PlanOverviewPanels);
const PeopleHabit = memo(PlanPeopleHabit);

export const PlanOverviewTab = memo(function PlanOverviewTab({
  data,
  refreshToken,
  hideAmounts,
  actions,
}: {
  data: PlanData;
  /** Changes with each load of the page: the pending refunds read their own data again. */
  refreshToken: object;
  hideAmounts: boolean;
  actions: PlanActions;
}) {
  const { open, openDetail, selectTab, openRefund } = actions;
  const viewPayments = useCallback(() => selectTab('upcoming'), [selectTab]);
  const addAccount = useCallback(() => openDetail('new-account', ''), [openDetail]);
  const openInvestments = useCallback(() => open('/investments'), [open]);
  const openBudget = useCallback((id: string) => openDetail('budget', id), [openDetail]);
  const openPeople = useCallback(() => open('/people'), [open]);
  const openPerson = useCallback((id: string) => openDetail('person', id), [openDetail]);
  const openGarden = useCallback(() => open('/garden'), [open]);
  return (
    <>
      <Runway
        compact
        onViewPayments={viewPayments}
        dueSoon={data.dueSoon}
        runway={data.runway}
        hasAccounts={data.hasAccounts}
        days={PLAN_DAYS}
        onAddAccount={addAccount}
      />
      <Panels
        budgets={data.budgets}
        groups={data.dueGroups}
        loans={data.loans}
        goals={data.goals}
        today={data.today}
        hideAmounts={hideAmounts}
        runway={data.hasAccounts ? data.runway : undefined}
        investments={data.investments}
        onInvestments={openInvestments}
        onTab={selectTab}
        onBudget={openBudget}
      />
      <View style={{ marginHorizontal: 16 }}>
        <PendingRefunds summaryOnly refreshToken={refreshToken} onOpen={openRefund} />
      </View>
      <Section compact title="People & habit">
        <PeopleHabit
          people={data.people}
          topPeople={data.topPeople}
          habit={data.habit}
          goalMinor={data.dailyGoalMinor}
          onPeople={openPeople}
          onPerson={openPerson}
          onGarden={openGarden}
        />
      </Section>
    </>
  );
});

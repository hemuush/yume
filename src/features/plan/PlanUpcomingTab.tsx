import { memo, useCallback, useMemo, type RefObject } from 'react';
import { Section } from '@/components/Section';
import RecurringWorkspace from '@/features/recurring/RecurringWorkspace';
import { ComingUpSection } from './ComingUpSection';
import type { PlanActions } from './planActions';
import type { PlanData } from './planData';
import { PLAN_DAYS } from './planOverview';
import { UpcomingDates, type UpcomingSelection } from './UpcomingDates';

/** Shows dated cash movements and opens rule management within the same Plan tab. */
export const PlanUpcomingTab = memo(function PlanUpcomingTab({
  data,
  actions,
  reload,
  recurringRefreshRef,
  selection,
  onSelectionChange,
}: {
  data: PlanData;
  actions: PlanActions;
  reload: () => Promise<void>;
  recurringRefreshRef: RefObject<(() => Promise<void>) | null>;
  selection: UpcomingSelection;
  onSelectionChange: (selection: UpcomingSelection) => void;
}) {
  const { open, openDetail, payEmi } = actions;
  const { schedule, today } = data;
  const renderDays = useCallback<NonNullable<Parameters<typeof UpcomingDates>[0]['renderDays']>>(
    (days, mode) => (
      <ComingUpSection
        flow={mode === 'income' ? 'in' : 'out'}
        groups={days.map((day) => ({
          date: day.date,
          outMinor: mode === 'income' ? day.inMinor : day.outMinor,
          items: day.items.filter((item) =>
            mode === 'income'
              ? item.kind === 'income' || item.transfer?.flow === 'in'
              : item.kind === 'emi' || item.kind === 'bill' || item.transfer?.flow === 'out'
          ),
        }))}
        today={today}
        onOpen={open}
        onPay={payEmi}
        onLoan={(id) => openDetail('loan', id)}
        onRule={(id) => openDetail('rule', id)}
      />
    ),
    [today, open, payEmi, openDetail]
  );
  const scheduledRuleIds = useMemo(
    () =>
      new Set(
        schedule.days.flatMap((day) => day.items.flatMap((item) => (item.ruleId ? [item.ruleId] : [])))
      ),
    [schedule.days]
  );
  return (
    <>
      <Section compact first title="Upcoming payments" subtitle={`Next ${PLAN_DAYS} days`}>
        <UpcomingDates
          runway={schedule}
          today={today}
          renderDays={renderDays}
          selection={selection}
          onSelectionChange={onSelectionChange}
        />
      </Section>
      <RecurringWorkspace
        scheduledRuleIds={scheduledRuleIds}
        onChanged={reload}
        refreshRef={recurringRefreshRef}
      />
    </>
  );
});

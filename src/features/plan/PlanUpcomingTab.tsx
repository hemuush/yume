import { memo, useCallback } from 'react';
import { Section } from '@/components/Section';
import { ComingUpSection } from './ComingUpSection';
import type { PlanActions } from './planActions';
import type { PlanData } from './planData';
import { PLAN_DAYS } from './planOverview';
import { UpcomingDates } from './UpcomingDates';

/**
 * Plan's "Upcoming": the payments of the next 30 days by date, outgoing or incoming. It compares its props by identity,
 * so it is drawn again only when the schedule changes.
 */
export const PlanUpcomingTab = memo(function PlanUpcomingTab({
  data,
  actions,
}: {
  data: PlanData;
  actions: PlanActions;
}) {
  const { open, openDetail, payEmi } = actions;
  const { schedule, today } = data;
  const openRecurring = useCallback(() => open('/recurring'), [open]);
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
  return (
    <Section
      compact
      first
      title="Upcoming payments"
      // One short line: beside "Manage recurring" it has about 190 dp on a 360 dp phone, and the rows say what each is.
      subtitle={`Next ${PLAN_DAYS} days`}
      actionLabel="Manage recurring"
      onSeeAll={openRecurring}
    >
      <UpcomingDates runway={schedule} today={today} renderDays={renderDays} />
    </Section>
  );
});

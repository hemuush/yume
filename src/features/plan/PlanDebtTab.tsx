import { memo, useCallback, useMemo } from 'react';
import { View } from 'react-native';
import { Section } from '@/components/Section';
import { loanHues } from '@/features/loans/loanIdentity';
import { DebtLoans } from './DebtLoans';
import { DebtPath } from './DebtPath';
import type { PlanActions } from './planActions';
import type { PlanData } from './planData';

/**
 * Plan's "Debt": the path to being debt-free, the loans borrowed and the money lent. It compares its props by identity,
 * so it is drawn again only when the loans change.
 */
export const PlanDebtTab = memo(function PlanDebtTab({
  data,
  actions,
}: {
  data: PlanData;
  actions: PlanActions;
}) {
  const { open, openDetail, openComparison } = actions;
  const { loans, loanDetails, today } = data;
  // The same colour a loan has on Loans, by its place among the borrowed ones.
  const hues = useMemo(() => loanHues(loanDetails), [loanDetails]);
  const borrowed = useMemo(
    () => ({ ...loans, rows: loans.rows.filter((l) => l.direction === 'borrowed') }),
    [loans]
  );
  const lent = useMemo(() => ({ ...loans, rows: loans.rows.filter((l) => l.direction === 'lent') }), [loans]);
  const openLoans = useCallback(() => open('/loans'), [open]);
  const addLoan = useCallback(() => openDetail('new-loan', ''), [openDetail]);
  const openLoan = useCallback((id: string) => openDetail('loan', id), [openDetail]);
  return (
    <>
      <View style={{ marginTop: 4 }}>
        <DebtPath
          loans={loans}
          today={today}
          hues={hues}
          onOpen={openLoans}
          onAdd={loans.rows.length === 0 ? addLoan : undefined}
          onCompare={borrowed.rows.length >= 2 ? openComparison : undefined}
        />
      </View>
      {borrowed.rows.length > 0 && (
        <Section compact title="Loans" onSeeAll={openLoans}>
          <DebtLoans hues={hues} loans={borrowed} onLoan={openLoan} />
        </Section>
      )}
      {lent.rows.length > 0 && (
        <Section compact title="Money lent" onSeeAll={openLoans}>
          <DebtLoans hues={hues} loans={lent} onLoan={openLoan} />
        </Section>
      )}
    </>
  );
});

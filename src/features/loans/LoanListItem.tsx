import { memo } from 'react';
import { MovingRow } from '@/components/MovingRow';
import type { LoanProgress } from '@/db/loans';
import type { Loan } from '@/types';
import { LoanCard } from './LoanCard';

/** One loan's card in the list. It compares its props by identity, so a reload redraws only the loans that changed. */
export const LoanListItem = memo(function LoanListItem({
  loan,
  hue,
  progress,
  onOpen,
  onPay,
}: {
  loan: Loan;
  hue: string;
  progress: LoanProgress | undefined;
  onOpen: (loan: Loan) => void;
  onPay: (loan: Loan) => void;
}) {
  return (
    <MovingRow>
      <LoanCard
        loan={loan}
        hue={hue}
        progress={progress}
        onPress={() => onOpen(loan)}
        onPay={() => onPay(loan)}
      />
    </MovingRow>
  );
});

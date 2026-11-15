import { memo, useState } from 'react';
import { Pressable } from 'react-native';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Text } from '@/components/Text';
import { theme } from '@/constants/theme';
import type { LoanProgress } from '@/db/loans';
import type { Loan } from '@/types';
import { LoanListItem } from './LoanListItem';
import { styles } from './loans.styles';

/** Paid-off loans, folded under a "Closed" heading. Whether they show is its own state, so opening it redraws only this. */
export const ClosedLoans = memo(function ClosedLoans({
  loans,
  hues,
  progress,
  onOpen,
  onPay,
}: {
  loans: Loan[];
  hues: Record<string, string>;
  progress: Record<string, LoanProgress>;
  onOpen: (loan: Loan) => void;
  onPay: (loan: Loan) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Pressable
        onPress={() => setOpen((v) => !v)}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        style={styles.closedHeader}
      >
        <Text style={styles.closedDivider}>Closed · {loans.length}</Text>
        <MaterialCommunityIcons
          name={open ? 'chevron-up' : 'chevron-down'}
          size={18}
          color={theme.colors.textMuted}
        />
      </Pressable>
      {open &&
        loans.map((loan) => (
          <LoanListItem
            key={loan.id}
            loan={loan}
            hue={hues[loan.id]}
            progress={progress[loan.id]}
            onOpen={onOpen}
            onPay={onPay}
          />
        ))}
    </>
  );
});

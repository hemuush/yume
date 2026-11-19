import { View } from 'react-native';
import { theme } from '@/constants/theme';
import { formatMoney } from '@/lib/money';
import { shortMonthYear } from '@/lib/dateLabels';
import { daysUntilIsoDate } from '@/lib/date';
import { DUE_SOON_DAYS, dueDateLabel } from '@/lib/dueDate';
import { keepTogether } from '@/lib/keepTogether';
import type { LoansSummary } from './planOverview';
import { PlanSummaryRow, summaryListStyle } from './PlanSummaryRow';

/** A readable list of loan balances, with the next installment called out when it needs attention. */
export function DebtLoans({ loans, onLoan }: { loans: LoansSummary; onLoan: (id: string) => void }) {
  if (loans.rows.length === 0) return null;
  return (
    <View style={summaryListStyle}>
      {loans.rows.map((loan, index) => {
        const lent = loan.direction === 'lent';
        const due = loan.nextDueDate ? daysUntilIsoDate(loan.nextDueDate) : undefined;
        const imminent =
          loan.nextDueDate && due !== undefined && due <= DUE_SOON_DAYS
            ? dueDateLabel(loan.nextDueDate)
            : null;
        const progress =
          loan.totalCount > 0 ? `${loan.paidCount} of ${loan.totalCount} paid` : lent ? 'Lent out' : 'Loan';
        const repayment = loan.endDate
          ? keepTogether(`${progress} · ends ${shortMonthYear(loan.endDate)}`)
          : progress;
        const subtitle = imminent ? `${repayment} · ${imminent}` : repayment;
        const balance = formatMoney(loan.leftMinor);
        return (
          <PlanSummaryRow
            key={loan.id}
            divider={index > 0}
            name={loan.name}
            subtitle={subtitle}
            amount={lent ? `+${balance}` : balance}
            icon={loan.icon ?? (lent ? 'hand-coin-outline' : 'bank-outline')}
            animKey={`plan:loan:${loan.id}`}
            color={lent ? theme.colors.incomeText : theme.colors.textPrimary}
            subtitleColor={
              due !== undefined && due < 0
                ? theme.colors.expenseText
                : imminent
                  ? theme.colors.warnInk
                  : undefined
            }
            accessibilityLabel={`${loan.name}, ${subtitle}, ${balance} ${lent ? 'owed to you' : 'left'}. Open loan details`}
            onPress={() => onLoan(loan.id)}
          />
        );
      })}
    </View>
  );
}

import { View, StyleSheet } from 'react-native';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import type { McIconName } from '@/components/iconName';
import { Glass } from '@/components/Glass';
import { cardSurface } from '@/components/CardSurface';
import { theme } from '@/constants/theme';
import { formatMoney } from '@/lib/money';
import { shortMonthYear } from '@/lib/dateLabels';
import { HomeRow } from '@/features/home/HomeRow';
import { LoansSummary } from './planOverview';
import { styles } from './plan.styles';

/**
 * The Debt tab's list: every open loan as Home's row (a mark, the name, how many EMIs are paid and when it
 * ends, what is left on the right). A row opens that loan; money you lent shows green.
 */
export function DebtLoans({ loans, onLoan }: { loans: LoansSummary; onLoan: (id: string) => void }) {
  if (loans.rows.length === 0) return null;
  return (
    <Glass style={[styles.list, cardSurface.neutral]}>
      {loans.rows.map((r, i) => {
        const lent = r.direction === 'lent';
        const progress =
          r.totalCount > 0 ? `${r.paidCount} of ${r.totalCount} paid` : lent ? 'Lent out' : 'Loan';
        const subtitle = r.endDate ? `${progress} · ends ${shortMonthYear(r.endDate)}` : progress;
        const left = formatMoney(r.leftMinor);
        return (
          <HomeRow
            key={r.id}
            leading={
              <View style={local.mark}>
                <MaterialCommunityIcons
                  name={(r.icon ?? (lent ? 'hand-coin-outline' : 'bank-outline')) as McIconName}
                  size={20}
                  color={theme.colors.ink}
                />
              </View>
            }
            title={r.name}
            subtitle={subtitle}
            value={lent ? `+${left}` : left}
            valueTone={lent ? 'income' : undefined}
            divider={i > 0}
            onPress={() => onLoan(r.id)}
            accessibilityLabel={`${r.name}, ${subtitle}, ${left} ${lent ? 'owed to you' : 'left'}. Open loan details`}
          />
        );
      })}
    </Glass>
  );
}

const local = StyleSheet.create({
  mark: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.expenseTint,
  },
});

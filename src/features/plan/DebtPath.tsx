import { View, Pressable, StyleSheet } from 'react-native';
import { Text } from '@/components/Text';
import { Glass } from '@/components/Glass';
import { cardSurface } from '@/components/CardSurface';
import { formatMoney } from '@/lib/money';
import { formatRatioPct } from '@/lib/format';
import { withPressed } from '@/lib/pressed';
import { shortMonthYear } from '@/lib/dateLabels';
import { LoansSummary } from './planOverview';
import { Kicker, PlanChip } from './PlanTiles';
import { styles } from './plan.styles';

import { PlanListAdd } from './PlanSummaryRow';
import { theme } from '@/constants/theme';

/** A compact debt overview: what is left, when you are debt-free, and how much is repaid. Opens Loans. */
export function DebtPath({
  loans,
  today,
  onOpen,
  onAdd,
}: {
  loans: LoansSummary;
  today: string;
  onOpen: () => void;
  onAdd?: () => void;
}) {
  const borrowed = loans.rows.filter((r) => r.direction === 'borrowed');
  if (borrowed.length === 0) {
    return (
      <Glass style={[styles.card, cardSurface.neutral]}>
        <Pressable
          onPress={onOpen}
          style={withPressed()}
          accessibilityRole="button"
          accessibilityLabel="Track an EMI. Open loans"
        >
          <View style={local.summary}>
            <Kicker icon="flag">No loans yet</Kicker>
            <Text style={styles.title}>Track an EMI</Text>
            <Text style={styles.sub}>
              A home or car loan. You&rsquo;ll see the month you&rsquo;re debt-free.
            </Text>
            {loans.lentLeftMinor > 0 && (
              <View style={styles.chips}>
                <PlanChip icon="arrow-up-right">{formatMoney(loans.lentLeftMinor)} you lent out</PlanChip>
              </View>
            )}
          </View>
        </Pressable>
        {onAdd && <PlanListAdd label="Add loan" onPress={onAdd} />}
      </Glass>
    );
  }

  // A debt-free month is only claimed when every loan has an end date and it's still ahead.
  const knownEnd =
    loans.debtFreeDate != null && loans.debtFreeDate > today && borrowed.every((r) => r.endDate != null)
      ? loans.debtFreeDate
      : null;
  const timeline = knownEnd ? `Debt-free ${shortMonthYear(knownEnd)}` : 'Debt-free date unknown';

  return (
    <Glass style={[styles.card, cardSurface.neutral]}>
      <Pressable
        onPress={onOpen}
        style={withPressed()}
        accessibilityRole="button"
        accessibilityLabel={`Principal left ${formatMoney(loans.debtLeftMinor)}, ${formatRatioPct(loans.paidFraction)} repaid, ${timeline}. Open loans`}
      >
        <View style={local.summary}>
          <View style={styles.head}>
            <View style={{ flexShrink: 1, gap: 4 }}>
              <Text style={styles.pathNote}>{timeline}</Text>
              <Text style={styles.pathValue} numberOfLines={1} adjustsFontSizeToFit>
                {formatMoney(loans.debtLeftMinor)} left
              </Text>
            </View>
            <Text style={styles.pathNote}>
              {formatRatioPct(loans.paidFraction)} repaid · {borrowed.length} loan
              {borrowed.length === 1 ? '' : 's'}
            </Text>
          </View>
          <View style={local.track}>
            <View
              style={[local.fill, { width: `${Math.min(100, Math.max(0, loans.paidFraction * 100))}%` }]}
            />
          </View>
          {loans.lentLeftMinor > 0 && (
            <View style={styles.chips}>
              <PlanChip icon="arrow-up-right">{formatMoney(loans.lentLeftMinor)} you lent out</PlanChip>
            </View>
          )}
        </View>
      </Pressable>
      {onAdd && <PlanListAdd label="Add loan" onPress={onAdd} />}
    </Glass>
  );
}

const local = StyleSheet.create({
  summary: { gap: 8, minHeight: 44 },
  track: { height: 6, borderRadius: 3, backgroundColor: theme.colors.borderSoft, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 3, backgroundColor: theme.colors.incomeText },
});

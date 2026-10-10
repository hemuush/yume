import { View, Pressable, StyleSheet } from 'react-native';
import { Text } from '@/components/Text';
import { Glass } from '@/components/Glass';
import { formatMoney } from '@/lib/money';
import { formatRatioPct } from '@/lib/format';
import { withPressed } from '@/lib/pressed';
import { dayMonth, longMonthYear } from '@/lib/dateLabels';
import { DueSoon, LoansSummary } from './planOverview';
import { Kicker, PlanChip } from './PlanTiles';
import { styles } from './plan.styles';

import Feather from '@expo/vector-icons/Feather';
import { theme } from '@/constants/theme';

/** A compact debt overview. Individual schedules stay on Loans. */
export function DebtPath({
  loans,
  dueSoon,
  today,
  onOpen,
}: {
  loans: LoansSummary;
  dueSoon: DueSoon;
  today: string;
  onOpen: () => void;
}) {
  const borrowed = loans.rows.filter((r) => r.direction === 'borrowed');
  if (borrowed.length === 0) {
    return (
      <Pressable
        onPress={onOpen}
        style={withPressed()}
        accessibilityRole="button"
        accessibilityLabel="Track an EMI. Open loans"
      >
        <Glass style={styles.card}>
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
        </Glass>
      </Pressable>
    );
  }

  // A debt-free month is only claimed when every loan has an end date and it's still ahead.
  const knownEnd =
    loans.debtFreeDate != null && loans.debtFreeDate > today && borrowed.every((r) => r.endDate != null)
      ? loans.debtFreeDate
      : null;
  const nextEmi = borrowed.find((r) => r.nextDueDate && r.nextEmiMinor != null);

  return (
    <View>
      <Glass style={styles.card}>
        <Kicker icon="flag">
          {knownEnd ? `Estimated debt-free · ${longMonthYear(knownEnd)}` : 'Debt left · schedule incomplete'}
        </Kicker>
        <Text style={styles.pathValue} numberOfLines={1} adjustsFontSizeToFit>
          {formatMoney(loans.debtLeftMinor)}
        </Text>
        <Text style={styles.pathNote}>Principal left · {formatRatioPct(loans.paidFraction)} repaid</Text>
        <View
          style={local.track}
          accessibilityRole="progressbar"
          accessibilityLabel="Principal repaid"
          accessibilityValue={{ min: 0, max: 100, now: Math.round(loans.paidFraction * 100) }}
        >
          <View style={[local.fill, { width: `${Math.min(100, Math.max(0, loans.paidFraction * 100))}%` }]} />
        </View>
        <View style={styles.chips}>
          {dueSoon.emiMinor > 0 ? (
            <PlanChip icon="calendar">{formatMoney(dueSoon.emiMinor)} in EMIs over 14 days</PlanChip>
          ) : nextEmi?.nextDueDate && nextEmi.nextEmiMinor != null ? (
            <PlanChip icon="calendar">
              Next EMI {formatMoney(nextEmi.nextEmiMinor)} on {dayMonth(nextEmi.nextDueDate)}
            </PlanChip>
          ) : null}
          {loans.lentLeftMinor > 0 && (
            <PlanChip icon="arrow-up-right">{formatMoney(loans.lentLeftMinor)} you lent out</PlanChip>
          )}
        </View>
        <Pressable
          onPress={onOpen}
          style={withPressed(local.link)}
          accessibilityRole="button"
          accessibilityLabel="Open loans"
        >
          <Text style={local.linkText}>View loans · {borrowed.length} active</Text>
          <Feather name="arrow-up-right" size={17} color={theme.colors.link} />
        </Pressable>
      </Glass>
    </View>
  );
}

const local = StyleSheet.create({
  track: { height: 6, borderRadius: 3, backgroundColor: theme.colors.borderSoft, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 3, backgroundColor: theme.colors.incomeText },
  link: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: theme.colors.borderSoft,
    paddingTop: 6,
  },
  linkText: { flexShrink: 1, fontFamily: theme.font.bodyBold, fontSize: 13, color: theme.colors.link },
});

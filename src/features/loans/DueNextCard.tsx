import { View, Pressable, StyleSheet } from 'react-native';
import { Text } from '@/components/Text';
import { DateTile } from '@/components/DateTile';
import { theme } from '@/constants/theme';
import { SECTION_TITLE, SECTION_GAP } from '@/constants/textStyles';
import { homeStyles as h } from '@/features/home/homeStyles';
import { daysUntilIsoDate } from '@/lib/date';
import { dueDateLabel, isDueUrgent } from '@/lib/dueDate';
import { formatMoney } from '@/lib/money';
import type { Loan } from '@/types';
import type { LoanProgress } from '@/db/loans';

/** An EMI due within this many days gets the amber date tile, like Home's Upcoming. */
const SOON_DAYS = 3;

export interface DueItem {
  loan: Loan;
  dueDate: string;
  emiMinor: number;
}

/** The open loans' next EMIs, soonest first. A loan with no EMI left has none. */
export function dueNextItems(loans: Loan[], progress: Record<string, LoanProgress | undefined>): DueItem[] {
  const items: DueItem[] = [];
  for (const loan of loans) {
    if (loan.status === 'closed') continue;
    const dueDate = progress[loan.id]?.nextDueDate ?? loan.nextDueDate;
    if (!dueDate) continue;
    items.push({ loan, dueDate, emiMinor: progress[loan.id]?.nextEmiMinor ?? loan.emiAmountMinor });
  }
  return items.sort((a, b) => a.dueDate.localeCompare(b.dueDate));
}

/**
 * "Due next": every open loan's next EMI as a date-tile row (Home's Upcoming
 * pattern) with the Pay pill. Tapping the row opens the loan; the pill goes
 * straight to that EMI's pay sheet. Money lent reads "Received" and in green.
 */
export function DueNextCard({
  items,
  onOpen,
  onPay,
}: {
  items: DueItem[];
  onOpen: (loan: Loan) => void;
  onPay: (loan: Loan) => void;
}) {
  if (items.length === 0) return null;
  return (
    <View>
      <Text style={styles.title}>Due next</Text>
      <View style={styles.card}>
        {items.map(({ loan, dueDate, emiMinor }, i) => {
          const borrowed = loan.direction === 'borrowed';
          const urgent = isDueUrgent(dueDate);
          const soon = !urgent && daysUntilIsoDate(dueDate) <= SOON_DAYS;
          return (
            <Pressable
              key={loan.id}
              onPress={() => onOpen(loan)}
              accessibilityRole="button"
              accessibilityLabel={`${loan.counterparty}, ${dueDateLabel(dueDate).toLowerCase()}`}
              style={({ pressed }) => [h.row, i > 0 && h.divider, pressed && styles.pressed]}
            >
              <DateTile iso={dueDate} urgent={urgent} soon={soon} />
              <View style={h.mid}>
                <Text style={h.title} numberOfLines={2}>
                  {loan.counterparty}
                </Text>
                <Text style={[h.sub, urgent ? h.subUrgent : soon && h.subSoon]} numberOfLines={1}>
                  {dueDateLabel(dueDate)}
                </Text>
              </View>
              <Text style={[h.amount, !borrowed && h.income]}>
                {borrowed ? '-' : '+'}
                {formatMoney(emiMinor)}
              </Text>
              <Pressable
                onPress={() => onPay(loan)}
                accessibilityRole="button"
                accessibilityLabel={`${borrowed ? 'Pay' : 'Mark received'} next EMI for ${loan.counterparty}`}
                hitSlop={8}
                style={({ pressed }) => [styles.pill, pressed && styles.pillPressed]}
              >
                <Text style={styles.pillText}>{borrowed ? 'Pay' : 'Received'}</Text>
              </Pressable>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  title: {
    ...SECTION_TITLE,
    marginHorizontal: 20,
    marginTop: SECTION_GAP.top - 12,
    marginBottom: SECTION_GAP.bottom,
  },
  card: { ...h.card },
  pressed: { backgroundColor: theme.colors.surfaceAlt },
  pill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.ink,
  },
  pillPressed: { opacity: 0.8 },
  pillText: { fontFamily: theme.font.bodyBold, fontSize: 11.5, color: theme.colors.white },
});

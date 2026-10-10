import { useState } from 'react';
import { View, Pressable, LayoutChangeEvent } from 'react-native';
import { Text } from '@/components/Text';
import { Glass } from '@/components/Glass';
import { formatMoney } from '@/lib/money';
import { formatRatioPct } from '@/lib/format';
import { withPressed } from '@/lib/pressed';
import { shade } from '@/lib/color';
import { parseLocalIsoDate } from '@/lib/date';
import { useAccent } from '@/theme/AccentContext';
import { dayMonth, longMonthYear, shortMonthYear } from '@/lib/dateLabels';
import { homeInk } from '@/features/home/homeInk';
import { DueSoon, LoansSummary, PlanLoanRow } from './planOverview';
import { Kicker, PlanChip } from './PlanTiles';
import { styles } from './plan.styles';

const LANES_SHOWN = 3;

/**
 * The way to debt-free: a timeline from today to the last EMI. Each borrowed loan is a line that stops at the
 * month it ends, so you see which goes first; under it, debt left, how much is paid, EMIs due in the next 14
 * days and what you lent out. Opens Loans. With nothing borrowed it's a prompt to track an EMI.
 */
export function DebtPath({
  loans,
  dueSoon,
  today,
  onOpen,
  onLoan,
}: {
  loans: LoansSummary;
  dueSoon: DueSoon;
  today: string;
  onOpen: () => void;
  onLoan?: (id: string) => void;
}) {
  const { accent } = useAccent();
  const [width, setWidth] = useState(0);
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

  const shown = borrowed.slice(0, LANES_SHOWN);
  const more = borrowed.length - shown.length;
  const start = parseLocalIsoDate(today).getTime();
  // A debt-free month is only claimed when every loan has an end date and it's still ahead.
  const knownEnd =
    loans.debtFreeDate != null && loans.debtFreeDate > today && borrowed.every((r) => r.endDate != null)
      ? loans.debtFreeDate
      : null;
  const end = knownEnd ? parseLocalIsoDate(knownEnd).getTime() : null;
  const share = (row: PlanLoanRow) =>
    end && row.endDate && end > start
      ? Math.min(1, Math.max(0.04, (parseLocalIsoDate(row.endDate).getTime() - start) / (end - start)))
      : null;
  const colors = [homeInk(accent), shade(accent, 58), shade(accent, 74)];
  const startYear = new Date(start).getFullYear();
  const endYear = end ? new Date(end).getFullYear() : null;
  const midYear = endYear && endYear - startYear >= 4 ? Math.round((startYear + endYear) / 2) : null;
  const nextEmi = borrowed.find((r) => r.nextDueDate && r.nextEmiMinor != null);

  return (
    <View>
      <Glass style={styles.card}>
        <Pressable
          onPress={onOpen}
          style={withPressed()}
          accessibilityRole="button"
          accessibilityLabel="Open loans"
        >
          <Kicker icon="flag">
            {knownEnd
              ? `Estimated debt-free · ${longMonthYear(knownEnd)}`
              : 'Debt left · schedule incomplete'}
          </Kicker>
        </Pressable>
        <Text style={styles.pathValue} numberOfLines={1} adjustsFontSizeToFit>
          {formatMoney(loans.debtLeftMinor)}
        </Text>
        <Text style={styles.pathNote}>Principal left · {formatRatioPct(loans.paidFraction)} repaid</Text>
        <Text style={styles.tileSub}>Lanes show time to scheduled payoff</Text>
        <View
          style={styles.lanes}
          onLayout={(e: LayoutChangeEvent) => setWidth(Math.round(e.nativeEvent.layout.width))}
        >
          {shown.map((row, i) => {
            const s = share(row);
            const color = colors[i % colors.length];
            const barWidth = s != null ? s * width : width;
            return (
              <Pressable
                key={row.id}
                onPress={() => (onLoan ? onLoan(row.id) : onOpen())}
                style={withPressed(styles.lane)}
                accessibilityRole="button"
                accessibilityLabel={`${row.name}, ${row.paidCount} of ${row.totalCount} installments paid. ${row.endDate ? `Scheduled end ${longMonthYear(row.endDate)}` : 'End date unknown'}. Open loan`}
              >
                <View style={styles.laneTop}>
                  <Text style={styles.laneName} numberOfLines={2}>
                    {row.name}
                  </Text>
                  <Text style={styles.laneSub} numberOfLines={1}>
                    {row.totalCount > 0
                      ? `${row.paidCount} of ${row.totalCount} installments paid`
                      : 'Installment schedule unavailable'}
                  </Text>
                </View>
                {width > 0 && s != null && (
                  <View style={styles.laneTrack}>
                    <View
                      style={[
                        styles.laneBar,
                        { width: Math.max(8, barWidth - (s != null ? 6 : 0)), backgroundColor: color },
                        s == null && { opacity: 0.35 },
                      ]}
                    />
                    {s != null && (
                      <View
                        style={[styles.laneEnd, { left: Math.max(0, barWidth - 16), borderColor: color }]}
                      />
                    )}
                  </View>
                )}
                <Text style={styles.laneSub}>
                  {row.endDate ? `Scheduled end · ${shortMonthYear(row.endDate)}` : 'End date unknown'}
                </Text>
              </Pressable>
            );
          })}
        </View>
        {endYear != null && (
          <View
            style={styles.axis}
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
          >
            <Text style={styles.axisText}>Now</Text>
            {midYear != null && <Text style={styles.axisText}>{midYear}</Text>}
            <Text style={[styles.axisText, styles.axisEnd]}>Debt-free {endYear}</Text>
          </View>
        )}
        {more > 0 && (
          <Text style={styles.more}>
            +{more} more loan{more === 1 ? '' : 's'}
          </Text>
        )}
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
        <Text style={styles.tileSub}>
          Based on recorded schedules. Rate changes and extra payments can change these dates.
        </Text>
      </Glass>
    </View>
  );
}

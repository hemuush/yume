import { useState } from 'react';
import { View, Pressable, StyleSheet } from 'react-native';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Text } from '@/components/Text';
import { theme } from '@/constants/theme';
import { formatMoney } from '@/lib/money';
import { allocateRoundedMinor } from '@/lib/round';
import { dayMonthYear } from '@/lib/dateLabels';
import { haptics } from '@/lib/haptics';
import type { LoanPayment } from '@/types';
import { styles as shared } from './loans.styles';
import { groupScheduleByYear, currentScheduleYear } from './scheduleYears';
import { isOverdueInstallment, nextUnpaidInstallment } from './installmentStatus';
import { toLocalIsoDate } from '@/lib/date';
import { shade } from '@/lib/color';
import { useAccent } from '@/theme/AccentContext';

function Marker({ status, isNext }: { status: LoanPayment['status']; isNext: boolean }) {
  const { accent } = useAccent();
  if (status === 'paid' || status === 'prepaid') {
    return (
      <View style={[styles.marker, styles.markerPaid]}>
        <MaterialCommunityIcons name="check" size={14} color={theme.colors.incomeText} />
      </View>
    );
  }
  return (
    <View
      style={[styles.marker, isNext ? [styles.markerNext, { borderColor: accent }] : styles.markerFuture]}
    />
  );
}

/**
 * Every EMI, a year at a time. The year the next EMI falls in starts open;
 * the others are one tap away, so a 240-month loan doesn't open as a wall of rows.
 */
export function LoanSchedule({ schedule }: { schedule: LoanPayment[] }) {
  const years = groupScheduleByYear(schedule);
  const nextId = nextUnpaidInstallment(schedule)?.id;
  const todayIso = toLocalIsoDate(new Date());
  const [toggled, setToggled] = useState<Record<number, boolean>>({});
  const startYear = currentScheduleYear(years);
  const { accent } = useAccent();

  return (
    <>
      {years.map((y) => {
        const open = (y.year === startYear) !== !!toggled[y.year];
        return (
          <View key={y.year}>
            <Pressable
              onPress={() => {
                haptics.tap();
                setToggled((t) => ({ ...t, [y.year]: !t[y.year] }));
              }}
              accessibilityRole="button"
              accessibilityState={{ expanded: open }}
              style={({ pressed }) => [styles.yearHead, pressed && styles.pressed]}
            >
              <Text style={styles.year}>{y.year}</Text>
              <Text style={styles.yearSub}>
                {y.paidCount} of {y.payments.length} paid
              </Text>
              <View style={{ flex: 1 }} />
              <MaterialCommunityIcons
                name={open ? 'chevron-up' : 'chevron-down'}
                size={18}
                color={theme.colors.textMuted}
              />
            </Pressable>
            {open &&
              y.payments.map((p) => {
                // Principal and interest rounded so they add up to the rounded EMI exactly
                // (the stored paise components already sum to it; this keeps that true on screen).
                const [dispPrincipal, dispInterest] = allocateRoundedMinor(
                  [p.principalComponentMinor, p.interestComponentMinor],
                  p.emiAmountMinor
                );
                const isNext = p.id === nextId;
                const overdue = isOverdueInstallment(p, todayIso);
                return (
                  <View
                    key={p.id}
                    style={[
                      shared.scheduleRow,
                      styles.row,
                      isNext && [styles.rowNext, { backgroundColor: shade(accent, 95) }],
                    ]}
                  >
                    <Marker status={p.status} isNext={isNext} />
                    <View style={{ flex: 1 }}>
                      <Text style={shared.rowLabel}>
                        #{p.installmentNumber} · {dayMonthYear(p.dueDate)}
                      </Text>
                      <Text style={shared.rowSub}>
                        Principal {formatMoney(dispPrincipal)} · Interest {formatMoney(dispInterest)}
                      </Text>
                    </View>
                    <View style={{ alignItems: 'flex-end' }}>
                      <Text style={shared.rowValue}>{formatMoney(p.emiAmountMinor)}</Text>
                      {overdue ? (
                        <Text style={[shared.statusTag, styles.overdueTag]}>Overdue</Text>
                      ) : isNext ? (
                        <Text style={[shared.statusTag, styles.nextTag]}>Next</Text>
                      ) : p.status === 'prepaid' ? (
                        <Text style={shared.statusTag}>{p.status}</Text>
                      ) : null}
                    </View>
                  </View>
                );
              })}
          </View>
        );
      })}
    </>
  );
}

const styles = StyleSheet.create({
  yearHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.colors.borderSoft,
  },
  pressed: { opacity: 0.6 },
  year: { fontFamily: theme.font.roundedBold, fontSize: 15, color: theme.colors.textPrimary },
  yearSub: { fontFamily: theme.font.mono, fontSize: 11, color: theme.colors.textMuted },
  row: { gap: 12 },
  rowNext: {
    borderRadius: theme.radius.md,
    paddingHorizontal: 10,
  },
  marker: { width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  markerPaid: { backgroundColor: theme.colors.incomeTint },
  markerNext: { borderWidth: 2 },
  markerFuture: { borderWidth: 1.5, borderColor: theme.colors.borderSoft },
  overdueTag: { color: theme.colors.expenseText, backgroundColor: theme.colors.expenseTint },
  nextTag: { color: theme.colors.textPrimary, backgroundColor: theme.colors.surface },
});

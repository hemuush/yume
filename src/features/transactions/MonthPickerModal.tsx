import { useEffect, useState } from 'react';
import { View, Text, Pressable } from 'react-native';
import { ModalSheet } from '@/components/ModalSheet';
import { styles } from './transactions.styles';
import { MONTH_NAMES } from './transactions.constants';

/**
 * A month grid + year stepper for jumping the day-strip straight to any
 * past month in one tap — the ‹ › arrows alone stepped 7 days at a time,
 * so reaching January from September meant repeatedly tapping ‹ eight times.
 */
export function MonthPickerModal({
  visible,
  anchor,
  todayDate,
  onClose,
  onPick,
}: {
  visible: boolean;
  anchor: Date;
  todayDate: Date;
  onClose: () => void;
  onPick: (d: Date) => void;
}) {
  const [year, setYear] = useState(anchor.getFullYear());

  useEffect(() => {
    if (visible) setYear(anchor.getFullYear());
  }, [visible, anchor]);

  if (!visible) return null;

  const currentYear = todayDate.getFullYear();
  const currentMonth = todayDate.getMonth();

  const pickMonth = (monthIndex: number) => {
    // Lands on the month's last day (or today, if that month is still in
    // progress) — the 7-day window then reads backward from there, showing
    // that month's final week rather than an arbitrary mid-month slice.
    const lastDayOfMonth = new Date(year, monthIndex + 1, 0);
    onPick(lastDayOfMonth > todayDate ? todayDate : lastDayOfMonth);
  };

  return (
    <ModalSheet visible={visible} onClose={onClose} variant="center" scrollable={false} title="Jump to month">
      <View style={styles.yearRow}>
        <Pressable onPress={() => setYear((y) => y - 1)} hitSlop={10} style={styles.weekNavBtn}>
          <Text style={styles.weekNavArrow}>‹</Text>
        </Pressable>
        <Text style={styles.yearLabel}>{year}</Text>
        <Pressable
          onPress={() => setYear((y) => Math.min(currentYear, y + 1))}
          hitSlop={10}
          disabled={year >= currentYear}
          style={styles.weekNavBtn}
        >
          <Text style={[styles.weekNavArrow, year >= currentYear && styles.weekNavArrowDisabled]}>›</Text>
        </Pressable>
      </View>
      <View style={styles.monthGrid}>
        {MONTH_NAMES.map((name, idx) => {
          const isFuture = year === currentYear && idx > currentMonth;
          return (
            <Pressable
              key={name}
              style={[styles.monthCell, isFuture && styles.monthCellDisabled]}
              onPress={() => pickMonth(idx)}
              disabled={isFuture}
            >
              <Text style={[styles.monthCellText, isFuture && styles.monthCellTextDisabled]}>{name}</Text>
            </Pressable>
          );
        })}
      </View>
    </ModalSheet>
  );
}

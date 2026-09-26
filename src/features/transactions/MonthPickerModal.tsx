import { useEffect, useState } from 'react';
import { View, Pressable, Animated } from 'react-native';
import { Text } from '@/components/Text';
import { ModalSheet } from '@/components/ModalSheet';
import { usePressScale } from '@/lib/usePressScale';
import { styles } from './transactions.styles';
import { MONTH_NAMES } from './transactions.constants';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

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
  // Both hook calls stay above the `!visible` early return below — Rules of
  // Hooks requires the same hooks fire on every render regardless of props.
  const prevYearBtn = usePressScale();
  const nextYearBtn = usePressScale();

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
    <ModalSheet
      visible={visible}
      onClose={onClose}
      variant="center"
      showClose
      scrollable={false}
      title="Jump to month"
    >
      <View style={styles.yearRow}>
        <AnimatedPressable
          onPress={() => setYear((y) => y - 1)}
          onPressIn={prevYearBtn.onPressIn}
          onPressOut={prevYearBtn.onPressOut}
          hitSlop={10}
          style={[styles.weekNavBtn, prevYearBtn.animatedStyle]}
        >
          <Text style={styles.weekNavArrow}>‹</Text>
        </AnimatedPressable>
        <Text style={styles.yearLabel}>{year}</Text>
        <AnimatedPressable
          onPress={() => setYear((y) => Math.min(currentYear, y + 1))}
          onPressIn={nextYearBtn.onPressIn}
          onPressOut={nextYearBtn.onPressOut}
          hitSlop={10}
          disabled={year >= currentYear}
          style={[styles.weekNavBtn, nextYearBtn.animatedStyle]}
        >
          <Text style={[styles.weekNavArrow, year >= currentYear && styles.weekNavArrowDisabled]}>›</Text>
        </AnimatedPressable>
      </View>
      <View style={styles.monthGrid}>
        {MONTH_NAMES.map((name, idx) => {
          const isFuture = year === currentYear && idx > currentMonth;
          return <MonthCell key={name} name={name} disabled={isFuture} onPress={() => pickMonth(idx)} />;
        })}
      </View>
    </ModalSheet>
  );
}

function MonthCell({ name, disabled, onPress }: { name: string; disabled: boolean; onPress: () => void }) {
  const { animatedStyle, onPressIn, onPressOut } = usePressScale(0.94);
  return (
    <AnimatedPressable
      style={[styles.monthCell, disabled && styles.monthCellDisabled, animatedStyle]}
      onPress={onPress}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      disabled={disabled}
    >
      <Text style={[styles.monthCellText, disabled && styles.monthCellTextDisabled]}>{name}</Text>
    </AnimatedPressable>
  );
}

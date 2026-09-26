import { View, Text, Pressable } from 'react-native';
import ReanimatedAnimated, { FadeIn } from 'react-native-reanimated';
import Feather from '@expo/vector-icons/Feather';
import { PeriodCursor, periodLabel, stepPeriod, setGranularity, canStepForward } from '@/lib/period';
import { theme } from '@/constants/theme';
import { useSwipeStep } from '@/lib/useSwipeStep';
import { styles } from './reports.styles';

/** The period switcher: ‹ September 2026 › (tap or swipe), plus Month / Year. */
export function PeriodRow({
  cursor,
  onChange,
}: {
  cursor: PeriodCursor;
  onChange: (c: PeriodCursor) => void;
}) {
  const fwd = canStepForward(cursor);
  // A drag anywhere on the pill steps the period the same as tapping its own
  // chevrons, without needing to land on the small 36px arrow itself.
  const swipe = useSwipeStep(
    () => onChange(stepPeriod(cursor, -1)),
    () => fwd && onChange(stepPeriod(cursor, 1))
  );
  return (
    <View style={styles.periodRow}>
      <View style={styles.periodPill} {...swipe.panHandlers}>
        <Pressable
          onPress={() => onChange(stepPeriod(cursor, -1))}
          hitSlop={8}
          style={styles.periodArrow}
          accessibilityRole="button"
          accessibilityLabel="Previous period"
        >
          <Feather name="chevron-left" size={16} color={theme.colors.ink} />
        </Pressable>
        <ReanimatedAnimated.Text
          key={periodLabel(cursor)}
          entering={FadeIn.duration(150)}
          style={styles.periodLabel}
        >
          {periodLabel(cursor)}
        </ReanimatedAnimated.Text>
        <Pressable
          onPress={() => onChange(stepPeriod(cursor, 1))}
          disabled={!fwd}
          hitSlop={8}
          style={[styles.periodArrow, !fwd && { opacity: 0.25 }]}
          accessibilityRole="button"
          accessibilityLabel="Next period"
          accessibilityState={{ disabled: !fwd }}
        >
          <Feather name="chevron-right" size={16} color={theme.colors.ink} />
        </Pressable>
      </View>
      <View style={styles.gran}>
        {(['month', 'year'] as const).map((g) => {
          const active = cursor.granularity === g;
          return (
            <Pressable
              key={g}
              onPress={() => onChange(setGranularity(cursor, g))}
              style={[styles.granBtn, active && styles.granBtnOn]}
            >
              <Text style={[styles.granText, active && styles.granTextOn]}>
                {g === 'month' ? 'Month' : 'Year'}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

import { useState } from 'react';
import { View, Pressable } from 'react-native';
import { Text, MAX_FONT_SCALE } from '@/components/Text';
import ReanimatedAnimated, { FadeIn } from 'react-native-reanimated';
import Feather from '@expo/vector-icons/Feather';
import { ReportWindow, windowLabel, windowRange, stepWindow, canStepWindowForward } from '@/lib/period';
import { theme } from '@/constants/theme';
import { useSwipeStep } from '@/lib/useSwipeStep';
import { haptics } from '@/lib/haptics';
import { styles } from './reports.styles';
import { RangeSheet } from './RangeSheet';
import { DURATIONS } from '@/lib/motionTimings';
import { withPressed } from '@/lib/pressed';

const GRANULARITIES = [
  { key: 'month', label: 'Month' },
  { key: 'year', label: 'Year' },
  { key: 'custom', label: 'Custom' },
] as const;

/**
 * The period switcher: ‹ September 2026 › (tap or swipe), plus Month / Year
 * / Custom. Custom opens a range sheet; its arrows then step by the range's
 * own length. Month and Year go back to the current month or year.
 */
export function PeriodRow({
  cursor,
  onChange,
}: {
  cursor: ReportWindow;
  onChange: (c: ReportWindow) => void;
}) {
  const [rangeOpen, setRangeOpen] = useState(false);
  const fwd = canStepWindowForward(cursor);
  const change = (next: ReportWindow) => {
    haptics.tap();
    onChange(next);
  };
  const pickGranularity = (g: (typeof GRANULARITIES)[number]['key']) => {
    if (g === 'custom') {
      haptics.tap();
      setRangeOpen(true);
    } else if (cursor.granularity !== g) {
      change({ granularity: g, offset: 0 });
    }
  };
  // A drag anywhere on the pill steps the period the same as tapping its own
  // chevrons, without needing to land on the small 36px arrow itself.
  const swipe = useSwipeStep(
    () => change(stepWindow(cursor, -1)),
    () => fwd && change(stepWindow(cursor, 1))
  );
  return (
    <View style={styles.periodRow}>
      <View style={styles.periodPill} {...swipe.panHandlers}>
        <Pressable
          onPress={() => change(stepWindow(cursor, -1))}
          hitSlop={8}
          style={withPressed(styles.periodArrow)}
          accessibilityRole="button"
          accessibilityLabel="Previous period"
        >
          <Feather name="chevron-left" size={16} color={theme.colors.ink} />
        </Pressable>
        <ReanimatedAnimated.Text
          maxFontSizeMultiplier={MAX_FONT_SCALE}
          key={windowLabel(cursor)}
          entering={FadeIn.duration(DURATIONS.quick)}
          numberOfLines={2}
          style={styles.periodLabel}
        >
          {windowLabel(cursor)}
        </ReanimatedAnimated.Text>
        <Pressable
          onPress={() => change(stepWindow(cursor, 1))}
          disabled={!fwd}
          hitSlop={8}
          style={withPressed([styles.periodArrow, !fwd && { opacity: 0.25 }])}
          accessibilityRole="button"
          accessibilityLabel="Next period"
          accessibilityState={{ disabled: !fwd }}
        >
          <Feather name="chevron-right" size={16} color={theme.colors.ink} />
        </Pressable>
      </View>
      <View style={styles.gran}>
        {GRANULARITIES.map((g) => {
          const active = cursor.granularity === g.key;
          return (
            <Pressable
              key={g.key}
              onPress={() => pickGranularity(g.key)}
              style={withPressed([styles.granBtn, active && styles.granBtnOn])}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
            >
              <Text style={[styles.granText, active && styles.granTextOn]}>{g.label}</Text>
            </Pressable>
          );
        })}
      </View>
      <RangeSheet
        visible={rangeOpen}
        initial={windowRange(cursor)}
        onClose={() => setRangeOpen(false)}
        onApply={(range) => {
          setRangeOpen(false);
          onChange({ granularity: 'custom', ...range });
        }}
      />
    </View>
  );
}

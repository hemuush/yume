import { useState } from 'react';
import { View, Pressable, StyleProp, ViewStyle } from 'react-native';
import { Text, MAX_FONT_SCALE } from '@/components/Text';
import { ActionSheet } from '@/components/ActionSheet';
import ReanimatedAnimated, { FadeIn, ReduceMotion } from 'react-native-reanimated';
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
  { key: 'month', label: 'Month', menuLabel: 'Month' },
  { key: 'year', label: 'Year', menuLabel: 'Year' },
  { key: 'custom', label: 'Custom', menuLabel: 'Custom range' },
] as const;

/**
 * The period switcher: ‹ September 2026 › (tap or swipe), plus a Month ▾ button for Month / Year / Custom.
 * Custom opens a range sheet and its arrows step by the range's length; Month and Year return to the current
 * month or year.
 */
export function PeriodRow({
  cursor,
  onChange,
  style,
}: {
  cursor: ReportWindow;
  onChange: (c: ReportWindow) => void;
  /** Placement: a category page adds its side padding here; Reports' header has its own. */
  style?: StyleProp<ViewStyle>;
}) {
  const [rangeOpen, setRangeOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
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
  // A drag anywhere on the pill steps the period the same as tapping its own chevrons.
  const swipe = useSwipeStep(
    () => change(stepWindow(cursor, -1)),
    () => fwd && change(stepWindow(cursor, 1))
  );
  const granLabel = GRANULARITIES.find((g) => g.key === cursor.granularity)?.label ?? 'Month';
  return (
    <View style={[styles.periodRow, style]}>
      <View style={styles.periodPill} {...swipe.panHandlers}>
        <Pressable
          onPress={() => change(stepWindow(cursor, -1))}
          hitSlop={4}
          style={withPressed(styles.periodArrow)}
          accessibilityRole="button"
          accessibilityLabel="Previous period"
        >
          <Feather name="chevron-left" size={18} color={theme.colors.ink} />
        </Pressable>
        <ReanimatedAnimated.Text
          maxFontSizeMultiplier={MAX_FONT_SCALE}
          key={windowLabel(cursor)}
          entering={FadeIn.duration(DURATIONS.quick).reduceMotion(ReduceMotion.System)}
          numberOfLines={2}
          style={styles.periodLabel}
        >
          {windowLabel(cursor)}
        </ReanimatedAnimated.Text>
        <Pressable
          onPress={() => change(stepWindow(cursor, 1))}
          disabled={!fwd}
          hitSlop={4}
          style={withPressed([styles.periodArrow, !fwd && styles.periodArrowOff])}
          accessibilityRole="button"
          accessibilityLabel="Next period"
          accessibilityState={{ disabled: !fwd }}
        >
          <Feather name="chevron-right" size={18} color={theme.colors.ink} />
        </Pressable>
      </View>
      {/* Month / Year / Custom, folded into one button: the choice is made rarely, the period stepped often. */}
      <Pressable
        onPress={() => {
          haptics.tap();
          setMenuOpen(true);
        }}
        style={withPressed(styles.granChip)}
        accessibilityRole="button"
        accessibilityLabel={`Period type: ${granLabel}. Change`}
      >
        <Text style={styles.granChipText}>{granLabel}</Text>
        <Feather name="chevron-down" size={14} color={theme.colors.ink} />
      </Pressable>
      <ActionSheet
        visible={menuOpen}
        onClose={() => setMenuOpen(false)}
        title="Show by"
        items={GRANULARITIES.map((g) => ({
          key: g.key,
          label: g.menuLabel,
          icon: cursor.granularity === g.key ? 'check-circle' : 'circle',
          onPress: () => pickGranularity(g.key),
        }))}
      />
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

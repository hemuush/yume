import { useState } from 'react';
import { Pressable, Animated, StyleSheet } from 'react-native';
import { Text } from '@/components/Text';
import Feather from '@expo/vector-icons/Feather';
import { theme } from '@/constants/theme';
import { usePressScale } from '@/lib/usePressScale';
import { PeriodPicker } from '@/components/PeriodPicker';
import { GLASS } from '@/components/Glass';
import { PeriodCursor, periodLabel, periodRange, periodShortLabel } from '@/lib/period';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

/**
 * Home's period control ("September ▾"): opens the period picker (Month | Year, a month grid, "This month").
 * `compact` is the smaller copy in the collapsed brand row: no calendar icon, shorter max width, same menu.
 */
export function MonthPill({
  cursor,
  onChange,
  compact,
}: {
  cursor: PeriodCursor;
  onChange: (next: PeriodCursor) => void;
  compact?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const start = periodRange(cursor).start;
  const { animatedStyle, onPressIn, onPressOut } = usePressScale(0.97);

  const pick = (next: PeriodCursor) => {
    onChange(next);
    setOpen(false);
  };

  return (
    <>
      <AnimatedPressable
        onPress={() => setOpen(true)}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        hitSlop={{ top: compact ? 7 : 6, bottom: compact ? 7 : 6, left: 6, right: 6 }}
        accessibilityRole="button"
        accessibilityLabel={`Change period, currently ${periodLabel(cursor)}`}
        style={[styles.pill, compact && styles.pillCompact, animatedStyle]}
      >
        <Text style={[styles.pillText, compact && styles.pillTextCompact]} numberOfLines={1}>
          {compact ? periodShortLabel(cursor) : periodLabel(cursor)}
        </Text>
        <Feather name="chevron-down" size={14} color={theme.colors.ink} />
      </AnimatedPressable>

      <PeriodPicker
        visible={open}
        onClose={() => setOpen(false)}
        today={new Date()}
        allowYear
        selected={{
          kind: cursor.granularity,
          year: Number(start.slice(0, 4)),
          month: Number(start.slice(5, 7)) - 1,
        }}
        onPickMonth={(y, m) => {
          const now = new Date();
          pick({ granularity: 'month', offset: (y - now.getFullYear()) * 12 + (m - now.getMonth()) });
        }}
        onPickYear={(y) => pick({ granularity: 'year', offset: y - new Date().getFullYear() })}
        onCurrent={(kind) => pick({ granularity: kind, offset: 0 })}
      />
    </>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minHeight: 32,
    paddingHorizontal: 12,
    borderRadius: theme.radius.pill,
    backgroundColor: GLASS.fillStrong,
    borderWidth: 1,
    borderColor: GLASS.edge,
    maxWidth: 168,
  },
  pillText: { fontFamily: theme.font.bodyBold, fontSize: 13, color: theme.colors.ink, flexShrink: 1 },
  pillCompact: { gap: 4, minHeight: 30, paddingHorizontal: 10, maxWidth: 140 },
  pillTextCompact: { fontFamily: theme.font.bodyBold, fontSize: 12 },
});

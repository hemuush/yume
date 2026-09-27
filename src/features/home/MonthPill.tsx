import { useState } from 'react';
import { View, Pressable, Animated, Modal, StyleSheet } from 'react-native';
import { Text } from '@/components/Text';
import Feather from '@expo/vector-icons/Feather';
import { theme } from '@/constants/theme';
import { useAccent } from '@/theme/AccentContext';
import { usePressScale } from '@/lib/usePressScale';
import {
  PeriodCursor,
  PeriodGranularity,
  canStepForward,
  periodLabel,
  periodShortLabel,
  setGranularity,
  stepPeriod,
} from '@/lib/period';
import { withPressed } from '@/lib/pressed';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

/**
 * The compact period control in the Home header — "September 2026 ▾". Tapping
 * opens a small menu with prev/next, a "This month" reset, and the Month/Year
 * toggle, so browsing history and switching to the yearly view both stay
 * reachable without a full prev/next period bar taking up header space.
 *
 * `compact` is the smaller copy that fades into the collapsed header's brand
 * row: no calendar icon, a shorter max width, same menu.
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
  const { accent, onAccent } = useAccent();
  const [open, setOpen] = useState(false);
  const forward = canStepForward(cursor);
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
        hitSlop={6}
        accessibilityRole="button"
        accessibilityLabel={`Change period, currently ${periodLabel(cursor)}`}
        style={[styles.pill, compact && styles.pillCompact, animatedStyle]}
      >
        {!compact && <Feather name="calendar" size={13} color={theme.colors.ink} />}
        <Text style={[styles.pillText, compact && styles.pillTextCompact]} numberOfLines={1}>
          {compact ? periodShortLabel(cursor) : periodLabel(cursor)}
        </Text>
        <Feather name="chevron-down" size={14} color={theme.colors.ink} />
      </AnimatedPressable>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable
          style={styles.backdrop}
          onPress={() => setOpen(false)}
          accessibilityRole="button"
          accessibilityLabel="Close period picker"
        >
          {/* Only swallows taps so they do not reach the backdrop — not a control itself. */}
          <Pressable style={styles.menu} onPress={(e) => e.stopPropagation()} accessible={false}>
            <View style={styles.stepRow}>
              <Pressable
                onPress={() => pick(stepPeriod(cursor, -1))}
                hitSlop={8}
                style={withPressed(styles.stepBtn)}
                accessibilityRole="button"
                accessibilityLabel="Previous period"
              >
                <Feather name="chevron-left" size={18} color={theme.colors.ink} />
              </Pressable>
              <Text style={styles.stepLabel} numberOfLines={1}>
                {periodLabel(cursor)}
              </Text>
              <Pressable
                onPress={() => pick(stepPeriod(cursor, 1))}
                disabled={!forward}
                hitSlop={8}
                style={withPressed([styles.stepBtn, !forward && styles.disabled])}
                accessibilityRole="button"
                accessibilityLabel="Next period"
              >
                <Feather name="chevron-right" size={18} color={theme.colors.ink} />
              </Pressable>
            </View>

            <View style={styles.toggle}>
              {(['month', 'year'] as PeriodGranularity[]).map((g) => {
                const active = cursor.granularity === g;
                return (
                  <Pressable
                    key={g}
                    onPress={() => pick(setGranularity(cursor, g))}
                    style={withPressed([styles.toggleBtn, active && { backgroundColor: accent }])}
                  >
                    <Text style={[styles.toggleText, active && { color: onAccent }]}>
                      {g === 'month' ? 'Month' : 'Year'}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            {cursor.offset !== 0 && (
              <Pressable style={withPressed(styles.resetBtn)} onPress={() => pick({ ...cursor, offset: 0 })}>
                <Text style={styles.resetText}>
                  Jump to {cursor.granularity === 'year' ? 'this year' : 'this month'}
                </Text>
              </Pressable>
            )}
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.borderSoft,
    maxWidth: 168,
  },
  pillText: { fontFamily: theme.font.roundedMedium, fontSize: 12.5, color: theme.colors.ink, flexShrink: 1 },
  pillCompact: { gap: 4, paddingHorizontal: 10, paddingVertical: 5, maxWidth: 140 },
  pillTextCompact: { fontFamily: theme.font.roundedMedium, fontSize: 12 },

  backdrop: {
    flex: 1,
    backgroundColor: theme.colors.scrimLight,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  menu: {
    width: '100%',
    maxWidth: 300,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.xl2,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.borderSoft,
    padding: 14,
    gap: 12,
  },
  stepRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  stepBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  disabled: { opacity: 0.25 },
  stepLabel: {
    flex: 1,
    textAlign: 'center',
    fontFamily: theme.font.roundedBold,
    fontSize: 16,
    color: theme.colors.textPrimary,
  },
  toggle: {
    flexDirection: 'row',
    backgroundColor: theme.colors.surfaceAlt,
    borderRadius: theme.radius.pill,
    padding: 3,
    gap: 3,
  },
  toggleBtn: { flex: 1, paddingVertical: 8, borderRadius: theme.radius.pill, alignItems: 'center' },
  toggleText: { fontFamily: theme.font.bodyBold, fontSize: 12.5, color: theme.colors.textSecondary },
  resetBtn: { alignItems: 'center', paddingVertical: 8 },
  resetText: { fontFamily: theme.font.bodyBold, fontSize: 12.5, color: theme.colors.textSecondary },
});

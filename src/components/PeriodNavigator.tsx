import { View, Text, Pressable, StyleSheet } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { theme } from '@/constants/theme';
import { useAccent } from '@/theme/AccentContext';
import {
  PeriodCursor,
  PeriodGranularity,
  canStepForward,
  periodLabel,
  setGranularity,
  stepPeriod,
} from '@/lib/period';

/**
 * ‹ September › with a Month/Year toggle — the single control for browsing
 * back through history. Every screen that shows period totals uses this one
 * component so stepping back a month means the same thing everywhere.
 */
export function PeriodNavigator({
  cursor,
  onChange,
  compact,
}: {
  cursor: PeriodCursor;
  onChange: (next: PeriodCursor) => void;
  /** Hides the Month/Year toggle where only month browsing makes sense. */
  compact?: boolean;
}) {
  const { accent, onAccent } = useAccent();
  const forward = canStepForward(cursor);

  return (
    <View style={styles.wrap}>
      <View style={styles.stepper}>
        <Pressable
          onPress={() => onChange(stepPeriod(cursor, -1))}
          hitSlop={10}
          style={styles.arrow}
          accessibilityRole="button"
          accessibilityLabel="Previous period"
        >
          <Feather name="chevron-left" size={18} color={theme.colors.ink} />
        </Pressable>
        <Text style={styles.label} numberOfLines={1}>
          {periodLabel(cursor)}
        </Text>
        <Pressable
          onPress={() => onChange(stepPeriod(cursor, 1))}
          hitSlop={10}
          disabled={!forward}
          style={[styles.arrow, !forward && styles.arrowDisabled]}
          accessibilityRole="button"
          accessibilityLabel="Next period"
        >
          <Feather name="chevron-right" size={18} color={theme.colors.ink} />
        </Pressable>
      </View>

      {!compact && (
        <View style={styles.toggle}>
          {(['month', 'year'] as PeriodGranularity[]).map((g) => {
            const active = cursor.granularity === g;
            return (
              <Pressable
                key={g}
                onPress={() => onChange(setGranularity(cursor, g))}
                style={[styles.toggleBtn, active && { backgroundColor: accent }]}
              >
                <Text style={[styles.toggleText, active && { color: onAccent }]}>
                  {g === 'month' ? 'Month' : 'Year'}
                </Text>
              </Pressable>
            );
          })}
        </View>
      )}

      {cursor.offset !== 0 && (
        <Pressable onPress={() => onChange({ ...cursor, offset: 0 })} hitSlop={8} style={styles.today}>
          <Text style={styles.todayText}>Today</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 20, marginBottom: 12 },
  stepper: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: theme.colors.surface,
    borderWidth: theme.border.thick,
    borderColor: theme.colors.ink,
    borderRadius: theme.radius.md,
    paddingHorizontal: 6,
    paddingVertical: 6,
  },
  arrow: { width: 28, height: 28, alignItems: 'center', justifyContent: 'center' },
  arrowDisabled: { opacity: 0.25 },
  label: {
    flex: 1,
    textAlign: 'center',
    fontFamily: theme.font.bodyBold,
    fontSize: 14,
    color: theme.colors.textPrimary,
  },
  toggle: {
    flexDirection: 'row',
    backgroundColor: theme.colors.surface,
    borderWidth: theme.border.thick,
    borderColor: theme.colors.ink,
    borderRadius: theme.radius.md,
    padding: 3,
    gap: 2,
  },
  toggleBtn: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: theme.radius.sm },
  toggleText: { fontFamily: theme.font.bodyBold, fontSize: 12, color: theme.colors.textSecondary },
  today: {
    paddingHorizontal: 10,
    paddingVertical: 9,
    borderRadius: theme.radius.md,
    borderWidth: theme.border.thin,
    borderColor: theme.colors.ink,
    backgroundColor: theme.colors.surfaceAlt,
  },
  todayText: { fontFamily: theme.font.bodyBold, fontSize: 12, color: theme.colors.textPrimary },
});

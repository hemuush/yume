import { View, Pressable, StyleSheet } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { Text } from '@/components/Text';
import { screenStyles as h } from '@/components/screenStyles';
import { theme } from '@/constants/theme';
import { withPressed } from '@/lib/pressed';
import {
  TIME_RANGES,
  TIME_STEP_MINUTES,
  TimeSlotKind,
  formatSlotTime,
  slotRangeLabel,
} from '@/lib/notificationTimes';

const LABELS: Record<TimeSlotKind, string> = { morning: 'Morning time', evening: 'Evening time' };

/** The row that opens under a Morning or Evening row: its time, moved 30 minutes at a time within the slot's range. */
export function SlotTimeStepper({
  kind,
  minutes,
  onChange,
}: {
  kind: TimeSlotKind;
  minutes: number;
  onChange: (minutes: number) => void;
}) {
  const { min, max } = TIME_RANGES[kind];
  const earlier = minutes <= min;
  const later = minutes >= max;
  return (
    <View style={[h.row, h.divider, styles.row]} testID={`${kind}-stepper`}>
      <View style={h.mid}>
        <Text style={h.title}>{LABELS[kind]}</Text>
        <Text style={h.sub}>{slotRangeLabel(kind)}</Text>
      </View>
      <View style={styles.timeRow}>
        <Pressable
          style={withPressed(styles.timeBtn)}
          disabled={earlier}
          onPress={() => onChange(minutes - TIME_STEP_MINUTES)}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={`${LABELS[kind]} 30 minutes earlier`}
          accessibilityState={{ disabled: earlier }}
        >
          <Feather
            name="chevron-down"
            size={16}
            color={earlier ? theme.colors.textMuted : theme.colors.ink}
          />
        </Pressable>
        <Text style={styles.timeValue}>{formatSlotTime(minutes)}</Text>
        <Pressable
          style={withPressed(styles.timeBtn)}
          disabled={later}
          onPress={() => onChange(minutes + TIME_STEP_MINUTES)}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={`${LABELS[kind]} 30 minutes later`}
          accessibilityState={{ disabled: later }}
        >
          <Feather name="chevron-up" size={16} color={later ? theme.colors.textMuted : theme.colors.ink} />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { backgroundColor: theme.colors.surfaceAlt },
  timeRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  timeBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.borderSoft,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.surface,
  },
  // Wide enough that 9:30 AM and 10:00 PM don't shift the arrows.
  timeValue: {
    fontFamily: theme.font.monoBold,
    fontSize: 13,
    color: theme.colors.textPrimary,
    minWidth: 72,
    textAlign: 'center',
  },
});

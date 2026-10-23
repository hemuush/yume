import { View, Pressable, StyleSheet } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { Text } from '@/components/Text';
import { ToggleSwitch } from '@/components/ToggleSwitch';
import { screenStyles as h } from '@/components/screenStyles';
import { theme } from '@/constants/theme';
import { withPressedTint } from '@/lib/pressed';
import { useAccent } from '@/theme/AccentContext';
import {
  TIME_RANGES,
  TIME_STEP_MINUTES,
  TimeSlotKind,
  formatSlotTime,
  slotRangeLabel,
} from '@/lib/notificationTimes';

const NAMES: Record<TimeSlotKind, string> = { morning: 'Morning', evening: 'Evening' };

/**
 * One of the day's two notification times as a card: its name and switch, then its time with a button to move
 * it 30 minutes either way, and the range it can sit in. The time stays on screen (dimmed) while it is off.
 */
export function SlotCard({
  kind,
  sub,
  on,
  minutes,
  onToggle,
  onChange,
}: {
  kind: TimeSlotKind;
  sub: string;
  on: boolean;
  minutes: number;
  onToggle: (on: boolean) => void;
  onChange: (minutes: number) => void;
}) {
  const { accent } = useAccent();
  const { min, max } = TIME_RANGES[kind];
  const name = NAMES[kind];
  const earlier = minutes <= min;
  const later = minutes >= max;
  return (
    <View style={styles.card} testID={`${kind}-slot`}>
      <View style={styles.head}>
        <View style={h.mid}>
          <Text style={styles.name}>{name}</Text>
          <Text style={styles.sub}>{sub}</Text>
        </View>
        <ToggleSwitch accessibilityLabel={name} value={on} onChange={onToggle} />
      </View>
      <View style={[styles.time, !on && styles.off]}>
        <Pressable
          style={withPressedTint(accent, styles.step)}
          disabled={earlier}
          onPress={() => onChange(minutes - TIME_STEP_MINUTES)}
          accessibilityRole="button"
          accessibilityLabel={`${name} time 30 minutes earlier`}
          accessibilityState={{ disabled: earlier }}
        >
          <Feather name="minus" size={16} color={earlier ? theme.colors.textMuted : theme.colors.ink} />
        </Pressable>
        <Text style={styles.clock} numberOfLines={1}>
          {formatSlotTime(minutes)}
        </Text>
        <Pressable
          style={withPressedTint(accent, styles.step)}
          disabled={later}
          onPress={() => onChange(minutes + TIME_STEP_MINUTES)}
          accessibilityRole="button"
          accessibilityLabel={`${name} time 30 minutes later`}
          accessibilityState={{ disabled: later }}
        >
          <Feather name="plus" size={16} color={later ? theme.colors.textMuted : theme.colors.ink} />
        </Pressable>
      </View>
      <Text style={styles.range}>{slotRangeLabel(kind)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexGrow: 1,
    flexBasis: 150,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.xl2,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.borderSoft,
    padding: 14,
    gap: 6,
  },
  head: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  name: { fontFamily: theme.font.bodyBold, fontSize: theme.typeSize.row, color: theme.colors.textPrimary },
  sub: { fontFamily: theme.font.body, fontSize: 12, lineHeight: 17, color: theme.colors.textSecondary },
  time: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 4 },
  off: { opacity: 0.55 },
  step: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.tray,
    boxShadow: `inset 0 0 0 1px ${theme.colors.inkHairline}`,
  },
  clock: {
    flexShrink: 1,
    fontFamily: theme.font.roundedBold,
    fontSize: 17,
    color: theme.colors.textPrimary,
    textAlign: 'center',
  },
  range: { fontFamily: theme.font.body, fontSize: 11.5, color: theme.colors.textMuted, textAlign: 'center' },
});

import { useState } from 'react';
import { View, Pressable, StyleSheet } from 'react-native';
import { Text } from '@/components/Text';
import Feather from '@expo/vector-icons/Feather';
import { CalendarSheet } from '@/components/CalendarSheet';
import { theme } from '@/constants/theme';
import { FIELD_LABEL } from '@/constants/textStyles';
import { haptics } from '@/lib/haptics';
import { parseLocalIsoDate, toLocalIsoDate, addDaysToIsoDate } from '@/lib/date';
import { withPressed } from '@/lib/pressed';

/** "5 Oct 2026" — the full date, since form dates are often in another year. */
export function dateFieldLabel(iso: string): string {
  return parseLocalIsoDate(iso).toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

/**
 * A form's date: a chip that opens CalendarSheet instead of three typed boxes. `pastFacing` fields get
 * Today/Yesterday chips; future-facing ones (first EMI, goal deadline) don't. Value is YYYY-MM-DD.
 */
export function DateField({
  label,
  value,
  onChange,
  minDate,
  maxDate,
  pastFacing,
}: {
  label: string;
  value: string;
  onChange: (iso: string) => void;
  minDate?: string;
  maxDate?: string;
  pastFacing?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const today = toLocalIsoDate(new Date());
  const yesterday = addDaysToIsoDate(today, -1);
  const quick = pastFacing
    ? [
        { iso: today, label: 'Today' },
        { iso: yesterday, label: 'Yesterday' },
      ].filter((q) => (!minDate || q.iso >= minDate) && (!maxDate || q.iso <= maxDate))
    : [];
  const isQuick = quick.some((q) => q.iso === value);

  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.row}>
        {quick.map((q) => (
          <Pressable
            key={q.label}
            onPress={() => {
              if (value !== q.iso) haptics.tap();
              onChange(q.iso);
            }}
            style={withPressed([styles.chip, value === q.iso && styles.chipOn])}
            accessibilityRole="button"
            accessibilityState={{ selected: value === q.iso }}
            accessibilityLabel={`${label}: ${q.label}`}
          >
            <Text style={[styles.chipText, value === q.iso && styles.chipTextOn]}>{q.label}</Text>
          </Pressable>
        ))}
        <Pressable
          onPress={() => {
            haptics.tap();
            setOpen(true);
          }}
          style={withPressed([styles.chip, !isQuick && pastFacing && styles.chipOn])}
          accessibilityRole="button"
          accessibilityLabel={`${label}: ${dateFieldLabel(value)}. Change`}
        >
          <Feather
            name="calendar"
            size={13}
            color={!isQuick && pastFacing ? theme.colors.surface : theme.colors.ink}
          />
          <Text style={[styles.chipText, !isQuick && pastFacing && styles.chipTextOn]}>
            {pastFacing && isQuick ? 'Pick' : dateFieldLabel(value)}
          </Text>
          <Feather
            name="chevron-down"
            size={12}
            color={!isQuick && pastFacing ? theme.colors.surface : theme.colors.textMuted}
          />
        </Pressable>
      </View>
      <CalendarSheet
        visible={open}
        value={value}
        minDate={minDate}
        maxDate={maxDate}
        title={label}
        onClose={() => setOpen(false)}
        onPick={onChange}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: 14 },
  label: {
    ...FIELD_LABEL,
    color: theme.colors.textMuted,
    marginBottom: 6,
  },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    minHeight: 44,
    justifyContent: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 13,
    paddingVertical: 9,
    borderRadius: theme.radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.borderSoft,
    backgroundColor: theme.colors.surface,
  },
  chipOn: { backgroundColor: theme.colors.ink, borderColor: theme.colors.ink },
  chipText: { fontFamily: theme.font.bodyMedium, fontSize: 13, color: theme.colors.textPrimary },
  chipTextOn: { color: theme.colors.surface },
});

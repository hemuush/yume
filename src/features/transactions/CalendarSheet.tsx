import { useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { ModalSheet } from '@/components/ModalSheet';
import { theme } from '@/constants/theme';
import { useAccent } from '@/theme/AccentContext';
import { parseLocalIsoDate, toLocalIsoDate, addMonthsToIsoDate } from '@/lib/date';

const WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

/**
 * A small month-grid date picker — Yume has no calendar library, and the
 * transaction form only ever needs to pick one day. Steps by month with the
 * ‹ › arrows; a day past `maxDate` (usually today, for a new entry) is
 * disabled. Value in / out is a plain YYYY-MM-DD string.
 */
export function CalendarSheet({
  visible,
  value,
  maxDate,
  onClose,
  onPick,
}: {
  visible: boolean;
  value: string;
  maxDate?: string;
  onClose: () => void;
  onPick: (isoDate: string) => void;
}) {
  const { accent, onAccent } = useAccent();
  // The month currently on screen — starts on the selected date's month.
  const [viewMonth, setViewMonth] = useState(() => value.slice(0, 7));

  // Re-seed the view when the sheet is reopened for a different value.
  const [seededFor, setSeededFor] = useState(value);
  if (visible && seededFor !== value) {
    setSeededFor(value);
    setViewMonth(value.slice(0, 7));
  }

  const [y, m] = viewMonth.split('-').map(Number);
  const firstWeekday = new Date(y, m - 1, 1).getDay();
  const daysInMonth = new Date(y, m, 0).getDate();
  const today = toLocalIsoDate(new Date());

  const cells: (string | null)[] = [];
  for (let i = 0; i < firstWeekday; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push(`${viewMonth}-${String(d).padStart(2, '0')}`);
  }

  return (
    <ModalSheet
      visible={visible}
      onClose={onClose}
      variant="center"
      showClose
      scrollable={false}
      title="Pick a date"
    >
      <View style={styles.header}>
        <Pressable
          onPress={() => setViewMonth(addMonthsToIsoDate(`${viewMonth}-01`, -1).slice(0, 7))}
          hitSlop={10}
          style={styles.navBtn}
          accessibilityLabel="Previous month"
        >
          <Feather name="chevron-left" size={20} color={theme.colors.ink} />
        </Pressable>
        <Text style={styles.monthLabel}>
          {MONTHS[m - 1]} {y}
        </Text>
        <Pressable
          onPress={() => setViewMonth(addMonthsToIsoDate(`${viewMonth}-01`, 1).slice(0, 7))}
          hitSlop={10}
          style={styles.navBtn}
          accessibilityLabel="Next month"
        >
          <Feather name="chevron-right" size={20} color={theme.colors.ink} />
        </Pressable>
      </View>

      <View style={styles.weekRow}>
        {WEEKDAYS.map((w, i) => (
          <Text key={i} style={styles.weekday}>
            {w}
          </Text>
        ))}
      </View>

      <View style={styles.grid}>
        {cells.map((iso, i) => {
          if (!iso) return <View key={i} style={styles.cell} />;
          const selected = iso === value;
          const isToday = iso === today;
          const disabled = maxDate ? iso > maxDate : false;
          return (
            <Pressable
              key={i}
              style={styles.cell}
              disabled={disabled}
              onPress={() => {
                onPick(iso);
                onClose();
              }}
            >
              <View
                style={[
                  styles.day,
                  isToday && styles.dayToday,
                  selected && { backgroundColor: accent, borderColor: theme.colors.ink },
                ]}
              >
                <Text
                  style={[
                    styles.dayText,
                    disabled && styles.dayTextDisabled,
                    selected && { color: onAccent },
                  ]}
                >
                  {parseLocalIsoDate(iso).getDate()}
                </Text>
              </View>
            </Pressable>
          );
        })}
      </View>
    </ModalSheet>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  navBtn: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center' },
  monthLabel: { fontFamily: theme.font.roundedBold, fontSize: 16, color: theme.colors.textPrimary },
  weekRow: { flexDirection: 'row', marginBottom: 4 },
  weekday: {
    flex: 1,
    textAlign: 'center',
    fontFamily: theme.font.bodyBold,
    fontSize: 10,
    color: theme.colors.textMuted,
  },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  cell: { width: `${100 / 7}%`, aspectRatio: 1, alignItems: 'center', justifyContent: 'center' },
  day: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'transparent',
  },
  dayToday: { borderColor: theme.colors.borderSoft },
  dayText: { fontFamily: theme.font.bodyMedium, fontSize: 13, color: theme.colors.textPrimary },
  dayTextDisabled: { color: theme.colors.textMuted, opacity: 0.4 },
});

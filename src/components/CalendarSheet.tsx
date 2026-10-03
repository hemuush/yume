import { useRef, useState } from 'react';
import { View, Pressable, Animated, StyleSheet, ScrollView } from 'react-native';
import { Text } from '@/components/Text';
import Feather from '@expo/vector-icons/Feather';
import { ModalSheet } from '@/components/ModalSheet';
import { theme } from '@/constants/theme';
import { useAccent } from '@/theme/AccentContext';
import { usePressScale } from '@/lib/usePressScale';
import { haptics } from '@/lib/haptics';
import { gridRows } from '@/lib/gridRows';
import { parseLocalIsoDate, toLocalIsoDate, addMonthsToIsoDate, addDaysToIsoDate } from '@/lib/date';
import { withPressed } from '@/lib/pressed';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

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
/** One year chip's width plus the gap after it. */
const YEAR_CHIP_STEP = 64;
/** How far the year list reaches either side of today, unless a min/max date limits it. */
const YEAR_SPAN = 15;

/**
 * The app's one date picker (no calendar library): month grid with ‹ ›; the month title opens a year/month
 * picker. Days outside `minDate`…`maxDate` are disabled; `quickPicks` adds Today/Yesterday. Value: YYYY-MM-DD.
 */
export function CalendarSheet({
  visible,
  value,
  minDate,
  maxDate,
  quickPicks,
  title = 'Pick a date',
  onClose,
  onPick,
}: {
  visible: boolean;
  value: string;
  minDate?: string;
  maxDate?: string;
  quickPicks?: boolean;
  title?: string;
  onClose: () => void;
  onPick: (isoDate: string) => void;
}) {
  const { accent, onAccent } = useAccent();
  const prevBtn = usePressScale();
  const nextBtn = usePressScale();
  // The month currently on screen — starts on the selected date's month.
  const [viewMonth, setViewMonth] = useState(() => value.slice(0, 7));
  const [pickingMonth, setPickingMonth] = useState(false);
  const yearStripRef = useRef<ScrollView>(null);

  // Re-seed the view when the sheet is reopened for a different value.
  const [seededFor, setSeededFor] = useState(value);
  if (visible && seededFor !== value) {
    setSeededFor(value);
    setViewMonth(value.slice(0, 7));
    setPickingMonth(false);
  }

  const [y, m] = viewMonth.split('-').map(Number);
  const firstWeekday = new Date(y, m - 1, 1).getDay();
  const daysInMonth = new Date(y, m, 0).getDate();
  const today = toLocalIsoDate(new Date());
  const yesterday = addDaysToIsoDate(today, -1);
  const outOfRange = (iso: string) => (minDate ? iso < minDate : false) || (maxDate ? iso > maxDate : false);

  const days = Array.from(
    { length: daysInMonth },
    (_, i) => `${viewMonth}-${String(i + 1).padStart(2, '0')}`
  );
  const weeks = gridRows(days, firstWeekday, 7);

  const thisYear = Number(today.slice(0, 4));
  const firstYear = Math.max(minDate ? Number(minDate.slice(0, 4)) : -Infinity, thisYear - YEAR_SPAN);
  const lastYear = Math.min(maxDate ? Number(maxDate.slice(0, 4)) : Infinity, thisYear + YEAR_SPAN);
  const years = Array.from({ length: lastYear - firstYear + 1 }, (_, i) => firstYear + i);
  // A whole month is only off-limits when every day of it is.
  const monthOutOfRange = (month: number) => {
    const key = `${y}-${String(month).padStart(2, '0')}`;
    return (minDate ? `${key}-31` < minDate : false) || (maxDate ? `${key}-01` > maxDate : false);
  };

  const pick = (iso: string) => {
    haptics.tap();
    onPick(iso);
    onClose();
  };
  const stepMonth = (by: number) => setViewMonth(addMonthsToIsoDate(`${viewMonth}-01`, by).slice(0, 7));

  return (
    <ModalSheet visible={visible} onClose={onClose} variant="center" scrollable={false} title={title}>
      {quickPicks && (
        <View style={styles.quickRow}>
          {[
            { iso: today, label: 'Today' },
            { iso: yesterday, label: 'Yesterday' },
          ]
            .filter((q) => !outOfRange(q.iso))
            .map((q) => (
              <Pressable
                key={q.label}
                onPress={() => pick(q.iso)}
                style={withPressed([
                  styles.quick,
                  value === q.iso && { backgroundColor: accent, borderColor: theme.colors.ink },
                ])}
                accessibilityRole="button"
                accessibilityState={{ selected: value === q.iso }}
              >
                <Text style={[styles.quickText, value === q.iso && { color: onAccent }]}>{q.label}</Text>
              </Pressable>
            ))}
        </View>
      )}

      <View style={styles.header}>
        <AnimatedPressable
          onPress={() => (pickingMonth ? setViewMonth(`${y - 1}-${viewMonth.slice(5)}`) : stepMonth(-1))}
          onPressIn={prevBtn.onPressIn}
          onPressOut={prevBtn.onPressOut}
          hitSlop={10}
          style={[styles.navBtn, prevBtn.animatedStyle]}
          accessibilityLabel={pickingMonth ? 'Previous year' : 'Previous month'}
        >
          <Feather name="chevron-left" size={20} color={theme.colors.ink} />
        </AnimatedPressable>
        <Pressable
          onPress={() => {
            haptics.tap();
            setPickingMonth((v) => !v);
          }}
          style={withPressed(styles.titleBtn)}
          accessibilityRole="button"
          accessibilityLabel={
            pickingMonth ? 'Back to the days' : `${MONTHS[m - 1]} ${y}. Pick a month and year`
          }
        >
          <Text style={styles.monthLabel}>{pickingMonth ? String(y) : `${MONTHS[m - 1]} ${y}`}</Text>
          <Feather name={pickingMonth ? 'chevron-up' : 'chevron-down'} size={15} color={theme.colors.ink} />
        </Pressable>
        <AnimatedPressable
          onPress={() => (pickingMonth ? setViewMonth(`${y + 1}-${viewMonth.slice(5)}`) : stepMonth(1))}
          onPressIn={nextBtn.onPressIn}
          onPressOut={nextBtn.onPressOut}
          hitSlop={10}
          style={[styles.navBtn, nextBtn.animatedStyle]}
          accessibilityLabel={pickingMonth ? 'Next year' : 'Next month'}
        >
          <Feather name="chevron-right" size={20} color={theme.colors.ink} />
        </AnimatedPressable>
      </View>

      {pickingMonth ? (
        <>
          <ScrollView
            ref={yearStripRef}
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.yearStrip}
            // Opens scrolled so the year on screen is visible, not the oldest
            // one — scrolled once it's laid out, which works on Android too.
            onLayout={() =>
              yearStripRef.current?.scrollTo({
                x: Math.max(0, (y - firstYear - 2) * YEAR_CHIP_STEP),
                animated: false,
              })
            }
          >
            {years.map((year) => (
              <Pressable
                key={year}
                onPress={() => setViewMonth(`${year}-${viewMonth.slice(5)}`)}
                style={withPressed([
                  styles.yearChip,
                  year === y && { backgroundColor: accent, borderColor: theme.colors.ink },
                ])}
                accessibilityRole="button"
                accessibilityState={{ selected: year === y }}
              >
                <Text style={[styles.yearText, year === y && { color: onAccent }]}>{year}</Text>
              </Pressable>
            ))}
          </ScrollView>
          {gridRows(
            MONTHS.map((_, i) => i + 1),
            0,
            3
          ).map((row, r) => (
            <View key={r} style={styles.row}>
              {row.map((month) =>
                month === null ? null : (
                  <Pressable
                    key={month}
                    disabled={monthOutOfRange(month)}
                    onPress={() => {
                      haptics.tap();
                      setViewMonth(`${y}-${String(month).padStart(2, '0')}`);
                      setPickingMonth(false);
                    }}
                    style={withPressed([styles.monthCell, month === m && { backgroundColor: accent }])}
                    accessibilityRole="button"
                    accessibilityLabel={`${MONTHS[month - 1]} ${y}`}
                  >
                    <Text
                      style={[
                        styles.monthCellText,
                        monthOutOfRange(month) && styles.dayTextDisabled,
                        month === m && { color: onAccent },
                      ]}
                    >
                      {MONTHS[month - 1].slice(0, 3)}
                    </Text>
                  </Pressable>
                )
              )}
            </View>
          ))}
        </>
      ) : (
        <>
          <View style={styles.row}>
            {WEEKDAYS.map((w, i) => (
              <Text key={i} style={[styles.slot, styles.weekday]}>
                {w}
              </Text>
            ))}
          </View>
          {weeks.map((week, r) => (
            <View key={r} style={styles.row}>
              {week.map((iso, c) =>
                iso === null ? (
                  <View key={`blank-${c}`} style={styles.slot} />
                ) : (
                  <DayCell
                    key={iso}
                    iso={iso}
                    disabled={outOfRange(iso)}
                    isToday={iso === today}
                    selected={iso === value}
                    accent={accent}
                    onAccent={onAccent}
                    onPress={() => pick(iso)}
                  />
                )
              )}
            </View>
          ))}
        </>
      )}
    </ModalSheet>
  );
}

function DayCell({
  iso,
  disabled,
  isToday,
  selected,
  accent,
  onAccent,
  onPress,
}: {
  iso: string;
  disabled: boolean;
  isToday: boolean;
  selected: boolean;
  accent: string;
  onAccent: string;
  onPress: () => void;
}) {
  // Squashes just the inner circle, not the whole slot — squashing the slot
  // itself would visibly nudge its neighbours in the row.
  const { animatedStyle, onPressIn, onPressOut } = usePressScale(0.88);
  const date = parseLocalIsoDate(iso);
  return (
    <Pressable
      style={[styles.slot, styles.cell]}
      disabled={disabled}
      onPress={onPress}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      accessibilityRole="button"
      accessibilityState={{ selected, disabled }}
      accessibilityLabel={date.toLocaleDateString(undefined, {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      })}
    >
      <Animated.View
        style={[
          styles.day,
          isToday && styles.dayToday,
          selected && { backgroundColor: accent, borderColor: theme.colors.ink },
          animatedStyle,
        ]}
      >
        <Text style={[styles.dayText, disabled && styles.dayTextDisabled, selected && { color: onAccent }]}>
          {date.getDate()}
        </Text>
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  quickRow: { flexDirection: 'row', gap: 8, marginBottom: 14 },
  quick: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 9,
    borderRadius: theme.radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.borderSoft,
    backgroundColor: theme.colors.surface,
  },
  quickText: { fontFamily: theme.font.roundedMedium, fontSize: 13, color: theme.colors.textPrimary },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  navBtn: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center' },
  titleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: theme.radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.borderSoft,
  },
  monthLabel: { fontFamily: theme.font.roundedBold, fontSize: 16, color: theme.colors.textPrimary },
  row: { flexDirection: 'row' },
  // Every slot takes an equal share of its row — see gridRows for why.
  slot: { flex: 1, minWidth: 0 },
  weekday: {
    textAlign: 'center',
    fontFamily: theme.font.bodyBold,
    fontSize: 10,
    color: theme.colors.textMuted,
    marginBottom: 4,
  },
  cell: { aspectRatio: 1, alignItems: 'center', justifyContent: 'center' },
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
  yearStrip: { gap: 6, paddingBottom: 12 },
  yearChip: {
    width: 58,
    alignItems: 'center',
    paddingVertical: 7,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.borderSoft,
    backgroundColor: theme.colors.surface,
  },
  yearText: { fontFamily: theme.font.monoBold, fontSize: 12.5, color: theme.colors.textPrimary },
  monthCell: { flex: 1, alignItems: 'center', paddingVertical: 12, margin: 3, borderRadius: 12 },
  monthCellText: { fontFamily: theme.font.roundedMedium, fontSize: 13.5, color: theme.colors.textPrimary },
});

import { useState } from 'react';
import { View, Pressable, StyleSheet, ScrollView } from 'react-native';
import { Text } from '@/components/Text';
import Feather from '@expo/vector-icons/Feather';
import { ModalSheet } from '@/components/ModalSheet';
import { PrimaryButton } from '@/components/PrimaryButton';
import { theme } from '@/constants/theme';
import { useAccent } from '@/theme/AccentContext';
import { haptics } from '@/lib/haptics';
import { gridRows } from '@/lib/gridRows';
import { parseLocalIsoDate, toLocalIsoDate, addMonthsToIsoDate, addDaysToIsoDate } from '@/lib/date';
import { customRangeLabel, financialYearOf, financialYearRange } from '@/lib/period';
import type { DateRange } from '@/types';
import { dayMonthYear } from '@/lib/dateLabels';
import { withPressed } from '@/lib/pressed';

const WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

/** The quick picks, worked out from today. */
export function rangeQuickPicks(today: string): { label: string; range: DateRange }[] {
  const thisMonth = `${today.slice(0, 7)}-01`;
  const fy = financialYearOf(today);
  const asRange = ({ start, end }: DateRange) => ({ start, end });
  return [
    { label: 'Last 30 days', range: { start: addDaysToIsoDate(today, -29), end: today } },
    {
      label: 'Last 3 months',
      range: { start: addMonthsToIsoDate(thisMonth, -3), end: addDaysToIsoDate(thisMonth, -1) },
    },
    { label: `FY ${fy}–${String((fy + 1) % 100).padStart(2, '0')}`, range: asRange(financialYearRange(fy)) },
    {
      label: `FY ${fy - 1}–${String(fy % 100).padStart(2, '0')}`,
      range: asRange(financialYearRange(fy - 1)),
    },
  ];
}

/**
 * Reports' "Custom": any range (a trip, last 30 days, a tax year). Quick picks on top, then a month calendar:
 * first tap is the start, second the end (swapped if backwards). Nothing after today can be picked.
 */
export function RangeSheet({
  visible,
  initial,
  onClose,
  onApply,
}: {
  visible: boolean;
  initial: DateRange;
  onClose: () => void;
  onApply: (range: DateRange) => void;
}) {
  const { accent, onAccent } = useAccent();
  const today = toLocalIsoDate(new Date());
  const [start, setStart] = useState(initial.start);
  const [end, setEnd] = useState<string | null>(initial.end);
  const [viewMonth, setViewMonth] = useState(() => (initial.end > today ? today : initial.end).slice(0, 7));

  // Re-seed each time the sheet opens, from whatever Reports is showing.
  const [wasVisible, setWasVisible] = useState(visible);
  if (visible !== wasVisible) {
    setWasVisible(visible);
    if (visible) {
      setStart(initial.start);
      setEnd(initial.end);
      setViewMonth((initial.end > today ? today : initial.end).slice(0, 7));
    }
  }

  const picks = rangeQuickPicks(today);
  const tapDay = (iso: string) => {
    haptics.tap();
    if (end !== null) {
      // A finished range: this tap starts a new one.
      setStart(iso);
      setEnd(null);
    } else if (iso < start) {
      // The second tap landed before the first: they swap.
      setEnd(start);
      setStart(iso);
    } else {
      setEnd(iso);
    }
  };

  const [y, m] = viewMonth.split('-').map(Number);
  const days = Array.from(
    { length: new Date(y, m, 0).getDate() },
    (_, i) => `${viewMonth}-${String(i + 1).padStart(2, '0')}`
  );
  const weeks = gridRows(days, new Date(y, m - 1, 1).getDay(), 7);
  const canNext = viewMonth < today.slice(0, 7);
  const stepMonth = (by: number) => setViewMonth(addMonthsToIsoDate(`${viewMonth}-01`, by).slice(0, 7));
  const monthTitle = parseLocalIsoDate(`${viewMonth}-01`).toLocaleDateString(undefined, {
    month: 'long',
    year: 'numeric',
  });

  const range = end ? { start, end } : null;
  return (
    <ModalSheet
      visible={visible}
      onClose={onClose}
      title="Pick a range"
      scrollable={false}
      footer={
        <PrimaryButton
          title={range ? `Show ${customRangeLabel(range)}` : 'Tap the last day'}
          disabled={!range}
          onPress={() => {
            if (!range) return;
            haptics.confirm();
            onApply(range);
          }}
        />
      }
    >
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.picks}>
        {picks.map((p) => {
          const on = range?.start === p.range.start && range?.end === p.range.end;
          return (
            <Pressable
              key={p.label}
              onPress={() => {
                haptics.tap();
                setStart(p.range.start);
                setEnd(p.range.end);
                setViewMonth((p.range.end > today ? today : p.range.end).slice(0, 7));
              }}
              style={withPressed([
                styles.pick,
                on && { backgroundColor: accent, borderColor: theme.colors.ink },
              ])}
              accessibilityRole="button"
              accessibilityState={{ selected: on }}
            >
              <Text style={[styles.pickText, on && { color: onAccent }]}>{p.label}</Text>
            </Pressable>
          );
        })}
      </ScrollView>

      <View style={styles.header}>
        <Pressable
          onPress={() => stepMonth(-1)}
          hitSlop={10}
          style={withPressed(styles.navBtn)}
          accessibilityLabel="Previous month"
        >
          <Feather name="chevron-left" size={20} color={theme.colors.ink} />
        </Pressable>
        <Text style={styles.monthLabel}>{monthTitle}</Text>
        <Pressable
          onPress={() => canNext && stepMonth(1)}
          disabled={!canNext}
          hitSlop={10}
          style={withPressed([styles.navBtn, !canNext && { opacity: 0.25 }])}
          accessibilityLabel="Next month"
        >
          <Feather name="chevron-right" size={20} color={theme.colors.ink} />
        </Pressable>
      </View>

      <View style={styles.row}>
        {WEEKDAYS.map((w, i) => (
          <Text key={i} style={[styles.slot, styles.weekday]}>
            {w}
          </Text>
        ))}
      </View>
      {weeks.map((week, r) => (
        <View key={r} style={styles.row}>
          {week.map((iso, c) => {
            if (iso === null) return <View key={`blank-${c}`} style={styles.slot} />;
            const future = iso > today;
            const isEnd = iso === start || iso === end;
            const inside = !!end && iso > start && iso < end;
            return (
              <Pressable
                key={iso}
                style={withPressed([
                  styles.slot,
                  styles.cell,
                  inside && { backgroundColor: theme.colors.primaryTint },
                ])}
                disabled={future}
                onPress={() => tapDay(iso)}
                accessibilityRole="button"
                accessibilityState={{ selected: isEnd || inside, disabled: future }}
                accessibilityLabel={dayMonthYear(iso)}
                testID={`range-day-${iso}`}
              >
                <View
                  style={[styles.day, isEnd && { backgroundColor: accent, borderColor: theme.colors.ink }]}
                >
                  <Text
                    style={[styles.dayText, future && styles.dayTextDisabled, isEnd && { color: onAccent }]}
                  >
                    {Number(iso.slice(8))}
                  </Text>
                </View>
              </Pressable>
            );
          })}
        </View>
      ))}

      <Text style={styles.summary}>
        {end
          ? `From ${dayMonthYear(start)} to ${dayMonthYear(end)}`
          : `From ${dayMonthYear(start)} — now tap the last day`}
      </Text>
    </ModalSheet>
  );
}

const styles = StyleSheet.create({
  picks: { gap: 8, paddingBottom: 14 },
  pick: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: theme.radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.borderSoft,
    backgroundColor: theme.colors.surface,
  },
  pickText: { fontFamily: theme.font.roundedMedium, fontSize: 13, color: theme.colors.textPrimary },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  navBtn: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center' },
  monthLabel: { fontFamily: theme.font.roundedBold, fontSize: 16, color: theme.colors.textPrimary },
  row: { flexDirection: 'row' },
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
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'transparent',
  },
  dayText: { fontFamily: theme.font.bodyMedium, fontSize: 13, color: theme.colors.textPrimary },
  dayTextDisabled: { color: theme.colors.textMuted, opacity: 0.4 },
  summary: {
    fontFamily: theme.font.body,
    fontSize: 12.5,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    marginTop: 10,
  },
});

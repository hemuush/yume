import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Text } from '@/components/Text';
import { theme } from '@/constants/theme';
import { dayMonth, weekdayDayMonth } from '@/lib/dateLabels';
import { formatMoney } from '@/lib/money';
import { withPressed } from '@/lib/pressed';
import { themeInk } from '@/theme/interactionColors';
import { useAccent } from '@/theme/AccentContext';
import type { Runway, RunwayDay } from './runway';

/** Only dates with scheduled outgoing payments; no empty days, income or carried balances. */
export function UpcomingDates({
  runway,
  renderDay,
}: {
  runway: Runway;
  renderDay?: (day: RunwayDay, mode: 'outgoing' | 'income') => React.ReactNode;
}) {
  const { accent } = useAccent();
  const ink = themeInk(accent);
  const [mode, setMode] = useState<'outgoing' | 'income'>('outgoing');
  const dates = runway.days.filter((day) => (mode === 'income' ? day.inMinor : day.outMinor) > 0);
  const [selectedDate, setSelectedDate] = useState(dates[0]?.date);
  const selected = dates.find((day) => day.date === selectedDate) ?? dates[0];
  return (
    <View testID="runway" style={s.root}>
      <View style={s.modeRow} accessibilityRole="radiogroup">
        {(['outgoing', 'income'] as const).map((value) => (
          <Pressable
            key={value}
            accessibilityRole="radio"
            accessibilityState={{ selected: mode === value }}
            onPress={() => setMode(value)}
            style={withPressed([s.mode, mode === value && { backgroundColor: ink }])}
          >
            <Text style={[s.dateLabel, mode === value && s.activeText]}>
              {value === 'outgoing' ? 'Money out' : 'Scheduled income'}
            </Text>
          </Pressable>
        ))}
      </View>
      {selected ? (
        <>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={s.dates}
            accessibilityLabel={
              mode === 'income' ? 'Scheduled income dates' : 'Upcoming outgoing payment dates'
            }
          >
            {dates.map((day) => {
              const active = day.date === selected.date;
              return (
                <Pressable
                  key={day.date}
                  testID={`${mode}-day-${day.date}`}
                  accessibilityRole="button"
                  accessibilityLabel={`${weekdayDayMonth(day.date)}, scheduled ${mode === 'income' ? 'income' : 'outgoing'} ${formatMoney(mode === 'income' ? day.inMinor : day.outMinor)}`}
                  accessibilityState={{ selected: active }}
                  onPress={() => setSelectedDate(day.date)}
                  style={withPressed([s.date, active && { backgroundColor: ink, borderColor: ink }])}
                >
                  <Text style={[s.dateLabel, active && s.activeText]}>{dayMonth(day.date)}</Text>
                  <Text style={[s.amount, active && s.activeText]}>
                    {formatMoney(mode === 'income' ? day.inMinor : day.outMinor)}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
          {selected.items.some((item) => item.dueDate < selected.date) && (
            <Text style={[s.caption, { marginHorizontal: 16 }]}>Includes overdue payments</Text>
          )}
          {renderDay ? (
            renderDay(selected, mode)
          ) : (
            <View style={s.summary} accessibilityLiveRegion="polite">
              <Text style={s.dateLabel}>
                {weekdayDayMonth(selected.date)} ·{' '}
                {formatMoney(mode === 'income' ? selected.inMinor : selected.outMinor)}{' '}
                {mode === 'income' ? 'expected' : 'due'}
              </Text>
              <Text style={s.caption}>
                {selected.items
                  .filter((item) =>
                    mode === 'income' ? item.kind === 'income' : item.kind === 'bill' || item.kind === 'emi'
                  )
                  .map((item) => item.title)
                  .join(' · ')}
              </Text>
            </View>
          )}
        </>
      ) : (
        <View style={s.summary}>
          <Text style={s.dateLabel}>
            {mode === 'income' ? 'No scheduled income' : 'No upcoming outgoing payments'}
          </Text>
          <Text style={s.caption}>
            {mode === 'income'
              ? 'Add recurring income from the Add menu.'
              : 'New scheduled bills and EMIs will appear here.'}
          </Text>
        </View>
      )}
    </View>
  );
}
const s = StyleSheet.create({
  root: { gap: 10 },
  modeRow: {
    marginHorizontal: 16,
    padding: 4,
    gap: 4,
    flexDirection: 'row',
    borderRadius: 24,
    backgroundColor: theme.colors.surfaceAlt,
  },
  mode: {
    flex: 1,
    minHeight: 44,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 6,
    borderRadius: 22,
  },
  dates: { paddingHorizontal: 16, gap: 8, paddingVertical: 2 },
  date: {
    minWidth: 88,
    minHeight: 64,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: theme.colors.borderSoft,
    backgroundColor: theme.colors.surface,
    gap: 5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dateLabel: { fontFamily: theme.font.bodyMedium, fontSize: 13, color: theme.colors.textPrimary },
  amount: {
    fontFamily: theme.font.body,
    fontSize: 12,
    color: theme.colors.textSecondary,
    fontVariant: ['tabular-nums'],
  },
  activeText: { color: theme.colors.white },
  summary: {
    marginHorizontal: 16,
    padding: 12,
    gap: 5,
    backgroundColor: theme.colors.surface,
    borderRadius: 18,
  },
  caption: { fontFamily: theme.font.body, fontSize: 12, color: theme.colors.textSecondary },
});

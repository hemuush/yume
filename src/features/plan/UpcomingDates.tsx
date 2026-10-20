import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Text } from '@/components/Text';
import { theme } from '@/constants/theme';
import { dayMonth, weekdayDayMonth } from '@/lib/dateLabels';
import { formatMoney } from '@/lib/money';
import { withPressed } from '@/lib/pressed';
import { homeInk } from '@/features/home/homeInk';
import { useAccent } from '@/theme/AccentContext';
import type { Runway, RunwayDay } from './runway';

/** Only dates with scheduled outgoing payments; no empty days, income or carried balances. */
export function UpcomingDates({
  runway,
  renderDay,
}: {
  runway: Runway;
  renderDay?: (day: RunwayDay) => React.ReactNode;
}) {
  const { accent } = useAccent();
  const ink = homeInk(accent);
  const dates = runway.days.filter((day) => day.outMinor > 0);
  const [selectedDate, setSelectedDate] = useState(dates[0]?.date);
  const selected = dates.find((day) => day.date === selectedDate) ?? dates[0];
  return (
    <View testID="runway" style={s.root}>
      {selected ? (
        <>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={s.dates}
            accessibilityLabel="Upcoming outgoing payment dates"
          >
            {dates.map((day) => {
              const active = day.date === selected.date;
              return (
                <Pressable
                  key={day.date}
                  testID={`outgoing-day-${day.date}`}
                  accessibilityRole="button"
                  accessibilityLabel={`${weekdayDayMonth(day.date)}, scheduled outgoing ${formatMoney(day.outMinor)}`}
                  accessibilityState={{ selected: active }}
                  onPress={() => setSelectedDate(day.date)}
                  style={withPressed([s.date, active && { backgroundColor: ink, borderColor: ink }])}
                >
                  <Text style={[s.dateLabel, active && s.activeText]}>{dayMonth(day.date)}</Text>
                  <Text style={[s.amount, active && s.activeText]}>{formatMoney(day.outMinor)}</Text>
                </Pressable>
              );
            })}
          </ScrollView>
          {selected.items.some((item) => item.dueDate < selected.date) && (
            <Text style={[s.caption, { marginHorizontal: 16 }]}>Includes overdue payments</Text>
          )}
          {renderDay ? (
            renderDay(selected)
          ) : (
            <View style={s.summary} accessibilityLiveRegion="polite">
              <Text style={s.dateLabel}>
                {weekdayDayMonth(selected.date)} · {formatMoney(selected.outMinor)} due
              </Text>
              <Text style={s.caption}>
                {selected.items
                  .filter((item) => item.kind === 'bill' || item.kind === 'emi')
                  .map((item) => item.title)
                  .join(' · ')}
              </Text>
            </View>
          )}
        </>
      ) : (
        <View style={s.summary}>
          <Text style={s.dateLabel}>No upcoming outgoing payments</Text>
          <Text style={s.caption}>New scheduled bills and EMIs will appear here.</Text>
        </View>
      )}
    </View>
  );
}
const s = StyleSheet.create({
  root: { gap: 10 },
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

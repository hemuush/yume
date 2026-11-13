import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Text } from '@/components/Text';
import { theme } from '@/constants/theme';
import { dayMonth, weekdayDayMonth } from '@/lib/dateLabels';
import { formatMoney } from '@/lib/money';
import { withPressedTint } from '@/lib/pressed';
import { selectedFill } from '@/theme/interactionColors';
import { useAccent } from '@/theme/AccentContext';
import type { Runway, RunwayDay } from './runway';
import { dueTone } from './planOverview';

type Mode = 'outgoing' | 'income';
/** The first chip: every date in the window, one list under day headings. */
const ALL = 'all';

/**
 * Only dates with scheduled outgoing payments or income; no empty days, balances or carried totals. A pill
 * switch picks money out or scheduled income, a strip of date pills (with "All" first) picks which days to
 * list, and `renderDays` draws them. A date with something late or close carries a small dot.
 */
export function UpcomingDates({
  runway,
  renderDays,
  today,
}: {
  runway: Runway;
  /** The days to list for the picked mode: every date under "All", or the one picked. */
  renderDays?: (days: RunwayDay[], mode: Mode) => React.ReactNode;
  /** YYYY-MM-DD: lets a date pill mark late or close payments. */
  today?: string;
}) {
  const { accent } = useAccent();
  const [mode, setMode] = useState<Mode>('outgoing');
  const dates = runway.days.filter((day) => (mode === 'income' ? day.inMinor : day.outMinor) > 0);
  const [picked, setPicked] = useState<string>(ALL);
  // A date that left the window (or the other mode has none) falls back to the whole list.
  const selected = picked === ALL ? undefined : dates.find((day) => day.date === picked);
  const shownDays = selected ? [selected] : dates;
  const amount = (day: RunwayDay) => (mode === 'income' ? day.inMinor : day.outMinor);
  const toneOf = (day: RunwayDay) => {
    if (!today) return null;
    const tones = day.items.map((item) => dueTone(item, today));
    return tones.includes('urgent') ? 'urgent' : tones.includes('soon') ? 'soon' : null;
  };
  return (
    <View testID="runway" style={s.root}>
      <View style={s.modeRow} accessibilityRole="radiogroup">
        {(['outgoing', 'income'] as const).map((value) => (
          <Pressable
            key={value}
            accessibilityRole="radio"
            accessibilityState={{ selected: mode === value }}
            onPress={() => {
              setMode(value);
              setPicked(ALL);
            }}
            style={withPressedTint(accent, [
              s.mode,
              mode === value && { backgroundColor: selectedFill(accent) },
            ])}
          >
            <Text style={[s.modeLabel, mode === value && s.activeText]}>
              {value === 'outgoing' ? 'Money out' : 'Scheduled income'}
            </Text>
          </Pressable>
        ))}
      </View>
      {dates.length > 0 ? (
        <>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={s.dates}
            accessibilityLabel={
              mode === 'income' ? 'Scheduled income dates' : 'Upcoming outgoing payment dates'
            }
          >
            {[ALL, ...dates.map((day) => day.date)].map((key) => {
              const day = dates.find((d) => d.date === key);
              const active = day ? selected?.date === key : !selected;
              const tone = day ? toneOf(day) : null;
              return (
                <Pressable
                  key={key}
                  testID={`${mode}-day-${key}`}
                  accessibilityRole="button"
                  accessibilityLabel={
                    day
                      ? `${weekdayDayMonth(day.date)}, scheduled ${mode === 'income' ? 'income' : 'outgoing'} ${formatMoney(amount(day))}${
                          tone === 'urgent'
                            ? ', has payments due now or late'
                            : tone === 'soon'
                              ? ', has payments due soon'
                              : ''
                        }`
                      : 'All dates'
                  }
                  accessibilityState={{ selected: active }}
                  onPress={() => setPicked(key)}
                  style={s.pillHit}
                >
                  {({ pressed }) => (
                    <View
                      style={[
                        s.pill,
                        active && {
                          backgroundColor: selectedFill(accent),
                          borderColor: selectedFill(accent),
                        },
                        pressed && !active && s.pillPressed,
                      ]}
                    >
                      <Text style={s.pillText}>{day ? dayMonth(day.date) : 'All'}</Text>
                      {tone && (
                        <View
                          style={[
                            s.dot,
                            {
                              backgroundColor:
                                tone === 'urgent' ? theme.colors.expense : theme.colors.slice.due,
                            },
                          ]}
                        />
                      )}
                    </View>
                  )}
                </Pressable>
              );
            })}
          </ScrollView>
          {renderDays ? (
            renderDays(shownDays, mode)
          ) : (
            <View style={s.summary} accessibilityLiveRegion="polite">
              {shownDays.map((day) => (
                <View key={day.date} style={s.summaryDay}>
                  <Text style={s.dateLabel}>
                    {weekdayDayMonth(day.date)} · {formatMoney(amount(day))}{' '}
                    {mode === 'income' ? 'expected' : 'due'}
                  </Text>
                  <Text style={s.caption}>
                    {day.items
                      .filter((item) =>
                        mode === 'income'
                          ? item.kind === 'income' || item.transfer?.flow === 'in'
                          : item.kind === 'bill' || item.kind === 'emi' || item.transfer?.flow === 'out'
                      )
                      .map((item) => item.title)
                      .join(' · ')}
                  </Text>
                </View>
              ))}
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
  root: { gap: 8 },
  // A pill switch like Reports and Activity use: one raised pill under the picked choice.
  modeRow: {
    marginHorizontal: 16,
    padding: 2,
    flexDirection: 'row',
    borderRadius: 999,
    backgroundColor: theme.colors.glass,
    borderWidth: 1,
    borderColor: theme.colors.borderSoft,
  },
  mode: { flex: 1, minHeight: 44, justifyContent: 'center', alignItems: 'center', borderRadius: 999 },
  modeLabel: { fontFamily: theme.font.body, fontSize: 13, color: theme.colors.textSecondary },
  dates: { paddingHorizontal: 16, gap: 6 },
  // A 44 dp touch area around a 32 dp pill.
  pillHit: { minHeight: 44, justifyContent: 'center' },
  pill: {
    minHeight: 32,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: theme.colors.borderSoft,
    backgroundColor: theme.colors.surface,
  },
  pillPressed: { backgroundColor: theme.colors.tray },
  // The same weight picked or not, so picking a date never changes the width of the pills beside it.
  pillText: { fontFamily: theme.font.bodyMedium, fontSize: 13, color: theme.colors.textPrimary },
  dot: { width: 7, height: 7, borderRadius: 4 },
  activeText: { fontFamily: theme.font.bodyBold, color: theme.colors.textPrimary },
  dateLabel: { fontFamily: theme.font.bodyMedium, fontSize: 13, color: theme.colors.textPrimary },
  summary: {
    marginHorizontal: 16,
    padding: 12,
    gap: 8,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.xl,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.borderSoft,
  },
  summaryDay: { gap: 4 },
  caption: { fontFamily: theme.font.body, fontSize: 12, color: theme.colors.textSecondary },
});

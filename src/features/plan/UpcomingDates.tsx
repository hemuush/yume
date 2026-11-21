import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Text } from '@/components/Text';
import { theme } from '@/constants/theme';
import { dayMonth, weekdayDayMonthMaybeYear } from '@/lib/dateLabels';
import { parseLocalIsoDate } from '@/lib/date';
import { formatMoney } from '@/lib/money';
import { withPressedTint } from '@/lib/pressed';
import { useAccent } from '@/theme/AccentContext';
import type { Runway, RunwayDay } from './runway';
import { dueTone } from './planOverview';
import { themedStyles } from '@/theme/themedStyles';

type Mode = 'outgoing' | 'income';
/** The first chip: every date in the window, one list under day headings. */
const ALL = 'all';

export type UpcomingSelection = { mode: Mode; dates: Record<Mode, string> };

export function upcomingSelection(date?: string): UpcomingSelection {
  return { mode: 'outgoing', dates: { outgoing: date ?? ALL, income: ALL } };
}

/**
 * Only dates with scheduled outgoing payments or income; no empty days, balances or carried totals. A pill
 * switch picks money out or scheduled income, a strip of date pills (with "All" first) picks which days to
 * list, and `renderDays` draws them. A date with something late or close carries a small dot.
 */
export function UpcomingDates({
  runway,
  renderDays,
  today,
  initialDate,
  selection,
  onSelectionChange,
}: {
  runway: Runway;
  /** The days to list for the picked mode: every date under "All", or the one picked. */
  renderDays?: (days: RunwayDay[], mode: Mode) => React.ReactNode;
  /** YYYY-MM-DD: lets a date pill mark late or close payments. */
  today?: string;
  initialDate?: string;
  selection?: UpcomingSelection;
  onSelectionChange?: (selection: UpcomingSelection) => void;
}) {
  const { accent } = useAccent();
  const [local, setLocal] = useState(() => upcomingSelection(initialDate));
  const current = selection ?? local;
  const { mode } = current;
  const update = onSelectionChange ?? setLocal;
  const dates = runway.days.filter((day) => (mode === 'income' ? day.inMinor : day.outMinor) > 0);
  const picked = current.dates[mode];
  // A date that left the window (or the other mode has none) falls back to the whole list.
  const selected = picked === ALL ? undefined : dates.find((day) => day.date === picked);
  const shownDays = selected ? [selected] : dates;
  const amount = (day: RunwayDay) => (mode === 'income' ? day.inMinor : day.outMinor);
  const total = shownDays.reduce((sum, day) => sum + amount(day), 0);
  const reference = today ? parseLocalIsoDate(today) : undefined;
  const toneOf = (day: RunwayDay) => {
    if (!today || mode === 'income') return null;
    const tones = day.items.map((item) => dueTone(item, today));
    return tones.includes('urgent') ? 'urgent' : tones.includes('soon') ? 'soon' : null;
  };
  return (
    <View testID="runway" style={s.root}>
      <View style={s.filters}>
        <View style={s.modeRow} accessibilityRole="radiogroup" accessibilityLabel="Schedule direction">
          {(['outgoing', 'income'] as const).map((value) => (
            <Pressable
              key={value}
              accessibilityRole="radio"
              accessibilityState={{ checked: mode === value }}
              onPress={() => update({ ...current, mode: value })}
              style={withPressedTint(accent, [s.mode, mode === value && s.modeOn])}
            >
              <View style={s.modeInner}>
                <Text style={[s.modeLabel, mode === value && s.activeText]}>
                  {value === 'outgoing' ? 'Money out' : 'Money in'}
                </Text>
                {mode === value && (
                  <Text style={[s.modeLabel, s.modeTotal, s.activeText]}>{formatMoney(total)}</Text>
                )}
              </View>
            </Pressable>
          ))}
        </View>
        {dates.length > 0 ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={s.dates}
            accessibilityLabel={
              mode === 'income' ? 'Scheduled income dates' : 'Upcoming outgoing payment dates'
            }
          >
            {[null, ...dates].map((day) => {
              const key = day?.date ?? ALL;
              const active = day ? selected?.date === key : !selected;
              const tone = day ? toneOf(day) : null;
              return (
                <Pressable
                  key={key}
                  testID={`${mode}-day-${key}`}
                  accessibilityRole="button"
                  accessibilityLabel={
                    day
                      ? `${weekdayDayMonthMaybeYear(day.date, reference)}, scheduled ${mode === 'income' ? 'income' : 'outgoing'} ${formatMoney(amount(day))}${
                          tone === 'urgent'
                            ? ', has payments due now or late'
                            : tone === 'soon'
                              ? ', has payments due soon'
                              : ''
                        }`
                      : 'All dates'
                  }
                  accessibilityState={{ selected: active }}
                  onPress={() => update({ ...current, dates: { ...current.dates, [mode]: key } })}
                  style={s.pillHit}
                >
                  {({ pressed }) => (
                    <View style={[s.pill, active && s.pillOn, pressed && !active && s.pillPressed]}>
                      <Text style={[s.pillText, active && s.activeText]}>
                        {day ? (day.date === today ? 'Today' : dayMonth(day.date)) : 'All'}
                      </Text>
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
        ) : null}
      </View>
      {dates.length > 0 ? (
        <>
          {renderDays ? (
            renderDays(shownDays, mode)
          ) : (
            <View style={s.summary} accessibilityLiveRegion="polite">
              {shownDays.map((day) => (
                <View key={day.date} style={s.summaryDay}>
                  <Text style={s.dateLabel}>
                    {weekdayDayMonthMaybeYear(day.date, reference)} · {formatMoney(amount(day))}{' '}
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
const s = themedStyles(() =>
  StyleSheet.create({
    root: { gap: 8 },
    // No box around the controls: the total, the two switches and the dates sit on the page, like Plan's own tabs.
    filters: { gap: 4 },
    modeRow: { marginHorizontal: 16, flexDirection: 'row', gap: 6 },
    mode: {
      flex: 1,
      minWidth: 0,
      minHeight: 36,
      paddingHorizontal: 4,
      justifyContent: 'center',
      alignItems: 'center',
      borderRadius: theme.radius.pill,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.colors.home.edge,
      backgroundColor: theme.colors.home.surface,
    },
    modeOn: { backgroundColor: theme.colors.action, borderColor: theme.colors.ink },
    pillOn: { backgroundColor: theme.colors.action, borderColor: theme.colors.ink },
    modeInner: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
    modeTotal: { fontFamily: theme.font.bodyBold, fontVariant: ['tabular-nums'] },
    modeLabel: {
      fontFamily: theme.font.bodyMedium,
      fontSize: 13,
      color: theme.colors.home.secondaryText,
      textAlign: 'center',
    },
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
      borderColor: theme.colors.home.edge,
      backgroundColor: theme.colors.home.surface,
    },
    pillPressed: { backgroundColor: theme.colors.home.pressed },
    // The same weight picked or not, so picking a date never changes the width of the pills beside it.
    pillText: { fontFamily: theme.font.bodyMedium, fontSize: 13, color: theme.colors.textPrimary },
    dot: { width: 7, height: 7, borderRadius: 4 },
    activeText: { color: theme.colors.onInk },
    dateLabel: { fontFamily: theme.font.bodyMedium, fontSize: 13, color: theme.colors.textPrimary },
    summary: {
      marginHorizontal: 16,
      padding: 12,
      gap: 8,
      borderRadius: 16,
      backgroundColor: theme.colors.home.surface,
    },
    summaryDay: { gap: 4 },
    caption: { fontFamily: theme.font.body, fontSize: 12, color: theme.colors.textSecondary },
  })
);

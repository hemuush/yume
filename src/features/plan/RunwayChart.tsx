import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { Text } from '@/components/Text';
import { theme } from '@/constants/theme';
import { dayMonth, weekdayDayMonth } from '@/lib/dateLabels';
import { formatMoney } from '@/lib/money';
import { withPressed } from '@/lib/pressed';
import { homeInk } from '@/features/home/homeInk';
import { useAccent } from '@/theme/AccentContext';
import type { Runway } from './runway';

const HEIGHT = 112;
const PAGE = 7;

/** Daily closing balances share one linear, zero-based scale across every page. */
export function RunwayChart({ runway }: { runway: Runway }) {
  const { accent } = useAccent();
  const ink = homeInk(accent);
  const [selectedDate, setSelectedDate] = useState(runway.days[0]?.date);
  const selectedIndex = Math.max(
    0,
    runway.days.findIndex((day) => day.date === selectedDate)
  );
  const selected = runway.days[selectedIndex];
  if (!selected) return null;
  const pageStart = Math.floor(selectedIndex / PAGE) * PAGE;
  const visible = runway.days.slice(pageStart, pageStart + PAGE);
  const values = [runway.startMinor, ...runway.days.map((day) => day.afterMinor)];
  const max = Math.max(0, ...values);
  const min = Math.min(0, ...values);
  const span = max - min || 1;
  const zero = (max / span) * HEIGHT;
  const negative = selected.afterMinor < 0;

  return (
    <View style={s.root} testID="runway">
      <Text style={s.title}>Scheduled balance</Text>
      <View style={s.navigation}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Previous seven days"
          disabled={pageStart === 0}
          accessibilityState={{ disabled: pageStart === 0 }}
          onPress={() => setSelectedDate(runway.days[Math.max(0, pageStart - PAGE)].date)}
          style={withPressed([s.arrow, pageStart === 0 && s.disabled])}
        >
          <Feather name="chevron-left" size={19} color={ink} />
        </Pressable>
        <Text style={s.range}>
          {dayMonth(visible[0].date)} – {dayMonth(visible[visible.length - 1].date)}
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Next seven days"
          disabled={pageStart + PAGE >= runway.days.length}
          accessibilityState={{ disabled: pageStart + PAGE >= runway.days.length }}
          onPress={() =>
            setSelectedDate(runway.days[Math.min(runway.days.length - 1, pageStart + PAGE)].date)
          }
          style={withPressed([s.arrow, pageStart + PAGE >= runway.days.length && s.disabled])}
        >
          <Feather name="chevron-right" size={19} color={ink} />
        </Pressable>
      </View>
      <Text style={s.hint}>Tap a day · bars show closing balance</Text>
      <View style={s.plot}>
        <View pointerEvents="none" style={[s.baseline, { top: zero }]} />
        {Array.from({ length: PAGE }, (_, index) => {
          const day = visible[index];
          if (!day) return <View key={index} style={s.column} />;
          const active = day.date === selected.date;
          const top = ((max - day.afterMinor) / span) * HEIGHT;
          return (
            <Pressable
              key={day.date}
              accessibilityRole="button"
              accessibilityLabel={`${weekdayDayMonth(day.date)}, closing balance ${formatMoney(day.afterMinor)}, coming in ${formatMoney(day.inMinor)}, going out ${formatMoney(day.outMinor)}`}
              accessibilityState={{ selected: active }}
              onPress={() => setSelectedDate(day.date)}
              style={withPressed(s.column)}
            >
              <View style={s.barTrack}>
                <View
                  testID={`balance-bar-${day.date}`}
                  style={[
                    s.bar,
                    {
                      top: Math.min(zero, top),
                      height: (Math.abs(day.afterMinor) / span) * HEIGHT,
                      backgroundColor:
                        day.afterMinor < 0 ? theme.colors.expense : active ? ink : theme.colors.primary,
                      opacity: active ? 1 : 0.65,
                    },
                  ]}
                />
                {day.afterMinor === 0 && (
                  <View style={[s.zeroDot, { top: zero - 2, backgroundColor: ink }]} />
                )}
              </View>
              <Text style={[s.day, active && { color: ink, fontFamily: theme.font.bodyMedium }]}>
                {Number(day.date.slice(-2))}
              </Text>
              <View style={[s.dot, { backgroundColor: active ? ink : 'transparent' }]} />
            </Pressable>
          );
        })}
      </View>
      <Text style={s.hint}>Zero baseline · same scale across all days</Text>
      <View
        style={[s.detail, negative && { backgroundColor: theme.colors.expenseTint }]}
        accessibilityLiveRegion="polite"
      >
        <Text style={s.hint}>
          {weekdayDayMonth(selected.date)} · {negative ? 'Shortfall' : 'Closing balance'}
        </Text>
        <Text style={[s.value, negative && { color: theme.colors.expenseText }]}>
          {formatMoney(selected.afterMinor)}
        </Text>
        <View style={s.facts}>
          <Text style={s.hint}>In {formatMoney(selected.inMinor)}</Text>
          <Text style={s.hint}>Out {formatMoney(selected.outMinor)}</Text>
        </View>
        <Text style={s.hint}>
          {selected.items.length
            ? selected.items.map((item) => item.title).join(' · ')
            : 'No scheduled movements'}
        </Text>
      </View>
      <Text style={s.hint}>Scheduled only · ends at {formatMoney(runway.endMinor)}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  root: {
    marginTop: 4,
    paddingTop: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: theme.colors.borderSoft,
    gap: 8,
  },
  title: { fontFamily: theme.font.bodyMedium, fontSize: 14, color: theme.colors.textPrimary },
  navigation: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  range: {
    fontFamily: theme.font.body,
    flex: 1,
    textAlign: 'center',
    fontSize: 12,
    color: theme.colors.textPrimary,
  },
  arrow: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 22,
    backgroundColor: theme.colors.surfaceAlt,
  },
  disabled: { opacity: 0.3 },
  hint: { fontFamily: theme.font.body, fontSize: 12, color: theme.colors.textSecondary },
  plot: { flexDirection: 'row', position: 'relative', paddingTop: 0 },
  baseline: { position: 'absolute', left: 0, right: 0, height: 1, backgroundColor: theme.colors.borderSoft },
  column: { flex: 1, minWidth: 0, alignItems: 'center', gap: 4, paddingBottom: 4 },
  barTrack: { height: HEIGHT, width: '100%', alignItems: 'center' },
  bar: { position: 'absolute', width: '62%', maxWidth: 28, borderRadius: 7 },
  zeroDot: { position: 'absolute', width: 4, height: 4, borderRadius: 2 },
  day: { fontFamily: theme.font.body, marginTop: 5, fontSize: 11, color: theme.colors.textSecondary },
  dot: { width: 4, height: 4, borderRadius: 2 },
  detail: { borderRadius: 16, padding: 12, gap: 5, backgroundColor: theme.colors.primaryTint },
  value: {
    fontSize: 24,
    fontFamily: theme.font.bodyMedium,
    color: theme.colors.textPrimary,
    fontVariant: ['tabular-nums'],
  },
  facts: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
});

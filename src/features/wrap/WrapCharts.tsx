import { useEffect, useState } from 'react';
import { View, Animated, Easing, Pressable } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { Text } from '@/components/Text';
import { Amount } from '@/components/Amount';
import { Glass } from '@/components/Glass';
import { theme } from '@/constants/theme';
import { formatMoney } from '@/lib/money';
import { dayMonth, longWeekday, weekdayDayMonth } from '@/lib/dateLabels';
import { withPressed } from '@/lib/pressed';
import { parseLocalIsoDate } from '@/lib/date';
import { useAccent } from '@/theme/AccentContext';
import { WrapBeat, WrapDay } from './wrapData';
import { Rise, Kicker } from './WrapBeatPrimitives';
import { styles } from './wrap.styles';
const EASE = Easing.out(Easing.cubic);
type BeatOf<K extends WrapBeat['kind']> = Extract<WrapBeat, { kind: K }>;

function Bar({ pct, color, index, still }: { pct: number; color: string; index: number; still: boolean }) {
  const [v] = useState(() => new Animated.Value(still ? pct : 0));
  useEffect(() => {
    if (still) {
      v.setValue(pct);
      return;
    }
    const a = Animated.timing(v, {
      toValue: pct,
      duration: 700,
      delay: 150 + index * 160,
      easing: EASE,
      useNativeDriver: false,
    });
    a.start();
    return () => a.stop();
  }, [v, pct, index, still]);
  const width = v.interpolate({ inputRange: [0, 100], outputRange: ['0%', '100%'], extrapolate: 'clamp' });
  return (
    <View style={styles.barTrack}>
      <Animated.View style={[styles.barFill, { width, backgroundColor: color }]} />
    </View>
  );
}

export function BarsBeat({
  beat,
  still,
  totalMinor,
  onInteract,
}: {
  beat: BeatOf<'bars'>;
  still: boolean;
  totalMinor?: number;
  onInteract?: () => void;
}) {
  const [selectedId, setSelectedId] = useState(beat.items[0]?.categoryId);
  const selected = beat.items.find((item) => item.categoryId === selectedId) ?? beat.items[0];
  const max = Math.max(1, ...beat.items.map((c) => c.totalMinor));
  const lead = beat.items[0];
  return (
    <View style={styles.beat}>
      <Kicker kind="bars">Where it went</Kicker>
      <Rise still={still}>
        <Text style={[styles.display, styles.gapM]}>
          {beat.items.length === 1 ? `All of it went to ${lead.name}.` : `${lead.name} took the most.`}
        </Text>
      </Rise>
      <View style={styles.middle}>
        <Glass radius={24} tone="strong" style={styles.chartCard}>
          <View style={[styles.bars, styles.chartBody]}>
            {beat.items.map((c, i) => (
              <Rise key={c.categoryId} delay={i * 160} still={still}>
                <Pressable
                  onPress={() => {
                    setSelectedId(c.categoryId);
                    onInteract?.();
                  }}
                  style={withPressed([
                    styles.categoryChoice,
                    selectedId === c.categoryId && styles.choiceSelected,
                  ])}
                  accessibilityRole="button"
                  accessibilityLabel={`Explore ${c.name}`}
                  accessibilityState={{ selected: selectedId === c.categoryId }}
                >
                  <View style={styles.barHead}>
                    <Text style={styles.barName}>{c.name}</Text>
                    <Amount minor={c.totalMinor} sensitive={c.isSensitive} style={styles.barAmount} />
                  </View>
                  <Bar
                    pct={Math.max(2, (c.totalMinor / max) * 100)}
                    color={c.color}
                    index={i}
                    still={still}
                  />
                </Pressable>
              </Rise>
            ))}
          </View>
        </Glass>
        {selected && (
          <View style={[styles.insight, styles.gapM]}>
            <Text style={styles.insightLabel}>{selected.name}</Text>
            <Amount
              minor={selected.totalMinor}
              sensitive={selected.isSensitive}
              style={styles.insightAmount}
            />
            {!!totalMinor && (
              <Text style={styles.body}>
                {Math.round((selected.totalMinor / totalMinor) * 100)}% of recorded spending
              </Text>
            )}
          </View>
        )}
        <Text style={[styles.hint, styles.gapS]}>Tap a category to explore its share.</Text>
      </View>
    </View>
  );
}

/** How dark a day is on the calendar: four steps of gold, by its share of the heaviest day. */
function dayLevel(totalMinor: number, max: number): number {
  if (totalMinor <= 0 || max <= 0) return 0;
  const share = totalMinor / max;
  return share > 0.66 ? 1 : share > 0.33 ? 0.7 : share > 0.12 ? 0.45 : 0.25;
}

function DayCell({
  day,
  level,
  index,
  ring,
  still,
  selected,
  label,
  onPress,
}: {
  day: number;
  level: number;
  index: number;
  ring: boolean;
  still: boolean;
  selected: boolean;
  label: string;
  onPress: () => void;
}) {
  const [fill] = useState(() => new Animated.Value(still ? level : 0));
  const [ringV] = useState(() => new Animated.Value(still && ring ? 1 : 0));
  useEffect(() => {
    if (still) {
      fill.setValue(level);
      ringV.setValue(ring ? 1 : 0);
      return;
    }
    const a = Animated.parallel([
      Animated.timing(fill, { toValue: level, duration: 180, delay: 80 + index * 45, useNativeDriver: true }),
      ...(ring
        ? [
            Animated.timing(ringV, {
              toValue: 1,
              duration: 240,
              delay: 1500,
              easing: EASE,
              useNativeDriver: true,
            }),
          ]
        : []),
    ]);
    a.start();
    return () => a.stop();
  }, [fill, ringV, level, index, ring, still]);
  return (
    <View style={styles.calSlot}>
      <Pressable
        style={withPressed([styles.calCell, selected && styles.daySelected])}
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityState={{ selected }}
      >
        <Animated.View style={[styles.calFill, { opacity: fill }]} />
        {ring && <Animated.View style={[styles.calRing, { opacity: ringV }]} />}
        <Text style={styles.calDay}>{day}</Text>
      </Pressable>
    </View>
  );
}

function quietLine(quietDays: number, span: 'month' | 'week'): string {
  if (quietDays === 0) return `Spending was recorded every day of the ${span}.`;
  return `${quietDays} ${quietDays === 1 ? 'day' : 'days'} with no recorded spending.`;
}

function DayDetail({ day, onOpenDay }: { day: WrapDay; onOpenDay?: (date: string) => void }) {
  return (
    <View style={[styles.insight, styles.gapM]}>
      <View style={styles.insightHead}>
        <Text style={styles.insightLabel}>{weekdayDayMonth(day.date)}</Text>
        <Feather
          name={day.totalMinor > 0 ? 'credit-card' : 'moon'}
          size={18}
          color={theme.colors.textSecondary}
        />
      </View>
      <Amount minor={day.totalMinor} style={styles.insightAmount} />
      <Text style={styles.body}>{day.totalMinor > 0 ? 'Recorded spending' : 'No spending recorded'}</Text>
      {onOpenDay && (
        <Pressable
          onPress={() => onOpenDay(day.date)}
          style={withPressed(styles.detailLink)}
          accessibilityRole="button"
          accessibilityLabel={`Open report for ${dayMonth(day.date)}`}
        >
          <Text style={styles.detailLinkText}>Explore this day</Text>
          <Feather name="arrow-right" size={16} color={theme.colors.link} />
        </Pressable>
      )}
    </View>
  );
}

export function DaysBeat({
  beat,
  still,
  onInteract,
  onOpenDay,
}: {
  beat: BeatOf<'days'>;
  still: boolean;
  onInteract?: () => void;
  onOpenDay?: (date: string) => void;
}) {
  const [selectedDate, setSelectedDate] = useState(beat.heaviest.date);
  const selected = beat.days.find((day) => day.date === selectedDate) ?? beat.heaviest;
  const max = beat.heaviest.totalMinor;
  return (
    <View style={styles.beat}>
      <Kicker kind="days">How the days went</Kicker>
      <View style={styles.middle}>
        <Glass radius={24} tone="strong" style={styles.chartCard}>
          <View style={styles.chartBody}>
            <View style={styles.cal}>
              {WEEK_LETTERS.map((letter, i) => (
                <View key={`heading-${i}`} style={styles.calSlot}>
                  <Text style={styles.calendarHeading}>{letter}</Text>
                </View>
              ))}
              {Array.from({ length: beat.firstWeekday }, (_, i) => (
                <View key={`pad-${i}`} style={styles.calSlot} />
              ))}
              {beat.days.map((d, i) => (
                <DayCell
                  key={d.date}
                  day={parseLocalIsoDate(d.date).getDate()}
                  level={dayLevel(d.totalMinor, max)}
                  index={i}
                  ring={d.date === beat.heaviest.date}
                  selected={d.date === selectedDate}
                  label={`Select ${dayMonth(d.date)}`}
                  onPress={() => {
                    setSelectedDate(d.date);
                    onInteract?.();
                  }}
                  still={still}
                />
              ))}
            </View>
          </View>
        </Glass>
        <Text style={[styles.hint, styles.gapS]}>Tap any day. The outlined day had the most spending.</Text>
        <DayDetail day={selected} onOpenDay={onOpenDay} />
        <Rise delay={1500} still={still}>
          <Text style={[styles.displaySmall, styles.gapM]}>
            {dayMonth(beat.heaviest.date)} was the heaviest day.
          </Text>
        </Rise>
        <Rise delay={1700} still={still}>
          <Text style={[styles.body, styles.gapS]}>
            <Text style={styles.bodyStrong}>{formatMoney(beat.heaviest.totalMinor)}</Text> went out.{' '}
            {quietLine(beat.quietDays, 'month')}
          </Text>
        </Rise>
      </View>
    </View>
  );
}

/** Sunday first, as Yume's weeks start. */
const WEEK_LETTERS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

function WeekBar({
  pct,
  color,
  index,
  still,
}: {
  pct: number;
  color: string;
  index: number;
  still: boolean;
}) {
  const [v] = useState(() => new Animated.Value(still ? pct : 0));
  useEffect(() => {
    if (still) {
      v.setValue(pct);
      return;
    }
    const a = Animated.timing(v, {
      toValue: pct,
      duration: 500,
      delay: index * 110,
      easing: EASE,
      useNativeDriver: false,
    });
    a.start();
    return () => a.stop();
  }, [v, pct, index, still]);
  const height = v.interpolate({ inputRange: [0, 100], outputRange: ['0%', '100%'], extrapolate: 'clamp' });
  return <Animated.View style={[styles.weekBar, { height, backgroundColor: color }]} />;
}

export function WeekDaysBeat({
  beat,
  still,
  onInteract,
  onOpenDay,
}: {
  beat: BeatOf<'weekDays'>;
  still: boolean;
  onInteract?: () => void;
  onOpenDay?: (date: string) => void;
}) {
  const [selectedDate, setSelectedDate] = useState(beat.heaviest.date);
  const selected = beat.days.find((day) => day.date === selectedDate) ?? beat.heaviest;
  const { accent } = useAccent();
  const max = Math.max(1, beat.heaviest.totalMinor);
  return (
    <View style={styles.beat}>
      <Kicker kind="weekDays">Day by day</Kicker>
      <View style={styles.middle}>
        <Glass radius={24} tone="strong" style={styles.chartCard}>
          <View style={styles.chartBody}>
            <View style={styles.week}>
              {beat.days.map((d, i) => {
                const heaviest = d.date === beat.heaviest.date;
                return (
                  <Pressable
                    key={d.date}
                    style={withPressed([styles.weekCol, selectedDate === d.date && styles.weekSelected])}
                    onPress={() => {
                      setSelectedDate(d.date);
                      onInteract?.();
                    }}
                    accessibilityRole="button"
                    accessibilityLabel={`Select ${dayMonth(d.date)}`}
                    accessibilityState={{ selected: selectedDate === d.date }}
                  >
                    <View style={{ flex: 1, width: '100%', justifyContent: 'flex-end' }}>
                      <WeekBar
                        pct={d.totalMinor > 0 ? Math.max(4, (d.totalMinor / max) * 100) : 3}
                        color={
                          heaviest ? theme.colors.ink : d.totalMinor > 0 ? accent : theme.colors.inkHairline
                        }
                        index={i}
                        still={still}
                      />
                    </View>
                    <Text style={styles.weekDay}>{WEEK_LETTERS[i]}</Text>
                    <Text style={styles.weekDate}>{parseLocalIsoDate(d.date).getDate()}</Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        </Glass>
        <Text style={[styles.hint, styles.gapS]}>Tap a day to see what went out.</Text>
        <DayDetail day={selected} onOpenDay={onOpenDay} />
        <Rise delay={900} still={still}>
          <Text style={[styles.displaySmall, styles.gapM]}>
            {longWeekday(beat.heaviest.date)} did the most.
          </Text>
        </Rise>
        <Rise delay={1050} still={still}>
          <Text style={[styles.body, styles.gapS]}>
            <Text style={styles.bodyStrong}>{formatMoney(beat.heaviest.totalMinor)}</Text> went out.{' '}
            {quietLine(beat.quietDays, 'week')}
          </Text>
        </Rise>
      </View>
    </View>
  );
}

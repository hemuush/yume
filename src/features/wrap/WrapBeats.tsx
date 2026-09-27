import { useEffect, useState } from 'react';
import { View, Animated, Easing, StyleProp, ViewStyle, TextStyle } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import Feather from '@expo/vector-icons/Feather';
import { Text } from '@/components/Text';
import { Amount } from '@/components/Amount';
import { CountUpAmount } from '@/components/CountUpAmount';
import { PrimaryButton } from '@/components/PrimaryButton';
import { SuuIllustration } from '@/components/SuuIllustration';
import { theme } from '@/constants/theme';
import { formatMoney } from '@/lib/money';
import { dayMonth, longWeekday } from '@/lib/dateLabels';
import { WrapBeat } from './wrapData';
import { styles } from './wrap.styles';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);
const EASE = Easing.out(Easing.cubic);

type BeatOf<K extends WrapBeat['kind']> = Extract<WrapBeat, { kind: K }>;

/** Fades and lifts something in after `delay` ms, once, when the beat appears. Still when `still`. */
function Rise({
  delay = 0,
  still,
  style,
  children,
}: {
  delay?: number;
  still: boolean;
  style?: StyleProp<ViewStyle>;
  children: React.ReactNode;
}) {
  const [v] = useState(() => new Animated.Value(still ? 1 : 0));
  useEffect(() => {
    if (still) {
      v.setValue(1);
      return;
    }
    const a = Animated.timing(v, { toValue: 1, duration: 380, delay, easing: EASE, useNativeDriver: true });
    a.start();
    return () => a.stop();
  }, [v, delay, still]);
  const translateY = v.interpolate({ inputRange: [0, 1], outputRange: [14, 0] });
  return (
    <Animated.View style={[style, { opacity: v, transform: [{ translateY }] }]}>{children}</Animated.View>
  );
}

/** A 0→`to` number that counts up once, for percentages. */
function CountUpPct({ to, still, style }: { to: number; still: boolean; style: StyleProp<TextStyle> }) {
  const [shown, setShown] = useState(still ? to : 0);
  useEffect(() => {
    if (still) {
      setShown(to);
      return;
    }
    const v = new Animated.Value(0);
    const id = v.addListener(({ value }) => setShown(value));
    const a = Animated.timing(v, { toValue: to, duration: 900, easing: EASE, useNativeDriver: false });
    a.start();
    return () => {
      a.stop();
      v.removeListener(id);
    };
  }, [to, still]);
  return <Text style={style}>{Math.round(shown)}%</Text>;
}

/** One letter of the hook's title, snapping up into place after the ones before it. */
function Letter({ ch, index, still }: { ch: string; index: number; still: boolean }) {
  const [v] = useState(() => new Animated.Value(still ? 1 : 0));
  useEffect(() => {
    if (still) {
      v.setValue(1);
      return;
    }
    const a = Animated.timing(v, {
      toValue: 1,
      duration: 320,
      delay: index * 45,
      easing: EASE,
      useNativeDriver: true,
    });
    a.start();
    return () => a.stop();
  }, [v, index, still]);
  const translateY = v.interpolate({ inputRange: [0, 1], outputRange: [22, 0] });
  const rotate = v.interpolate({ inputRange: [0, 1], outputRange: ['8deg', '0deg'] });
  return (
    <Animated.View style={{ opacity: v, transform: [{ translateY }, { rotate }] }}>
      <Text style={styles.title}>{ch === ' ' ? ' ' : ch}</Text>
    </Animated.View>
  );
}

export function HookBeat({ beat, still }: { beat: BeatOf<'hook'>; still: boolean }) {
  return (
    <View style={styles.beat}>
      <Rise still={still}>
        <Text style={styles.kicker}>{beat.kicker}</Text>
      </Rise>
      <View style={styles.middle}>
        <View style={styles.lettersRow} accessible accessibilityLabel={beat.title}>
          {[...beat.title].map((ch, i) => (
            <Letter key={i} ch={ch} index={i} still={still} />
          ))}
        </View>
        <CountUpAmount
          minor={beat.spentMinor}
          style={[styles.huge, styles.gapM]}
          numberOfLines={1}
          adjustsFontSizeToFit
        />
        <Rise delay={700} still={still}>
          <Text style={[styles.body, styles.gapS]}>went out.</Text>
        </Rise>
      </View>
    </View>
  );
}

const RING = 150;
const RING_STROKE = 18;

export function KeptBeat({ beat, still }: { beat: BeatOf<'kept'>; still: boolean }) {
  const kept = beat.keptMinor > 0;
  const r = RING / 2 - RING_STROKE / 2;
  const c = 2 * Math.PI * r;
  const target = kept ? Math.min(100, beat.keptPct) : 0;
  const [v] = useState(() => new Animated.Value(still ? target : 0));
  useEffect(() => {
    if (still) {
      v.setValue(target);
      return;
    }
    const a = Animated.timing(v, { toValue: target, duration: 1100, easing: EASE, useNativeDriver: false });
    a.start();
    return () => a.stop();
  }, [v, target, still]);
  const offset = v.interpolate({ inputRange: [0, 100], outputRange: [c, 0], extrapolate: 'clamp' });

  return (
    <View style={styles.beat}>
      <Text style={styles.kicker}>What you kept</Text>
      <View style={styles.middle}>
        {kept ? (
          <>
            <View style={styles.ringWrap}>
              <Svg width={RING} height={RING} viewBox={`0 0 ${RING} ${RING}`}>
                <Circle
                  cx={RING / 2}
                  cy={RING / 2}
                  r={r}
                  fill="none"
                  stroke={theme.colors.inkWash}
                  strokeWidth={RING_STROKE}
                />
                <AnimatedCircle
                  cx={RING / 2}
                  cy={RING / 2}
                  r={r}
                  fill="none"
                  stroke={theme.colors.income}
                  strokeWidth={RING_STROKE}
                  strokeDasharray={c}
                  strokeDashoffset={offset}
                  strokeLinecap="round"
                  transform={`rotate(-90 ${RING / 2} ${RING / 2})`}
                />
              </Svg>
            </View>
            <View style={{ flexDirection: 'row', justifyContent: 'center', alignItems: 'baseline', gap: 8 }}>
              <Text style={styles.display}>You kept</Text>
              <CountUpPct
                to={Math.round(beat.keptPct)}
                still={still}
                style={[styles.huge, { fontSize: 32, lineHeight: 38 }]}
              />
            </View>
            <Rise delay={600} still={still}>
              <Text style={[styles.body, styles.center, styles.gapS]}>
                <Text style={styles.bodyStrong}>{formatMoney(beat.keptMinor)}</Text> of{' '}
                <Text style={styles.bodyStrong}>{formatMoney(beat.incomeMinor)}</Text> that came in.
              </Text>
            </Rise>
          </>
        ) : beat.keptMinor === 0 ? (
          <>
            <Rise still={still}>
              <Text style={styles.display}>Everything that came in went out.</Text>
            </Rise>
            <Rise delay={300} still={still}>
              <Text style={[styles.body, styles.gapM]}>
                <Text style={styles.bodyStrong}>{formatMoney(beat.incomeMinor)}</Text> in, the same out.
              </Text>
            </Rise>
          </>
        ) : (
          <>
            <Rise still={still}>
              <Text style={styles.display}>More went out than came in.</Text>
            </Rise>
            <Rise delay={300} still={still}>
              <Text style={[styles.body, styles.gapM]}>
                <Text style={styles.bodyStrong}>{formatMoney(-beat.keptMinor)}</Text> more than the{' '}
                <Text style={styles.bodyStrong}>{formatMoney(beat.incomeMinor)}</Text> that came in.
              </Text>
            </Rise>
          </>
        )}
      </View>
    </View>
  );
}

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

export function BarsBeat({ beat, still }: { beat: BeatOf<'bars'>; still: boolean }) {
  const max = Math.max(1, ...beat.items.map((c) => c.totalMinor));
  const lead = beat.items[0];
  return (
    <View style={styles.beat}>
      <Text style={styles.kicker}>Where it went</Text>
      <Rise still={still}>
        <Text style={[styles.display, styles.gapM]}>
          {beat.items.length === 1 ? `All of it went to ${lead.name}.` : `${lead.name} took the most.`}
        </Text>
      </Rise>
      <View style={styles.middle}>
        <View style={styles.bars}>
          {beat.items.map((c, i) => (
            <Rise key={c.categoryId} delay={i * 160} still={still}>
              <View style={styles.barHead}>
                <Text style={styles.barName} numberOfLines={1}>
                  {c.name}
                </Text>
                <Amount minor={c.totalMinor} sensitive={c.isSensitive} style={styles.barAmount} />
              </View>
              <Bar pct={Math.max(2, (c.totalMinor / max) * 100)} color={c.color} index={i} still={still} />
            </Rise>
          ))}
        </View>
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
}: {
  day: number;
  level: number;
  index: number;
  ring: boolean;
  still: boolean;
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
      <View style={styles.calCell}>
        <Animated.View style={[styles.calFill, { opacity: fill }]} />
        {ring && <Animated.View style={[styles.calRing, { opacity: ringV }]} />}
        <Text style={styles.calDay}>{day}</Text>
      </View>
    </View>
  );
}

function quietLine(quietDays: number, span: 'month' | 'week'): string {
  if (quietDays === 0) return `Something went out every day of the ${span}.`;
  if (quietDays === 1) return 'And 1 day nothing went out at all.';
  return `And ${quietDays} days nothing went out at all.`;
}

export function DaysBeat({ beat, still }: { beat: BeatOf<'days'>; still: boolean }) {
  const max = beat.heaviest.totalMinor;
  return (
    <View style={styles.beat}>
      <Text style={styles.kicker}>How the days went</Text>
      <View style={styles.middle}>
        <View style={styles.cal} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          {Array.from({ length: beat.firstWeekday }, (_, i) => (
            <View key={`pad-${i}`} style={styles.calSlot} />
          ))}
          {beat.days.map((d, i) => (
            <DayCell
              key={d.date}
              day={i + 1}
              level={dayLevel(d.totalMinor, max)}
              index={i}
              ring={d.date === beat.heaviest.date}
              still={still}
            />
          ))}
        </View>
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

export function MoverBeat({ beat, still }: { beat: BeatOf<'mover'>; still: boolean }) {
  const [punch] = useState(() => new Animated.Value(still ? 1 : 0));
  useEffect(() => {
    if (still) {
      punch.setValue(1);
      return;
    }
    const a = Animated.timing(punch, { toValue: 1, duration: 360, easing: EASE, useNativeDriver: true });
    a.start();
    return () => a.stop();
  }, [punch, still]);
  const scale = punch.interpolate({ inputRange: [0, 1], outputRange: [1.35, 1] });
  return (
    <View style={styles.beat}>
      <Text style={styles.kicker}>What moved</Text>
      <View style={styles.middle}>
        <Animated.View style={{ opacity: punch, transform: [{ scale }] }}>
          <Text style={styles.display} numberOfLines={2}>
            {beat.category.name}
          </Text>
        </Animated.View>
        <View style={styles.moverRow}>
          <Rise delay={200} still={still}>
            <Feather name="arrow-up" size={40} color={theme.colors.expense} />
          </Rise>
          <CountUpPct
            to={Math.round(beat.pctChange)}
            still={still}
            style={[styles.huge, { color: theme.colors.expense }]}
          />
        </View>
        <Rise delay={500} still={still}>
          <Text style={[styles.body, styles.gapS]}>
            more than {beat.comparedTo}.{' '}
            <Amount
              minor={beat.category.totalMinor}
              sensitive={beat.category.isSensitive}
              style={styles.bodyStrong}
            />{' '}
            this month.
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

export function WeekDaysBeat({ beat, still }: { beat: BeatOf<'weekDays'>; still: boolean }) {
  const max = Math.max(1, beat.heaviest.totalMinor);
  return (
    <View style={styles.beat}>
      <Text style={styles.kicker}>Day by day</Text>
      <View style={styles.middle}>
        <View style={styles.week} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          {beat.days.map((d, i) => {
            const heaviest = d.date === beat.heaviest.date;
            return (
              <View key={d.date} style={styles.weekCol}>
                <View style={{ flex: 1, width: '100%', justifyContent: 'flex-end' }}>
                  <WeekBar
                    pct={d.totalMinor > 0 ? Math.max(4, (d.totalMinor / max) * 100) : 3}
                    color={
                      heaviest
                        ? theme.colors.ink
                        : d.totalMinor > 0
                          ? theme.colors.primary
                          : theme.colors.inkHairline
                    }
                    index={i}
                    still={still}
                  />
                </View>
                <Text style={styles.weekDay}>{WEEK_LETTERS[i]}</Text>
              </View>
            );
          })}
        </View>
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

export function UsualBeat({ beat, still }: { beat: BeatOf<'usual'>; still: boolean }) {
  const less = beat.changePct < 0;
  const steady = Math.abs(beat.changePct) < 5;
  return (
    <View style={styles.beat}>
      <Text style={styles.kicker}>Against your usual</Text>
      <View style={styles.middle}>
        {steady ? (
          <Rise still={still}>
            <Text style={styles.display}>About the same as a usual week.</Text>
          </Rise>
        ) : (
          <>
            <CountUpPct
              to={Math.round(Math.abs(beat.changePct))}
              still={still}
              style={[styles.huge, { color: less ? theme.colors.income : theme.colors.expense }]}
            />
            <Rise delay={200} still={still}>
              <Text style={styles.displaySmall}>{less ? 'less' : 'more'} than a usual week.</Text>
            </Rise>
          </>
        )}
        {beat.top && (
          <Rise delay={500} still={still}>
            <Text style={[styles.body, styles.gapM]}>
              {beat.top.name} led, at{' '}
              <Amount
                minor={beat.top.totalMinor}
                sensitive={beat.top.isSensitive}
                style={styles.bodyStrong}
              />
              .
            </Text>
          </Rise>
        )}
      </View>
    </View>
  );
}

export function FinalBeat({
  beat,
  still,
  onOpenReport,
  onDone,
}: {
  beat: BeatOf<'final'>;
  still: boolean;
  onOpenReport: () => void;
  onDone: () => void;
}) {
  const [v] = useState(() => new Animated.Value(still ? 1 : 0));
  useEffect(() => {
    if (still) {
      v.setValue(1);
      return;
    }
    const a = Animated.sequence([
      Animated.timing(v, { toValue: 1.06, duration: 420, easing: EASE, useNativeDriver: true }),
      Animated.timing(v, { toValue: 1, duration: 200, easing: EASE, useNativeDriver: true }),
    ]);
    a.start();
    return () => a.stop();
  }, [v, still]);
  const opacity = v.interpolate({ inputRange: [0, 1, 1.06], outputRange: [0, 1, 1] });
  const scale = v.interpolate({ inputRange: [0, 1, 1.06], outputRange: [0.6, 1, 1.06] });
  return (
    <View style={styles.beat}>
      <View style={styles.finalMiddle}>
        <Animated.View style={{ opacity, transform: [{ scale }] }}>
          <SuuIllustration size={96} />
        </Animated.View>
        <Rise delay={250} still={still}>
          <Text style={[styles.display, styles.center, styles.gapM]}>{beat.title}</Text>
        </Rise>
        <Rise delay={400} still={still}>
          <Text style={[styles.tagline, styles.center]}>Better money. Bigger dreams.</Text>
        </Rise>
      </View>
      <Rise delay={600} still={still} style={styles.actions}>
        <PrimaryButton title="See the full report" onPress={onOpenReport} />
        <PrimaryButton title="Done" variant="secondary" onPress={onDone} />
      </Rise>
    </View>
  );
}

/** Renders whichever beat `beat` is. */
export function Beat({
  beat,
  still,
  onOpenReport,
  onDone,
}: {
  beat: WrapBeat;
  still: boolean;
  onOpenReport: () => void;
  onDone: () => void;
}) {
  switch (beat.kind) {
    case 'hook':
      return <HookBeat beat={beat} still={still} />;
    case 'kept':
      return <KeptBeat beat={beat} still={still} />;
    case 'bars':
      return <BarsBeat beat={beat} still={still} />;
    case 'days':
      return <DaysBeat beat={beat} still={still} />;
    case 'mover':
      return <MoverBeat beat={beat} still={still} />;
    case 'weekDays':
      return <WeekDaysBeat beat={beat} still={still} />;
    case 'usual':
      return <UsualBeat beat={beat} still={still} />;
    case 'final':
      return <FinalBeat beat={beat} still={still} onOpenReport={onOpenReport} onDone={onDone} />;
  }
}

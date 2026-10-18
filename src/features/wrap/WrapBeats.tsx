import { useEffect, useRef, useState } from 'react';
import { View, Animated, Easing, StyleProp, TextStyle, Pressable } from 'react-native';
import { captureRef } from 'react-native-view-shot';
import * as Sharing from 'expo-sharing';
import { File } from 'expo-file-system';
import Svg, { Circle } from 'react-native-svg';
import Feather from '@expo/vector-icons/Feather';
import { Text } from '@/components/Text';
import { Amount } from '@/components/Amount';
import { CountUpAmount } from '@/components/CountUpAmount';
import { PrimaryButton } from '@/components/PrimaryButton';
import { showAlert } from '@/components/AppDialog';
import { theme } from '@/constants/theme';
import { formatMoney } from '@/lib/money';
import { withoutRelock } from '@/lib/appLock';
import { errorMessage } from '@/lib/errorMessage';
import { useAccent } from '@/theme/AccentContext';
import { Wrap, WrapBeat, USUAL_BAND_PCT } from './wrapData';
import { Glass } from '@/components/Glass';
import { HomeWallpaper } from '@/features/home/HomeWallpaper';
import { YumeLogo } from '@/components/YumeLogo';
import { styles } from './wrap.styles';
import { Rise, Kicker } from './WrapBeatPrimitives';
import { BarsBeat, DaysBeat, WeekDaysBeat } from './WrapCharts';
import { withPressed } from '@/lib/pressed';

export { BarsBeat, DaysBeat, WeekDaysBeat } from './WrapCharts';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);
const EASE = Easing.out(Easing.cubic);

type BeatOf<K extends WrapBeat['kind']> = Extract<WrapBeat, { kind: K }>;

/** A 0→`to` number that counts up once, for percentages. */
function CountUpPct({ to, still, style }: { to: number; still: boolean; style: StyleProp<TextStyle> }) {
  const [shown, setShown] = useState(still ? to : 0);
  useEffect(() => {
    if (still) {
      setShown(to);
      return;
    }
    const v = new Animated.Value(0);
    // Whole percents: frames that land on the same number bail out of the re-render.
    const id = v.addListener(({ value }) => setShown(Math.round(value)));
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

function HookBeat({ beat, still }: { beat: BeatOf<'hook'>; still: boolean }) {
  return (
    <View style={styles.beat}>
      <Rise still={still}>
        <Kicker kind="hook">{beat.kicker}</Kicker>
      </Rise>
      <View style={styles.middle}>
        <View style={styles.lettersRow} accessible accessibilityLabel={beat.title}>
          {[...beat.title].map((ch, i) => (
            <Letter key={i} ch={ch} index={i} still={still} />
          ))}
        </View>
        <CountUpAmount
          minor={beat.spentMinor}
          countFromZero={!still}
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

/** A ring that fills to `pct` (0–100) once, when the beat appears. */
function Ring({ pct, color, still }: { pct: number; color: string; still: boolean }) {
  const r = RING / 2 - RING_STROKE / 2;
  const c = 2 * Math.PI * r;
  const target = Math.min(100, Math.max(0, pct));
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
    <View style={styles.ringWrap}>
      <Svg width={RING} height={RING} viewBox={`0 0 ${RING} ${RING}`}>
        <Circle
          cx={RING / 2}
          cy={RING / 2}
          r={r}
          fill="none"
          stroke={theme.colors.surface}
          strokeWidth={RING_STROKE}
        />
        <AnimatedCircle
          cx={RING / 2}
          cy={RING / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={RING_STROKE}
          strokeDasharray={c}
          strokeDashoffset={offset}
          strokeLinecap="round"
          transform={`rotate(-90 ${RING / 2} ${RING / 2})`}
        />
      </Svg>
    </View>
  );
}

function KeptBeat({ beat, still }: { beat: BeatOf<'kept'>; still: boolean }) {
  const kept = beat.keptMinor > 0;
  return (
    <View style={styles.beat}>
      <Kicker kind="kept">What you kept</Kicker>
      <View style={styles.middle}>
        {kept ? (
          <>
            <Ring pct={beat.keptPct} color={theme.colors.income} still={still} />
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

function MoverBeat({ beat, still }: { beat: BeatOf<'mover'>; still: boolean }) {
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
      <Kicker kind="mover">What moved</Kicker>
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
            this period.
          </Text>
        </Rise>
      </View>
    </View>
  );
}

function UsualBeat({ beat, still }: { beat: BeatOf<'usual'>; still: boolean }) {
  const less = beat.changePct < 0;
  const steady = Math.abs(beat.changePct) < USUAL_BAND_PCT;
  return (
    <View style={styles.beat}>
      <Kicker kind="usual">Against your usual</Kicker>
      <View style={styles.middle}>
        {steady ? (
          <Rise still={still}>
            <Text style={styles.display}>About the same as a usual week.</Text>
          </Rise>
        ) : (
          <>
            <Ring
              pct={Math.abs(beat.changePct)}
              color={less ? theme.colors.income : theme.colors.ink}
              still={still}
            />
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

/** How the period compared, in a few words, for the closing card. */
function cardLine(wrap: Wrap): string | null {
  for (const b of wrap.beats) {
    if (b.kind === 'usual') {
      if (Math.abs(b.changePct) < USUAL_BAND_PCT) return 'About a usual week';
      return `${Math.round(Math.abs(b.changePct))}% ${b.changePct < 0 ? 'less' : 'more'} than usual`;
    }
    if (b.kind === 'kept') {
      return b.keptMinor > 0
        ? `Kept ${Math.round(b.keptPct)}% of what came in`
        : b.keptMinor === 0
          ? 'Everything that came in went out'
          : 'More went out than came in';
    }
  }
  return null;
}

/**
 * The closing beat: the period as a card (what went out, comparison, top three categories) with Share, which
 * sends the card as a picture via Android's share sheet (nothing leaves the phone unless you choose), and the report.
 */
function FinalBeat({
  wrap,
  beat,
  still,
  onOpenReport,
  onReplay,
}: {
  wrap: Wrap;
  beat: BeatOf<'final'>;
  still: boolean;
  onOpenReport: () => void;
  onReplay?: () => void;
}) {
  const card = useRef<View>(null);
  const { accent, secondary } = useAccent();
  const hook = wrap.beats.find((b): b is BeatOf<'hook'> => b.kind === 'hook');
  const top = wrap.beats.find((b): b is BeatOf<'bars'> => b.kind === 'bars')?.items.slice(0, 3) ?? [];
  const line = cardLine(wrap);
  // Capturing mid fade-in would send a half-transparent card, so Share waits until the card is fully visible.
  const [cardShown, setCardShown] = useState(still);
  const [sharing, setSharing] = useState(false);
  const shareInFlight = useRef(false);
  const share = async () => {
    if (!cardShown || shareInFlight.current) return;
    shareInFlight.current = true;
    setSharing(true);
    let uri: string | null = null;
    try {
      uri = await captureRef(card, { format: 'png', quality: 1 });
      await withoutRelock(() =>
        Sharing.shareAsync(uri!, { mimeType: 'image/png', dialogTitle: 'Share your Wrap' })
      );
    } catch (e) {
      showAlert("Couldn't share it", errorMessage(e));
    } finally {
      shareInFlight.current = false;
      setSharing(false);
      // The capture is a temp PNG in the cache; once the share sheet is done with it, don't leave it behind.
      if (uri) {
        try {
          new File(uri).delete();
        } catch {
          // Already gone, or the cache cleans it up later.
        }
      }
    }
  };
  return (
    <View style={styles.beat}>
      <Rise still={still}>
        <Kicker kind="final">Your wrap, in one card</Kicker>
        <Text style={[styles.displaySmall, styles.gapM]}>{beat.title}</Text>
      </Rise>
      <View style={styles.finalMiddle}>
        <Rise delay={200} still={still} onShown={() => setCardShown(true)}>
          {/* The shared image: the card on its own bit of wallpaper, so it's opaque and looks like the app. */}
          <View ref={card} collapsable={false} style={styles.card}>
            <HomeWallpaper accent={accent} secondary={secondary} />
            <Glass radius={24} tone="strong">
              <View style={styles.cardBody}>
                <View style={styles.cardHead}>
                  <View style={styles.cardBrand}>
                    <YumeLogo size={16} />
                    <Text style={styles.cardBrandText}>Yume</Text>
                  </View>
                  <Text style={styles.cardKicker}>{wrap.label}</Text>
                </View>
                <Amount
                  minor={hook?.spentMinor ?? 0}
                  style={styles.cardTotal}
                  numberOfLines={1}
                  adjustsFontSizeToFit
                />
                <Text style={styles.cardLine}>
                  {hook ? `went out${line ? ` · ${line}` : ''}` : 'No spending recorded'}
                </Text>
                {top.length > 0 && (
                  <View style={styles.cardRows}>
                    {top.map((c) => (
                      <View key={c.categoryId} style={styles.cardRow}>
                        <View style={[styles.cardDot, { backgroundColor: c.color }]} />
                        <Text style={styles.cardName}>{c.name}</Text>
                        <Amount minor={c.totalMinor} sensitive={c.isSensitive} style={styles.cardAmount} />
                      </View>
                    ))}
                  </View>
                )}
              </View>
            </Glass>
          </View>
        </Rise>
      </View>
      {onReplay && (
        <Pressable
          onPress={onReplay}
          style={withPressed(styles.replay)}
          accessibilityRole="button"
          accessibilityLabel="Replay wrap"
        >
          <Feather name="rotate-ccw" size={16} color={theme.colors.ink} />
          <Text style={styles.controlText}>Watch again</Text>
        </Pressable>
      )}
      <Rise delay={450} still={still} style={styles.actions}>
        <PrimaryButton
          title="See the full report"
          variant="secondary"
          onPress={onOpenReport}
          style={styles.action}
        />
        <PrimaryButton
          title={sharing ? 'Sharing…' : 'Share'}
          onPress={share}
          disabled={!cardShown || sharing}
          style={styles.action}
        />
      </Rise>
    </View>
  );
}

/** Renders whichever beat `beat` is. */
export function Beat({
  wrap,
  beat,
  still,
  onOpenReport,
  onInteract,
  onOpenDay,
  onReplay,
}: {
  wrap: Wrap;
  beat: WrapBeat;
  still: boolean;
  onOpenReport: () => void;
  onInteract?: () => void;
  onOpenDay?: (date: string) => void;
  onReplay?: () => void;
}) {
  switch (beat.kind) {
    case 'hook':
      return <HookBeat beat={beat} still={still} />;
    case 'kept':
      return <KeptBeat beat={beat} still={still} />;
    case 'bars':
      return (
        <BarsBeat
          beat={beat}
          still={still}
          totalMinor={wrap.beats.find((part) => part.kind === 'hook')?.spentMinor}
          onInteract={onInteract}
        />
      );
    case 'days':
      return <DaysBeat beat={beat} still={still} onInteract={onInteract} onOpenDay={onOpenDay} />;
    case 'mover':
      return <MoverBeat beat={beat} still={still} />;
    case 'weekDays':
      return <WeekDaysBeat beat={beat} still={still} onInteract={onInteract} onOpenDay={onOpenDay} />;
    case 'usual':
      return <UsualBeat beat={beat} still={still} />;
    case 'final':
      return (
        <FinalBeat wrap={wrap} beat={beat} still={still} onOpenReport={onOpenReport} onReplay={onReplay} />
      );
  }
}

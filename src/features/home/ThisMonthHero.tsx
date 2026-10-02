import { useEffect, useRef, useState } from 'react';
import { View, Pressable, PanResponder, StyleSheet } from 'react-native';
import { Text } from '@/components/Text';
import Feather from '@expo/vector-icons/Feather';
import Svg, { Path } from 'react-native-svg';
import ReanimatedAnimated, {
  SharedValue,
  useSharedValue,
  useAnimatedStyle,
  useAnimatedProps,
  withDelay,
  withTiming,
  interpolate,
  runOnJS,
} from 'react-native-reanimated';
import { theme } from '@/constants/theme';
import { formatMoney } from '@/lib/money';
import { useReduceMotion } from '@/lib/useReduceMotion';
import { haptics } from '@/lib/haptics';
import { MOTION, timing } from '@/lib/animation';
import { SoftCard } from './SoftCard';
import { MonthRing, RING_COLORS } from './MonthRing';
import { LimitMeter, LimitMeterTone } from '@/components/LimitMeter';
import { CountUpAmount } from '@/components/CountUpAmount';
import { useAccent } from '@/theme/AccentContext';
import { usePrivacy } from '@/theme/PrivacyContext';
import {
  heroSlices,
  heroPct,
  heroShare,
  heroModes,
  heroRestingMode,
  withoutSavings,
  HeroMode,
  HERO_MODE_LABEL,
} from './heroSlices';
import type { SuuLine } from './suuLine';
import { withPressed } from '@/lib/pressed';

// Reanimated only in this file, never core RN `Animated` — mixing the two in
// one tree is the exact bug class that crashed BudgetRow/GoalCard/GoalChip
// in an earlier pass (see Skeleton.tsx's own comment on the same rule). The
// confetti burst and the drawn checkmark below used to be built on core
// `Animated`, nested inside this component's Reanimated slide wrapper.
const AnimatedPath = ReanimatedAnimated.createAnimatedComponent(Path);

interface HeroContent {
  incomeMinor: number;
  spentMinor: number;
  /** Net moved into savings accounts this period (negative = more came out). */
  savingsMinor: number;
  /** Income − spent − savings: what's free to use. */
  surplusMinor: number;
  outstandingLoansMinor: number;
  suu: SuuLine;
  /** Which period these figures are for: a new period remounts the rolling figures instead of rolling them. */
  periodKey: string;
}

const CHECK_PATH_LENGTH = 22;
const RING_SIZE = 72;
const CONFETTI_COLORS = [theme.colors.secondary, theme.colors.primary, theme.colors.idCoralDeep];
/** How far a horizontal drag must travel before letting go changes the period. */
const SWIPE_STEP_PX = 60;

interface ConfettiPiece {
  color: string;
  angle: number;
  distance: number;
}

function makeConfetti(): ConfettiPiece[] {
  return Array.from({ length: 8 }, (_, i) => ({
    color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
    angle: -Math.PI / 2 + (Math.random() - 0.5) * 2.6,
    distance: 22 + Math.random() * 18,
  }));
}

function ConfettiDot({ progress, piece }: { progress: SharedValue<number>; piece: ConfettiPiece }) {
  const style = useAnimatedStyle(() => {
    const tx = interpolate(progress.value, [0, 1], [0, Math.cos(piece.angle) * piece.distance]);
    const ty = interpolate(
      progress.value,
      [0, 0.4, 1],
      [0, Math.sin(piece.angle) * piece.distance - 6, Math.sin(piece.angle) * piece.distance + 18]
    );
    const opacity = interpolate(progress.value, [0, 0.15, 0.7, 1], [0, 1, 1, 0]);
    const rotate = interpolate(progress.value, [0, 1], [0, 260]);
    return {
      opacity,
      transform: [{ translateX: tx }, { translateY: ty }, { rotate: `${rotate}deg` }],
    };
  });
  return (
    <ReanimatedAnimated.View
      pointerEvents="none"
      style={[styles.confettiDot, { backgroundColor: piece.color }, style]}
    />
  );
}

/**
 * The month at a glance, number first: what's free to use is the one big
 * figure, with the income it came out of underneath. Beside it a small ring
 * splits that income into spent, moved to savings and free (see MonthRing) —
 * tap it to step through the slices — and three tinted tiles under them give
 * spent, saved and debt left (tap spent or saved to pick its slice). Today's
 * spend against the daily goal and the month's pace are two slim lines under
 * those, and Suu's line is the card's mint footer.
 *
 * The period bar at the top (title, ‹ month ›) stays put; everything under
 * it is the "page" that turns. Dragging that page sideways turns it too —
 * right for the period before, left for the one after — rubber-banding with
 * a haptic tick past the current period, where there's nothing newer.
 *
 * `periodKey`/`direction` and the lagged `displayed` state: a same-period
 * data update syncs immediately, while a genuine period change slides the
 * old content out before the new content is committed. The `commit`/`runId`
 * guard stops a slower, stale slide from overwriting a newer one.
 */
export function ThisMonthHero({
  periodKey,
  direction,
  title,
  canStepForward,
  onStep,
  incomeMinor,
  spentMinor,
  savingsMinor,
  surplusMinor,
  outstandingLoansMinor,
  suu,
  celebrateDebtCleared = false,
  today = null,
  pace = null,
}: HeroContent & {
  periodKey: string;
  direction: -1 | 0 | 1;
  /** "This month", or "Looking back" for an earlier period. */
  title: string;
  canStepForward: boolean;
  /** -1 for the period before, 1 for the one after. */
  onStep: (dir: -1 | 1) => void;
  /** Fires once on the real >0 → 0 crossing — see `justClearedDebt` in Home. */
  celebrateDebtCleared?: boolean;
  /** Today's spend against the daily goal — only when a goal is set and the current period is showing. */
  today?: { spentMinor: number; goalMinor: number } | null;
  /** Where this month's spending is heading (monthPace) — the current month only, from the 5th. */
  pace?: { projectedMinor: number; byLabel: string } | null;
}) {
  const reduce = useReduceMotion();
  const { dot } = useAccent();
  const { hideAmounts } = usePrivacy();
  const [displayed, setDisplayed] = useState<HeroContent>({
    incomeMinor,
    spentMinor,
    savingsMinor,
    surplusMinor,
    outstandingLoansMinor,
    suu,
    periodKey,
  });
  // null = the resting view (Kept, or Spent when nothing was kept) — see
  // heroRestingMode. Reset whenever the period turns.
  const [picked, setPicked] = useState<HeroMode | null>(null);
  const prevPeriodKey = useRef(periodKey);
  const tx = useSharedValue(0);
  const dragX = useSharedValue(0);
  const opacity = useSharedValue(1);
  const runId = useRef(0);

  useEffect(() => {
    const myRun = ++runId.current;
    const next: HeroContent = {
      incomeMinor,
      spentMinor,
      savingsMinor,
      surplusMinor,
      outstandingLoansMinor,
      suu,
      periodKey,
    };
    const isPeriodTurn = prevPeriodKey.current !== periodKey;
    prevPeriodKey.current = periodKey;

    if (!isPeriodTurn || reduce) {
      setDisplayed(next);
      if (isPeriodTurn) setPicked(null);
      return;
    }
    const outX = direction > 0 ? -18 : direction < 0 ? 18 : 0;
    const inX = direction > 0 ? 18 : direction < 0 ? -18 : 0;
    const commit = () => {
      if (runId.current !== myRun) return;
      setDisplayed(next);
      setPicked(null);
    };
    // Built here, on the JS thread: the completion callback below runs on the
    // UI thread, where calling a plain JS helper like `timing()` crashes the
    // app (it did — on every month change). A config object is safe to
    // capture into the worklet; a function call is not.
    const outCfg = timing(MOTION.slideOut);
    const inCfg = timing(MOTION.slideIn);
    opacity.value = withTiming(0, outCfg);
    tx.value = withTiming(outX, outCfg, (finished) => {
      if (!finished) return;
      runOnJS(commit)();
      tx.value = inX;
      tx.value = withTiming(0, inCfg);
      opacity.value = withTiming(1, inCfg);
    });
    // `suu` (an object) and `direction` deliberately excluded — including an
    // object recreated every render would re-fire this effect every render
    // too; the current values are read fresh via closure regardless.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [periodKey, incomeMinor, spentMinor, savingsMinor, surplusMinor, outstandingLoansMinor, reduce]);

  const slideStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: tx.value + dragX.value }],
    opacity: opacity.value,
  }));

  // The drag reads the latest props through refs — the responder itself is
  // created once (same "latest ref" pattern as useSwipeStep).
  const onStepRef = useRef(onStep);
  const canForwardRef = useRef(canStepForward);
  const reduceRef = useRef(reduce);
  useEffect(() => {
    onStepRef.current = onStep;
    canForwardRef.current = canStepForward;
    reduceRef.current = reduce;
  });
  // eslint-disable-next-line react-hooks/refs -- the refs are only read inside gesture callbacks, see useSwipeStep
  const [pan] = useState(() => {
    const settle = (ms: number) => {
      dragX.value = reduceRef.current ? 0 : withTiming(0, timing(ms));
    };
    return PanResponder.create({
      // Mostly-horizontal drags only — a vertical one is Home scrolling.
      onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) > 10 && Math.abs(g.dx) > Math.abs(g.dy) * 1.5,
      onPanResponderMove: (_, g) => {
        const pastNewest = g.dx < 0 && !canForwardRef.current;
        dragX.value = g.dx * (pastNewest ? 0.22 : 0.9);
      },
      onPanResponderRelease: (_, g) => {
        if (g.dx > SWIPE_STEP_PX) {
          haptics.tap();
          settle(MOTION.slideOut);
          onStepRef.current(-1);
        } else if (g.dx < -SWIPE_STEP_PX && canForwardRef.current) {
          haptics.tap();
          settle(MOTION.slideOut);
          onStepRef.current(1);
        } else {
          if (g.dx < -SWIPE_STEP_PX) haptics.tap(); // bumped the newest period
          settle(MOTION.standard);
        }
      },
      onPanResponderTerminate: () => settle(MOTION.standard),
    });
  });

  // With "hide savings" on, nothing on the card may reveal what went to
  // savings: no tile, no arc (its share stays empty track), no "kept" view.
  const full = heroSlices(displayed.incomeMinor, displayed.spentMinor, displayed.savingsMinor);
  const slices = hideAmounts ? withoutSavings(full) : full;
  const modes = heroModes(slices, hideAmounts);
  // The ring rests on the spent share: the free figure is the headline beside it.
  const resting: HeroMode = heroShare(slices, 'spent') > 0 ? 'spent' : heroRestingMode(slices, hideAmounts);
  const mode: HeroMode = picked && modes.includes(picked) ? picked : resting;
  const canPick = modes.length > 1;
  const rowValue = {
    spent: displayed.spentMinor,
    saved: displayed.savingsMinor,
  };
  const warn = displayed.suu.pose === 'sleepy';
  const debtCleared = displayed.outstandingLoansMinor === 0;

  // The headline on the ring's face, and the same said in full for a screen reader.
  let big: string;
  let subText: string;
  if (!slices.hasIncome) {
    big = '—';
    subText = 'Add income to see your month';
  } else if (slices.overMinor > 0) {
    big = 'Over';
    subText = `by ${formatMoney(slices.overMinor)}, more went out than came in`;
  } else {
    big = heroPct(heroShare(slices, mode));
    subText = `${(hideAmounts ? PRIVATE_LABEL[mode] : HERO_MODE_LABEL[mode]).toLowerCase()} of ${formatMoney(displayed.incomeMinor)} income`;
  }
  const nextMode = () => {
    if (!canPick) return;
    haptics.tap();
    setPicked(modes[(modes.indexOf(mode) + 1) % modes.length]);
  };
  const pickMode = (m: HeroMode) => {
    if (!canPick) return;
    haptics.tap();
    setPicked((cur) => (cur === m ? null : m));
  };

  const todayPct = today && today.goalMinor > 0 ? (today.spentMinor / today.goalMinor) * 100 : 0;
  const todayTone: LimitMeterTone = todayPct >= 100 ? 'over' : todayPct >= 80 ? 'near' : 'ok';

  // Debt-cleared celebration — a drawn checkmark plus a small confetti
  // burst, played once on the real crossing (see Home's own comment on
  // `justClearedDebt`), not on every render where debt already happens to
  // be zero.
  const [confetti, setConfetti] = useState<ConfettiPiece[]>([]);
  const [confettiPlaying, setConfettiPlaying] = useState(false);
  const checkDraw = useSharedValue(1);
  const confettiProgress = useSharedValue(0);
  useEffect(() => {
    if (!celebrateDebtCleared || reduce) return;
    setConfetti(makeConfetti());
    setConfettiPlaying(true);
    checkDraw.value = 0;
    confettiProgress.value = 0;
    checkDraw.value = withDelay(150, withTiming(1, timing(380)));
    confettiProgress.value = withDelay(
      100,
      withTiming(1, timing(MOTION.draw), (finished) => {
        if (finished) runOnJS(setConfettiPlaying)(false);
      })
    );
  }, [celebrateDebtCleared, reduce, checkDraw, confettiProgress]);

  const checkAnimatedProps = useAnimatedProps(() => ({
    strokeDashoffset: interpolate(checkDraw.value, [0, 1], [CHECK_PATH_LENGTH, 0]),
  }));

  const ringLabel = !slices.hasIncome || slices.overMinor > 0 ? '' : RING_LABEL[mode];
  const tileModes = hideAmounts ? (['spent'] as const) : (['spent', 'saved'] as const);

  // The headline: what's free to use, or by how much the month went over.
  const over = slices.overMinor > 0;
  const headLabel = over ? 'Over by' : 'Free to use';
  const headMinor = over ? slices.overMinor : displayed.surplusMinor;
  const headNeg = over || displayed.surplusMinor < 0;
  const headCaption = !slices.hasIncome
    ? 'Add income to see what is free'
    : over
      ? 'more went out than came in'
      : displayed.surplusMinor < 0
        ? 'below zero'
        : `left of ${formatMoney(displayed.incomeMinor)} income`;

  return (
    <SoftCard elevated backgroundColor={theme.colors.surface} padding={0} style={styles.card}>
      <View style={styles.inner}>
        {/* The period bar — outside the sliding page, so it never moves or fades. */}
        <View style={styles.bar}>
          <Text style={styles.title}>{title}</Text>
          <View style={styles.nav}>
            <Pressable
              onPress={() => onStep(-1)}
              hitSlop={8}
              style={withPressed(styles.navBtn)}
              accessibilityRole="button"
              accessibilityLabel="Previous period"
            >
              <Feather name="chevron-left" size={16} color={theme.colors.textSecondary} />
            </Pressable>
            <Pressable
              onPress={() => onStep(1)}
              disabled={!canStepForward}
              hitSlop={8}
              style={withPressed([styles.navBtn, !canStepForward && styles.navBtnOff])}
              accessibilityRole="button"
              accessibilityLabel="Next period"
              accessibilityState={{ disabled: !canStepForward }}
            >
              <Feather name="chevron-right" size={16} color={theme.colors.textSecondary} />
            </Pressable>
          </View>
        </View>

        <ReanimatedAnimated.View style={[styles.body, slideStyle]} {...pan.panHandlers}>
          <View style={styles.top}>
            <View
              style={styles.headline}
              accessible
              accessibilityLabel={
                slices.hasIncome ? `${headLabel}, ${formatMoney(headMinor)}, ${headCaption}` : headCaption
              }
            >
              <Text style={styles.headLabel}>{headLabel}</Text>
              {slices.hasIncome ? (
                // Rolls to its new value after a save; a new period slides in instead.
                <CountUpAmount
                  key={displayed.periodKey}
                  minor={headMinor}
                  countFromZero={false}
                  style={[styles.headValue, headNeg && styles.headValueNeg]}
                  symbolStyle={styles.headSymbol}
                  numberOfLines={1}
                  adjustsFontSizeToFit
                />
              ) : (
                <Text style={styles.headValue}>—</Text>
              )}
              <Text style={styles.headCaption} numberOfLines={2}>
                {headCaption}
              </Text>
            </View>
            <MonthRing
              slices={slices}
              mode={picked && modes.includes(picked) ? picked : 'kept'}
              big={big}
              label={ringLabel}
              size={RING_SIZE}
              periodKey={displayed.periodKey}
              onPress={nextMode}
              accessibilityLabel={`${big}, ${subText}`}
            />
          </View>
          <View style={styles.tiles}>
            {tileModes.map((m) => {
              const active = picked === m;
              const faded = !!picked && !active;
              return (
                <Pressable
                  key={m}
                  onPress={() => pickMode(m)}
                  disabled={!canPick || !modes.includes(m)}
                  style={withPressed([
                    styles.tile,
                    { backgroundColor: TILE_TINT[m] },
                    active && styles.tileActive,
                    faded && styles.tileFaded,
                  ])}
                  accessibilityRole={canPick ? 'button' : 'text'}
                  accessibilityState={canPick ? { selected: active } : undefined}
                  accessibilityLabel={`${TILE_LABEL[m]}, ${formatMoney(rowValue[m])}`}
                >
                  <View style={styles.tileHead}>
                    <View
                      style={[styles.tileDot, { backgroundColor: RING_COLORS[m], borderColor: DOT_EDGE[m] }]}
                    />
                    <Text style={styles.tileLabel} numberOfLines={1}>
                      {TILE_LABEL[m]}
                    </Text>
                  </View>
                  {/* Rolls to its new value after a save; a new period slides in instead. */}
                  <CountUpAmount
                    key={displayed.periodKey}
                    minor={rowValue[m]}
                    countFromZero={false}
                    style={styles.tileValue}
                    numberOfLines={1}
                    adjustsFontSizeToFit
                  />
                </Pressable>
              );
            })}
            <View
              style={[styles.tile, { backgroundColor: TILE_TINT.debt }]}
              accessible
              accessibilityLabel={`Debt left, ${formatMoney(displayed.outstandingLoansMinor)}`}
            >
              <View style={styles.tileHead}>
                <Feather name="credit-card" size={10} color={theme.colors.textSecondary} />
                <Text style={styles.tileLabel} numberOfLines={1}>
                  Debt left
                </Text>
                {debtCleared && (
                  <Svg width={10} height={10} viewBox="0 0 24 24">
                    <AnimatedPath
                      d="M5 13l4 4 10-10"
                      stroke={theme.colors.income}
                      strokeWidth={3.6}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      fill="none"
                      strokeDasharray={CHECK_PATH_LENGTH}
                      animatedProps={checkAnimatedProps}
                    />
                  </Svg>
                )}
              </View>
              <CountUpAmount
                key={displayed.periodKey}
                minor={displayed.outstandingLoansMinor}
                countFromZero={false}
                style={styles.tileValue}
                numberOfLines={1}
                adjustsFontSizeToFit
              />
              {confettiPlaying &&
                confetti.map((piece, i) => <ConfettiDot key={i} progress={confettiProgress} piece={piece} />)}
            </View>
          </View>

          {today && (
            <View style={styles.line}>
              <Feather name="clock" size={15} color={theme.colors.textSecondary} />
              <Text style={styles.lineLabel} numberOfLines={1}>
                Today <Text style={styles.lineMoney}>{formatMoney(today.spentMinor)}</Text>
                {todayTone === 'over' ? (
                  <>
                    {' '}
                    — <Text style={styles.lineMoney}>
                      {formatMoney(today.spentMinor - today.goalMinor)}
                    </Text>{' '}
                    over
                  </>
                ) : (
                  <>
                    {' '}
                    of <Text style={styles.lineMoney}>{formatMoney(today.goalMinor)}</Text>
                  </>
                )}
              </Text>
              <View style={styles.todayMeter}>
                <LimitMeter pct={todayPct} tone={todayTone} animKey="home:today" />
              </View>
            </View>
          )}

          {pace && (
            <View style={styles.line}>
              <Feather name="trending-up" size={15} color={theme.colors.textSecondary} />
              <Text style={styles.lineLabel} numberOfLines={1}>
                On pace for about{' '}
                <Text style={styles.lineMoney}>
                  {formatMoney(Math.round(pace.projectedMinor / 10000) * 10000)}
                </Text>{' '}
                by {pace.byLabel}
              </Text>
            </View>
          )}
        </ReanimatedAnimated.View>
      </View>

      <View style={[styles.suu, warn && styles.suuWarn]}>
        <View style={[styles.suuDot, { backgroundColor: dot }]} />
        <Text style={[styles.suuText, warn && styles.suuTextWarn]}>{displayed.suu.text}</Text>
      </View>
    </SoftCard>
  );
}

/** The word under the ring's figure — short, to fit the small face. */
const RING_LABEL: Record<HeroMode, string> = { kept: 'kept', spent: 'spent', saved: 'saved', free: 'free' };

/** The tiles' labels: "Saved", since the headline already says what is free. */
const TILE_LABEL = { spent: 'Spent', saved: 'Saved' };

/** What the spoken summary calls each view when savings are hidden: "free", not "free to use". */
const PRIVATE_LABEL: Record<HeroMode, string> = { ...HERO_MODE_LABEL, free: 'Free', kept: 'Free' };

/** The tiles' pale fills: each slice's own family, and a soft lavender for debt. */
const TILE_TINT = {
  spent: theme.colors.idCoral,
  saved: theme.colors.secondaryTint,
  debt: theme.colors.accentTint,
};

/** A deeper edge on each tile's legend dot, so the pastel ring colour still reads on the pale tile. */
const DOT_EDGE = { spent: theme.colors.idCoralDeep, saved: theme.colors.secondaryDeep };

const styles = StyleSheet.create({
  card: { marginHorizontal: 20, marginTop: 4, overflow: 'hidden' },
  inner: { padding: 16, paddingBottom: 14 },
  bar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  title: { fontFamily: theme.font.roundedBold, fontSize: 15, color: theme.colors.textPrimary },
  nav: { flexDirection: 'row', alignItems: 'center', gap: 2, flexShrink: 1 },
  navBtn: {
    width: 28,
    height: 28,
    borderRadius: theme.radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navBtnOff: { opacity: 0.25 },
  body: { marginTop: 10 },

  top: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  headline: { flex: 1, minWidth: 0 },
  headLabel: {
    fontFamily: theme.font.bodyBold,
    fontSize: 11,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    color: theme.colors.textSecondary,
  },
  headValue: {
    fontFamily: theme.font.monoBold,
    fontSize: 34,
    lineHeight: 38,
    letterSpacing: -1,
    color: theme.colors.textPrimary,
    marginTop: 2,
  },
  headSymbol: {
    fontFamily: theme.font.monoBold,
    fontSize: 21,
    letterSpacing: 0,
    color: theme.colors.textMuted,
  },
  headValueNeg: { color: theme.colors.expenseText },
  headCaption: {
    fontFamily: theme.font.body,
    fontSize: 12.5,
    color: theme.colors.textSecondary,
    marginTop: 2,
  },
  tiles: { flexDirection: 'row', gap: 7, marginTop: 12 },
  tile: {
    flex: 1,
    minWidth: 0,
    borderRadius: 16,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  tileActive: { borderColor: theme.colors.ink },
  tileFaded: { opacity: 0.4 },
  tileHead: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  tileDot: { width: 9, height: 9, borderRadius: 4.5, borderWidth: 1.5 },
  tileLabel: {
    flexShrink: 1,
    fontFamily: theme.font.bodyBold,
    fontSize: 11,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    color: theme.colors.textSecondary,
  },
  tileValue: {
    fontFamily: theme.font.monoBold,
    fontSize: 13.5,
    color: theme.colors.textPrimary,
    marginTop: 5,
  },

  // Slim lines under the ring and tiles.
  line: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 12 },
  lineLabel: { flex: 1, fontFamily: theme.font.body, fontSize: 12.5, color: theme.colors.textSecondary },
  lineMoney: { fontFamily: theme.font.monoBold, color: theme.colors.textPrimary },
  todayMeter: { width: 72 },

  // Suu's line: the card's mint footer (coral when Suu is worried).
  suu: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 9,
    paddingHorizontal: 16,
    paddingVertical: 11,
    backgroundColor: theme.colors.secondaryTint,
  },
  suuWarn: { backgroundColor: theme.colors.idCoral },
  suuDot: { width: 9, height: 9, borderRadius: 5, marginTop: 4 },
  suuText: {
    flex: 1,
    fontFamily: theme.font.roundedMedium,
    fontSize: 12.5,
    lineHeight: 17,
    color: '#1D5E45',
  },
  suuTextWarn: { color: theme.colors.expenseText },

  confettiDot: {
    position: 'absolute',
    top: 4,
    left: '50%',
    width: 5,
    height: 5,
    borderRadius: 1,
    marginLeft: -2.5,
  },
});

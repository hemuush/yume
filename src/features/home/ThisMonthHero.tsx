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
import { HeroMoon, MOON_COLORS } from './HeroMoon';
import { LimitMeter, LimitMeterTone } from '@/components/LimitMeter';
import { useAccent } from '@/theme/AccentContext';
import {
  heroSlices,
  heroPct,
  heroShare,
  heroModes,
  heroRestingMode,
  HeroMode,
  HERO_MODE_LABEL,
} from './heroSlices';
import type { SuuLine } from './suuLine';

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
}

const CHECK_PATH_LENGTH = 22;
const MOON_SIZE = 124;
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
 * The month's headline, drawn as a moon (see HeroMoon): income split into
 * spent, moved to savings, and free to use — the moon on the left, its
 * headline beside it, and the three figures underneath doubling as the
 * legend (tap one to pick its slice; tap the moon to step through them).
 * Debt left, today's spend against the daily goal, and Suu's line run
 * along the bottom as thin lines of the same card (the "arranged Home"
 * sign-off — they used to be separate stats and a separate strip).
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
  periodName,
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
}: HeroContent & {
  periodKey: string;
  direction: -1 | 0 | 1;
  /** "This month", or "Looking back" for an earlier period. */
  title: string;
  /** The period's own name for the bar — "September", "2025". */
  periodName: string;
  canStepForward: boolean;
  /** -1 for the period before, 1 for the one after. */
  onStep: (dir: -1 | 1) => void;
  /** Fires once on the real >0 → 0 crossing — see `justClearedDebt` in Home. */
  celebrateDebtCleared?: boolean;
  /** Today's spend against the daily goal — only when a goal is set and the current period is showing. */
  today?: { spentMinor: number; goalMinor: number } | null;
}) {
  const reduce = useReduceMotion();
  const { dot } = useAccent();
  const [displayed, setDisplayed] = useState<HeroContent>({
    incomeMinor,
    spentMinor,
    savingsMinor,
    surplusMinor,
    outstandingLoansMinor,
    suu,
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

  const slices = heroSlices(displayed.incomeMinor, displayed.spentMinor, displayed.savingsMinor);
  const modes = heroModes(slices);
  const resting = heroRestingMode(slices);
  const mode: HeroMode = picked && modes.includes(picked) ? picked : resting;
  const canPick = modes.length > 1;
  // Figure rows for the slices that exist — or just Spent when there's no
  // split to show (no income, or overspent) but money did go out.
  const rowModes: ('spent' | 'saved' | 'free')[] =
    modes.length > 0
      ? (['spent', 'saved', 'free'] as const).filter((m) => modes.includes(m))
      : displayed.spentMinor > 0
        ? ['spent']
        : [];
  const rowValue = {
    spent: displayed.spentMinor,
    saved: displayed.savingsMinor,
    free: displayed.surplusMinor,
  };
  const warn = displayed.suu.pose === 'sleepy';
  const debtCleared = displayed.outstandingLoansMinor === 0;

  // The headline beside the moon.
  let big: string;
  let sub: React.ReactNode;
  let subText: string;
  if (!slices.hasIncome) {
    big = '—';
    subText = 'Add income to see your month';
    sub = subText;
  } else if (slices.overMinor > 0) {
    big = 'Over';
    subText = `by ${formatMoney(slices.overMinor)}, more went out than came in`;
    sub = (
      <>
        by <Text style={styles.subMoney}>{formatMoney(slices.overMinor)}</Text> — more went out than came in
      </>
    );
  } else {
    big = heroPct(heroShare(slices, mode));
    subText = `${HERO_MODE_LABEL[mode].toLowerCase()} of ${formatMoney(displayed.incomeMinor)} income`;
    sub = (
      <>
        {HERO_MODE_LABEL[mode].toLowerCase()} of{' '}
        <Text style={styles.subMoney}>{formatMoney(displayed.incomeMinor)}</Text> income
      </>
    );
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [celebrateDebtCleared, reduce]);

  const checkAnimatedProps = useAnimatedProps(() => ({
    strokeDashoffset: interpolate(checkDraw.value, [0, 1], [CHECK_PATH_LENGTH, 0]),
  }));

  return (
    <SoftCard elevated backgroundColor={theme.colors.surface} style={styles.card}>
      {/* The period bar — outside the sliding page, so it never moves or fades. */}
      <View style={styles.bar}>
        <Text style={styles.title}>{title}</Text>
        <View style={styles.nav}>
          <Pressable
            onPress={() => onStep(-1)}
            hitSlop={8}
            style={styles.navBtn}
            accessibilityRole="button"
            accessibilityLabel="Previous period"
          >
            <Feather name="chevron-left" size={16} color={theme.colors.textSecondary} />
          </Pressable>
          <Text style={styles.navLabel} numberOfLines={1}>
            {periodName}
          </Text>
          <Pressable
            onPress={() => onStep(1)}
            disabled={!canStepForward}
            hitSlop={8}
            style={[styles.navBtn, !canStepForward && styles.navBtnOff]}
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
          <HeroMoon
            slices={slices}
            mode={picked && modes.includes(picked) ? picked : 'kept'}
            size={MOON_SIZE}
            onPress={nextMode}
            accessibilityLabel={`${big}, ${subText}`}
          />
          <View style={styles.headline}>
            <Text style={styles.big} numberOfLines={1} adjustsFontSizeToFit>
              {big}
            </Text>
            <Text style={styles.sub}>{sub}</Text>
          </View>
        </View>

        {rowModes.length > 0 && (
          <View style={styles.rows}>
            {rowModes.map((m) => {
              const active = picked === m;
              const faded = !!picked && !active;
              return (
                <Pressable
                  key={m}
                  onPress={() => pickMode(m)}
                  disabled={!canPick}
                  style={[styles.figRow, active && styles.figRowActive, faded && styles.figRowFaded]}
                  accessibilityRole={canPick ? 'button' : 'text'}
                  accessibilityState={canPick ? { selected: active } : undefined}
                  accessibilityLabel={`${HERO_MODE_LABEL[m]}, ${formatMoney(rowValue[m])}`}
                >
                  <View style={[styles.figDot, { backgroundColor: MOON_COLORS[m] }]} />
                  <Text style={styles.figName}>{HERO_MODE_LABEL[m]}</Text>
                  <Text
                    style={[styles.figVal, m === 'free' && rowValue.free < 0 && styles.figValNeg]}
                    numberOfLines={1}
                  >
                    {formatMoney(rowValue[m])}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        )}

        <View style={styles.foot}>
          <View style={styles.line}>
            <Feather name="credit-card" size={15} color={theme.colors.textSecondary} />
            <Text style={styles.lineLabel}>Debt left</Text>
            {debtCleared && (
              <Svg width={11} height={11} viewBox="0 0 24 24">
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
            <Text style={styles.lineValue} numberOfLines={1}>
              {formatMoney(displayed.outstandingLoansMinor)}
            </Text>
            {confettiPlaying &&
              confetti.map((piece, i) => <ConfettiDot key={i} progress={confettiProgress} piece={piece} />)}
          </View>

          {today && (
            <View style={[styles.line, styles.lineDivider]}>
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
                <LimitMeter pct={todayPct} tone={todayTone} />
              </View>
            </View>
          )}

          <View style={[styles.line, styles.lineDivider, styles.suuLine]}>
            <View style={[styles.suuDot, { backgroundColor: dot }]} />
            <Text style={[styles.suuText, warn && styles.suuTextWarn]}>{displayed.suu.text}</Text>
          </View>
        </View>
      </ReanimatedAnimated.View>
    </SoftCard>
  );
}

const styles = StyleSheet.create({
  card: { marginHorizontal: 20, marginTop: 4, overflow: 'hidden' },
  bar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  title: {
    fontFamily: theme.font.roundedBold,
    fontSize: 13,
    letterSpacing: 0.3,
    color: theme.colors.textSecondary,
    textTransform: 'uppercase',
  },
  nav: { flexDirection: 'row', alignItems: 'center', gap: 2, flexShrink: 1 },
  navBtn: {
    width: 28,
    height: 28,
    borderRadius: theme.radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navBtnOff: { opacity: 0.25 },
  navLabel: {
    fontFamily: theme.font.roundedMedium,
    fontSize: 12.5,
    color: theme.colors.textSecondary,
    minWidth: 64,
    textAlign: 'center',
    flexShrink: 1,
  },
  body: { marginTop: 6 },

  top: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  headline: { flex: 1, minWidth: 0 },
  big: { fontFamily: theme.font.roundedBold, fontSize: 36, lineHeight: 40, color: theme.colors.textPrimary },
  sub: {
    fontFamily: theme.font.body,
    fontSize: 12.5,
    lineHeight: 17,
    color: theme.colors.textSecondary,
    marginTop: 4,
  },
  subMoney: { fontFamily: theme.font.monoBold, color: theme.colors.income },

  rows: { marginTop: 8, marginHorizontal: -6 },
  figRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 6,
    paddingHorizontal: 6,
    borderRadius: theme.radius.md,
  },
  figRowActive: { backgroundColor: theme.colors.surfaceAlt },
  figRowFaded: { opacity: 0.45 },
  figDot: { width: 10, height: 10, borderRadius: 5 },
  figName: { flex: 1, fontFamily: theme.font.body, fontSize: 14, color: theme.colors.textPrimary },
  figVal: { fontFamily: theme.font.monoBold, fontSize: 14, color: theme.colors.textPrimary },
  figValNeg: { color: theme.colors.expense },

  // Thin lines along the card's bottom edge, full-bleed like a list.
  foot: {
    marginTop: 10,
    marginHorizontal: -16,
    marginBottom: -16,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: theme.colors.borderSoft,
  },
  line: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, paddingHorizontal: 16 },
  lineDivider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.colors.borderSoft },
  lineLabel: { flex: 1, fontFamily: theme.font.body, fontSize: 13, color: theme.colors.textSecondary },
  lineMoney: { fontFamily: theme.font.monoBold, color: theme.colors.textPrimary },
  lineValue: { fontFamily: theme.font.monoBold, fontSize: 13.5, color: theme.colors.textPrimary },
  todayMeter: { width: 64 },
  suuLine: { backgroundColor: theme.colors.surfaceAlt, alignItems: 'flex-start' },
  suuDot: { width: 8, height: 8, borderRadius: 4, marginTop: 5 },
  suuText: {
    flex: 1,
    fontFamily: theme.font.rounded,
    fontSize: 12.5,
    lineHeight: 17,
    color: theme.colors.textSecondary,
  },
  suuTextWarn: { fontFamily: theme.font.roundedMedium, color: theme.colors.idCoralDeep },

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

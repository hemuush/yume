import { useEffect, useRef, useState } from 'react';
import { View, Pressable, PanResponder } from 'react-native';
import { Text } from '@/components/Text';
import Feather from '@expo/vector-icons/Feather';
import Svg, { Path } from 'react-native-svg';
import ReanimatedAnimated, {
  useSharedValue,
  useAnimatedStyle,
  useAnimatedProps,
  withDelay,
  withTiming,
  interpolate,
  runOnJS,
} from 'react-native-reanimated';
import { theme } from '@/constants/theme';
import { formatMoney, formatMaskableMoney } from '@/lib/money';
import { useReduceMotion } from '@/lib/useReduceMotion';
import { haptics } from '@/lib/haptics';
import { MOTION, timing } from '@/lib/animation';
import { SoftCard } from '@/components/SoftCard';
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
import { styles } from './hero.styles';
import { ConfettiDot, ConfettiPiece, makeConfetti } from './HeroConfetti';
import { WorkingRow } from './WorkingRow';
import { withPressed } from '@/lib/pressed';

// Reanimated only, never core RN `Animated`: mixing them in one tree crashed BudgetRow/GoalCard/GoalChip
// (see Skeleton.tsx). That covers the confetti burst and checkmark below too.
const AnimatedPath = ReanimatedAnimated.createAnimatedComponent(Path);

interface HeroContent {
  incomeMinor: number;
  spentMinor: number;
  /** Net moved into savings accounts this period (negative = more came out). */
  savingsMinor: number;
  /** What's free to use: what carried over from earlier months, plus income − spent − savings. */
  surplusMinor: number;
  /**
   * Left over from (or, when negative, owed from) all the months before this period — already inside
   * surplusMinor.
   */
  carryMinor: number;
  /**
   * EMIs and bills still to pay this month (current month only; 0 = none). The headline is free to use minus
   * this.
   */
  dueMinor: number;
  outstandingLoansMinor: number;
  suu: SuuLine;
  /** Which period these figures are for: a new period remounts the rolling figures instead of rolling them. */
  periodKey: string;
}

const CHECK_PATH_LENGTH = 22;
const RING_SIZE = 72;
/** How far a horizontal drag must travel before letting go changes the period. */
const SWIPE_STEP_PX = 60;

/**
 * Month card: free-to-use headline, MonthRing, three tiles; unpaid bills give "Free after bills" (gold chip).
 * `displayed` lags `periodKey` so content slides out first; a `runId` guard stops stale slides overwriting.
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
  carryMinor = 0,
  dueMinor = 0,
  outstandingLoansMinor,
  suu,
  celebrateDebtCleared = false,
  today = null,
  pace = null,
}: Omit<HeroContent, 'dueMinor' | 'carryMinor'> & {
  dueMinor?: number;
  carryMinor?: number;
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
    carryMinor,
    dueMinor,
    outstandingLoansMinor,
    suu,
    periodKey,
  });
  // null = the resting view (Kept, or Spent when nothing was kept) — see
  // heroRestingMode. Reset whenever the period turns.
  const [picked, setPicked] = useState<HeroMode | null>(null);
  // The sum behind "Free after bills", opened from the "still to pay" chip.
  const [showWorking, setShowWorking] = useState(false);
  const prevPeriodKey = useRef(periodKey);
  const tx = useSharedValue(0);
  const dragX = useSharedValue(0);
  const opacity = useSharedValue(1);
  const runId = useRef(0);

  // Primitives, so a fresh `suu` object each render doesn't re-fire the effect below — but a changed line
  // (including the hide-savings variant) does.
  const suuText = suu.text;
  const suuPose = suu.pose;

  useEffect(() => {
    const myRun = ++runId.current;
    const next: HeroContent = {
      incomeMinor,
      spentMinor,
      savingsMinor,
      surplusMinor,
      carryMinor,
      dueMinor,
      outstandingLoansMinor,
      suu: { text: suuText, pose: suuPose },
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
    // Built on the JS thread: the completion callback runs on the UI thread, where calling a JS helper like
    // `timing()` crashes the app. A config object can be captured into the worklet; a function call can't.
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
  }, [
    periodKey,
    direction,
    suuText,
    suuPose,
    incomeMinor,
    spentMinor,
    savingsMinor,
    surplusMinor,
    carryMinor,
    dueMinor,
    outstandingLoansMinor,
    reduce,
    opacity,
    tx,
  ]);

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

  // With "hide savings" on nothing may reveal savings: no tile, no arc (share stays empty track), no "kept".
  // Carry-over joins the ring's pool like income; a carried shortfall only lowers the headline, not the ring.
  const poolMinor = displayed.incomeMinor + Math.max(0, displayed.carryMinor);
  const full = heroSlices(poolMinor, displayed.spentMinor, displayed.savingsMinor, displayed.dueMinor);
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
    subText = `${(hideAmounts ? PRIVATE_LABEL[mode] : HERO_MODE_LABEL[mode]).toLowerCase()} of ${formatMoney(poolMinor)} ${displayed.carryMinor > 0 ? 'available' : 'income'}`;
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

  // Debt-cleared celebration (checkmark + confetti) plays once on the real crossing (see Home's
  // `justClearedDebt`), not on every render where debt is already zero.
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
  // With bills still to come this month, what is free is counted after them.
  const hasDue = slices.hasIncome && !over && displayed.dueMinor > 0;
  const freeMinor = displayed.surplusMinor - (hasDue ? displayed.dueMinor : 0);
  const headLabel = over
    ? 'Over by'
    : hasDue
      ? freeMinor < 0
        ? 'Short after bills'
        : 'Free after bills'
      : 'Free to use';
  const headMinor = over ? slices.overMinor : freeMinor;
  const headNeg = over || freeMinor < 0;
  const carryNote =
    displayed.carryMinor > 0
      ? ` + ${formatMoney(displayed.carryMinor)} carried over`
      : displayed.carryMinor < 0
        ? ` − ${formatMoney(-displayed.carryMinor)} carried over`
        : '';
  const headCaption = !slices.hasIncome
    ? 'Add income to see what is free'
    : over
      ? 'more went out than came in'
      : hasDue
        ? `of ${formatMoney(displayed.incomeMinor)} income${carryNote}`
        : displayed.surplusMinor < 0
          ? 'below zero'
          : `left of ${formatMoney(displayed.incomeMinor)} income${carryNote}`;

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
            <View style={styles.headline}>
              <View
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
              {hasDue && (
                <Pressable
                  onPress={() => {
                    haptics.tap();
                    setShowWorking((v) => !v);
                  }}
                  style={withPressed(styles.dueChip)}
                  accessibilityRole="button"
                  accessibilityState={{ expanded: showWorking }}
                  accessibilityLabel={`${formatMoney(displayed.dueMinor)} still to pay this month`}
                  accessibilityHint="Shows how this adds up"
                >
                  <View style={styles.dueDot} />
                  <Text style={styles.dueText} numberOfLines={1}>
                    <Text style={styles.dueMoney}>{formatMoney(displayed.dueMinor)}</Text> still to pay
                  </Text>
                  <Feather
                    name={showWorking ? 'chevron-up' : 'chevron-down'}
                    size={12}
                    color={theme.colors.warnInk}
                  />
                </Pressable>
              )}
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
          {hasDue && showWorking && (
            <View style={styles.working}>
              <WorkingRow label="Income" value={formatMoney(displayed.incomeMinor)} />
              <WorkingRow label="Spent" value={`−${formatMoney(displayed.spentMinor)}`} />
              <WorkingRow
                label="Set aside"
                value={
                  hideAmounts
                    ? `−${formatMaskableMoney(0, { masked: true })}`
                    : `${displayed.savingsMinor < 0 ? '+' : '−'}${formatMoney(Math.abs(displayed.savingsMinor))}`
                }
              />
              {displayed.carryMinor !== 0 && (
                <WorkingRow
                  label="Carried over"
                  value={`${displayed.carryMinor < 0 ? '−' : '+'}${formatMoney(Math.abs(displayed.carryMinor))}`}
                />
              )}
              <WorkingRow label="Free to use" value={formatMoney(displayed.surplusMinor)} total />
              <WorkingRow label="Still to pay" value={`−${formatMoney(displayed.dueMinor)}`} due />
              <WorkingRow label="After bills" value={formatMoney(freeMinor)} total />
            </View>
          )}

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

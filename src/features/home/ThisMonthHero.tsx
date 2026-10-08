import { useEffect, useRef, useState } from 'react';
import { View, Pressable, PanResponder } from 'react-native';
import { Text } from '@/components/Text';
import Feather from '@expo/vector-icons/Feather';
import ReanimatedAnimated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  runOnJS,
} from 'react-native-reanimated';
import { theme } from '@/constants/theme';
import { formatMoney, formatMaskableMoney } from '@/lib/money';
import { useReduceMotion } from '@/lib/useReduceMotion';
import { haptics } from '@/lib/haptics';
import { MOTION, timing } from '@/lib/animation';
import { CountUpAmount } from '@/components/CountUpAmount';
import { Glass } from '@/components/Glass';
import { usePrivacy } from '@/theme/PrivacyContext';
import { heroSlices, heroPct, heroShare, withoutSavings } from './heroSlices';
import { styles } from './hero.styles';
import { WorkingRow } from './WorkingRow';
import { HeroActions } from './HeroActions';
import { withPressed } from '@/lib/pressed';

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
  /** Which period these figures are for: a new period remounts the rolling figures instead of rolling them. */
  periodKey: string;
}

/** How far a horizontal drag must travel before letting go changes the period. */
const SWIPE_STEP_PX = 60;

/**
 * Home's month card, frosted glass: what is free to use as one big light figure, small chips under it (the
 * spent share, today against the daily goal, bills still to pay), then the Add shortcuts. Swipe it sideways
 * to step the period. `displayed` lags `periodKey` so the old figures slide out first; a `runId` guard stops
 * a stale slide overwriting a newer one.
 */
export function ThisMonthHero({
  periodKey,
  direction,
  period,
  canStepForward,
  onStep,
  incomeMinor,
  spentMinor,
  savingsMinor,
  surplusMinor,
  carryMinor = 0,
  dueMinor = 0,
  today = null,
  pace = null,
}: Omit<HeroContent, 'dueMinor' | 'carryMinor'> & {
  dueMinor?: number;
  carryMinor?: number;
  periodKey: string;
  direction: -1 | 0 | 1;
  /** The period control (the month pill), top right. */
  period?: React.ReactNode;
  canStepForward: boolean;
  /** -1 for the period before, 1 for the one after. */
  onStep: (dir: -1 | 1) => void;
  /** Today's spend against the daily goal — only when a goal is set and the current period is showing. */
  today?: { spentMinor: number; goalMinor: number } | null;
  /** Where this month's spending is heading (monthPace) — the current month only, from the 5th. */
  pace?: { projectedMinor: number; byLabel: string } | null;
}) {
  const reduce = useReduceMotion();
  const { hideAmounts } = usePrivacy();
  const [displayed, setDisplayed] = useState<HeroContent>({
    incomeMinor,
    spentMinor,
    savingsMinor,
    surplusMinor,
    carryMinor,
    dueMinor,
    periodKey,
  });
  // The sum behind "Free after bills", opened from the "still to pay" chip.
  const [showWorking, setShowWorking] = useState(false);
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
      carryMinor,
      dueMinor,
      periodKey,
    };
    const isPeriodTurn = prevPeriodKey.current !== periodKey;
    prevPeriodKey.current = periodKey;

    if (!isPeriodTurn || reduce) {
      setDisplayed(next);
      return;
    }
    const outX = direction > 0 ? -18 : direction < 0 ? 18 : 0;
    const inX = direction > 0 ? 18 : direction < 0 ? -18 : 0;
    const commit = () => {
      if (runId.current !== myRun) return;
      setDisplayed(next);
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
    incomeMinor,
    spentMinor,
    savingsMinor,
    surplusMinor,
    carryMinor,
    dueMinor,
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

  // Carry-over joins the pool like income; a carried shortfall only lowers the headline. With "hide savings"
  // on, nothing may reveal savings.
  const poolMinor = displayed.incomeMinor + Math.max(0, displayed.carryMinor);
  const full = heroSlices(poolMinor, displayed.spentMinor, displayed.savingsMinor, displayed.dueMinor);
  const slices = hideAmounts ? withoutSavings(full) : full;

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

  const spentShare = slices.hasIncome && !over ? heroPct(heroShare(slices, 'spent')) : null;
  const todayOverMinor = today ? today.spentMinor - today.goalMinor : 0;

  return (
    <Glass radius={28} style={styles.card}>
      <View style={styles.bar}>
        <Text style={styles.headLabel}>{headLabel}</Text>
        {period}
      </View>

      <ReanimatedAnimated.View style={[styles.body, slideStyle]} {...pan.panHandlers}>
        <View
          accessible
          accessibilityLabel={
            slices.hasIncome ? `${headLabel}, ${formatMoney(headMinor)}, ${headCaption}` : headCaption
          }
          // The swipe, for a screen reader: swipe up or down on the figure to step the period.
          accessibilityActions={[
            { name: 'decrement', label: 'Previous period' },
            ...(canStepForward ? [{ name: 'increment', label: 'Next period' }] : []),
          ]}
          onAccessibilityAction={(e) => {
            if (e.nativeEvent.actionName === 'decrement') onStep(-1);
            else if (e.nativeEvent.actionName === 'increment' && canStepForward) onStep(1);
          }}
        >
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

        {(spentShare || today || hasDue) && (
          <View style={styles.chips}>
            {spentShare && (
              <View style={styles.chip}>
                <Feather name="pie-chart" size={13} color={theme.colors.textSecondary} />
                <Text style={styles.chipText}>{spentShare} spent</Text>
              </View>
            )}
            {today && (
              <View style={[styles.chip, todayOverMinor > 0 && styles.chipOver]}>
                <Feather
                  name="clock"
                  size={13}
                  color={todayOverMinor > 0 ? theme.colors.expenseText : theme.colors.textSecondary}
                />
                <Text style={[styles.chipText, todayOverMinor > 0 && styles.chipTextOver]} numberOfLines={1}>
                  {todayOverMinor > 0
                    ? `${formatMoney(today.spentMinor)} today · ${formatMoney(todayOverMinor)} over`
                    : `${formatMoney(today.spentMinor)} of ${formatMoney(today.goalMinor)} today`}
                </Text>
              </View>
            )}
            {hasDue && (
              <Pressable
                onPress={() => {
                  haptics.tap();
                  setShowWorking((v) => !v);
                }}
                style={withPressed([styles.chip, styles.dueChip])}
                hitSlop={5}
                accessibilityRole="button"
                accessibilityState={{ expanded: showWorking }}
                accessibilityLabel={`${formatMoney(displayed.dueMinor)} still to pay this month`}
                accessibilityHint="Shows how this adds up"
              >
                <View style={styles.dueDot} />
                <Text style={styles.dueText} numberOfLines={1}>
                  {formatMoney(displayed.dueMinor)} still to pay
                </Text>
                <Feather
                  name={showWorking ? 'chevron-up' : 'chevron-down'}
                  size={12}
                  color={theme.colors.dueInk}
                />
              </Pressable>
            )}
          </View>
        )}

        {pace && (
          <View style={styles.pace}>
            <Feather name="trending-up" size={14} color={theme.colors.textMuted} />
            <Text style={styles.paceText} numberOfLines={1}>
              On pace for about {formatMoney(Math.round(pace.projectedMinor / 10000) * 10000)} by{' '}
              {pace.byLabel}
            </Text>
          </View>
        )}

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
      </ReanimatedAnimated.View>

      <HeroActions />
    </Glass>
  );
}

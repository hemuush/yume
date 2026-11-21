import { useEffect, useRef, useState } from 'react';
import { PanResponder } from 'react-native';
import {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  runOnJS,
  cancelAnimation,
} from 'react-native-reanimated';
import { MOTION, timing } from '@/lib/animation';
import { haptics } from '@/lib/haptics';
import { useReduceMotion } from '@/hooks/useReduceMotion';

/** What the month card shows for one period. */
export interface HeroContent {
  spendingTrend?: {
    daily: { date: string; totalMinor: number }[];
    today: string;
    mode?: 'week' | 'month';
  } | null;
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
   * EMIs and bills still to pay this month (null outside the current month; 0 = none). The headline is free to use minus
   * this.
   */
  dueMinor: number | null;
  /** Which period these figures are for: a new period remounts the rolling figures instead of rolling them. */
  periodKey: string;
  today?: { spentMinor: number; goalMinor: number } | null;
  pace?: { projectedMinor: number; byLabel: string } | null;
}

/** How far a horizontal drag must travel before letting go changes the period. */
const SWIPE_STEP_PX = 60;

/**
 * How the month card turns its page. `displayed` lags the figures it is given: when the period changes the old
 * ones slide out first, then the new ones slide in (a `runId` guard stops a stale slide overwriting a newer one), and
 * `onPeriodDisplayed` is told which period is on show. A sideways drag on the card steps the period (`panHandlers`),
 * following the finger and settling back. Under reduced motion nothing slides.
 */
export function useHeroTurn({
  periodKey,
  direction,
  incomeMinor,
  spentMinor,
  savingsMinor,
  surplusMinor,
  carryMinor,
  dueMinor,
  today,
  pace,
  spendingTrend,
  onPeriodDisplayed,
  canStepForward,
  onStep,
}: HeroContent & {
  /** The way the period stepped: +1 forward, -1 back, 0 a plain fade. */
  direction: -1 | 0 | 1;
  onPeriodDisplayed?: (key: string) => void;
  canStepForward: boolean;
  /** -1 for the period before, 1 for the one after. */
  onStep: (dir: -1 | 1) => void;
}) {
  const reduce = useReduceMotion();
  const [displayed, setDisplayed] = useState<HeroContent>({
    incomeMinor,
    spentMinor,
    savingsMinor,
    surplusMinor,
    carryMinor,
    dueMinor,
    periodKey,
    today,
    pace,
    spendingTrend,
  });
  const prevPeriodKey = useRef(periodKey);
  const tx = useSharedValue(0);
  const dragX = useSharedValue(0);
  const opacity = useSharedValue(1);
  const runId = useRef(0);
  const displayedCallback = useRef(onPeriodDisplayed);
  useEffect(() => {
    displayedCallback.current = onPeriodDisplayed;
  }, [onPeriodDisplayed]);
  const todaySpent = today?.spentMinor;
  const todayGoal = today?.goalMinor;
  const paceProjected = pace?.projectedMinor;
  const paceLabel = pace?.byLabel;
  const trendDaily = spendingTrend?.daily;
  const trendToday = spendingTrend?.today;
  const trendMode = spendingTrend?.mode;

  useEffect(() => {
    const myRun = ++runId.current;
    let active = true;
    cancelAnimation(tx);
    cancelAnimation(opacity);
    const next: HeroContent = {
      incomeMinor,
      spentMinor,
      savingsMinor,
      surplusMinor,
      carryMinor,
      dueMinor,
      periodKey,
      spendingTrend:
        trendDaily && trendToday ? { daily: trendDaily, today: trendToday, mode: trendMode } : null,
      today:
        todaySpent != null && todayGoal != null ? { spentMinor: todaySpent, goalMinor: todayGoal } : null,
      pace:
        paceProjected != null && paceLabel != null
          ? { projectedMinor: paceProjected, byLabel: paceLabel }
          : null,
    };
    const isPeriodTurn = prevPeriodKey.current !== periodKey;
    prevPeriodKey.current = periodKey;

    if (!isPeriodTurn || reduce) {
      tx.value = 0;
      opacity.value = 1;
      setDisplayed(next);
      displayedCallback.current?.(next.periodKey);
      return () => {
        active = false;
        cancelAnimation(tx);
        cancelAnimation(opacity);
      };
    }
    const outX = direction > 0 ? -18 : direction < 0 ? 18 : 0;
    const inX = direction > 0 ? 18 : direction < 0 ? -18 : 0;
    const commit = () => {
      if (!active || runId.current !== myRun) return;
      setDisplayed(next);
      displayedCallback.current?.(next.periodKey);
      tx.value = inX;
      tx.value = withTiming(0, inCfg);
      opacity.value = withTiming(1, inCfg);
    };
    // Built on the JS thread: the completion callback runs on the UI thread, where calling a JS helper like
    // `timing()` crashes the app. A config object can be captured into the worklet; a function call can't.
    const outCfg = timing(MOTION.slideOut);
    const inCfg = timing(MOTION.slideIn);
    opacity.value = withTiming(0, outCfg);
    tx.value = withTiming(outX, outCfg, (finished) => {
      if (!finished) return;
      runOnJS(commit)();
    });
    return () => {
      active = false;
      cancelAnimation(tx);
      cancelAnimation(opacity);
    };
  }, [
    periodKey,
    direction,
    incomeMinor,
    spentMinor,
    savingsMinor,
    surplusMinor,
    carryMinor,
    dueMinor,
    todaySpent,
    todayGoal,
    paceProjected,
    paceLabel,
    trendDaily,
    trendToday,
    trendMode,
    reduce,
    opacity,
    tx,
  ]);
  useEffect(() => {
    cancelAnimation(dragX);
    if (reduce) dragX.value = 0;
    return () => cancelAnimation(dragX);
  }, [reduce, dragX]);

  const slideStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: tx.value + dragX.value }],
    opacity: opacity.value,
  }));
  // The second card turns its page with the first (one animated style can't drive two views).
  const rhythmSlideStyle = useAnimatedStyle(() => ({
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

  return { displayed, slideStyle, rhythmSlideStyle, panHandlers: pan.panHandlers };
}

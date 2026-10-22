import { useEffect, useRef, useState } from 'react';
import { View, Pressable, PanResponder } from 'react-native';
import { Text } from '@/components/Text';
import Feather from '@expo/vector-icons/Feather';
import ReanimatedAnimated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  runOnJS,
  cancelAnimation,
} from 'react-native-reanimated';
import { theme } from '@/constants/theme';
import { formatMoney, formatMaskableMoney } from '@/lib/money';
import { useReduceMotion } from '@/lib/useReduceMotion';
import { haptics } from '@/lib/haptics';
import { MOTION, timing, ROW_LAYOUT, ROW_EXIT, PANEL_ENTER } from '@/lib/animation';
import Svg, { Defs, RadialGradient, Stop, Circle } from 'react-native-svg';
import { useAccent } from '@/theme/AccentContext';
import { CountUpAmount } from '@/components/CountUpAmount';
import { usePrivacy } from '@/theme/PrivacyContext';
import { heroSlices, withoutSavings, heroPct } from './heroSlices';
import { daysLeftInMonth, monthElapsed, dailyAllowance } from './allowance';
import { HeroLegend, type LegendItem } from './HeroLegend';
import { AllowanceTile } from './AllowanceTile';
import { DURATIONS } from '@/lib/motionTimings';
import { styles } from './hero.styles';
import { WorkingRow } from './WorkingRow';
import { SpendBars } from './SpendBars';
import { MonthLine } from './MonthLine';
import { HeroActions } from './HeroActions';
import { withPressed } from '@/lib/pressed';

interface HeroContent {
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
/** The theme-coloured glow behind the card's top corner. */
const GLOW = 240;

/**
 * Home's compact month card: available money, an inline period footer and calculation disclosure,
 * with entry shortcuts below. Daily allowance and recent spending remain visible; recaps stay in the disclosure. Swipe it sideways
 * to step the period. `displayed` lags `periodKey` so the old figures slide out first; a `runId` guard stops
 * a stale slide overwriting a newer one.
 */
export function ThisMonthHero({
  periodKey,
  direction,
  period,
  renderPeriod,
  onPeriodDisplayed,
  canStepForward,
  onStep,
  incomeMinor,
  spentMinor,
  savingsMinor,
  surplusMinor,
  carryMinor = 0,
  dueMinor = null,
  today = null,
  pace = null,
  recaps = [],
  spendingTrend = null,
  onSeeInsights,
}: Omit<HeroContent, 'dueMinor' | 'carryMinor'> & {
  onSeeInsights?: (periodKey: string) => void;
  dueMinor?: number | null;
  carryMinor?: number;
  periodKey: string;
  direction: -1 | 0 | 1;
  /** The period control (the month pill), top right. */
  period?: React.ReactNode;
  renderPeriod?: (key: string) => React.ReactNode;
  onPeriodDisplayed?: (key: string) => void;
  canStepForward: boolean;
  /** -1 for the period before, 1 for the one after. */
  onStep: (dir: -1 | 1) => void;
  /** Today's spend against the daily goal — only when a goal is set and the current period is showing. */
  today?: { spentMinor: number; goalMinor: number } | null;
  recaps?: { key: string; label: string; onPress: () => void }[];
  /** Where this month's spending is heading (monthPace) — the current month only, from the 5th. */
  pace?: { projectedMinor: number; byLabel: string } | null;
}) {
  const reduce = useReduceMotion();
  const { accent } = useAccent();
  const { hideAmounts } = usePrivacy();
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
  // The sum behind "Free after bills", opened from the "still to pay" chip.
  const [showWorking, setShowWorking] = useState(false);
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

  // Carry-over joins the pool like income; a carried shortfall only lowers the headline. With "hide savings"
  // on, nothing may reveal savings.
  const poolMinor = displayed.incomeMinor + Math.max(0, displayed.carryMinor);
  const billsMinor = displayed.dueMinor ?? 0;
  const full = heroSlices(poolMinor, displayed.spentMinor, displayed.savingsMinor, billsMinor);
  const slices = hideAmounts ? withoutSavings(full) : full;

  // The headline: what's free to use, or by how much the month went over.
  const over = slices.overMinor > 0;
  // With bills still to come this month, what is free is counted after them.
  const hasDue = slices.hasIncome && !over && billsMinor > 0;
  const freeMinor = displayed.surplusMinor - (hasDue ? billsMinor : 0);
  const headLabel = over
    ? 'Over by'
    : hasDue
      ? freeMinor < 0
        ? 'Short after bills'
        : 'Free after bills'
      : 'Free to use';
  const headMinor = over ? slices.overMinor : freeMinor;
  const headNeg = over || freeMinor < 0;
  // Keep the caption about deductions; the disclosure retains the full income/carryover sum.
  const headCaption = !slices.hasIncome
    ? 'Add income to see what is free'
    : over
      ? 'more went out than came in'
      : displayed.surplusMinor < 0 && !hasDue
        ? 'below zero'
        : `after ${hasDue ? (hideAmounts ? 'deductions and bills' : 'spending, savings and bills') : hideAmounts ? 'deductions' : 'spending and savings'}`;

  const shownToday = displayed.today;
  const shownPace = displayed.pace;
  const hasRhythm = !!(displayed.spendingTrend || onSeeInsights);

  // The current month also gets a day-of-month tick on its line and what can be spent a day from here on.
  const now = new Date();
  const isCurrentMonth = displayed.periodKey === 'month:0';
  const daysLeft = daysLeftInMonth(now);
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const perDayMinor =
    isCurrentMonth && slices.hasIncome && !over ? dailyAllowance(freeMinor, daysLeft) : null;
  const legend: LegendItem[] = !slices.hasIncome
    ? []
    : [
        {
          key: 'spent',
          label: 'Spent',
          color: theme.colors.slice.spent,
          minor: displayed.spentMinor,
          share: heroPct(slices.spent),
        },
        ...(!hideAmounts && slices.saved > 0
          ? [
              {
                key: 'saved',
                label: 'Saved',
                color: theme.colors.slice.saved,
                minor: displayed.savingsMinor,
                share: heroPct(slices.saved),
              },
            ]
          : []),
        ...(displayed.dueMinor != null && billsMinor > 0
          ? [
              {
                key: 'due',
                label: 'Bills left',
                color: theme.colors.slice.due,
                minor: billsMinor,
                share: heroPct(slices.due ?? 0),
                onPress: () => {
                  haptics.tap();
                  setShowWorking((v) => !v);
                },
                expanded: showWorking,
              },
            ]
          : []),
        ...(!over && freeMinor > 0
          ? [
              {
                key: 'free',
                label: 'Free',
                color: theme.colors.slice.free,
                minor: freeMinor,
                share: heroPct(slices.free),
              },
            ]
          : []),
      ];

  return (
    <>
      <ReanimatedAnimated.View layout={ROW_LAYOUT} style={styles.card}>
        <View pointerEvents="none" style={styles.glow}>
          <Svg width={GLOW} height={GLOW}>
            <Defs>
              <RadialGradient id="homeGlow" cx="50%" cy="50%" r="50%">
                <Stop offset="0" stopColor={accent} stopOpacity={0.22} />
                <Stop offset="1" stopColor={accent} stopOpacity={0} />
              </RadialGradient>
            </Defs>
            <Circle cx={GLOW / 2} cy={GLOW / 2} r={GLOW / 2} fill="url(#homeGlow)" />
          </Svg>
        </View>
        <View style={styles.bar}>
          <View style={styles.headTitle}>
            <Text style={styles.headLabel}>{headLabel}</Text>
            {slices.hasIncome && (
              <Pressable
                onPress={() => {
                  haptics.tap();
                  setShowWorking((v) => !v);
                }}
                style={withPressed([styles.howLink, showWorking && styles.howLinkOn])}
                hitSlop={{ top: 6, bottom: 6, left: 8, right: 8 }}
                accessibilityRole="button"
                accessibilityState={{ expanded: showWorking }}
                accessibilityLabel="How this adds up"
              >
                <Feather name="info" size={17} color={theme.colors.link} />
              </Pressable>
            )}
          </View>
          {renderPeriod ? renderPeriod(displayed.periodKey) : period}
        </View>

        <ReanimatedAnimated.View style={[styles.body, slideStyle]} {...pan.panHandlers}>
          <View style={styles.heroRow}>
            <View
              style={styles.figure}
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
                // Show the real amount immediately, then interpolate later changes.
                <CountUpAmount
                  key={displayed.periodKey}
                  minor={headMinor}
                  duration={DURATIONS.rollUp}
                  style={[styles.headValue, headNeg && styles.headValueNeg]}
                  symbolStyle={styles.headSymbol}
                  numberOfLines={1}
                  adjustsFontSizeToFit
                />
              ) : (
                <Text style={styles.headValue}>—</Text>
              )}
            </View>
            {perDayMinor != null && (
              <AllowanceTile perDayMinor={perDayMinor} daysLeft={daysLeft} daysInMonth={daysInMonth} />
            )}
          </View>

          <Text
            style={styles.headCaption}
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
          >
            {headCaption}
          </Text>

          {slices.hasIncome && (
            <MonthLine
              slices={slices}
              hideSavings={hideAmounts}
              periodKey={displayed.periodKey}
              marker={isCurrentMonth ? { at: monthElapsed(now), day: now.getDate() } : null}
            />
          )}

          {/* The legend describes this period; total debt belongs in Plan. */}
          <HeroLegend items={legend} />

          {slices.hasIncome && showWorking && (
            <ReanimatedAnimated.View entering={PANEL_ENTER} exiting={ROW_EXIT} style={styles.working}>
              <WorkingRow label="Income" value={formatMoney(displayed.incomeMinor)} />
              {displayed.carryMinor !== 0 && (
                <WorkingRow
                  label="Carried over"
                  value={`${displayed.carryMinor < 0 ? '−' : '+'}${formatMoney(Math.abs(displayed.carryMinor))}`}
                />
              )}
              <WorkingRow label="Spent" value={`−${formatMoney(displayed.spentMinor)}`} />
              <WorkingRow
                label="Set aside"
                value={
                  hideAmounts
                    ? `−${formatMaskableMoney(0, { masked: true })}`
                    : `${displayed.savingsMinor < 0 ? '+' : '−'}${formatMoney(Math.abs(displayed.savingsMinor))}`
                }
              />
              <WorkingRow label="Free to use" value={formatMoney(displayed.surplusMinor)} total />
              {hasDue && (
                <>
                  <WorkingRow label="Still to pay" value={`−${formatMoney(billsMinor)}`} due />
                  <WorkingRow label="After bills" value={formatMoney(freeMinor)} total />
                </>
              )}
              {shownPace && (
                <WorkingRow
                  label={`On pace by ${shownPace.byLabel}`}
                  value={`about ${formatMoney(Math.round(shownPace.projectedMinor / 10000) * 10000)}`}
                />
              )}
              {recaps.map((recap) => (
                <Pressable
                  key={recap.key}
                  onPress={recap.onPress}
                  accessibilityRole="button"
                  accessibilityLabel={`View ${recap.label} recap`}
                  style={withPressed(styles.link)}
                >
                  <Text style={styles.linkText}>View {recap.label} recap →</Text>
                </Pressable>
              ))}
            </ReanimatedAnimated.View>
          )}
        </ReanimatedAnimated.View>

        {hasRhythm && (
          <ReanimatedAnimated.View style={[styles.rhythm, rhythmSlideStyle]}>
            {displayed.spendingTrend && (
              <SpendBars
                daily={displayed.spendingTrend.daily}
                today={displayed.spendingTrend.today}
                periodMode={displayed.spendingTrend.mode}
                goalMinor={shownToday?.goalMinor ?? null}
                todaySpentMinor={shownToday?.spentMinor ?? null}
                onSeeInsights={onSeeInsights ? () => onSeeInsights(displayed.periodKey) : undefined}
              />
            )}
            {onSeeInsights && !displayed.spendingTrend && (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="See spending insights"
                onPress={() => onSeeInsights(displayed.periodKey)}
                style={withPressed(styles.insightsLink)}
              >
                <Text style={styles.insightsText}>See insights</Text>
                <Feather name="arrow-up-right" size={14} color={theme.colors.link} />
              </Pressable>
            )}
          </ReanimatedAnimated.View>
        )}
      </ReanimatedAnimated.View>
      <View style={styles.actions}>
        <HeroActions />
      </View>
    </>
  );
}

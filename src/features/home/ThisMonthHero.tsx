import { useEffect, useRef, useState } from 'react';
import { View, Pressable, PanResponder, useWindowDimensions } from 'react-native';
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
import { MOTION, timing } from '@/lib/animation';
import { CountUpAmount } from '@/components/CountUpAmount';
import { usePrivacy } from '@/theme/PrivacyContext';
import { heroSlices, withoutSavings } from './heroSlices';
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
  const { fontScale } = useWindowDimensions();
  const stackStats = fontScale > 1.2;
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
  const [showDailyWorking, setShowDailyWorking] = useState(false);
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
  const todayOverMinor = shownToday ? shownToday.spentMinor - shownToday.goalMinor : 0;

  const todayLeftMinor = shownToday ? shownToday.goalMinor - shownToday.spentMinor : 0;
  const todayPct = shownToday
    ? Math.max(0, Math.min(100, (shownToday.spentMinor / shownToday.goalMinor) * 100))
    : 0;
  const hasRhythm = !!(displayed.spendingTrend || shownToday || onSeeInsights);

  return (
    <>
      <View style={styles.card}>
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

          <Text
            style={styles.headCaption}
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
          >
            {headCaption}
          </Text>

          {slices.hasIncome && (
            <MonthLine slices={slices} hideSavings={hideAmounts} periodKey={displayed.periodKey} />
          )}

          {/* The legend describes this period; total debt belongs in Plan. */}
          <View style={styles.stats}>
            <Stat
              stacked={stackStats}
              label={displayed.periodKey.startsWith('month:') ? 'Spent this month' : 'Spent this year'}
              color={theme.colors.slice.spent}
              minor={displayed.spentMinor}
              periodKey={displayed.periodKey}
            />
            {!hideAmounts && (
              <Stat
                stacked={stackStats}
                label={displayed.periodKey.startsWith('month:') ? 'Saved this month' : 'Saved this year'}
                color={theme.colors.slice.saved}
                minor={displayed.savingsMinor}
                periodKey={displayed.periodKey}
              />
            )}
            {displayed.dueMinor != null && billsMinor > 0 && (
              <Stat
                stacked={stackStats}
                label="Bills left"
                color={theme.colors.slice.due}
                minor={billsMinor}
                periodKey={displayed.periodKey}
                onPress={
                  slices.hasIncome
                    ? () => {
                        haptics.tap();
                        setShowWorking((v) => !v);
                      }
                    : undefined
                }
                expanded={showWorking}
              />
            )}
          </View>

          {slices.hasIncome && showWorking && (
            <View style={styles.working}>
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
            </View>
          )}
        </ReanimatedAnimated.View>
      </View>

      {hasRhythm && (
        <ReanimatedAnimated.View style={[styles.rhythm, rhythmSlideStyle]}>
          {shownToday && (
            <>
              <Pressable
                onPress={() => setShowDailyWorking((open) => !open)}
                accessibilityRole="button"
                accessibilityLabel="How today’s allowance is calculated"
                accessibilityState={{ expanded: showDailyWorking }}
                style={styles.today}
              >
                <View style={styles.todayRow}>
                  <Text style={[styles.todayFigure, todayOverMinor > 0 && styles.todayFigureOver]}>
                    {todayOverMinor > 0
                      ? `${formatMoney(shownToday.spentMinor)} today · ${formatMoney(todayOverMinor)} over`
                      : `${formatMoney(todayLeftMinor)} left today`}
                  </Text>
                  <View style={styles.todayRight}>
                    {todayOverMinor <= 0 && (
                      <Text style={styles.chipText}>{formatMoney(shownToday.spentMinor)} spent today</Text>
                    )}
                    <Feather
                      name={showDailyWorking ? 'chevron-up' : 'chevron-down'}
                      size={14}
                      color={theme.colors.textSecondary}
                    />
                  </View>
                </View>
                {shownToday.goalMinor > 0 && (
                  <View style={styles.todayTrack}>
                    <View
                      testID="home-today-meter"
                      style={[
                        styles.todayFill,
                        // Outgoing expenses consume the saved limit; refunds never refill it.
                        { width: `${todayPct}%` },
                        todayOverMinor > 0 && styles.todayFillOver,
                      ]}
                    />
                  </View>
                )}
              </Pressable>
              {showDailyWorking && (
                <View style={styles.working}>
                  <WorkingRow label="Daily limit" value={formatMoney(shownToday.goalMinor)} />
                  <WorkingRow label="Expenses today" value={formatMoney(shownToday.spentMinor)} />
                  <Text style={styles.chipText}>
                    Refunds and income do not refill your daily limit. Transfers are excluded.
                  </Text>
                  {onSeeInsights && (
                    <Pressable
                      onPress={() => onSeeInsights(displayed.periodKey)}
                      accessibilityRole="button"
                      style={withPressed(styles.link)}
                    >
                      <Text style={styles.linkText}>View spending details →</Text>
                    </Pressable>
                  )}
                </View>
              )}
            </>
          )}

          {displayed.spendingTrend && (
            <View style={[styles.trend, shownToday && styles.trendBelowToday]}>
              <SpendBars
                daily={displayed.spendingTrend.daily}
                today={displayed.spendingTrend.today}
                periodMode={displayed.spendingTrend.mode}
                onSeeInsights={onSeeInsights ? () => onSeeInsights(displayed.periodKey) : undefined}
              />
            </View>
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
      <View style={styles.actions}>
        <HeroActions />
      </View>
    </>
  );
}

/** The compact period footer; a nonzero bill estimate also opens the calculation. */
function Stat({
  label,
  color,
  minor,
  periodKey,
  onPress,
  expanded,
  stacked = false,
}: {
  label: string;
  color: string;
  minor: number;
  periodKey: string;
  onPress?: () => void;
  expanded?: boolean;
  stacked?: boolean;
}) {
  const Container = onPress ? Pressable : View;
  return (
    <Container
      onPress={onPress}
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityState={onPress ? { expanded } : undefined}
      accessibilityHint={onPress ? 'Shows how this adds up' : undefined}
      style={[styles.stat, stacked && styles.statStack, onPress && { minHeight: 44 }]}
      accessible
      accessibilityLabel={`${label}, ${formatMoney(minor)}`}
    >
      <View style={styles.statHead}>
        <View style={[styles.statDot, { backgroundColor: color }]} />
        <Text style={styles.statLabel}>{label}</Text>
      </View>
      {/* Show real figures immediately; later changes use the same short interpolation. */}
      <CountUpAmount
        key={periodKey}
        minor={minor}
        duration={DURATIONS.rollUp}
        style={styles.statValue}
        numberOfLines={1}
        adjustsFontSizeToFit
      />
    </Container>
  );
}

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
import { CountUpAmount } from '@/components/CountUpAmount';
import { usePrivacy } from '@/theme/PrivacyContext';
import { heroSlices, withoutSavings, heroPct } from './heroSlices';
import { daysLeftInMonth, dailyAllowance } from './allowance';
import { HeroLegend, type LegendItem } from './HeroLegend';
import { AllowanceTile } from './AllowanceTile';
import { styles } from './hero.styles';
import { WorkingRow } from './WorkingRow';
import { SpendBars } from './SpendBars';
import { MonthRing, type SliceKey } from './MonthRing';
import { HeroActions } from './HeroActions';
import { Section } from '@/components/Section';
import { weekBars, monthBars } from './spendBarData';
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
  // The slice of the month picked on the line or in the legend, tied to the period it was picked in.
  const [picked, setPicked] = useState<{ period: string; key: SliceKey } | null>(null);
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

  // The bar compares spending with income and positive carry. The headline must use Home's actual
  // balance, which also includes signed carry and money withdrawn from savings.
  const over = slices.overMinor > 0 && displayed.surplusMinor < 0;
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
  const headMinor = over ? -displayed.surplusMinor : freeMinor;
  const headNeg = over || freeMinor < 0;
  // Keep the caption about deductions; the disclosure retains the full income/carryover sum.
  const headCaption = !slices.hasIncome
    ? 'Add income to see what is free'
    : over
      ? 'more went out than came in'
      : displayed.surplusMinor < 0 && !hasDue
        ? 'below zero'
        : `after ${hasDue ? (hideAmounts ? 'deductions and bills' : 'spending, savings and bills') : hideAmounts ? 'deductions' : 'spending and savings'}`;

  // A picked slice takes over the headline (label, figure and caption) until it is picked again, or the period
  // turns. A slice that is not on the line right now (savings while hidden, bills once paid) cannot be picked.
  const sliceShown: Record<SliceKey, boolean> = {
    spent: slices.hasIncome,
    saved: slices.hasIncome && !hideAmounts && slices.saved > 0,
    due: slices.hasIncome && billsMinor > 0,
    free: slices.hasIncome && !over && freeMinor > 0,
  };
  const focus: SliceKey | null =
    picked && picked.period === displayed.periodKey && sliceShown[picked.key] ? picked.key : null;
  const current = displayed.periodKey === 'month:0';
  const focused =
    focus === 'spent'
      ? {
          label: current ? 'Spent this month' : 'Spent',
          minor: displayed.spentMinor,
          caption: `${heroPct(slices.spent)} of what you had to spend`,
        }
      : focus === 'saved'
        ? {
            label: current ? 'Saved this month' : 'Saved',
            minor: displayed.savingsMinor,
            caption: `${heroPct(slices.saved)} of what you had to spend`,
          }
        : focus === 'due'
          ? { label: 'Bills still to pay', minor: billsMinor, caption: 'before the month ends' }
          : null;
  const pick = (key: SliceKey) => {
    haptics.tap();
    setPicked((prev) =>
      prev && prev.period === displayed.periodKey && prev.key === key
        ? null
        : { period: displayed.periodKey, key }
    );
  };
  const shownLabel = focused?.label ?? headLabel;
  const shownMinor = focused?.minor ?? headMinor;
  const shownNeg = !focused && headNeg;
  const shownCaption = focused?.caption ?? headCaption;

  const shownToday = displayed.today;
  const shownPace = displayed.pace;
  const weekMode = displayed.spendingTrend?.mode !== 'month';
  const trendTotalMinor = displayed.spendingTrend
    ? (weekMode ? weekBars : monthBars)(displayed.spendingTrend.daily, displayed.spendingTrend.today).reduce(
        (sum, bar) => sum + bar.totalMinor,
        0
      )
    : 0;

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
          onPress: () => pick('spent'),
          selected: focus === 'spent',
          hint: 'Shows spending in the headline',
        },
        ...(!hideAmounts && slices.saved > 0
          ? [
              {
                key: 'saved',
                label: 'Saved',
                color: theme.colors.slice.saved,
                minor: displayed.savingsMinor,
                share: heroPct(slices.saved),
                onPress: () => pick('saved'),
                selected: focus === 'saved',
                hint: 'Shows savings in the headline',
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
                  // Bills left also opens the sum behind the figure; picking it again closes both.
                  pick('due');
                  setShowWorking((v) => !v);
                },
                expanded: showWorking,
                selected: focus === 'due',
                hint: 'Shows how this adds up',
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
                onPress: () => pick('free'),
                selected: focus === 'free',
                hint: 'Shows what is free in the headline',
              },
            ]
          : []),
      ];

  return (
    <>
      <ReanimatedAnimated.View layout={ROW_LAYOUT} style={styles.card}>
        <View style={styles.bar}>
          <Text style={styles.headLabel}>{shownLabel}</Text>
          {renderPeriod ? renderPeriod(displayed.periodKey) : period}
        </View>

        <ReanimatedAnimated.View style={[styles.body, slideStyle]} {...pan.panHandlers}>
          <View style={styles.heroRow}>
            <MonthRing
              slices={slices}
              hideSavings={hideAmounts}
              dayShare={isCurrentMonth && slices.hasIncome ? now.getDate() / daysInMonth : null}
              focus={focus}
            >
              <View
                accessible
                accessibilityLabel={
                  slices.hasIncome
                    ? `${shownLabel}, ${formatMoney(shownMinor)}, ${shownCaption}`
                    : shownCaption
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
                style={styles.figure}
              >
                {slices.hasIncome ? (
                  <CountUpAmount
                    key={displayed.periodKey}
                    minor={shownMinor}
                    style={[styles.headValue, shownNeg && styles.headValueNeg]}
                    numberOfLines={1}
                    adjustsFontSizeToFit
                  />
                ) : (
                  <Text style={styles.headValue}>—</Text>
                )}
              </View>
            </MonthRing>
            <HeroLegend items={legend} stacked />
          </View>

          {perDayMinor != null && <AllowanceTile perDayMinor={perDayMinor} daysLeft={daysLeft} />}

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

          <View style={styles.footer}>
            {slices.hasIncome && (
              <Pressable
                onPress={() => {
                  haptics.tap();
                  setShowWorking((v) => !v);
                }}
                style={withPressed(styles.howLink)}
                accessibilityRole="button"
                accessibilityState={{ expanded: showWorking }}
                accessibilityLabel="How this adds up"
              >
                <Text style={styles.howLinkText}>How it adds up</Text>
                <Feather
                  name={showWorking ? 'chevron-up' : 'chevron-down'}
                  size={14}
                  color={theme.colors.link}
                />
              </Pressable>
            )}
            <Text
              style={styles.headCaption}
              accessibilityElementsHidden
              importantForAccessibility="no-hide-descendants"
            >
              {shownCaption}
            </Text>
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
          </View>
        </ReanimatedAnimated.View>
      </ReanimatedAnimated.View>
      <View style={styles.actions}>
        <HeroActions />
      </View>
      {/* The week's spending has its own card, so the figure above keeps the summary card to itself. */}
      {displayed.spendingTrend && (
        <Section
          compact
          title={weekMode ? 'This week' : 'Spending by week'}
          // A past month names no total here: the bars count money out before refunds, so it could
          // disagree with the card's net Spent figure above.
          subtitle={weekMode ? `${formatMoney(trendTotalMinor)} spent in 7 days` : undefined}
          onSeeAll={onSeeInsights ? () => onSeeInsights(displayed.periodKey) : undefined}
          actionLabel="Insights"
        >
          <ReanimatedAnimated.View style={[styles.rhythm, rhythmSlideStyle]}>
            <SpendBars
              daily={displayed.spendingTrend.daily}
              today={displayed.spendingTrend.today}
              periodMode={displayed.spendingTrend.mode}
              goalMinor={shownToday?.goalMinor ?? null}
              todaySpentMinor={shownToday?.spentMinor ?? null}
            />
          </ReanimatedAnimated.View>
        </Section>
      )}
    </>
  );
}

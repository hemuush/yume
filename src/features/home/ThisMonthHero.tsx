import { useState } from 'react';
import { View, Pressable } from 'react-native';
import { Text } from '@/components/Text';
import Feather from '@expo/vector-icons/Feather';
import { SummaryGradient } from '@/components/SummaryGradient';
import ReanimatedAnimated from 'react-native-reanimated';
import { theme } from '@/constants/theme';
import { formatMoney, formatMaskableMoney } from '@/lib/money';
import { haptics } from '@/lib/haptics';
import { ROW_LAYOUT, ROW_EXIT, PANEL_ENTER } from '@/lib/animation';
import { CountUpAmount } from '@/components/CountUpAmount';
import { JustAddedGlow } from '@/components/JustAddedGlow';
import { usePrivacy } from '@/theme/PrivacyContext';
import { useStacked } from '@/lib/useStacked';
import { heroSlices, withoutSavings, heroPct } from './heroSlices';
import { daysLeftInMonth, dailyAllowance } from './allowance';
import { HeroLegend, type LegendItem } from './HeroLegend';
import { AllowanceTile } from './AllowanceTile';
import { styles } from './hero.styles';
import { useHeroTurn, type HeroContent } from './useHeroTurn';
import { WorkingRow } from './WorkingRow';
import { SpendBars } from './SpendBars';
import { HeroActions } from './HeroActions';
import { weekBars, monthBars } from './spendBarData';
import { withPressed } from '@/lib/pressed';

type SliceKey = 'spent' | 'saved' | 'due';

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
  todaySpentMinor = null,
  pace = null,
  recaps = [],
  spendingTrend = null,
  onSeeInsights,
  savedExpenseIds,
}: Omit<HeroContent, 'dueMinor' | 'carryMinor'> & {
  onSeeInsights?: (periodKey: string) => void;
  savedExpenseIds?: string[];
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
  /** What went out today (the current period only), shown against the daily figure under the headline. */
  todaySpentMinor?: number | null;
  recaps?: { key: string; label: string; onPress: () => void }[];
  /** Where this month's spending is heading (monthPace) — the current month only, from the 5th. */
  pace?: { projectedMinor: number; byLabel: string } | null;
}) {
  const { hideAmounts } = usePrivacy();
  const stacked = useStacked();
  const { displayed, slideStyle, rhythmSlideStyle, panHandlers } = useHeroTurn({
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
  });
  // The sum behind "Free after bills", opened from the "still to pay" chip.
  const [showWorking, setShowWorking] = useState(false);
  // The active view inside the unified card: This Month overview vs This Week rhythm.
  const [showSpending, setShowSpending] = useState(false);
  const showingWeek = showSpending && displayed.spendingTrend != null;
  const toggleSpending = () => {
    haptics.tap();
    setShowSpending((visible) => !visible);
  };
  // The slice of the month picked on the line or in the legend, tied to the period it was picked in.
  const [picked, setPicked] = useState<{ period: string; key: SliceKey } | null>(null);
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
  const hasDue = slices.hasIncome && billsMinor > 0;
  const freeMinor = displayed.surplusMinor - (hasDue ? billsMinor : 0);
  const headLabel = hasDue
    ? freeMinor < 0
      ? 'Short after bills'
      : 'Free after bills'
    : over
      ? 'Over by'
      : 'Free to use';
  const headMinor = over && !hasDue ? -displayed.surplusMinor : freeMinor;
  const headNeg = over || freeMinor < 0;
  // Keep the caption about deductions; the disclosure retains the full income/carryover sum.
  const headCaption = !slices.hasIncome
    ? 'Add income to see what is free'
    : over && !hasDue
      ? 'more went out than came in'
      : displayed.surplusMinor < 0 && !hasDue
        ? 'below zero'
        : `after ${hasDue ? (hideAmounts ? 'deductions and bills' : 'spending, savings and bills') : hideAmounts ? 'deductions' : 'spending and savings'}`;

  // A selected metric explains its figure without replacing the available balance.
  const sliceShown: Record<SliceKey, boolean> = {
    spent: slices.hasIncome,
    saved: slices.hasIncome && !hideAmounts && slices.saved > 0,
    due: slices.hasIncome && billsMinor > 0,
  };
  const focus: SliceKey | null =
    picked && picked.period === displayed.periodKey && sliceShown[picked.key] ? picked.key : null;
  const current = displayed.periodKey === 'month:0';
  const focused =
    focus === 'spent'
      ? {
          label: current ? 'Spent this month' : 'Spent',
          caption: `${heroPct(slices.spent)} of what you had to spend`,
        }
      : focus === 'saved'
        ? {
            label: current ? 'Saved this month' : 'Saved',
            caption: `${heroPct(slices.saved)} of what you had to spend`,
          }
        : focus === 'due'
          ? { label: 'Bills still to pay', caption: 'through month end, including arrears' }
          : null;
  const pick = (key: SliceKey) => {
    haptics.tap();
    setPicked((prev) =>
      prev && prev.period === displayed.periodKey && prev.key === key
        ? null
        : { period: displayed.periodKey, key }
    );
  };

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
          hint: 'Shows the spending share',
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
                hint: 'Shows the savings share',
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
                  setShowWorking((visible) => !visible);
                },
                expanded: showWorking,
                selected: focus === 'due',
                hint: 'Shows how this adds up',
              },
            ]
          : []),
      ];

  return (
    <ReanimatedAnimated.View layout={ROW_LAYOUT}>
      <ReanimatedAnimated.View style={styles.card} layout={ROW_LAYOUT}>
        <View style={styles.bar}>
          <Text
            style={styles.headLabel}
            accessibilityElementsHidden={!showingWeek}
            importantForAccessibility={showingWeek ? 'auto' : 'no'}
          >
            {showingWeek ? (weekMode ? 'Last 7 days' : 'Spending by week') : headLabel}
          </Text>
          {renderPeriod ? renderPeriod(displayed.periodKey) : period}
        </View>

        <View
          style={showingWeek && styles.hidden}
          accessibilityElementsHidden={showingWeek}
          importantForAccessibility={showingWeek ? 'no-hide-descendants' : 'auto'}
        >
          <ReanimatedAnimated.View style={[styles.body, slideStyle]} {...panHandlers}>
            <View style={styles.figure}>
              <SummaryGradient />
              {savedExpenseIds && <JustAddedGlow ids={savedExpenseIds} surface="homeBalance" />}
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
                  <CountUpAmount
                    key={displayed.periodKey}
                    minor={headMinor}
                    style={[styles.headValue, headNeg && styles.headValueNeg]}
                    numberOfLines={stacked ? undefined : 1}
                    adjustsFontSizeToFit={!stacked}
                    minimumFontScale={0.75}
                  />
                ) : (
                  <Text style={styles.headValue}>—</Text>
                )}
              </View>
              {perDayMinor != null ? (
                <AllowanceTile
                  perDayMinor={perDayMinor}
                  daysLeft={daysLeft}
                  todaySpentMinor={isCurrentMonth ? todaySpentMinor : null}
                />
              ) : (
                <Text style={styles.figureCaption} accessibilityElementsHidden importantForAccessibility="no">
                  {headCaption}
                </Text>
              )}
            </View>
            {legend.length > 0 && <HeroLegend items={legend} />}
            {focused && (
              <ReanimatedAnimated.View key={focus} entering={PANEL_ENTER}>
                <Text style={styles.headCaption}>
                  {focused.label} · {focused.caption}
                </Text>
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
              {displayed.spendingTrend && (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={weekMode ? 'Last 7 days' : 'By week'}
                  onPress={toggleSpending}
                  style={withPressed(styles.insightsLink)}
                >
                  <Feather name="bar-chart-2" size={14} color={theme.colors.link} />
                  <Text style={styles.insightsText}>{weekMode ? 'Last 7 days' : 'By week'}</Text>
                </Pressable>
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
            </View>

            {/* Under the link that opens it, so the link stays where the finger is. */}
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
        </View>

        {/* WEEK VIEW CONTENT */}
        {displayed.spendingTrend && (
          <View
            style={!showingWeek && styles.hidden}
            accessibilityElementsHidden={!showingWeek}
            importantForAccessibility={showingWeek ? 'auto' : 'no-hide-descendants'}
          >
            <ReanimatedAnimated.View style={rhythmSlideStyle} {...panHandlers}>
              {weekMode && (
                <Text style={styles.weekTitle}>{formatMoney(trendTotalMinor)} spent in 7 days</Text>
              )}
              <SpendBars
                daily={displayed.spendingTrend.daily}
                today={displayed.spendingTrend.today}
                periodMode={displayed.spendingTrend.mode}
                goalMinor={shownToday?.goalMinor ?? null}
                todaySpentMinor={shownToday?.spentMinor ?? null}
              />
            </ReanimatedAnimated.View>
            <View style={styles.footer}>
              <Pressable
                accessibilityRole="button"
                onPress={toggleSpending}
                style={withPressed(styles.howLink)}
              >
                <Feather name="arrow-left" size={14} color={theme.colors.link} />
                <Text style={styles.howLinkText}>Overview</Text>
              </Pressable>
              {onSeeInsights && (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={weekMode ? 'Insights — Last 7 days' : 'Insights — Spending by week'}
                  onPress={() => onSeeInsights(displayed.periodKey)}
                  style={withPressed(styles.insightsLink)}
                >
                  <Text style={styles.insightsText}>Insights</Text>
                  <Feather name="arrow-up-right" size={14} color={theme.colors.link} />
                </Pressable>
              )}
            </View>
          </View>
        )}
      </ReanimatedAnimated.View>
      <HeroActions />
    </ReanimatedAnimated.View>
  );
}

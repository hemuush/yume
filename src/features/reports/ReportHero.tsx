import { useState } from 'react';
import { View, StyleSheet } from 'react-native';
import Animated, { useAnimatedProps } from 'react-native-reanimated';
import Svg, { Defs, LinearGradient, Stop, Line, Polygon, Polyline, Circle } from 'react-native-svg';
import { Text } from '@/components/Text';
import { Amount } from '@/components/Amount';
import { CountUpAmount } from '@/components/CountUpAmount';
import { ProgressRing } from '@/components/ProgressRing';
import { FrostChip } from '@/components/Frost';
import { screenStyles as h } from '@/components/screenStyles';
import { theme } from '@/constants/theme';
import { formatMoney } from '@/lib/money';
import { roundedMinor } from '@/lib/round';
import { useDrawnValue } from '@/lib/useDrawnValue';
import { useAccent } from '@/theme/AccentContext';
import { themeInk } from '@/theme/interactionColors';
import { useScrub } from './useScrub';

const AnimatedPolyline = Animated.createAnimatedComponent(Polyline);
const CHART_H = 124;
const PLOT_TOP = 36;
const PLOT_BOTTOM = 114;
const TIP_W = 118;

/** The line draws in from its first day once after app open and stays still on a revisit (useDrawnValue). */
function DrawnLine({ animKey, points, color }: { animKey: string; points: string; color: string }) {
  const coords = points.split(' ').map((p) => p.split(',').map(Number));
  let length = 0;
  for (let i = 1; i < coords.length; i++) {
    length += Math.hypot(coords[i][0] - coords[i - 1][0], coords[i][1] - coords[i - 1][1]);
  }
  length = Math.ceil(length) + 1;
  const draw = useDrawnValue(animKey, 1, 1000);
  const animatedProps = useAnimatedProps(() => ({ strokeDashoffset: length * (1 - draw.value) }));
  return (
    <AnimatedPolyline
      points={points}
      fill="none"
      stroke={color}
      strokeWidth={2.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeDasharray={length}
      animatedProps={animatedProps}
    />
  );
}

const money = (minor: number) => formatMoney(roundedMinor(minor));

/**
 * Reports' first card: what was spent, the running total against the period before (and the budget, when
 * there is one), scrubbable day by day, then income, what was kept and the budget used. The picked day is
 * shared with the heatmap below, so dragging either moves both.
 */
export function ReportHero({
  periodName,
  inProgress,
  spentMinor,
  perDayMinor,
  current,
  previous,
  labelAt,
  selected,
  onSelect,
  budgetMinor,
  projectedMinor,
  currentName,
  previousName,
  incomeMinor,
  previousIncomeMinor,
  comparedTo,
  animKey,
}: {
  periodName: string;
  inProgress: boolean;
  spentMinor: number;
  perDayMinor: number | null;
  /** Running spend per day of the period; null after today. */
  current: (number | null)[];
  /** Running spend per day of the period before, to the same scale. */
  previous: number[];
  labelAt: (index: number) => string;
  selected: number | null;
  onSelect: (index: number) => void;
  budgetMinor: number | null;
  /** Where the period ends at its pace so far; null when it is over. */
  projectedMinor: number | null;
  currentName: string;
  previousName: string;
  incomeMinor: number;
  previousIncomeMinor: number;
  comparedTo: string;
  animKey: string;
}) {
  const { accent } = useAccent();
  const ink = themeInk(accent);
  const [width, setWidth] = useState(0);
  const lastI = current.reduce<number>((acc, v, i) => (v != null ? i : acc), 0);
  const selI = Math.max(0, Math.min(lastI, selected ?? lastI));
  const scrub = useScrub({ count: lastI + 1, onPick: onSelect });
  // One scale for all three lines so they compare.
  const known = [...current.filter((v): v is number => v != null), ...previous, budgetMinor ?? 0];
  const top = Math.max(1, ...known) * 1.04;
  const y = (v: number) => PLOT_BOTTOM - (v / top) * (PLOT_BOTTOM - PLOT_TOP);
  const xOf = (i: number, n: number) => (n <= 1 ? 0 : (i / (n - 1)) * width);
  const mine = current
    .slice(0, lastI + 1)
    .map((v, i) => `${xOf(i, current.length).toFixed(1)},${y(v ?? 0).toFixed(1)}`);
  const ghost = previous.map((v, i) => `${xOf(i, previous.length).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
  const selX = xOf(selI, current.length);
  const selY = y(current[selI] ?? 0);
  const tipLeft = Math.max(0, Math.min(width - TIP_W, selX - TIP_W / 2));

  const underBy = budgetMinor != null ? budgetMinor - (projectedMinor ?? spentMinor) : null;
  const budgetChip =
    underBy != null
      ? `${money(Math.abs(underBy))} ${underBy >= 0 ? 'under' : 'over'} budget${projectedMinor != null ? ' at this pace' : ''}`
      : null;
  const kept = incomeMinor - spentMinor;
  const keptPct = incomeMinor > 0 ? Math.round((kept / incomeMinor) * 100) : null;
  const incomeChange =
    previousIncomeMinor > 0 ? Math.round((incomeMinor / previousIncomeMinor - 1) * 100) : null;
  const budgetPct = budgetMinor && budgetMinor > 0 ? Math.round((spentMinor / budgetMinor) * 100) : null;

  return (
    <>
      <View style={styles.card}>
        <Text style={styles.label}>{`Spent in ${periodName}${inProgress ? ' so far' : ''}`}</Text>
        <CountUpAmount
          minor={roundedMinor(spentMinor)}
          countFromZero
          style={styles.figure}
          symbolStyle={styles.symbol}
          numberOfLines={1}
          adjustsFontSizeToFit
        />
        <View style={styles.chips}>
          {budgetChip && <FrostChip tone={underBy! >= 0 ? 'ok' : 'bad'}>{budgetChip}</FrostChip>}
          {perDayMinor != null && perDayMinor > 0 && <FrostChip>{`${money(perDayMinor)} a day`}</FrostChip>}
        </View>

        <View
          style={styles.chart}
          onLayout={(e) => {
            setWidth(e.nativeEvent.layout.width);
            scrub.onLayout(e.nativeEvent.layout.width);
          }}
          {...scrub.panHandlers}
          accessible
          accessibilityRole="adjustable"
          accessibilityLabel={`Running spend, ${labelAt(selI)}: ${money(current[selI] ?? 0)}. Swipe to change day`}
          accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
          onAccessibilityAction={(e) =>
            onSelect(Math.max(0, Math.min(lastI, selI + (e.nativeEvent.actionName === 'increment' ? 1 : -1))))
          }
        >
          {width > 0 && (
            <>
              <Svg width={width} height={CHART_H} pointerEvents="none">
                <Defs>
                  <LinearGradient id="heroFill" x1="0" x2="0" y1="0" y2="1">
                    <Stop offset="0" stopColor={accent} stopOpacity={0.5} />
                    <Stop offset="1" stopColor={accent} stopOpacity={0} />
                  </LinearGradient>
                </Defs>
                {budgetMinor != null && budgetMinor > 0 && (
                  <Line
                    x1={0}
                    x2={width}
                    y1={y(budgetMinor)}
                    y2={y(budgetMinor)}
                    stroke={theme.colors.expenseText}
                    strokeOpacity={0.55}
                    strokeWidth={1.2}
                    strokeDasharray="2 4"
                  />
                )}
                <Polyline
                  points={ghost}
                  fill="none"
                  stroke={theme.colors.textMuted}
                  strokeOpacity={0.6}
                  strokeWidth={1.6}
                  strokeDasharray="3 4"
                  strokeLinecap="round"
                />
                <Polygon
                  points={`0,${PLOT_BOTTOM} ${mine.join(' ')} ${xOf(lastI, current.length)},${PLOT_BOTTOM}`}
                  fill="url(#heroFill)"
                />
                <DrawnLine animKey={`hero:${animKey}`} points={mine.join(' ')} color={ink} />
                <Line
                  x1={selX}
                  x2={selX}
                  y1={PLOT_TOP - 8}
                  y2={PLOT_BOTTOM + 2}
                  stroke={theme.colors.textMuted}
                  strokeOpacity={0.5}
                />
                <Circle
                  cx={selX}
                  cy={selY}
                  r={5.5}
                  fill={ink}
                  stroke={theme.colors.surface}
                  strokeWidth={2.5}
                />
              </Svg>
              <View style={[styles.tip, { left: tipLeft }]} pointerEvents="none">
                <Text style={styles.tipText} numberOfLines={1}>
                  {labelAt(selI)} · {money(current[selI] ?? 0)}
                </Text>
              </View>
            </>
          )}
        </View>
        <View style={styles.legend}>
          <View style={styles.legendItem}>
            <View style={[styles.legendKey, { backgroundColor: ink }]} />
            <Text style={styles.legendText}>{currentName}</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendKey, { backgroundColor: theme.colors.textMuted, opacity: 0.6 }]} />
            <Text style={styles.legendText}>{previousName}</Text>
          </View>
          {budgetMinor != null && budgetMinor > 0 && (
            <View style={styles.legendItem}>
              <View style={[styles.legendKey, { backgroundColor: theme.colors.expenseText }]} />
              <Text style={styles.legendText}>Budget {money(budgetMinor)}</Text>
            </View>
          )}
        </View>
      </View>

      <View style={styles.kpis}>
        <View style={styles.kpi}>
          <Text style={styles.kpiLabel}>Income</Text>
          <Amount
            minor={roundedMinor(incomeMinor)}
            style={styles.kpiValue}
            numberOfLines={1}
            adjustsFontSizeToFit
          />
          <Text
            style={[styles.kpiSub, incomeChange != null && incomeChange > 0 && styles.good]}
            numberOfLines={1}
          >
            {incomeChange != null && incomeChange !== 0
              ? `${incomeChange > 0 ? '↑' : '↓'} ${Math.abs(incomeChange)}% vs ${comparedTo}`
              : 'received'}
          </Text>
        </View>
        <View style={[styles.kpi, h.dividerLeft]}>
          <Text style={styles.kpiLabel}>Kept</Text>
          <Text style={[styles.kpiValue, kept < 0 && styles.bad]} numberOfLines={1} adjustsFontSizeToFit>
            {kept < 0 ? '−' : ''}
            {money(Math.abs(kept))}
          </Text>
          <Text style={[styles.kpiSub, kept >= 0 ? styles.good : styles.bad]} numberOfLines={1}>
            {keptPct != null ? `${keptPct}% of income` : 'income minus spending'}
          </Text>
        </View>
        <View style={[styles.kpi, h.dividerLeft]}>
          <Text style={styles.kpiLabel}>{budgetPct != null ? 'Budget used' : 'Biggest day'}</Text>
          {budgetPct != null ? (
            <>
              <Text style={styles.kpiValue} numberOfLines={1}>
                {budgetPct}%
              </Text>
              <Text style={[styles.kpiSub, budgetPct > 100 && styles.bad]} numberOfLines={1}>
                {money(Math.abs(budgetMinor! - spentMinor))} {budgetMinor! >= spentMinor ? 'left' : 'over'}
              </Text>
              <View style={styles.ring}>
                <ProgressRing
                  percent={Math.min(100, budgetPct)}
                  color={budgetPct > 100 ? theme.colors.expenseText : ink}
                  animKey={`hero-budget:${animKey}`}
                  size={30}
                  stroke={4}
                />
              </View>
            </>
          ) : (
            <>
              <Amount
                minor={roundedMinor(
                  Math.max(
                    0,
                    ...current.map((v, i) => (v == null ? 0 : v - (i > 0 ? (current[i - 1] ?? 0) : 0)))
                  )
                )}
                style={styles.kpiValue}
                numberOfLines={1}
                adjustsFontSizeToFit
              />
              <Text style={styles.kpiSub}>in one day</Text>
            </>
          )}
        </View>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  card: { ...h.card, marginBottom: 12, paddingHorizontal: 16, paddingTop: 14, paddingBottom: 12 },
  label: { fontFamily: theme.font.bodyMedium, fontSize: 13, color: theme.colors.textSecondary },
  figure: {
    fontFamily: theme.font.bodyLight,
    fontSize: theme.typeSize.headline,
    lineHeight: 40,
    letterSpacing: -1.1,
    color: theme.colors.textPrimary,
    fontVariant: ['tabular-nums'],
  },
  symbol: { fontFamily: theme.font.body, fontSize: 22, letterSpacing: 0, color: theme.colors.textMuted },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 6 },
  chart: { height: CHART_H, marginTop: 10 },
  tip: {
    position: 'absolute',
    top: 0,
    width: TIP_W,
    alignItems: 'center',
  },
  tipText: {
    overflow: 'hidden',
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 10,
    backgroundColor: theme.colors.ink,
    fontFamily: theme.font.bodyBold,
    fontSize: 12,
    color: theme.colors.surface,
    fontVariant: ['tabular-nums'],
  },
  legend: { flexDirection: 'row', flexWrap: 'wrap', gap: 14, marginTop: 8 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendKey: { width: 14, height: 3, borderRadius: 2 },
  legendText: { fontFamily: theme.font.body, fontSize: 12, color: theme.colors.textSecondary },
  kpis: { ...h.card, flexDirection: 'row', marginBottom: 12 },
  kpi: { flex: 1, minWidth: 0, minHeight: 80, paddingHorizontal: 14, paddingVertical: 12, gap: 2 },
  kpiLabel: { fontFamily: theme.font.body, fontSize: 12, color: theme.colors.textSecondary },
  kpiValue: {
    fontFamily: theme.font.bodyBold,
    fontSize: 15,
    color: theme.colors.textPrimary,
    fontVariant: ['tabular-nums'],
  },
  kpiSub: { fontFamily: theme.font.bodyBold, fontSize: 12, color: theme.colors.textMuted },
  good: { color: theme.colors.incomeText },
  bad: { color: theme.colors.expenseText },
  ring: { position: 'absolute', right: 10, top: 12 },
});

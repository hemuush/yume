import { useState } from 'react';
import { Animated, View, Pressable, useWindowDimensions } from 'react-native';
import { Text } from '@/components/Text';
import { theme } from '@/constants/theme';
import type { CashFlowPoint } from '@/db/reports';
import { formatMoney } from '@/lib/money';
import { roundedMinor } from '@/lib/round';
import { haptics } from '@/lib/haptics';
import { CountUpAmount } from '@/components/CountUpAmount';
import { useGrowFrom } from '@/lib/useGrowFrom';
import { withPressed } from '@/lib/pressed';
import { MIN_TREND_POINTS } from './TrendChart';
import { cashFlowReadLine, keptOf, keptSummary } from './reportsInsights';
import { styles } from './reports.styles';

const BAR_MAX = 100;
/** Past this many months the amount under each bar no longer fits; the sentence still reads the picked one. */
const KEPT_PILL_MAX_POINTS = 8;

/** From this system font scale the summary strip stacks, so each figure keeps a full row. */
const STACK_STRIP_AT = 1.3;
const BAR_STAGGER_MS = 45;

/** One bar: grows from the baseline in turn, once after app open; glides if the figure changes. */
function FlowBar({
  animKey,
  heightPx,
  index,
  color,
  narrow,
  live,
}: {
  animKey: string;
  heightPx: number;
  index: number;
  color: string;
  narrow: boolean;
  live: boolean;
}) {
  const h = useGrowFrom(animKey, heightPx, { delay: index * BAR_STAGGER_MS });
  return (
    <Animated.View
      style={[
        styles.flowBar,
        styles.flowBarEdge,
        narrow && { width: 5 },
        { height: h, backgroundColor: color },
        live && styles.flowBarLive,
      ]}
    />
  );
}

const compact = (minor: number) => {
  const major = Math.abs(roundedMinor(minor)) / 100;
  const text = major >= 1000 ? `${(major / 1000).toFixed(1)}k` : `${Math.round(major)}`;
  return minor < 0 && major > 0 ? `−${text}` : text;
};

/**
 * Trends: income beside spending for each month, what was kept under each bar (tap one to read it) and a
 * summary of the finished months. Left out when there is no income to compare against.
 */
export function CashFlowCard({
  points,
  inProgress,
  monthLink,
}: {
  points: CashFlowPoint[];
  /** The last month is still going: its spending bar is dashed and its figures read "so far". */
  inProgress: boolean;
  /** For the picked month (its index and the point count): the month it stands for and how to open it; null if it can't be. */
  monthLink?: (index: number, count: number) => { name: string; open: () => void } | null;
}) {
  const [sel, setSel] = useState<number | null>(null);
  const { fontScale } = useWindowDimensions();
  if (points.length < MIN_TREND_POINTS || !points.some((p) => p.incomeMinor > 0)) return null;

  const lastI = points.length - 1;
  const selI = sel != null && sel <= lastI ? sel : lastI;
  const max = Math.max(1, ...points.map((p) => Math.max(p.incomeMinor, p.expenseMinor)));
  const summary = keptSummary(points, inProgress);
  const showKept = points.length <= KEPT_PILL_MAX_POINTS;
  const narrow = points.length > 12;
  const labelEvery = narrow ? 3 : 1;
  const stacked = fontScale >= STACK_STRIP_AT;
  const divided = stacked ? styles.stripCellStacked : styles.stripCellDivided;
  const link = monthLink ? monthLink(selI, points.length) : null;
  const height = (v: number) => (v > 0 ? Math.max(3, (v / max) * BAR_MAX) : 0);
  const pick = (i: number) => {
    if (i === selI) return;
    haptics.tap();
    setSel(i);
  };

  return (
    <View style={styles.trendBlock}>
      <View style={styles.trendCard}>
        <View style={styles.trendHead}>
          <Text style={styles.trendTitle}>Money in and out</Text>
          <View style={styles.flowLegend}>
            <View style={styles.flowLegendItem}>
              <View style={[styles.flowLegendDot, { backgroundColor: theme.colors.primary }]} />
              <Text style={styles.flowLegendText}>In</Text>
            </View>
            <View style={styles.flowLegendItem}>
              <View style={[styles.flowLegendDot, { backgroundColor: theme.colors.spentSoft }]} />
              <Text style={styles.flowLegendText}>Out</Text>
            </View>
          </View>
        </View>
        <View style={styles.flowChart}>
          {points.map((p, i) => {
            const on = i === selI;
            const live = inProgress && i === lastI;
            const kept = keptOf(p);
            const keptWord = kept < 0 ? 'overspent' : 'kept';
            return (
              <Pressable
                key={i}
                onPress={() => pick(i)}
                style={withPressed([styles.flowCol, on && styles.flowColOn])}
                accessibilityRole="button"
                accessibilityLabel={`${p.label}${live ? ' so far' : ''}, ${formatMoney(roundedMinor(p.incomeMinor))} in, ${formatMoney(roundedMinor(p.expenseMinor))} out, ${keptWord} ${formatMoney(roundedMinor(Math.abs(kept)))}`}
                accessibilityState={{ selected: on }}
              >
                <View style={styles.flowBars}>
                  <FlowBar
                    animKey={`flow:${p.label}:${i}:in`}
                    heightPx={height(p.incomeMinor)}
                    index={i}
                    color={theme.colors.primary}
                    narrow={narrow}
                    live={false}
                  />
                  <FlowBar
                    animKey={`flow:${p.label}:${i}:out`}
                    heightPx={height(p.expenseMinor)}
                    index={i}
                    color={theme.colors.spentSoft}
                    narrow={narrow}
                    live={live}
                  />
                </View>
                <Text style={[styles.flowLabel, on && styles.flowLabelOn]} numberOfLines={1}>
                  {(lastI - i) % labelEvery === 0 ? p.label : ''}
                </Text>
                {showKept && (
                  <View
                    style={[styles.flowKept, kept < 0 && styles.flowKeptNeg, live && styles.flowKeptLive]}
                  >
                    <Text style={[styles.flowKeptText, kept < 0 && styles.flowKeptTextNeg]} numberOfLines={1}>
                      {compact(kept)}
                    </Text>
                  </View>
                )}
              </Pressable>
            );
          })}
        </View>
        {showKept && <Text style={styles.flowKeptCaption}>Kept each month</Text>}
        <Text style={styles.trendRead}>
          {cashFlowReadLine(points[selI], inProgress && selI === lastI, summary?.usualRatePct ?? null)}
        </Text>
        {link && (
          <Pressable
            onPress={link.open}
            hitSlop={8}
            style={withPressed(styles.trendLink)}
            accessibilityRole="link"
          >
            <Text style={styles.trendLinkText}>Open {link.name} in Reports ›</Text>
          </Pressable>
        )}
      </View>
      {summary && (
        <View style={[styles.stripCard, stacked && styles.stripCardStack]}>
          <View style={styles.stripCell}>
            <Text style={styles.stripLabel} numberOfLines={1}>
              Avg kept
            </Text>
            <CountUpAmount
              minor={roundedMinor(summary.avgKeptMinor)}
              style={[
                styles.stripValue,
                { color: summary.avgKeptMinor < 0 ? theme.colors.expenseText : theme.colors.incomeText },
              ]}
              numberOfLines={1}
              adjustsFontSizeToFit
            />
            <Text style={styles.stripSub}>a month</Text>
          </View>
          <View style={[styles.stripCell, divided]}>
            <Text style={styles.stripLabel} numberOfLines={1}>
              Best month
            </Text>
            <CountUpAmount
              minor={roundedMinor(summary.best.keptMinor)}
              style={styles.stripValue}
              numberOfLines={1}
              adjustsFontSizeToFit
            />
            <Text style={styles.stripSub} numberOfLines={1}>
              {summary.best.label}
              {summary.best.ratePct != null ? `, ${summary.best.ratePct}% kept` : ''}
            </Text>
          </View>
          <View style={[styles.stripCell, divided]}>
            <Text style={styles.stripLabel} numberOfLines={1}>
              Months kept
            </Text>
            <Text style={styles.stripValue} numberOfLines={1}>
              {summary.inBlack} of {summary.months}
            </Text>
            <Text style={styles.stripSub}>finished months</Text>
          </View>
        </View>
      )}
    </View>
  );
}

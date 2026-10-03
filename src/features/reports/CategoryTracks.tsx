import { useState } from 'react';
import { View, Pressable } from 'react-native';
import Svg, { Circle, Line, Polyline } from 'react-native-svg';
import { Text } from '@/components/Text';
import { CategoryIcon } from '@/components/CategoryIcon';
import { theme } from '@/constants/theme';
import { formatMoney } from '@/lib/money';
import { roundedMinor } from '@/lib/round';
import { withPressed } from '@/lib/pressed';
import type { Category } from '@/types';
import type { CategoryAgainstUsual } from './reportsInsights';
import { styles } from './reports.styles';

/** Like every long list in Reports, this shows the first few and offers the rest. */
const TRACKS_SHOWN = 5;
const SPARK_W = 62;
const SPARK_H = 24;
const SPARK_PAD = 3;

function Sparkline({ values, usual, live }: { values: number[]; usual: number; live: boolean }) {
  const lo = Math.min(...values, usual);
  const hi = Math.max(...values, usual);
  const y = (v: number) => SPARK_H - SPARK_PAD - ((v - lo) / (hi - lo || 1)) * (SPARK_H - 2 * SPARK_PAD);
  const x = (i: number) => SPARK_PAD + (i * (SPARK_W - 2 * SPARK_PAD)) / Math.max(1, values.length - 1);
  const pts = (list: number[]) => list.map((v, i) => `${x(i)},${y(v)}`).join(' ');
  const last = values.length - 1;
  const stroke = {
    stroke: theme.colors.ink,
    strokeOpacity: 0.75,
    strokeWidth: 1.6,
    strokeLinecap: 'round' as const,
  };
  return (
    <Svg width={SPARK_W} height={SPARK_H} pointerEvents="none">
      <Line
        x1={SPARK_PAD}
        x2={SPARK_W - SPARK_PAD}
        y1={y(usual)}
        y2={y(usual)}
        stroke={theme.colors.textMuted}
        strokeWidth={1}
        strokeDasharray="2 3"
      />
      <Polyline
        points={pts(live ? values.slice(0, -1) : values)}
        fill="none"
        strokeLinejoin="round"
        {...stroke}
      />
      {live && (
        <Line
          x1={x(last - 1)}
          y1={y(values[last - 1])}
          x2={x(last)}
          y2={y(values[last])}
          strokeDasharray="2 3"
          {...stroke}
        />
      )}
      <Circle cx={x(last)} cy={y(values[last])} r={3} fill={theme.colors.ink} />
    </Svg>
  );
}

/**
 * Trends: each category's latest month beside its own earlier months, furthest over its usual first.
 * A row opens that category's page.
 */
export function CategoryTracks({
  rows,
  catById,
  inProgress,
  onOpen,
}: {
  rows: CategoryAgainstUsual[];
  catById: Map<string, Category>;
  /** The latest month is still going: amounts read "so far". */
  inProgress: boolean;
  onOpen: (categoryId: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  if (rows.length === 0) return null;
  const shown = expanded ? rows : rows.slice(0, TRACKS_SHOWN);
  const hidden = rows.length - TRACKS_SHOWN;
  const months = rows[0].totalsMinor.length;

  return (
    <View style={styles.tracksBlock}>
      <View style={styles.storyHead}>
        <Text style={styles.blockTitle}>Against your usual</Text>
        <Text style={styles.storyPos}>Last {months} months</Text>
      </View>
      <View style={styles.tracksCard}>
        {shown.map((r, i) => {
          const cat = catById.get(r.categoryId);
          const now = formatMoney(roundedMinor(r.nowMinor));
          const usual = formatMoney(roundedMinor(r.usualMinor));
          return (
            <Pressable
              key={r.categoryId}
              onPress={() => onOpen(r.categoryId)}
              style={withPressed([styles.trackRow, i === 0 && { borderTopWidth: 0 }])}
              accessibilityRole="button"
              accessibilityLabel={`${r.name}, ${now}${inProgress ? ' so far' : ''}, ${r.pct}% of your usual ${usual}. Open`}
            >
              <CategoryIcon name={cat?.icon ?? 'shape-outline'} color={cat?.color ?? r.color} />
              <View style={styles.trackMid}>
                <Text style={styles.trackName} numberOfLines={1}>
                  {r.name}
                </Text>
                <Text style={styles.trackSub} numberOfLines={1}>
                  {now}
                  {inProgress ? ' so far' : ''} · usual {usual}
                </Text>
              </View>
              <View style={styles.trackEnd}>
                <Sparkline values={r.totalsMinor} usual={r.usualMinor} live={inProgress} />
                <Text
                  style={[
                    styles.trackPct,
                    r.pct > 105 && styles.trackPctOver,
                    r.pct < 95 && styles.trackPctUnder,
                  ]}
                >
                  {r.pct}% of usual
                </Text>
              </View>
            </Pressable>
          );
        })}
        {hidden > 0 && (
          <Pressable
            onPress={() => setExpanded((v) => !v)}
            style={withPressed(styles.trackFoot)}
            accessibilityRole="button"
          >
            <Text style={styles.trackFootText}>
              {expanded
                ? `All ${rows.length} categories`
                : `${hidden} more ${hidden === 1 ? 'category' : 'categories'}`}
            </Text>
            <Text style={styles.trackFootLink}>{expanded ? 'Show less' : 'See all →'}</Text>
          </Pressable>
        )}
      </View>
      <Text style={styles.tracksNote}>The dashed line in each is that category's usual month.</Text>
    </View>
  );
}

import { useState } from 'react';
import { View, StyleSheet } from 'react-native';
import Svg, { Line, Polygon, Polyline, Circle } from 'react-native-svg';
import { Text } from '@/components/Text';
import { theme } from '@/constants/theme';
import { formatMoney } from '@/lib/money';
import { hexToRgba } from '@/lib/color';
import { weekdayDayMonth } from '@/lib/dateLabels';
import { useAccent } from '@/theme/AccentContext';
import { themeInk } from '@/theme/interactionColors';
import { useScrub } from '@/features/reports/useScrub';
import type { Runway } from './runway';

const H = 96;
const TOP = 10;
const BOTTOM = H - 8;

/**
 * The runway as a step line: the balance holds until something moves it, then steps. Touch and drag to read
 * any day (its balance after what moved that day); the readout under it names the payments.
 */
export function RunwayChart({ runway }: { runway: Runway }) {
  const { accent } = useAccent();
  const ink = themeInk(accent);
  const [width, setWidth] = useState(0);
  const days = runway.days;
  const n = days.length;
  const home = runway.short ? days.findIndex((d) => d.date === runway.short!.date) : -1;
  const [picked, setPicked] = useState<number | null>(null);
  const sel = Math.max(0, Math.min(n - 1, picked ?? (home >= 0 ? home : 0)));
  const scrub = useScrub({ count: n, onPick: setPicked });

  const values = [runway.startMinor, ...days.map((d) => d.afterMinor)];
  const hi = Math.max(1, ...values);
  const lo = Math.min(0, ...values);
  const y = (v: number) => TOP + (1 - (v - lo) / Math.max(1, hi - lo)) * (BOTTOM - TOP);
  const x = (i: number) => (n <= 1 ? 0 : (i / (n - 1)) * width);
  const pts: string[] = [];
  let prev = runway.startMinor;
  days.forEach((d, i) => {
    pts.push(`${x(i).toFixed(1)},${y(prev).toFixed(1)}`, `${x(i).toFixed(1)},${y(d.afterMinor).toFixed(1)}`);
    prev = d.afterMinor;
  });
  const day = days[sel];
  const moved = day.items.map(
    (it) => `${it.title} ${it.kind === 'income' ? '+' : '−'}${formatMoney(it.amountMinor)}`
  );

  return (
    <View>
      <View
        style={styles.chart}
        onLayout={(e) => {
          setWidth(e.nativeEvent.layout.width);
          scrub.onLayout(e.nativeEvent.layout.width);
        }}
        {...scrub.panHandlers}
        accessible
        accessibilityRole="adjustable"
        accessibilityLabel={`Balance on ${weekdayDayMonth(day.date)}: ${formatMoney(day.afterMinor)}. Swipe to change day`}
        accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
        onAccessibilityAction={(e) =>
          setPicked(Math.max(0, Math.min(n - 1, sel + (e.nativeEvent.actionName === 'increment' ? 1 : -1))))
        }
      >
        {width > 0 && n > 0 && (
          <Svg width={width} height={H} pointerEvents="none">
            <Polygon
              points={`0,${BOTTOM + 8} ${pts.join(' ')} ${width},${BOTTOM + 8}`}
              fill={hexToRgba(accent, 0.22)}
            />
            {lo < 0 && (
              <Line
                x1={0}
                x2={width}
                y1={y(0)}
                y2={y(0)}
                stroke={theme.colors.expenseText}
                strokeOpacity={0.6}
                strokeDasharray="3 4"
              />
            )}
            <Polyline
              points={pts.join(' ')}
              fill="none"
              stroke={ink}
              strokeWidth={2.2}
              strokeLinejoin="round"
              strokeLinecap="round"
            />
            <Line x1={x(sel)} x2={x(sel)} y1={0} y2={H} stroke={theme.colors.textMuted} strokeOpacity={0.5} />
            <Circle
              cx={x(sel)}
              cy={y(day.afterMinor)}
              r={6}
              fill={theme.colors.ink}
              stroke={theme.colors.surface}
              strokeWidth={2.5}
            />
          </Svg>
        )}
      </View>
      <View style={styles.read}>
        <View style={styles.readHead}>
          <Text style={styles.date}>{weekdayDayMonth(day.date)}</Text>
          <Text style={[styles.bal, day.afterMinor < 0 && { color: theme.colors.expenseText }]}>
            {formatMoney(day.afterMinor)}
          </Text>
        </View>
        <Text style={styles.moved}>{moved.length ? moved.join(' · ') : 'Nothing due'}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  chart: { height: H, marginTop: 12 },
  read: {
    marginTop: 10,
    borderRadius: 14,
    backgroundColor: theme.colors.surfaceAlt,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 2,
  },
  readHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 },
  date: {
    fontFamily: theme.font.bodyMedium,
    fontSize: theme.typeSize.row - 1,
    color: theme.colors.textSecondary,
  },
  bal: { fontFamily: theme.font.bodyBold, fontSize: 15, color: theme.colors.textPrimary },
  moved: { fontFamily: theme.font.body, fontSize: theme.typeSize.row - 1, color: theme.colors.textSecondary },
});

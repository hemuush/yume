import { View, Text, StyleSheet } from 'react-native';
import Svg, { Path, Circle } from 'react-native-svg';
import { theme } from '@/constants/theme';
import { useAccent } from '@/theme/AccentContext';

export interface TrendPoint {
  label: string;
  value: number;
}

// A hand-drawn wavy trend line with a filled area underneath and a dot on
// every point — the doodle system's answer to a plain line chart.
export function LineChartDoodle({
  points,
  width = 268,
  height = 90,
}: {
  points: TrendPoint[];
  width?: number;
  height?: number;
}) {
  const { accent } = useAccent();
  if (points.length === 0) return null;
  // min/max (not a 0-floor) so a series that dips negative — e.g. net worth
  // when debt outweighs assets — still scales within the visible chart area
  // instead of drawing off the top or bottom. Equivalent to the old
  // 0-to-max scaling whenever every value is already >= 0.
  const max = Math.max(0, ...points.map((p) => p.value));
  const min = Math.min(0, ...points.map((p) => p.value));
  const range = Math.max(1, max - min);
  const padX = 10;
  const padTop = 10;
  const padBottom = 4;
  const usableW = width - padX * 2;
  const usableH = height - padTop - padBottom;
  const step = points.length > 1 ? usableW / (points.length - 1) : 0;

  const coords = points.map((p, i) => ({
    x: padX + i * step,
    y: padTop + usableH - ((p.value - min) / range) * usableH,
  }));

  const linePath = coords.reduce((d, c, i) => (i === 0 ? `M ${c.x} ${c.y}` : `${d} L ${c.x} ${c.y}`), '');
  const fillPath = `${linePath} L ${coords[coords.length - 1].x} ${height} L ${coords[0].x} ${height} Z`;

  return (
    <View>
      <Svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`}>
        <Path d={fillPath} fill={theme.colors.flatBlue} opacity={0.3} />
        <Path
          d={linePath}
          fill="none"
          stroke={theme.colors.ink}
          strokeWidth={3}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {coords.map((c, i) => (
          <Circle
            key={i}
            cx={c.x}
            cy={c.y}
            r={i === coords.length - 1 ? 5.5 : 4}
            fill={i === coords.length - 1 ? accent : theme.colors.surface}
            stroke={theme.colors.ink}
            strokeWidth={2.5}
          />
        ))}
      </Svg>
      <View style={styles.labels}>
        {points.map((p) => (
          <Text key={p.label} style={styles.label}>
            {p.label}
          </Text>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  labels: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 },
  label: { fontFamily: theme.font.bodyBold, fontSize: 9.5, color: theme.colors.textMuted },
});

import { View, Text, StyleSheet } from 'react-native';
import Svg, { Path, Circle } from 'react-native-svg';
import { theme } from '@/constants/theme';

export interface DualTrendPoint {
  label: string;
  a: number;
  b: number;
}

/**
 * Two hand-drawn trend lines sharing one scale — used for income vs expense,
 * where a single LineChartDoodle series isn't enough. Separate from
 * LineChartDoodle rather than bolting a second series onto it, so the
 * existing single-series trend view can't regress.
 */
export function DualLineChartDoodle({
  points,
  colorA = theme.colors.income,
  colorB = theme.colors.expense,
  width = 268,
  height = 90,
}: {
  points: DualTrendPoint[];
  colorA?: string;
  colorB?: string;
  width?: number;
  height?: number;
}) {
  if (points.length === 0) return null;
  const max = Math.max(1, ...points.map((p) => Math.max(p.a, p.b)));
  const padX = 10;
  const padTop = 10;
  const padBottom = 4;
  const usableW = width - padX * 2;
  const usableH = height - padTop - padBottom;
  const step = points.length > 1 ? usableW / (points.length - 1) : 0;

  const toPath = (key: 'a' | 'b') => {
    const coords = points.map((p, i) => ({
      x: padX + i * step,
      y: padTop + usableH - (p[key] / max) * usableH,
    }));
    const d = coords.reduce((acc, c, i) => (i === 0 ? `M ${c.x} ${c.y}` : `${acc} L ${c.x} ${c.y}`), '');
    return { d, coords };
  };

  const lineA = toPath('a');
  const lineB = toPath('b');

  return (
    <View>
      <Svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`}>
        <Path
          d={lineA.d}
          fill="none"
          stroke={colorA}
          strokeWidth={3}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <Path
          d={lineB.d}
          fill="none"
          stroke={colorB}
          strokeWidth={3}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {lineA.coords.map((c, i) => (
          <Circle
            key={`a-${i}`}
            cx={c.x}
            cy={c.y}
            r={4}
            fill={colorA}
            stroke={theme.colors.ink}
            strokeWidth={1.5}
          />
        ))}
        {lineB.coords.map((c, i) => (
          <Circle
            key={`b-${i}`}
            cx={c.x}
            cy={c.y}
            r={4}
            fill={colorB}
            stroke={theme.colors.ink}
            strokeWidth={1.5}
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

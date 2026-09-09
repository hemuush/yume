import { View, Text, StyleSheet } from 'react-native';
import Svg, { Path, Circle } from 'react-native-svg';
import { theme } from '@/constants/theme';

export interface PieSlice {
  value: number;
  color: string;
}

function polar(cx: number, cy: number, r: number, angleDeg: number) {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

// A hand-drawn-style pie chart: flat color wedges each with their own black
// outline stroke (not one shared ring outline), plus a punched-out center
// circle showing the total — matches the doodle system's per-shape outlines.
export function PieChartDoodle({
  slices,
  size = 170,
  centerLabel,
  centerValue,
}: {
  slices: PieSlice[];
  size?: number;
  centerLabel: string;
  centerValue: string;
}) {
  const total = slices.reduce((s, x) => s + x.value, 0) || 1;
  const cx = size / 2;
  const cy = size / 2;
  const r = size / 2 - 4;
  // Cumulative start angle for each slice, precomputed so the map below stays
  // a pure transform (no accumulator mutated mid-render).
  const startAngles = slices.reduce<number[]>((acc, s, i) => {
    acc.push(i === 0 ? 0 : acc[i - 1] + (slices[i - 1].value / total) * 360);
    return acc;
  }, []);
  const paths = slices.map((s, i) => {
    const sweep = (s.value / total) * 360;
    const angle = startAngles[i];
    const start = polar(cx, cy, r, angle);
    const end = polar(cx, cy, r, angle + sweep);
    const largeArc = sweep > 180 ? 1 : 0;
    const d = `M ${cx} ${cy} L ${start.x} ${start.y} A ${r} ${r} 0 ${largeArc} 1 ${end.x} ${end.y} Z`;
    return { d, color: s.color, key: i };
  });
  const innerR = r * 0.42;

  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {paths.map((p) => (
          <Path
            key={p.key}
            d={p.d}
            fill={p.color}
            stroke={theme.colors.ink}
            strokeWidth={2.5}
            strokeLinejoin="round"
          />
        ))}
        <Circle
          cx={cx}
          cy={cy}
          r={innerR}
          fill={theme.colors.surface}
          stroke={theme.colors.ink}
          strokeWidth={3}
        />
      </Svg>
      <View
        style={[
          styles.center,
          { width: innerR * 2, height: innerR * 2, left: cx - innerR, top: cy - innerR },
        ]}
        pointerEvents="none"
      >
        <Text style={styles.centerValue} numberOfLines={1} adjustsFontSizeToFit>
          {centerValue}
        </Text>
        <Text style={styles.centerLabel}>{centerLabel}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { position: 'absolute', alignItems: 'center', justifyContent: 'center' },
  centerValue: { fontFamily: theme.font.display, fontSize: 15, color: theme.colors.textPrimary },
  centerLabel: { fontFamily: theme.font.body, fontSize: 9, color: theme.colors.textMuted, marginTop: 1 },
});

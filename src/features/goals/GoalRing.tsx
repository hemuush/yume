import Svg, { Circle, Text as SvgText } from 'react-native-svg';
import { theme } from '@/constants/theme';

/**
 * A goal's progress as a ring — 0-100%, or a checkmark once it's reached (or
 * passed) its target. `percent` is expected pre-clamped to [0, 100] by the
 * caller; this component only draws, it doesn't decide what "done" means.
 */
export function GoalRing({
  percent,
  color,
  size = 44,
  done = false,
}: {
  percent: number;
  color: string;
  size?: number;
  done?: boolean;
}) {
  const strokeWidth = size * 0.11;
  const r = size / 2 - strokeWidth / 2 - 1;
  const c = size / 2;
  const circumference = 2 * Math.PI * r;
  const offset = circumference * (1 - Math.max(0, Math.min(100, percent)) / 100);

  return (
    <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <Circle cx={c} cy={c} r={r} fill="none" stroke={theme.colors.borderSoft} strokeWidth={strokeWidth} />
      <Circle
        cx={c}
        cy={c}
        r={r}
        fill="none"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        strokeLinecap="round"
        // Starts the ring at 12 o'clock instead of SVG's default 3 o'clock.
        transform={`rotate(-90 ${c} ${c})`}
      />
      <SvgText
        x={c}
        y={c + size * 0.09}
        textAnchor="middle"
        fontFamily={theme.font.mono}
        fontSize={size * 0.24}
        fill={theme.colors.ink}
      >
        {done ? '✓' : `${Math.round(Math.max(0, Math.min(100, percent)))}%`}
      </SvgText>
    </Svg>
  );
}

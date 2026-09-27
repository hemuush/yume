import { useEffect, useState } from 'react';
import { Animated } from 'react-native';
import Svg, { Circle, Text as SvgText } from 'react-native-svg';
import { theme } from '@/constants/theme';
import { useGrowFrom } from '@/lib/useGrowFrom';
import { DURATIONS } from '@/lib/motionTimings';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

function clampPct(percent: number): number {
  return Math.max(0, Math.min(100, percent));
}

/**
 * A goal's progress as a ring — 0-100%, or a checkmark once it's reached (or
 * passed) its target. `percent` is expected pre-clamped to [0, 100] by the
 * caller; this component only draws, it doesn't decide what "done" means.
 *
 * With `animKey` the ring fills from the value it last showed (useGrowFrom):
 * adding money makes it grow, and coming back to the screen moves nothing.
 */
export function GoalRing({
  percent,
  color,
  size = 44,
  done = false,
  animKey,
}: {
  percent: number;
  color: string;
  size?: number;
  done?: boolean;
  /** e.g. `goal:<id>` — see useGrowFrom. Without it the ring is drawn plain. */
  animKey?: string;
}) {
  if (animKey)
    return <GrowingRing percent={percent} color={color} size={size} done={done} animKey={animKey} />;
  return <RingSvg color={color} size={size} progress={clampPct(percent)} label={ringLabel(done, percent)} />;
}

function ringLabel(done: boolean, percent: number): string {
  return done ? '✓' : `${Math.round(clampPct(percent))}%`;
}

function GrowingRing({
  percent,
  color,
  size,
  done,
  animKey,
}: {
  percent: number;
  color: string;
  size: number;
  done: boolean;
  animKey: string;
}) {
  // Adding money is the moment here, so a change fills at the slower draw pace.
  const v = useGrowFrom(animKey, clampPct(percent), { changeMs: DURATIONS.draw });
  // The % label follows the ring as it fills, so the two never disagree.
  const [shown, setShown] = useState(clampPct(percent));
  useEffect(() => {
    const id = v.addListener(({ value }) => setShown(value));
    return () => v.removeListener(id);
  }, [v]);
  return <RingSvg color={color} size={size} progress={v} label={ringLabel(done && shown >= 99.5, shown)} />;
}

function RingSvg({
  color,
  size,
  progress,
  label,
}: {
  color: string;
  size: number;
  /** 0-100, plain or animated. */
  progress: number | Animated.Value;
  label: string;
}) {
  const strokeWidth = size * 0.11;
  const r = size / 2 - strokeWidth / 2 - 1;
  const c = size / 2;
  const circumference = 2 * Math.PI * r;
  const offset =
    typeof progress === 'number'
      ? circumference * (1 - progress / 100)
      : progress.interpolate({ inputRange: [0, 100], outputRange: [circumference, 0], extrapolate: 'clamp' });

  return (
    <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <Circle cx={c} cy={c} r={r} fill="none" stroke={theme.colors.borderSoft} strokeWidth={strokeWidth} />
      <AnimatedCircle
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
        {label}
      </SvgText>
    </Svg>
  );
}

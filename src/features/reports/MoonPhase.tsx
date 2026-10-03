import Svg, { Circle, Path } from 'react-native-svg';
import Animated, { FadeIn, ReduceMotion } from 'react-native-reanimated';
import { theme } from '@/constants/theme';
import { shade } from '@/lib/color';
import { DURATIONS } from '@/lib/motionTimings';

/**
 * Lune path covering exactly `k` of a circle's area (radius `r` at cx, cy), lit on the right: right half-circle
 * plus an ellipse arc (radius `a`); crescent for k < 0.5, gibbous for k > 0.5; k=0 empty, k=1 full disc.
 */
export function lunePath(cx: number, cy: number, r: number, k: number): string {
  const clamped = Math.max(0, Math.min(1, k));
  const a = r * Math.abs(1 - 2 * clamped);
  const sweepEllipse = clamped < 0.5 ? 0 : 1;
  return `M ${cx} ${cy - r} A ${r} ${r} 0 0 1 ${cx} ${cy + r} A ${a} ${r} 0 0 ${sweepEllipse} ${cx} ${cy - r} Z`;
}

/**
 * A disc split by illuminated fraction `litFraction` (0-1): the lit lune covers exactly that share of the
 * area, so it works as a proportion chart. Lit/dark are shades of the user's accent (`moonPhaseShades`).
 */
function moonPhaseShades(accent: string): { lit: string; dark: string } {
  return { lit: shade(accent, 45, 6), dark: shade(accent, 78, -4) };
}

export function MoonPhase({
  size = 150,
  litFraction,
  accent,
}: {
  size?: number;
  litFraction: number;
  /** The colour to derive both the lit and dark shade from — pass the user's accent. */
  accent: string;
}) {
  const { lit: litColor, dark: darkColor } = moonPhaseShades(accent);
  const r = size / 2 - 2;
  const c = size / 2;
  return (
    <Animated.View
      // Keyed by litFraction so a real period change re-triggers the reveal, while an unrelated re-render
      // with the same fraction doesn't replay it.
      key={litFraction}
      entering={FadeIn.duration(DURATIONS.draw).reduceMotion(ReduceMotion.System)}
    >
      <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <Circle cx={c} cy={c} r={r} fill={darkColor} />
        <Path d={lunePath(c, c, r, litFraction)} fill={litColor} />
        <Circle cx={c} cy={c} r={r} fill="none" stroke={theme.colors.ink} strokeWidth={1.5} opacity={0.25} />
      </Svg>
    </Animated.View>
  );
}

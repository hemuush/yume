import Svg, { Circle, Path } from 'react-native-svg';
import { theme } from '@/constants/theme';
import { shade } from '@/lib/color';

/**
 * The path for a lune (crescent/gibbous) covering exactly `k` of a circle's
 * area, radius `r` centred at (cx, cy), lit on the right. Standard
 * two-arc construction: the right half of the circle plus an ellipse arc
 * (horizontal radius `a`) back to the top, bulging the same side as the
 * circle for a crescent (k < 0.5, a shrinks the enclosed area toward 0) or
 * the opposite side for a gibbous (k > 0.5, a grows it toward the full
 * circle). Verified at the three checkpoints: k=0 → the two arcs coincide
 * (zero area); k=0.5 → the ellipse degenerates to a straight vertical line
 * (exactly the right half-circle); k=1 → the ellipse becomes the left
 * half-circle too (the full disc). Between those, the enclosed area is k
 * exactly — this is the same construction real moon-phase icons use.
 */
function lunePath(cx: number, cy: number, r: number, k: number): string {
  const clamped = Math.max(0, Math.min(1, k));
  const a = r * Math.abs(1 - 2 * clamped);
  const sweepEllipse = clamped < 0.5 ? 0 : 1;
  return `M ${cx} ${cy - r} A ${r} ${r} 0 0 1 ${cx} ${cy + r} A ${a} ${r} 0 0 ${sweepEllipse} ${cx} ${cy - r} Z`;
}

/**
 * A disc split by illuminated fraction `litFraction` (0-1) — the lit lune
 * covers exactly that share of the circle's area, not just its width, so it
 * doubles as an actual proportion chart rather than a mood illustration.
 *
 * Both the lit and dark regions are shades of the same accent hue (see
 * `moonPhaseShades`) rather than two unrelated fixed colours — the moon
 * should always sit in the same colour family as whatever accent the user
 * has actually picked, not clash with it.
 */
export function moonPhaseShades(accent: string): { lit: string; dark: string } {
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
    <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <Circle cx={c} cy={c} r={r} fill={darkColor} />
      <Path d={lunePath(c, c, r, litFraction)} fill={litColor} />
      <Circle cx={c} cy={c} r={r} fill="none" stroke={theme.colors.ink} strokeWidth={1.5} opacity={0.25} />
    </Svg>
  );
}

import { useId } from 'react';
import Svg, { Circle, Path, Defs, Mask, Rect } from 'react-native-svg';
import { theme } from '@/constants/theme';

interface Props {
  size?: number;
  /** 'color' = ink moon + sage/mint sprout; 'mono' = a single-colour silhouette. */
  tone?: 'color' | 'mono';
  color?: string;
}

/**
 * The Yume mark — the same crescent-moon-and-sprout as the app icon, drawn
 * from the shared path data so the two never drift. Used in the Home header,
 * Settings → About and the lock screen.
 */
export function YumeLogo({ size = 28, tone = 'color', color }: Props) {
  const raw = useId();
  const uid = raw.replace(/[^a-zA-Z0-9]/g, '');
  const mono = tone === 'mono';
  const solid = color ?? theme.colors.ink;
  const moon = mono ? solid : theme.colors.ink;
  const leafA = mono ? solid : theme.colors.primary;
  const leafB = mono ? solid : theme.colors.secondary;
  const stroke = mono ? solid : theme.colors.ink;
  const strokeW = mono ? 0 : 9;
  return (
    <Svg width={size} height={size} viewBox="0 0 512 512">
      <Defs>
        <Mask id={`ym${uid}`} maskUnits="userSpaceOnUse" x={-60} y={-60} width={632} height={632}>
          <Rect x={-60} y={-60} width={632} height={632} fill="#fff" />
          <Circle cx={374} cy={224} r={176} fill="#000" />
        </Mask>
      </Defs>
      <Circle cx={246} cy={258} r={190} fill={moon} mask={`url(#ym${uid})`} />
      <Path
        d="M232 356 C240 322 276 298 306 286"
        fill="none"
        stroke={stroke}
        strokeWidth={24}
        strokeLinecap="round"
      />
      <Path
        d="M306 296 Q308.34 221.22 252 172 Q249.66 246.78 306 296 Z"
        fill={leafA}
        stroke={stroke}
        strokeWidth={strokeW}
        strokeLinejoin="round"
      />
      <Path
        d="M306 296 Q378.04 263.15 380 184 Q307.96 216.85 306 296 Z"
        fill={leafB}
        stroke={stroke}
        strokeWidth={strokeW}
        strokeLinejoin="round"
      />
    </Svg>
  );
}

import Svg, { Ellipse, Circle, Path, Rect } from 'react-native-svg';
import { theme } from '@/constants/theme';
import { useAccent } from '@/theme/AccentContext';

interface Props {
  size?: number;
  pose?: 'default' | 'peek' | 'sleepy';
}

// Flynn — Yume's mascot (a round bird whose scarf matches the app's
// accent color), drawn once here in the same hand-outlined doodle style as
// the rest of the UI so every screen that shows him stays visually
// identical instead of drifting per-instance.
export function FlynnIllustration({ size = 90, pose = 'default' }: Props) {
  const { accent } = useAccent();
  const eyes =
    pose === 'sleepy' ? (
      <>
        <Path
          d="M37 33 Q42 37 47 33"
          stroke={theme.colors.ink}
          strokeWidth={3}
          fill="none"
          strokeLinecap="round"
        />
        <Path
          d="M53 33 Q58 37 63 33"
          stroke={theme.colors.ink}
          strokeWidth={3}
          fill="none"
          strokeLinecap="round"
        />
      </>
    ) : (
      <>
        <Circle cx={42} cy={32} r={4.2} fill={theme.colors.ink} />
        <Circle cx={58} cy={32} r={4.2} fill={theme.colors.ink} />
        <Circle cx={40.5} cy={30.3} r={1.2} fill={theme.colors.white} />
        <Circle cx={56.5} cy={30.3} r={1.2} fill={theme.colors.white} />
      </>
    );

  return (
    <Svg width={size} height={size} viewBox="0 0 100 100">
      {/* feet — matches the launcher icon's stubby webbed feet peeking out below the body */}
      <Path
        d="M38 84 Q35 90 40 90 Q43 90 43 86 Q46 90 49 89 Q47 84 44 83 Z"
        fill={theme.colors.gold}
        stroke={theme.colors.ink}
        strokeWidth={2.2}
        strokeLinejoin="round"
      />
      <Path
        d="M52 84 Q49 90 54 90 Q57 90 57 86 Q60 90 63 89 Q61 84 58 83 Z"
        fill={theme.colors.gold}
        stroke={theme.colors.ink}
        strokeWidth={2.2}
        strokeLinejoin="round"
      />
      {/* body */}
      <Ellipse
        cx={50}
        cy={64}
        rx={28}
        ry={24}
        fill={theme.colors.surface}
        stroke={theme.colors.ink}
        strokeWidth={3.5}
      />
      {/* wings */}
      <Path
        d="M27 60 Q13 55 10 39 Q26 40 33 52 Z"
        fill={theme.colors.flatPink}
        stroke={theme.colors.ink}
        strokeWidth={2.8}
        strokeLinejoin="round"
      />
      <Path
        d="M73 58 Q88 46 85 30 Q68 36 65 52 Z"
        fill={theme.colors.flatBlue}
        stroke={theme.colors.ink}
        strokeWidth={2.8}
        strokeLinejoin="round"
      />
      {/* scarf, tied like the launcher icon's neckerchief — a band plus a knotted tail hanging below it */}
      <Path
        d="M50 56 L42 68 L50 64 L58 68 Z"
        fill={accent}
        stroke={theme.colors.ink}
        strokeWidth={2.5}
        strokeLinejoin="round"
      />
      <Rect
        x={34}
        y={49}
        width={32}
        height={9}
        rx={4.5}
        fill={accent}
        stroke={theme.colors.ink}
        strokeWidth={2.5}
      />
      <Circle cx={50} cy={53.5} r={5} fill={accent} stroke={theme.colors.ink} strokeWidth={2.5} />
      {/* head */}
      <Circle
        cx={50}
        cy={32}
        r={20}
        fill={theme.colors.surface}
        stroke={theme.colors.ink}
        strokeWidth={3.5}
      />
      {/* hair tuft — the launcher icon's signature little flick on top */}
      <Path
        d="M46 13 Q48 5 54 8 Q58 10 55 14 Q60 13 60 18"
        fill="none"
        stroke={theme.colors.ink}
        strokeWidth={3}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {eyes}
      <Path
        d="M50 35 L60 39 L50 43 Z"
        fill={theme.colors.gold}
        stroke={theme.colors.ink}
        strokeWidth={2.2}
        strokeLinejoin="round"
      />
    </Svg>
  );
}

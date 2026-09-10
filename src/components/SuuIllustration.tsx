import { useId } from 'react';
import Svg, { Circle, Path, Rect, Defs, Mask, ClipPath, Text as SvgText } from 'react-native-svg';
import { theme } from '@/constants/theme';

interface Props {
  size?: number;
  pose?: 'default' | 'peek' | 'sleepy';
}

const INK = theme.colors.ink;
const SAGE = theme.colors.primary;
const MINT = theme.colors.secondary;

// Suu — Yume's mascot: a plump crescent-moon sprite, drawn in the same
// crescent-plus-leaf language as the app logo so the two stay visually of a
// piece. Body is a sage disc with a circular "bite" (via a mask); the concave
// edge gets its outline back through a clip-path. Only 'sleepy' differs from
// 'default' — 'peek' renders like 'default', matching the old mascot.
export function SuuIllustration({ size = 90, pose = 'default' }: Props) {
  const raw = useId();
  const uid = raw.replace(/[^a-zA-Z0-9]/g, '');
  const maskId = `suuBody${uid}`;
  const clipId = `suuClip${uid}`;
  const sleepy = pose === 'sleepy';

  return (
    <Svg width={size} height={size} viewBox="0 0 100 100">
      <Defs>
        <Mask id={maskId} maskUnits="userSpaceOnUse" x={-20} y={-20} width={140} height={140}>
          <Rect x={-20} y={-20} width={140} height={140} fill="#fff" />
          <Circle cx={80} cy={40} r={37} fill="#000" />
        </Mask>
        <ClipPath id={clipId}>
          <Circle cx={45} cy={55} r={40} />
        </ClipPath>
      </Defs>

      {/* crescent body + its outline */}
      <Circle cx={45} cy={55} r={40} fill={SAGE} stroke={INK} strokeWidth={2.6} mask={`url(#${maskId})`} />
      {/* outline along the concave (bitten) edge only */}
      <Circle
        cx={80}
        cy={40}
        r={37}
        fill="none"
        stroke={INK}
        strokeWidth={2.6}
        clipPath={`url(#${clipId})`}
      />

      {/* blush */}
      <Circle cx={25} cy={61} r={3.6} fill={MINT} opacity={0.85} />
      <Circle cx={51} cy={63} r={3.6} fill={MINT} opacity={0.85} />

      {/* eyes */}
      {sleepy ? (
        <>
          <Path d="M27 52 q4 4 8 0" fill="none" stroke={INK} strokeWidth={3} strokeLinecap="round" />
          <Path d="M43 54 q4 4 8 0" fill="none" stroke={INK} strokeWidth={3} strokeLinecap="round" />
        </>
      ) : (
        <>
          <Circle cx={31} cy={53} r={3.4} fill={INK} />
          <Circle cx={47} cy={55} r={3.4} fill={INK} />
          <Circle cx={29.8} cy={51.8} r={1} fill={theme.colors.white} />
          <Circle cx={45.8} cy={53.8} r={1} fill={theme.colors.white} />
        </>
      )}

      {/* mouth */}
      <Path
        d={sleepy ? 'M34 64 q5 3 10 1' : 'M33 63 q6 6 13 1'}
        fill="none"
        stroke={INK}
        strokeWidth={2.6}
        strokeLinecap="round"
      />

      {/* leaf sprouting from the top horn */}
      <Path
        d="M44 19 Q56.66 14.44 56 1 Q43.34 5.56 44 19 Z"
        fill={MINT}
        stroke={INK}
        strokeWidth={2.6}
        strokeLinejoin="round"
      />

      {sleepy && (
        <>
          <SvgText x={70} y={26} fontFamily={theme.font.roundedBold} fontSize={13} fill={INK}>
            z
          </SvgText>
          <SvgText x={79} y={17} fontFamily={theme.font.roundedBold} fontSize={9} fill={INK}>
            z
          </SvgText>
        </>
      )}
    </Svg>
  );
}

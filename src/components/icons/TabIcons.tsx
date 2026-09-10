import Svg, { Path, Circle, Rect } from 'react-native-svg';

// One consistent 1.8px rounded-stroke line-icon set, drawn for Yume rather
// than pulled from emoji or a generic icon font — emoji icons are one of the
// clearest "default template" signals a UI can give off.

interface IconProps {
  color: string;
  size?: number;
}

export function HomeIcon({ color, size = 22 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M4 11.5 12 4l8 7.5"
        stroke={color}
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M6 10v9a1 1 0 0 0 1 1h3v-5h4v5h3a1 1 0 0 0 1-1v-9"
        stroke={color}
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export function ActivityIcon({ color, size = 22 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Rect x="5" y="3" width="14" height="18" rx="2.4" stroke={color} strokeWidth="1.8" />
      <Path d="M8.5 8h7M8.5 12h7M8.5 16h4" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
    </Svg>
  );
}

export function LoanIcon({ color, size = 22 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M3 10 12 4l9 6"
        stroke={color}
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path d="M5 10v9M10 10v9M14 10v9M19 10v9" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
      <Path d="M3 19h18" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
    </Svg>
  );
}

export function ReportsIcon({ color, size = 22 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M5 20V11M12 20V4M19 20v-7"
        stroke={color}
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path d="M3 20h18" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
    </Svg>
  );
}

export function WalletIcon({ color, size = 22 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M3 8a2 2 0 0 1 2-2h13a1 1 0 0 1 1 1v2"
        stroke={color}
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <Rect x="3" y="8" width="18" height="12" rx="2.4" stroke={color} strokeWidth="1.8" />
      <Circle cx="16" cy="14" r="1.6" fill={color} />
    </Svg>
  );
}

export function MoreIcon({ color, size = 22 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx="5" cy="12" r="1.7" fill={color} />
      <Circle cx="12" cy="12" r="1.7" fill={color} />
      <Circle cx="19" cy="12" r="1.7" fill={color} />
    </Svg>
  );
}

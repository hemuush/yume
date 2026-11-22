import Svg, { Path, Rect } from 'react-native-svg';

// One consistent 1.8px rounded-stroke line-icon set drawn for Yume; emoji icons are a clear
// "default template" signal, so none are used.

interface IconProps {
  color: string;
  size?: number;
  /** The tab you are on: its shapes take a soft fill of their own colour, so it is told apart by more than colour. */
  active?: boolean;
}

/** The soft fill of an active tab's shapes. */
const FILL_OPACITY = 0.18;
const fillOf = (color: string, active?: boolean) => ({
  fill: active ? color : 'none',
  fillOpacity: active ? FILL_OPACITY : 0,
});

export function HomeIcon({ color, size = 22, active }: IconProps) {
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
        {...fillOf(color, active)}
        stroke={color}
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export function ActivityIcon({ color, size = 22, active }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Rect
        x="5"
        y="3"
        width="14"
        height="18"
        rx="2.4"
        stroke={color}
        strokeWidth="1.8"
        {...fillOf(color, active)}
      />
      <Path d="M8.5 8h7M8.5 12h7M8.5 16h4" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
    </Svg>
  );
}

/** Plan: four rounded tiles — the tab is a grid of everything you're planning. */
export function PlanIcon({ color, size = 22, active }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Rect
        x="4"
        y="4"
        width="7"
        height="7"
        rx="2"
        stroke={color}
        strokeWidth="1.8"
        {...fillOf(color, active)}
      />
      <Rect
        x="13"
        y="4"
        width="7"
        height="7"
        rx="2"
        stroke={color}
        strokeWidth="1.8"
        {...fillOf(color, active)}
      />
      <Rect
        x="4"
        y="13"
        width="7"
        height="7"
        rx="2"
        stroke={color}
        strokeWidth="1.8"
        {...fillOf(color, active)}
      />
      <Rect
        x="13"
        y="13"
        width="7"
        height="7"
        rx="3.5"
        stroke={color}
        strokeWidth="1.8"
        {...fillOf(color, active)}
      />
    </Svg>
  );
}

export function ReportsIcon({ color, size = 22, active }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M5 20V11M12 20V4M19 20v-7"
        stroke={color}
        strokeWidth={active ? 2.6 : 1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path d="M3 20h18" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
    </Svg>
  );
}

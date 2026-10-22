import { Animated, View, StyleSheet } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { theme } from '@/constants/theme';
import { useGrowFrom } from '@/lib/useGrowFrom';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

/**
 * A round progress mark with its label in the middle. The arc draws in once after app open, stays still on
 * revisit and glides on a real change (useGrowFrom). Decoration: put the figure in the row's own text.
 */
export function ProgressRing({
  percent,
  color,
  animKey,
  size = 48,
  stroke = 5,
  children,
}: {
  /** 0-100. */
  percent: number;
  color: string;
  /** Ring identity, e.g. `goal:<id>` (see useGrowFrom). */
  animKey: string;
  size?: number;
  stroke?: number;
  children?: React.ReactNode;
}) {
  const r = (size - stroke) / 2;
  const circumference = 2 * Math.PI * r;
  const filled = useGrowFrom(animKey, Math.min(100, Math.max(0, percent)));
  const dashOffset = filled.interpolate({
    inputRange: [0, 100],
    outputRange: [circumference, 0],
    extrapolate: 'clamp',
  });
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg
        width={size}
        height={size}
        style={StyleSheet.absoluteFill}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      >
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={theme.colors.trayTrack}
          strokeWidth={stroke}
          fill="none"
        />
        <AnimatedCircle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          fill="none"
          strokeDasharray={`${circumference} ${circumference}`}
          strokeDashoffset={dashOffset}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </Svg>
      {children}
    </View>
  );
}

import { View, Text } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { theme } from '@/constants/theme';
import { styles } from './reports.styles';

/**
 * A small circular progress ring for savings rate — color carries the same
 * income/expense meaning as everything else on this screen, not a new
 * arbitrary accent.
 */
export function SavingsRing({ pct, color, size = 40 }: { pct: number; color: string; size?: number }) {
  const strokeWidth = 4.5;
  const r = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * r;
  const offset = circumference - (Math.abs(pct) / 100) * circumference;
  return (
    <View style={{ width: size, height: size }}>
      <Svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        style={{ transform: [{ rotate: '-90deg' }] }}
      >
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={theme.colors.surfaceAlt}
          strokeWidth={strokeWidth}
          fill="none"
        />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={color}
          strokeWidth={strokeWidth}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={pct === 0 ? circumference : offset}
        />
      </Svg>
      <View style={styles.ringTextWrap} pointerEvents="none">
        <Text style={styles.ringText} numberOfLines={1} adjustsFontSizeToFit>
          {Math.round(pct)}%
        </Text>
      </View>
    </View>
  );
}

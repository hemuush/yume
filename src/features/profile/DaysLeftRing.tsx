import { View, StyleSheet } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { theme } from '@/constants/theme';

const SIZE = 48;
const STROKE = 3;
const R = (SIZE - STROKE) / 2;
const CIRC = 2 * Math.PI * R;
/** How long Recently deleted keeps an entry. */
const KEPT_DAYS = 30;
/** In the last week the ring turns coral. */
const LAST_WEEK = 7;

/**
 * A ring around a deleted entry's icon that empties as its 30 days run out, coral in the last week. Decoration:
 * the row's sub-line says the days left in words.
 */
export function DaysLeftRing({ daysLeft, children }: { daysLeft: number; children: React.ReactNode }) {
  const f = Math.max(0, Math.min(1, daysLeft / KEPT_DAYS));
  const color = daysLeft <= LAST_WEEK ? theme.colors.expense : theme.colors.ink;
  return (
    <View style={styles.wrap}>
      <Svg
        width={SIZE}
        height={SIZE}
        style={StyleSheet.absoluteFill}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      >
        <Circle
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={R}
          stroke="rgba(16,32,51,0.08)"
          strokeWidth={STROKE}
          fill="none"
        />
        {f > 0 && (
          <Circle
            cx={SIZE / 2}
            cy={SIZE / 2}
            r={R}
            stroke={color}
            strokeOpacity={0.35 + 0.65 * f}
            strokeWidth={STROKE}
            strokeLinecap="round"
            fill="none"
            strokeDasharray={`${CIRC * f} ${CIRC}`}
            transform={`rotate(-90 ${SIZE / 2} ${SIZE / 2})`}
          />
        )}
      </Svg>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { width: SIZE, height: SIZE, alignItems: 'center', justifyContent: 'center' },
});

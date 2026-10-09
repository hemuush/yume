import { View, StyleSheet } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { theme } from '@/constants/theme';
import { Category } from '@/types';
import type { DraftPart } from './splitDraft';

const SIZE = 104;
const STROKE = 14;
const R = (SIZE - STROKE) / 2;
const CIRC = 2 * Math.PI * R;
/** The gap between two slices, along the ring. */
const GAP = 3;

/**
 * The split page's ring: the payment as a donut, a slice per part as long as its share, in its category's
 * colour. Shares are of what's been split so far, so a split that runs over still reads as its parts.
 * Decoration: the rows and the legend say the same in words.
 */
export function SplitDonut({
  parts,
  amounts,
  categories,
}: {
  parts: DraftPart[];
  amounts: number[];
  categories: Category[];
}) {
  const slices = parts
    .map((p, i) => ({
      key: p.key,
      minor: amounts[i] ?? 0,
      color: categories.find((c) => c.id === p.categoryId)?.color ?? theme.colors.inkHairline,
    }))
    .filter((s) => s.minor > 0);
  const sum = slices.reduce((a, s) => a + s.minor, 0);
  const gap = slices.length > 1 ? GAP : 0;
  let from = 0;
  return (
    <View style={styles.wrap} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Svg width={SIZE} height={SIZE}>
        <Circle
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={R}
          stroke="rgba(16,32,51,0.06)"
          strokeWidth={STROKE}
          fill="none"
        />
        {sum > 0 &&
          slices.map((s) => {
            const len = (s.minor / sum) * CIRC;
            const el = (
              <Circle
                key={s.key}
                cx={SIZE / 2}
                cy={SIZE / 2}
                r={R}
                stroke={s.color}
                strokeWidth={STROKE}
                fill="none"
                strokeDasharray={`${Math.max(0.5, len - gap)} ${CIRC}`}
                strokeDashoffset={-from}
                transform={`rotate(-90 ${SIZE / 2} ${SIZE / 2})`}
              />
            );
            from += len;
            return el;
          })}
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { width: SIZE, height: SIZE },
});

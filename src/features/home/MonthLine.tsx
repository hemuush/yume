import { View } from 'react-native';
import { Text } from '@/components/Text';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';
import { theme } from '@/constants/theme';
import { useDrawnValue } from '@/lib/useDrawnValue';
import { DURATIONS } from '@/lib/motionTimings';
import { heroPct, type HeroSlices } from './heroSlices';
import { styles } from './hero.styles';

/**
 * The month as one rounded line: spent, saved, bills still to pay and free, in the colours of the legend below
 * it. It always fills the width, so with savings hidden the free share is shown against what is left rather
 * than leaving a gap the size of the savings. It draws in from the left once per period.
 */
export function MonthLine({
  slices,
  hideSavings,
  periodKey,
  marker,
}: {
  slices: HeroSlices;
  hideSavings: boolean;
  periodKey: string;
  /** Where today falls in the month, 0-1 and the date: a tick over the line (current month only). */
  marker?: { at: number; day: number } | null;
}) {
  const draw = useDrawnValue(`month-line:${periodKey}`, 1, DURATIONS.draw + 220);
  const drawStyle = useAnimatedStyle(() => ({ transform: [{ scaleX: draw.value }] }));
  const parts = [
    { key: 'spent', share: slices.spent, color: theme.colors.slice.spent },
    { key: 'saved', share: hideSavings ? 0 : slices.saved, color: theme.colors.slice.saved },
    { key: 'due', share: slices.due ?? 0, color: theme.colors.slice.due },
    { key: 'free', share: slices.free, color: theme.colors.slice.free },
  ].filter((part) => part.share > 0);
  const label = `Where the month went: spent ${heroPct(slices.spent)}${
    hideSavings ? '' : `, saved ${heroPct(slices.saved)}`
  }${slices.due ? `, bills ${heroPct(slices.due)}` : ''}, free ${heroPct(slices.free)}`;
  const line = (
    <Animated.View
      accessible
      accessibilityRole="image"
      accessibilityLabel={label}
      style={[styles.line, styles.lineOrigin, drawStyle]}
    >
      {parts.map((part) => (
        <View
          key={part.key}
          style={[styles.lineSegment, { flexGrow: part.share, flexBasis: 0, backgroundColor: part.color }]}
        />
      ))}
    </Animated.View>
  );
  if (!marker) return <View style={styles.lineWrap}>{line}</View>;
  // The tick sits outside the drawn (scaled) line so it never stretches while the line draws in.
  return (
    <View style={styles.lineWrap}>
      {line}
      <View
        pointerEvents="none"
        style={[styles.tick, { left: `${Math.round(marker.at * 100)}%` }]}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      >
        <Text style={styles.tickDay}>{String(marker.day)}</Text>
      </View>
    </View>
  );
}

import { Animated, View } from 'react-native';
import { theme } from '@/constants/theme';
import { useGrowFrom } from '@/lib/useGrowFrom';
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
}: {
  slices: HeroSlices;
  hideSavings: boolean;
  periodKey: string;
}) {
  const draw = useGrowFrom(`month-line:${periodKey}`, 1, { drawMs: DURATIONS.draw + 220 });
  const parts = [
    { key: 'spent', share: slices.spent, color: theme.colors.slice.spent },
    { key: 'saved', share: hideSavings ? 0 : slices.saved, color: theme.colors.slice.saved },
    { key: 'due', share: slices.due ?? 0, color: theme.colors.slice.due },
    { key: 'free', share: slices.free, color: theme.colors.slice.free },
  ].filter((part) => part.share > 0);
  const label = `Where the month went: spent ${heroPct(slices.spent)}${
    hideSavings ? '' : `, saved ${heroPct(slices.saved)}`
  }${slices.due ? `, bills ${heroPct(slices.due)}` : ''}, free ${heroPct(slices.free)}`;
  return (
    <Animated.View
      accessible
      accessibilityRole="image"
      accessibilityLabel={label}
      style={[styles.line, { transform: [{ scaleX: draw }], transformOrigin: 'left center' }]}
    >
      {parts.map((part) => (
        <View
          key={part.key}
          style={[styles.lineSegment, { flexGrow: part.share, flexBasis: 0, backgroundColor: part.color }]}
        />
      ))}
    </Animated.View>
  );
}

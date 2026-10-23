import { View } from 'react-native';
import { CategoryBreakdownItem } from '@/db/reports';
import { theme } from '@/constants/theme';
import { styles } from './reports.styles';

/** A category under this share of the total is too thin to see; the small ones share one grey segment. */
const SMALL_SHARE = 0.02;

/**
 * The period's whole split as one bar, each category its share in its own colour: "Where it went" at a
 * glance, above the rows. With a category picked, the others fade back. Categories under 2% each are joined
 * into one neutral segment, except the picked one, which keeps its own so it still stands out.
 */
export function CategoryBar({
  breakdown,
  selectedId,
}: {
  breakdown: CategoryBreakdownItem[];
  selectedId: string | null;
}) {
  const total = breakdown.reduce((sum, c) => sum + c.totalMinor, 0);
  const isSmall = (c: CategoryBreakdownItem) =>
    c.categoryId !== selectedId && total > 0 && c.totalMinor / total < SMALL_SHARE;
  const segments = breakdown
    .filter((c) => !isSmall(c))
    .map((c) => ({
      key: c.categoryId,
      weight: c.totalMinor,
      color: c.color,
      id: c.categoryId as string | null,
    }));
  const smallTotal = breakdown.filter(isSmall).reduce((sum, c) => sum + c.totalMinor, 0);
  // Only worth a segment when more than one category is folded into it; a single thin one keeps its colour.
  const smallCount = breakdown.filter(isSmall).length;
  if (smallCount === 1) {
    const only = breakdown.find(isSmall)!;
    segments.push({ key: only.categoryId, weight: only.totalMinor, color: only.color, id: only.categoryId });
  } else if (smallCount > 1) {
    segments.push({ key: 'other', weight: smallTotal, color: theme.colors.otherSlice, id: null });
  }
  return (
    <View style={styles.catBar} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {segments.map((seg) => (
        <View
          key={seg.key}
          style={[
            styles.catBarSeg,
            {
              flexGrow: Math.max(1, seg.weight),
              backgroundColor: seg.color,
              opacity: selectedId != null && selectedId !== seg.id ? 0.3 : 1,
            },
          ]}
        />
      ))}
    </View>
  );
}

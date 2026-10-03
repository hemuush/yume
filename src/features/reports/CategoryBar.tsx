import { View } from 'react-native';
import { CategoryBreakdownItem } from '@/db/reports';
import { styles } from './reports.styles';

/**
 * The period's whole split as one bar, each category its share in its own
 * colour — the shape of "Where it went" at a glance, above the rows. With a
 * category picked, the others fade back.
 */
export function CategoryBar({
  breakdown,
  selectedId,
}: {
  breakdown: CategoryBreakdownItem[];
  selectedId: string | null;
}) {
  return (
    <View style={styles.catBar} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {breakdown.map((c) => (
        <View
          key={c.categoryId}
          style={[
            styles.catBarSeg,
            {
              flexGrow: Math.max(1, c.totalMinor),
              backgroundColor: c.color,
              opacity: selectedId != null && selectedId !== c.categoryId ? 0.3 : 1,
            },
          ]}
        />
      ))}
    </View>
  );
}

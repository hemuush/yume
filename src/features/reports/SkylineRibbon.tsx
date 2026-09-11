import { View, StyleSheet } from 'react-native';
import { theme } from '@/constants/theme';
import { CategoryBreakdownItem } from '@/db/reports';

/**
 * One thin strip showing every category's share of the period side by side,
 * in proportion — the same information as the row-by-row list below, drawn
 * once instead of once per category. Sits above "Where it went" as the
 * at-a-glance shape of the month before the readable numbers.
 */
export function SkylineRibbon({
  categories,
  totalMinor,
}: {
  categories: CategoryBreakdownItem[];
  totalMinor: number;
}) {
  if (totalMinor <= 0) return null;
  return (
    <View style={styles.ribbon}>
      {categories.map((c, i) => (
        <View
          key={c.categoryId}
          style={[
            i > 0 && styles.segmentGap,
            { flex: Math.max(0.4, (c.totalMinor / totalMinor) * 100), backgroundColor: c.color },
          ]}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  ribbon: {
    flexDirection: 'row',
    height: 20,
    borderRadius: 10,
    overflow: 'hidden',
    marginBottom: 14,
  },
  segmentGap: { borderLeftWidth: 1.5, borderLeftColor: theme.colors.background },
});

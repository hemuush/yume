import { View, StyleSheet } from 'react-native';
import { Skeleton } from '@/components/Skeleton';
import { useContentWidth } from '@/components/ColumnFrame';
import { themedStyles } from '@/theme/themedStyles';

const SUMMARY_H = 124;
const CATEGORIES_H = 186;

/** A few chart-sized placeholders avoid an animation per calendar cell. */
export function ReportsSkeleton() {
  // The cards' width: the screen less the 16 dp gutter on each side, as on the loaded page.
  const width = Math.max(0, useContentWidth() - 32);
  return (
    <View style={styles.wrap} accessibilityLabel="Loading report">
      {/* Match the summary and category preview on the loaded Overview. */}
      <Skeleton width={width} height={SUMMARY_H} radius={20} />
      <Skeleton width={width} height={CATEGORIES_H} radius={20} />
    </View>
  );
}
const styles = themedStyles(() =>
  StyleSheet.create({ wrap: { paddingHorizontal: 16, paddingTop: 12, gap: 10 } })
);

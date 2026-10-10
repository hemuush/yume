import { View, StyleSheet, useWindowDimensions } from 'react-native';
import { Skeleton } from '@/components/Skeleton';

/** A few chart-sized placeholders avoid an animation per calendar cell. */
export function ReportsSkeleton() {
  const width = Math.max(0, useWindowDimensions().width - 40);
  return (
    <View style={styles.wrap} accessibilityLabel="Loading report">
      <Skeleton width={width} height={48} radius={24} />
      <Skeleton width={width} height={290} radius={24} />
      <Skeleton width={width} height={176} radius={24} />
    </View>
  );
}
const styles = StyleSheet.create({ wrap: { paddingHorizontal: 20, gap: 16 } });

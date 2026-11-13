import { View, StyleSheet, useWindowDimensions } from 'react-native';
import { Skeleton } from '@/components/Skeleton';

const SUMMARY_H = 124;
const CALENDAR_H = 440;

/** A few chart-sized placeholders avoid an animation per calendar cell. */
export function ReportsSkeleton() {
  // The cards' width: the screen less the 16 dp gutter on each side, as on the loaded page.
  const width = Math.max(0, useWindowDimensions().width - 32);
  return (
    <View style={styles.wrap} accessibilityLabel="Loading report">
      {/* Two cards at about the heights of the loaded Overview: the summary (three figures and a budget line), then
          the calendar with its legend and the day under it. A few chart-sized blocks, not a placeholder per cell. */}
      <Skeleton width={width} height={SUMMARY_H} radius={20} />
      <Skeleton width={width} height={CALENDAR_H} radius={20} />
    </View>
  );
}
const styles = StyleSheet.create({ wrap: { paddingHorizontal: 16, paddingTop: 12, gap: 10 } });

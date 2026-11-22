import { View } from 'react-native';
import { Skeleton } from '@/components/Skeleton';
import { useContentWidth } from '@/components/ColumnFrame';
import { useStacked } from '@/hooks/useStacked';
import { styles as hero } from './hero.styles';

export { CardRowsSkeleton } from '@/components/ListSkeleton';

/**
 * Matches the balance and breakdown while the overview loads.
 */
export function ThisMonthHeroSkeleton() {
  const innerWidth = Math.max(0, useContentWidth() - 94);
  const stacked = useStacked();
  return (
    <View style={hero.card}>
      <View style={hero.bar}>
        <Skeleton width={78} height={14} radius={4} />
        <Skeleton width={96} height={32} radius={16} />
      </View>
      <View style={hero.figure}>
        <Skeleton width={Math.min(130, innerWidth)} height={40} radius={8} />
        <Skeleton width={Math.min(165, innerWidth)} height={20} radius={10} />
      </View>
      <View style={[styles.row, stacked && styles.stacked]}>
        {[0, 1].map((i) => (
          <View key={i} style={styles.figure}>
            <Skeleton width={46} height={12} radius={4} />
            <Skeleton width={72} height={17} radius={4} />
          </View>
        ))}
      </View>
      <View style={hero.footer}>
        <Skeleton width={120} height={14} radius={4} />
        <Skeleton width={62} height={14} radius={4} />
      </View>
    </View>
  );
}

export function AccountTilesSkeleton() {
  return (
    <View style={styles.accountTiles}>
      {[0, 1, 2].map((i) => (
        <Skeleton key={i} width={148} height={68} radius={22} />
      ))}
    </View>
  );
}

const styles = {
  figure: { gap: 4 },
  row: { flexDirection: 'row', gap: 18, paddingTop: 8 },
  stacked: { flexDirection: 'column', gap: 8 },
  accountTiles: { marginHorizontal: 16, flexDirection: 'row', gap: 8, overflow: 'hidden' },
} as const;

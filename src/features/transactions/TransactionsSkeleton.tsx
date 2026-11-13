import { View, StyleSheet } from 'react-native';
import { theme } from '@/constants/theme';
import { Skeleton } from '@/components/Skeleton';
import { screenStyles } from '@/components/screenStyles';

const BAR_HEIGHTS = [12, 22, 8, 30, 16, 26, 14];
/** How many entries each placeholder day holds. */
const DAYS = [3, 2];

/**
 * Stands in for the page while the first `listTransactions` batch is loading. It is drawn from the same
 * measures as the real page (the slim Spent strip, the filter row, then days with their date rail and a card of
 * entries), so when the data lands the page fills in rather than reflowing.
 */
export function TransactionsSkeleton() {
  return (
    <View>
      <View style={[screenStyles.card, styles.strip]}>
        <View style={styles.lead}>
          <Skeleton width={96} height={11} radius={4} />
          <Skeleton width={120} height={20} radius={6} style={{ marginTop: 6 }} />
        </View>
        <View style={styles.bars}>
          {BAR_HEIGHTS.map((h, i) => (
            <Skeleton key={i} width={6} height={h} radius={3} />
          ))}
        </View>
      </View>

      <View style={styles.filters}>
        <Skeleton width={40} height={40} radius={20} />
        {[44, 62, 64, 84].map((w) => (
          <Skeleton key={w} width={w} height={40} radius={theme.radius.lg} />
        ))}
      </View>

      {DAYS.map((rows, d) => (
        <View key={d} style={[styles.day, d === 0 && styles.firstDay]}>
          <View style={styles.rail}>
            <Skeleton width={24} height={9} radius={3} />
            <Skeleton width={26} height={20} radius={6} style={{ marginTop: 8 }} />
          </View>
          <View style={styles.body}>
            <View style={styles.head}>
              <Skeleton width={80} height={11} radius={4} />
              <Skeleton width={104} height={10} radius={4} />
            </View>
            <View style={styles.lane}>
              {Array.from({ length: rows }, (_, i) => (
                <View key={i} style={styles.row}>
                  <Skeleton width={34} height={34} radius={17} />
                  <View style={styles.rowMid}>
                    <Skeleton width={d === 0 && i === 1 ? 96 : 128} height={13} radius={4} />
                    <Skeleton width={78} height={10} radius={3} style={{ marginTop: 6 }} />
                  </View>
                  <Skeleton width={58} height={13} radius={4} />
                </View>
              ))}
            </View>
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  // The real strip: 64 dp, 16 dp of side padding, the figure on the left and the day bars on the right.
  strip: {
    marginTop: 8,
    minHeight: 64,
    paddingHorizontal: 16,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  lead: { flex: 1 },
  bars: { flexDirection: 'row', alignItems: 'flex-end', gap: 3, height: 34, width: 64 },
  // The filter row: the Filters button, then the type choices.
  filters: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8, paddingHorizontal: 16 },
  // A day: the 44 dp rail on the left, the heading and the card beside it.
  day: { marginHorizontal: 16, marginTop: 14, flexDirection: 'row', gap: 12 },
  // The filter row's own 10 dp gap sits above the first day.
  firstDay: { marginTop: 24 },
  rail: { width: 44, alignItems: 'center', paddingTop: 8 },
  body: { flex: 1, minWidth: 0 },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 8,
    paddingBottom: 8,
  },
  lane: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.xl,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.borderSoft,
    paddingHorizontal: 14,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 48, paddingVertical: 6 },
  rowMid: { flex: 1 },
});

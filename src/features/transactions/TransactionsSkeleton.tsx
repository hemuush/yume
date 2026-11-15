import { View, StyleSheet } from 'react-native';
import { theme } from '@/constants/theme';
import { Skeleton } from '@/components/Skeleton';
import { screenStyles } from '@/components/screenStyles';

const BAR_HEIGHTS = [12, 22, 8, 40, 16, 26, 14];
/** How many entries each placeholder day holds. */
const DAYS = [3, 2];

/**
 * Stands in for the page while the first `listTransactions` batch is loading. It is drawn from the same
 * measures as the real page (the Spent card, the filter row, then days with a heading above a card of entries), so
 * when the data lands the page fills in rather than reflowing.
 */
export function TransactionsSkeleton() {
  return (
    <View>
      <View style={[screenStyles.card, styles.strip]}>
        <View style={styles.lead}>
          <Skeleton width={96} height={11} radius={4} />
          <Skeleton width={120} height={24} radius={6} style={{ marginTop: 5 }} />
          <Skeleton width={132} height={22} radius={11} style={{ marginTop: 7 }} />
        </View>
        <View style={styles.preview}>
          <View style={styles.bars}>
            {BAR_HEIGHTS.map((h, i) => (
              <Skeleton key={i} width={9} height={h} radius={4} />
            ))}
          </View>
          <Skeleton width={PREVIEW_W} height={10} radius={3} />
        </View>
      </View>

      <View style={styles.filters}>
        <Skeleton width={40} height={40} radius={20} />
        {[44, 62, 64, 84].map((w) => (
          <Skeleton key={w} width={w} height={40} radius={20} />
        ))}
      </View>

      {DAYS.map((rows, d) => (
        <View key={d} style={[styles.day, d === 0 && styles.firstDay]}>
          <View style={styles.head}>
            <Skeleton width={128} height={12} radius={4} />
            <Skeleton width={84} height={10} radius={4} />
          </View>
          <View style={styles.lane}>
            {Array.from({ length: rows }, (_, i) => (
              <View key={i} style={styles.row}>
                <Skeleton width={34} height={34} radius={17} />
                <View style={styles.rowMid}>
                  <Skeleton width={d === 0 && i === 1 ? 96 : 128} height={13} radius={4} />
                  <Skeleton width={78} height={10} radius={3} style={{ marginTop: 6 }} />
                </View>
                <View style={styles.rowEnd}>
                  <Skeleton width={58} height={13} radius={4} />
                  <Skeleton width={36} height={10} radius={3} style={{ marginTop: 6 }} />
                </View>
              </View>
            ))}
          </View>
        </View>
      ))}
    </View>
  );
}

const PREVIEW_W = 96;

const styles = StyleSheet.create({
  // The real card: 16 dp of side padding and 12 above and below, the figure and its chip on the left and the lettered
  // bars on the right.
  strip: {
    marginTop: 8,
    minHeight: 98,
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  lead: { flex: 1 },
  preview: { width: PREVIEW_W, gap: 7 },
  bars: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', height: 40 },
  // The filter row: the Filters button, then the type choices, in the real row's 44 dp.
  filters: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 8,
    minHeight: 44,
    paddingHorizontal: 16,
  },
  // A day: its heading, then the card across the full width.
  day: { marginHorizontal: 16, marginTop: 12 },
  // The filter row's own 10 dp gap sits above the first day.
  firstDay: { marginTop: 22 },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 29,
    paddingHorizontal: 4,
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
  rowEnd: { alignItems: 'flex-end' },
});

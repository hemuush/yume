import { View, StyleSheet } from 'react-native';
import { Skeleton } from '@/components/Skeleton';
import { screenStyles, SCREEN } from '@/components/screenStyles';
import { themedStyles } from '@/theme/themedStyles';
import { theme } from '@/constants/theme';
import { styles as timeline } from './TimelineDay.styles';

const BAR_HEIGHTS = [12, 22, 8, 40, 16, 26, 14];
/** How many entries each placeholder day holds. */
const DAYS = [3, 2];

/**
 * Stands in for the page while the first `listTransactions` batch is loading. It is drawn from the same
 * measures as the real page (the Spent card, the filter row, then each day as Home's list card with its heading inside), so
 * when the data lands the page fills in rather than reflowing.
 */
export function TransactionsSkeleton() {
  return (
    <View>
      <View style={styles.strip}>
        <View style={styles.lead}>
          <Skeleton width={96} height={11} radius={4} />
          <Skeleton width={104} height={25} radius={6} style={{ marginTop: 5 }} />
          <Skeleton width={132} height={22} radius={11} style={{ marginTop: 8 }} />
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
          <View style={timeline.lane}>
            <View style={styles.head}>
              <Skeleton width={56} height={11} radius={4} />
              <Skeleton width={52} height={11} radius={4} />
            </View>
            {Array.from({ length: rows }, (_, i) => (
              <View key={i} style={[styles.row, i > 0 && styles.divider]}>
                <View style={styles.slot}>
                  <Skeleton width={SCREEN.mark} height={SCREEN.mark} radius={SCREEN.mark / 2} />
                </View>
                <View style={styles.rowMid}>
                  <Skeleton width={d === 0 && i === 1 ? 96 : 128} height={13} radius={4} />
                  <Skeleton width={110} height={10} radius={3} style={{ marginTop: 6 }} />
                </View>
                <Skeleton width={58} height={13} radius={4} />
              </View>
            ))}
          </View>
        </View>
      ))}
    </View>
  );
}

const PREVIEW_W = 96;

const styles = themedStyles(() =>
  StyleSheet.create({
    // The real card: 16 dp of side padding and 12 above and below, the figure and its chip on the left and the lettered
    // bars on the right.
    strip: {
      marginHorizontal: 16,
      marginTop: 8,
      borderRadius: theme.radius.xl,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.colors.home.edge,
      backgroundColor: theme.colors.home.surface,
      // The real card's height (8 + kicker 18 + 2 + figure 30 + 2 + change row 24 + 8), so nothing moves when it lands.
      minHeight: 92,
      paddingHorizontal: 16,
      paddingVertical: 8,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    lead: { flex: 1 },
    preview: { width: PREVIEW_W, gap: 8 },
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
    // A day: Home's list card, the day named inside it (its heading line), then its rows.
    day: { marginTop: 12 },
    // The filter row's own 10 dp gap sits above the first day.
    firstDay: { marginTop: 22 },
    // Home's day heading: 12 dp above and 2 below a line of small capitals.
    head: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      minHeight: 29,
      paddingHorizontal: 14,
      paddingTop: 12,
      paddingBottom: 2,
    },
    // Home's row: 52 dp least, 14 dp of side padding, the 40 dp disc in its 44 dp slot.
    row: { ...screenStyles.row, gap: 12 },
    divider: screenStyles.divider,
    slot: { width: SCREEN.lead, alignItems: 'center', justifyContent: 'center' },
    rowMid: { flex: 1 },
  })
);

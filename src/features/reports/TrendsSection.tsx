import { View } from 'react-native';
import { Text } from '@/components/Text';
import { NetWorthPoint, TrendPoint } from '@/db/reports';
import { formatMoney } from '@/lib/money';
import { roundedMinor } from '@/lib/round';
import { theme } from '@/constants/theme';
import { TrendBars } from './TrendBars';
import { styles } from './reports.styles';

/** A trend needs at least this many points to be worth drawing. */
const MIN_POINTS = 3;

/** Spend against the last few months (with the average as a dashed line), then net worth. */
export function TrendsSection({
  periodName,
  spentMinor,
  trend,
  baseline,
  netWorthTrend,
}: {
  periodName: string;
  /** This period's exact spend — compared against the baseline. */
  spentMinor: number;
  trend: TrendPoint[];
  baseline: number | null;
  netWorthTrend: NetWorthPoint[];
}) {
  const nwFirst = netWorthTrend[0]?.netWorthMinor ?? 0;
  const nwLast = netWorthTrend[netWorthTrend.length - 1]?.netWorthMinor ?? 0;
  const nwDelta = nwLast - nwFirst;
  return (
    <>
      {trend.length >= MIN_POINTS && (
        <>
          <View style={styles.rule} />
          <Text style={styles.blockTitle}>Against your last {trend.length} months</Text>
          <TrendBars
            values={trend.map((t) => t.totalMinor)}
            labels={trend.map((t) => t.label)}
            baseline={baseline}
          />
          {baseline != null && (
            <Text style={styles.rdNote}>
              The dashed line is your average.{' '}
              {spentMinor > baseline ? `${periodName} is above it.` : `${periodName} is below it.`}
            </Text>
          )}
        </>
      )}

      {netWorthTrend.length >= MIN_POINTS && (
        <>
          <View style={styles.rule} />
          <Text style={styles.blockTitle}>Net worth</Text>
          <TrendBars
            values={netWorthTrend.map((t) => t.netWorthMinor)}
            labels={netWorthTrend.map((t) => t.label)}
            baseline={null}
            emphasisColor={nwLast >= 0 ? theme.colors.income : theme.colors.expense}
          />
          <Text style={styles.rdNote}>
            {nwDelta >= 0 ? '↑ ' : '↓ '}
            <Text style={{ color: nwDelta >= 0 ? theme.colors.income : theme.colors.expense }}>
              {formatMoney(Math.abs(roundedMinor(nwDelta)))}
            </Text>{' '}
            over the last {netWorthTrend.length} months
          </Text>
        </>
      )}
    </>
  );
}

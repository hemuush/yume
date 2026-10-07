import { View, Animated } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { Text } from '@/components/Text';
import { CountUpAmount } from '@/components/CountUpAmount';
import { formatMoney } from '@/lib/money';
import { formatPctChange } from '@/lib/format';
import { theme } from '@/constants/theme';
import { useSlideIn } from '@/lib/useSlideIn';
import { styles } from './reports.styles';

/**
 * The pinned summary card of Reports (under the header, outside the scroll): what was spent, the "above/below
 * usual" badge and three day figures. Stays in view whichever of Days, Categories and Trends is open.
 */
export function ReportSummary({
  periodName,
  slideDirection = 0,
  spentMinor,
  vsUsualPct,
  vsUsualSoFar = false,
  perDayMinor,
  spendDays,
  countedDays,
  laterMinor,
}: {
  periodName: string;
  /** Which way the period just moved: the headline slides in from that side. */
  slideDirection?: -1 | 0 | 1;
  spentMinor: number;
  vsUsualPct: number | null;
  /** The month is still going: the comparison is with the usual month so far. */
  vsUsualSoFar?: boolean;
  perDayMinor: number;
  spendDays: number;
  /** Days so far (the period in progress) or the whole period. */
  countedDays: number;
  /** Spending dated after today: in the total, left out of the day figures. */
  laterMinor: number;
}) {
  const up = vsUsualPct != null && vsUsualPct > 0;
  const slide = useSlideIn(periodName, slideDirection);
  // The three figures, read out as one sentence (the cells alone would be "A day, ₹1,000" and so on).
  const factsLabel = `${formatMoney(perDayMinor)} a day, spent on ${spendDays} of ${countedDays} days${
    laterMinor > 0 ? `, ${formatMoney(laterMinor)} scheduled later` : ''
  }`;
  return (
    <View style={styles.summary}>
      <Animated.View style={[styles.summaryHead, slide]}>
        <View style={styles.summaryMain}>
          <Text style={styles.summaryLabel}>Spent in {periodName}</Text>
          <CountUpAmount
            minor={spentMinor}
            style={styles.summaryBig}
            numberOfLines={1}
            adjustsFontSizeToFit
          />
        </View>
        {vsUsualPct != null && (
          <View
            style={[
              styles.vsBadge,
              { backgroundColor: up ? theme.colors.expenseTint : theme.colors.incomeTint },
            ]}
          >
            <Feather
              name={up ? 'arrow-up-right' : 'arrow-down-right'}
              size={14}
              color={up ? theme.colors.expenseText : theme.colors.incomeText}
            />
            <Text
              style={[styles.vsBadgeText, { color: up ? theme.colors.expenseText : theme.colors.incomeText }]}
              numberOfLines={2}
            >
              {formatPctChange(vsUsualPct)} {up ? 'above' : 'below'} usual{vsUsualSoFar ? ' so far' : ''}
            </Text>
          </View>
        )}
      </Animated.View>
      <View style={styles.summaryCells} accessible accessibilityLabel={factsLabel}>
        <View style={styles.summaryCell}>
          <Text style={styles.summaryCellLabel} numberOfLines={1}>
            A day
          </Text>
          <Text style={styles.summaryCellValue} numberOfLines={1} adjustsFontSizeToFit>
            {formatMoney(perDayMinor)}
          </Text>
        </View>
        <View style={[styles.summaryCell, styles.summaryCellDivided]}>
          <Text style={styles.summaryCellLabel} numberOfLines={1}>
            Spend days
          </Text>
          <Text style={styles.summaryCellValue} numberOfLines={1} adjustsFontSizeToFit>
            {spendDays} of {countedDays}
          </Text>
        </View>
        {laterMinor > 0 && (
          <View style={[styles.summaryCell, styles.summaryCellDivided]}>
            <Text style={styles.summaryCellLabel} numberOfLines={1}>
              Scheduled later
            </Text>
            <Text style={styles.summaryCellValue} numberOfLines={1} adjustsFontSizeToFit>
              {formatMoney(laterMinor)}
            </Text>
          </View>
        )}
      </View>
    </View>
  );
}

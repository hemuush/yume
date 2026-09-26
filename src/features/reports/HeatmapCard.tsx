import { View, StyleSheet } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { Text } from '@/components/Text';
import { CountUpAmount } from '@/components/CountUpAmount';
import { formatMoney } from '@/lib/money';
import { formatPctChange } from '@/lib/format';
import { spendHeatScale } from '@/lib/color';
import { theme } from '@/constants/theme';
import { useAccent } from '@/theme/AccentContext';
import { SpendHeatmap, HeatCell } from './SpendHeatmap';
import { styles } from './reports.styles';

const LEVELS = [0, 1, 2, 3, 4] as const;

/**
 * The top of Reports (the Reports sign-off: "keep the heatmap on top"): the
 * period's day-by-day heatmap, with the headline built into the same card —
 * what was spent, the "above/below usual" badge, the per-day figure and how
 * many days had spending. Tapping a day opens its list (the cells carry
 * their own onPress, see buildHeatGrid).
 */
export function HeatmapCard({
  periodName,
  spentMinor,
  vsUsualPct,
  perDayMinor,
  spendDays,
  countedDays,
  grid,
  isYear,
}: {
  periodName: string;
  spentMinor: number;
  vsUsualPct: number | null;
  perDayMinor: number;
  spendDays: number;
  /** Days so far (the period in progress) or the whole period. */
  countedDays: number;
  grid: { cells: HeatCell[]; leadingPad: number; columns: number; weekdayLabels?: string[] };
  isYear: boolean;
}) {
  const heatScale = spendHeatScale(useAccent().accent);
  const up = vsUsualPct != null && vsUsualPct > 0;
  return (
    <View style={styles.hmCard}>
      <View style={styles.hmHead}>
        <View style={styles.hmHeadMain}>
          <Text style={styles.eyebrow}>Spent in {periodName}</Text>
          <CountUpAmount minor={spentMinor} style={styles.big} numberOfLines={1} adjustsFontSizeToFit />
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
              size={12}
              color={up ? theme.colors.expense : theme.colors.income}
            />
            <Text style={[styles.vsBadgeText, { color: up ? theme.colors.expense : theme.colors.income }]}>
              {formatPctChange(vsUsualPct)} {up ? 'above' : 'below'} usual
            </Text>
          </View>
        )}
      </View>
      <Text style={styles.hmFacts}>
        <Text style={styles.hmFactStrong}>{formatMoney(perDayMinor)}</Text> a day · spent on{' '}
        <Text style={styles.hmFactStrong}>{spendDays}</Text> of {countedDays} days
      </Text>

      <SpendHeatmap
        cells={grid.cells}
        leadingPad={grid.leadingPad}
        columns={grid.columns}
        weekdayLabels={grid.weekdayLabels}
      />

      <View style={styles.hmFoot}>
        <Text style={styles.hmHint}>
          {isYear ? 'Darker months spent more' : 'Tap a day to see what went out'}
        </Text>
        <View style={styles.legend}>
          <Text style={styles.legendText}>less</Text>
          {LEVELS.map((l) => (
            <View
              key={l}
              style={[
                styles.legendSwatch,
                l === 0
                  ? { borderWidth: StyleSheet.hairlineWidth, borderColor: theme.colors.borderSoft }
                  : { backgroundColor: heatScale[l] },
              ]}
            />
          ))}
          <Text style={styles.legendText}>more</Text>
        </View>
      </View>
    </View>
  );
}

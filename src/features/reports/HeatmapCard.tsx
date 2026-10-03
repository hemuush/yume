import { View, Pressable, StyleSheet } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { Text } from '@/components/Text';
import { spendHeatScale } from '@/lib/color';
import { theme } from '@/constants/theme';
import { useAccent } from '@/theme/AccentContext';
import { withPressed } from '@/lib/pressed';
import { SpendHeatmap, HeatCell } from './SpendHeatmap';
import { styles } from './reports.styles';

const LEVELS = [0, 1, 2, 3, 4] as const;

/**
 * The Days tab's heatmap: the period's day grid with legend and hint. A category picked in Categories narrows
 * it to that category's days (a chip clears it). Tapping a day opens its list; cells carry their own onPress.
 */
export function HeatmapCard({
  grid,
  isYear,
  filter,
}: {
  grid: { cells: HeatCell[]; leadingPad: number; columns: number; weekdayLabels?: string[] };
  isYear: boolean;
  /** The category the grid is narrowed to, if any. */
  filter?: { name: string; color: string; onClear: () => void } | null;
}) {
  const heatScale = spendHeatScale(useAccent().accent);
  return (
    <View style={styles.hmCard}>
      {filter && (
        <Pressable
          onPress={filter.onClear}
          style={withPressed(styles.filterChip)}
          accessibilityRole="button"
          accessibilityLabel={`Clear the ${filter.name} filter`}
        >
          <View style={[styles.catDot, { backgroundColor: filter.color }]} />
          <Text style={styles.filterChipText} numberOfLines={1}>
            {filter.name}
          </Text>
          <Feather name="x" size={13} color={theme.colors.textSecondary} />
        </Pressable>
      )}

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

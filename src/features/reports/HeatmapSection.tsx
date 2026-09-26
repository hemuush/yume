import { View, StyleSheet } from 'react-native';
import { Text } from '@/components/Text';
import { theme } from '@/constants/theme';
import { spendHeatScale } from '@/lib/color';
import { useAccent } from '@/theme/AccentContext';
import { SpendHeatmap, HeatCell } from './SpendHeatmap';
import { styles } from './reports.styles';

const LEVELS = [0, 1, 2, 3, 4] as const;

/** The period's heatmap with its less → more legend, and any pattern reads not already in "In short". */
export function HeatmapSection({
  title,
  grid,
  reads,
}: {
  title: string;
  grid: { cells: HeatCell[]; leadingPad: number; columns: number; weekdayLabels?: string[] };
  reads: string[];
}) {
  const heatScale = spendHeatScale(useAccent().accent);
  return (
    <>
      <View style={styles.hmTitleRow}>
        <Text style={styles.blockTitle}>{title}</Text>
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
      <SpendHeatmap
        cells={grid.cells}
        leadingPad={grid.leadingPad}
        columns={grid.columns}
        weekdayLabels={grid.weekdayLabels}
      />
      {reads.length > 0 && (
        <View style={styles.reads}>
          {reads.map((r, i) => (
            <View key={i} style={styles.readRow}>
              <Text style={styles.readBullet}>▸</Text>
              <Text style={styles.readText}>{r}</Text>
            </View>
          ))}
        </View>
      )}
    </>
  );
}

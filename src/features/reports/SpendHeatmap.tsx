import { View, Pressable, StyleSheet } from 'react-native';
import { Text } from '@/components/Text';
import Animated, { FadeIn, ReduceMotion } from 'react-native-reanimated';
import { theme } from '@/constants/theme';
import { spendHeatScale, hexToHsl } from '@/lib/color';
import { useAccent } from '@/theme/AccentContext';
import { MAX_LIST_STAGGER_MS } from '@/lib/animation';
import { gridRows } from '@/lib/gridRows';
import { DURATIONS } from '@/lib/motionTimings';
import { withPressed } from '@/lib/pressed';

export interface HeatCell {
  key: string;
  label: string;
  /** What a screen reader says for the cell: the day and its spend (the visible label is only a number). */
  a11yLabel?: string;
  level: 0 | 1 | 2 | 3 | 4;
  /** Ringed, so you can find your place in the month. */
  isToday?: boolean;
  /** A day that hasn't happened yet: faded, so it doesn't read as a day with no spending. */
  isFuture?: boolean;
  /** The day open below the grid: a heavier ring than today's. */
  isSelected?: boolean;
  onPress?: () => void;
}

/**
 * A month calendar tinted by daily spend: no-spend days are a hairline, spend days carry the accent at rising
 * strength (spendHeatScale), today an ink ring. Explicit rows of equal-share slots (see gridRows for why).
 */
export function SpendHeatmap({
  cells,
  leadingPad,
  columns = 7,
  weekdayLabels,
}: {
  cells: HeatCell[];
  leadingPad: number;
  columns?: number;
  weekdayLabels?: string[];
}) {
  const { accent } = useAccent();
  const heatScale = spendHeatScale(accent);
  // Label colour per level: muted on an empty day, ink on the washes, and
  // ink or cream on the full accent at the top level, whichever reads.
  const onAccent = hexToHsl(accent)[2] > 55 ? theme.colors.ink : theme.colors.surface;
  const labelColor = [theme.colors.textMuted, theme.colors.ink, theme.colors.ink, theme.colors.ink, onAccent];
  const rows = gridRows(cells, leadingPad, columns);
  return (
    <View>
      {weekdayLabels && (
        <View style={styles.row}>
          {weekdayLabels.map((w, i) => (
            <Text key={i} style={[styles.slot, styles.weekday]}>
              {w}
            </Text>
          ))}
        </View>
      )}
      {rows.map((row, r) => (
        <View key={r} style={styles.row}>
          {row.map((c, col) => {
            if (!c) return <View key={`blank-${col}`} style={[styles.slot, styles.cellWrap]} />;
            const i = r * columns + col - leadingPad;
            const inner = (
              <View
                style={[
                  styles.cell,
                  c.level === 0 && styles.cellEmpty,
                  c.isToday && styles.cellToday,
                  c.isFuture && styles.cellFuture,
                  c.isSelected && styles.cellSelected,
                  { backgroundColor: heatScale[c.level] },
                ]}
              >
                <Text
                  style={[
                    styles.cellLabel,
                    c.level === 4 && styles.cellLabelTop,
                    { color: labelColor[c.level] },
                  ]}
                >
                  {c.label}
                </Text>
              </View>
            );
            return (
              <Animated.View
                key={c.key}
                entering={FadeIn.delay(Math.min(i * 12, MAX_LIST_STAGGER_MS))
                  .duration(DURATIONS.standard)
                  .reduceMotion(ReduceMotion.System)}
                style={[styles.slot, styles.cellWrap]}
              >
                {c.onPress ? (
                  <Pressable
                    style={withPressed()}
                    onPress={c.onPress}
                    accessibilityRole="button"
                    accessibilityLabel={c.a11yLabel ?? c.label}
                    accessibilityState={{ selected: !!c.isSelected }}
                  >
                    {inner}
                  </Pressable>
                ) : (
                  <View accessible={!!c.a11yLabel} accessibilityLabel={c.a11yLabel}>
                    {inner}
                  </View>
                )}
              </Animated.View>
            );
          })}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row' },
  // Every slot in a row takes an equal share — see the component's comment.
  slot: { flex: 1, minWidth: 0 },
  weekday: {
    marginBottom: 6,
    textAlign: 'center',
    fontFamily: theme.font.mono,
    fontSize: 11,
    color: theme.colors.textMuted,
  },
  cellWrap: { padding: 2 },
  cell: { height: 40, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  cellEmpty: { borderWidth: StyleSheet.hairlineWidth, borderColor: theme.colors.borderSoft },
  cellFuture: { borderWidth: 0, opacity: 0.35 },
  cellToday: { borderWidth: 2, borderColor: theme.colors.ink },
  cellSelected: { borderWidth: 2.5, borderColor: theme.colors.ink },
  cellLabel: { fontFamily: theme.font.mono, fontSize: 12 },
  cellLabelTop: { fontFamily: theme.font.monoBold },
});

import { View, Pressable, StyleSheet } from 'react-native';
import { Text } from '@/components/Text';
import Animated, { FadeIn, ReduceMotion } from 'react-native-reanimated';
import { theme } from '@/constants/theme';
import { spendHeatScale, hexToHsl } from '@/lib/color';
import { useAccent } from '@/theme/AccentContext';
import { MAX_LIST_STAGGER_MS } from '@/lib/animation';

export interface HeatCell {
  key: string;
  label: string;
  level: 0 | 1 | 2 | 3 | 4;
  /** Ringed, so you can find your place in the month. */
  isToday?: boolean;
  onPress?: () => void;
}

/**
 * A transparent month calendar tinted by daily spend — no card around it, it
 * sits on the page. Days with no spend are just a hairline; spend days carry
 * the accent at rising strength (spendHeatScale); today has an ink ring.
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
  return (
    <View>
      {weekdayLabels && (
        <View style={styles.weekRow}>
          {weekdayLabels.map((w, i) => (
            <Text key={i} style={[styles.weekday, { width: `${100 / columns}%` }]}>
              {w}
            </Text>
          ))}
        </View>
      )}
      <View style={styles.grid}>
        {Array.from({ length: leadingPad }).map((_, i) => (
          <View key={`pad-${i}`} style={[styles.cellWrap, { width: `${100 / columns}%` }]} />
        ))}
        {cells.map((c, i) => {
          const inner = (
            <View
              style={[
                styles.cell,
                c.level === 0 && styles.cellEmpty,
                c.isToday && styles.cellToday,
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
                .duration(260)
                .springify()
                .reduceMotion(ReduceMotion.System)}
              style={[styles.cellWrap, { width: `${100 / columns}%` }]}
            >
              {c.onPress ? (
                <Pressable onPress={c.onPress} accessibilityRole="button">
                  {inner}
                </Pressable>
              ) : (
                inner
              )}
            </Animated.View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  weekRow: { flexDirection: 'row', marginBottom: 5 },
  weekday: {
    textAlign: 'center',
    fontFamily: theme.font.mono,
    fontSize: 9,
    color: theme.colors.textMuted,
  },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  cellWrap: { padding: 2 },
  cell: { height: 34, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  cellEmpty: { borderWidth: StyleSheet.hairlineWidth, borderColor: theme.colors.borderSoft },
  cellToday: { borderWidth: 1.5, borderColor: theme.colors.ink },
  cellLabel: { fontFamily: theme.font.mono, fontSize: 10 },
  cellLabelTop: { fontFamily: theme.font.monoBold },
});

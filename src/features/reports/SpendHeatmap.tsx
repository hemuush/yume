import { View, Pressable, StyleSheet } from 'react-native';
import { Text } from '@/components/Text';
import Animated, { FadeIn, ReduceMotion } from 'react-native-reanimated';
import { theme, SPEND_HEAT_TEXT } from '@/constants/theme';
import { spendHeatScale } from '@/lib/color';
import { useAccent } from '@/theme/AccentContext';
import { MAX_LIST_STAGGER_MS } from '@/lib/animation';

export interface HeatCell {
  key: string;
  label: string;
  level: 0 | 1 | 2 | 3 | 4;
  isWeekend?: boolean;
  onPress?: () => void;
}

/**
 * A transparent month calendar tinted by daily spend — no card around it, it
 * sits on the page. Empty days are just a hairline; spend days carry a
 * translucent coral wash; weekend columns get a faint grey.
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
          const bg =
            c.level === 0 ? (c.isWeekend ? theme.colors.inkWash : 'transparent') : heatScale[c.level];
          const inner = (
            <View style={[styles.cell, c.level === 0 && styles.cellEmpty, { backgroundColor: bg }]}>
              <Text style={[styles.cellLabel, { color: SPEND_HEAT_TEXT[c.level] }]}>{c.label}</Text>
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
  cellWrap: { padding: 2.5 },
  cell: {
    aspectRatio: 1,
    borderRadius: 6,
    alignItems: 'flex-end',
    padding: 3,
  },
  cellEmpty: { borderWidth: StyleSheet.hairlineWidth, borderColor: theme.colors.borderSoft },
  cellLabel: { fontFamily: theme.font.mono, fontSize: 8 },
});

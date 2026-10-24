import { View, StyleSheet } from 'react-native';
import { Text } from '@/components/Text';
import { Glass } from '@/components/Glass';
import { cardSurface } from '@/components/CardSurface';
import { SCREEN } from '@/components/screenStyles';
import { theme } from '@/constants/theme';
import type { SplitPart } from '@/lib/portfolio';

const SPLIT_COLORS = ['#8FCBFF', '#F0E1A8', '#8FE8C8', '#E2A6D8', '#F6BFD3', '#BEC8D4'];

/** Where the money sits: one bar split by holding (or kind), with each share named below it. */
export function SplitCard({ parts }: { parts: SplitPart[] }) {
  return (
    <Glass radius={22} tone="strong" style={[styles.card, cardSurface.neutral, styles.block]}>
      <Text style={styles.label}>Where it sits</Text>
      <View style={styles.bar} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        {parts.map((p, i) => (
          <View
            key={p.key}
            style={{
              flex: Math.max(p.share, 0.01),
              backgroundColor: SPLIT_COLORS[i % SPLIT_COLORS.length],
            }}
          />
        ))}
      </View>
      {parts.map((p, i) => (
        <View
          key={p.key}
          style={styles.legendRow}
          accessible
          accessibilityLabel={`${p.label}, ${Math.round(p.share * 100)} percent`}
        >
          <View style={[styles.dot, { backgroundColor: SPLIT_COLORS[i % SPLIT_COLORS.length] }]} />
          <Text style={styles.legendName} numberOfLines={1}>
            {p.label}
          </Text>
          <Text style={styles.legendShare}>{Math.round(p.share * 100)}%</Text>
        </View>
      ))}
    </Glass>
  );
}

const styles = StyleSheet.create({
  block: { marginTop: 0, marginBottom: 12 },
  card: { marginHorizontal: SCREEN.gutter, padding: 14, gap: 10 },
  label: { fontFamily: theme.font.bodyBold, fontSize: 12, color: theme.colors.textSecondary },
  bar: { flexDirection: 'row', height: 10, borderRadius: 5, overflow: 'hidden', gap: 2 },
  legendRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  legendName: {
    flex: 1,
    minWidth: 0,
    fontFamily: theme.font.body,
    fontSize: 13,
    color: theme.colors.textPrimary,
  },
  legendShare: { fontFamily: theme.font.bodyBold, fontSize: 13, color: theme.colors.textSecondary },
});

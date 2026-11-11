import { View, StyleSheet } from 'react-native';
import { Text } from '@/components/Text';
import { ListCard } from '@/components/SummaryCard';
import { theme } from '@/constants/theme';
import type { SplitPart } from '@/lib/portfolio';

const SPLIT_COLORS = theme.colors.splitPalette;

/** Where the money sits: one bar split by holding (or kind), with each share named below it. */
export function SplitCard({ parts }: { parts: SplitPart[] }) {
  return (
    <ListCard style={styles.card}>
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
    </ListCard>
  );
}

const styles = StyleSheet.create({
  card: { padding: 14, gap: 10, marginBottom: 12 },
  label: { fontFamily: theme.font.bodyBold, fontSize: 12, color: theme.colors.textSecondary },
  bar: { flexDirection: 'row', height: 8, borderRadius: 4, overflow: 'hidden', gap: 3 },
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

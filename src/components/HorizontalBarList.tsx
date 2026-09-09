import { View, Text, Pressable, StyleSheet } from 'react-native';
import { theme } from '@/constants/theme';
import { formatMoney, getCurrencySymbol } from '@/lib/money';
import { usePrivacy } from '@/theme/PrivacyContext';

export interface BarListItem {
  label: string;
  value: number;
  color: string;
  /** When set, the row shows a drill-down chevron and becomes tappable — used for a category rolled up from subcategories. */
  onPress?: () => void;
  /** This row's category (or its top-level parent) has "hide savings & investment amounts" turned on for it — masks the amount when the global privacy toggle is also on. */
  sensitive?: boolean;
}

/**
 * Replaces the old side-by-side capsule bar chart, which broke down to a
 * single shapeless blob whenever there was only one item — that "column"
 * became the full card width, and a rounded-pill bar stretched edge-to-edge
 * reads as a blob, not a bar. A horizontal track per row has no such
 * degenerate case: one item or ten, each row is sized to the card width on
 * its own, labeled with its own name and amount.
 */
export function HorizontalBarList({ items }: { items: BarListItem[] }) {
  const { hideAmounts } = usePrivacy();
  const max = Math.max(1, ...items.map((i) => i.value));
  return (
    <View>
      {items.map((item, i) => {
        const masked = hideAmounts && item.sensitive;
        const row = (
          <View style={styles.rowTop}>
            <View style={styles.nameWrap}>
              <View style={[styles.dot, { backgroundColor: item.color }]} />
              <Text style={styles.name} numberOfLines={1}>
                {item.label}
              </Text>
              {!!item.onPress && <Text style={styles.chevron}>›</Text>}
            </View>
            <Text style={styles.amount}>
              {masked ? `${getCurrencySymbol()}••••` : formatMoney(item.value)}
            </Text>
          </View>
        );
        return (
          <View key={item.label} style={[styles.row, i === items.length - 1 && styles.rowLast]}>
            {item.onPress ? <Pressable onPress={item.onPress}>{row}</Pressable> : row}
            <View style={styles.track}>
              <View
                style={[
                  styles.fill,
                  { width: `${Math.max(2, (item.value / max) * 100)}%`, backgroundColor: item.color },
                ]}
              />
            </View>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { marginBottom: 14 },
  rowLast: { marginBottom: 0 },
  rowTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  nameWrap: { flexDirection: 'row', alignItems: 'center', flex: 1, marginRight: 8, minWidth: 0 },
  dot: { width: 9, height: 9, borderRadius: 5, marginRight: 7, flexShrink: 0 },
  name: { fontSize: 13, fontFamily: theme.font.bodyMedium, color: theme.colors.textPrimary, flexShrink: 1 },
  chevron: { fontSize: 15, fontFamily: theme.font.bodyBold, color: theme.colors.textMuted, marginLeft: 4 },
  amount: { fontSize: 13, fontFamily: theme.font.monoBold, color: theme.colors.textPrimary },
  // A thin outline on the track itself — every other shape on this screen
  // (cards, dots, pills) is bordered, so a bare unbordered bar read as the
  // odd one out next to them.
  track: {
    height: 12,
    borderRadius: 999,
    backgroundColor: theme.colors.surfaceAlt,
    borderWidth: theme.border.thin,
    borderColor: theme.colors.ink,
    overflow: 'hidden',
  },
  fill: { height: '100%', borderRadius: 999 },
});

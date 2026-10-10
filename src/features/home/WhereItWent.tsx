import { useState } from 'react';
import { View, Pressable, StyleSheet } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Text } from '@/components/Text';
import { Glass } from '@/components/Glass';
import type { McIconName } from '@/components/iconName';
import type { CategoryBreakdownItem } from '@/db/reports';
import { theme } from '@/constants/theme';
import { formatMoney } from '@/lib/money';
import { haptics } from '@/lib/haptics';
import { withPressed } from '@/lib/pressed';

const TOP_CATEGORIES = 4;

/** Category amounts and shares stay visible together, without a sparse icon dial. */
export function WhereItWent({
  breakdown,
  iconFor,
  spentMinor,
  previousSpentMinor,
  periodName,
  previousName,
  onOpenReports,
}: {
  breakdown: CategoryBreakdownItem[];
  iconFor: (categoryId: string) => string | undefined;
  spentMinor: number;
  previousSpentMinor: number;
  periodName: string;
  previousName: string;
  onOpenReports: () => void;
}) {
  const positive = breakdown.filter((category) => category.totalMinor > 0);
  const top = positive.slice(0, TOP_CATEGORIES);
  const total = positive.reduce((sum, category) => sum + category.totalMinor, 0);
  const [picked, setPicked] = useState(top[0]?.categoryId);
  const selected = top.some((category) => category.categoryId === picked) ? picked : top[0]?.categoryId;
  if (!top.length) return null;
  const diff = spentMinor - previousSpentMinor;
  return (
    <Glass style={styles.card}>
      <Text style={styles.label}>Spent in {periodName}</Text>
      <Text style={styles.total} numberOfLines={1} adjustsFontSizeToFit>
        {formatMoney(spentMinor)}
      </Text>
      {previousSpentMinor > 0 && diff !== 0 && (
        <Text style={styles.comparison}>
          {formatMoney(Math.abs(diff))} {diff < 0 ? 'less' : 'more'} than {previousName}
        </Text>
      )}
      <View style={styles.stack} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        {positive.map((category) => (
          <View
            key={category.categoryId}
            style={{ flex: category.totalMinor, backgroundColor: category.color }}
          />
        ))}
      </View>
      {top.map((category) => {
        const share = Math.round((category.totalMinor / total) * 100);
        const active = category.categoryId === selected;
        return (
          <Pressable
            key={category.categoryId}
            style={withPressed([styles.row, active && styles.selected])}
            onPress={() => {
              if (!active) {
                haptics.tap();
                setPicked(category.categoryId);
              }
            }}
            accessibilityRole="button"
            accessibilityLabel={`${category.name}, ${share}% of spending`}
            accessibilityState={{ selected: active }}
          >
            <View style={[styles.icon, { backgroundColor: category.color }]}>
              <MaterialCommunityIcons
                name={(iconFor(category.categoryId) ?? 'tag') as McIconName}
                size={16}
                color={theme.colors.ink}
              />
            </View>
            <View style={styles.mid}>
              <Text style={styles.name} numberOfLines={2}>
                {category.name}
              </Text>
              <Text style={styles.meta}>
                {formatMoney(category.totalMinor)} · {share}% of spending
              </Text>
            </View>
            <Text style={styles.share}>{share}%</Text>
          </Pressable>
        );
      })}
      <Pressable
        onPress={onOpenReports}
        style={withPressed(styles.footer)}
        accessibilityRole="button"
        accessibilityLabel="All categories in Reports"
      >
        <Text style={styles.link}>
          {positive.length > top.length ? `View all ${positive.length} categories` : 'Explore spending'}
        </Text>
        <Feather name="arrow-right" size={16} color={theme.colors.link} />
      </Pressable>
    </Glass>
  );
}
const styles = StyleSheet.create({
  card: { marginHorizontal: 16, padding: 14, gap: 6 },
  label: { fontFamily: theme.font.bodyMedium, fontSize: 12.5, color: theme.colors.textMuted },
  total: { fontFamily: theme.font.bodyLight, fontSize: 28, lineHeight: 34, color: theme.colors.textPrimary },
  comparison: {
    fontFamily: theme.font.bodyMedium,
    fontSize: 12,
    lineHeight: 18,
    color: theme.colors.textSecondary,
  },
  stack: { flexDirection: 'row', height: 6, gap: 2, borderRadius: 3, overflow: 'hidden', marginVertical: 6 },
  row: {
    minHeight: 52,
    paddingHorizontal: 8,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: 14,
  },
  selected: { backgroundColor: theme.colors.surface },
  icon: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  mid: { flex: 1, minWidth: 0, gap: 3 },
  name: { fontFamily: theme.font.bodyBold, fontSize: 13, color: theme.colors.textPrimary },
  meta: { fontFamily: theme.font.body, fontSize: 12, lineHeight: 17, color: theme.colors.textSecondary },
  share: { fontFamily: theme.font.bodyBold, fontSize: 12, color: theme.colors.textSecondary },
  footer: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: theme.colors.borderSoft,
    marginTop: 4,
  },
  link: { flexShrink: 1, fontFamily: theme.font.bodyBold, fontSize: 13, color: theme.colors.link },
});

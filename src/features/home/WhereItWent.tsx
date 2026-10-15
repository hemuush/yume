import { View, Pressable, StyleSheet, useWindowDimensions } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Text } from '@/components/Text';
import { cardSurface } from '@/components/CardSurface';
import type { McIconName } from '@/components/iconName';
import type { CategoryBreakdownItem } from '@/db/reports';
import { theme } from '@/constants/theme';
import { formatMoney } from '@/lib/money';
import { withPressed } from '@/lib/pressed';
import { shade } from '@/lib/color';

/** A visible category breakdown; each tile opens its category without an extra selection step. */
export function WhereItWent({
  breakdown,
  iconFor,
  spentMinor,
  previousSpentMinor,
  periodName,
  previousName,
  onOpenReports,
  onOpenCategory,
  onAddExpense,
}: {
  breakdown: CategoryBreakdownItem[];
  iconFor: (categoryId: string) => string | undefined;
  spentMinor: number;
  previousSpentMinor: number;
  periodName: string;
  previousName: string;
  onOpenReports: () => void;
  onOpenCategory?: (categoryId: string) => void;
  onAddExpense?: () => void;
}) {
  const { width, fontScale } = useWindowDimensions();
  const stacked = width < 360 || fontScale > 1.2;
  const positive = breakdown.filter((c) => c.totalMinor > 0).sort((a, b) => b.totalMinor - a.totalMinor);
  const total = positive.reduce((sum, c) => sum + c.totalMinor, 0);
  const diff = spentMinor - previousSpentMinor;
  return (
    <View style={[styles.section, cardSurface.neutral]}>
      <Text style={styles.label}>{periodName} spending breakdown</Text>
      {previousSpentMinor > 0 && diff !== 0 && (
        <Text style={[styles.meta, { color: diff < 0 ? theme.colors.incomeText : theme.colors.expenseText }]}>
          {formatMoney(Math.abs(diff))} {diff < 0 ? 'less' : 'more'} than {previousName}
        </Text>
      )}
      {positive.length > 0 ? (
        <>
          <View
            style={styles.bar}
            accessible
            accessibilityLabel="Category proportions of positive net spending"
          >
            {positive.map((c) => (
              <View
                key={c.categoryId}
                style={{
                  flex: c.totalMinor / total,
                  backgroundColor: c.color ?? theme.colors.textMuted,
                  height: 8,
                }}
              />
            ))}
          </View>
          <View style={[styles.grid, stacked && styles.stacked]}>
            {positive.slice(0, 4).map((c) => {
              const share = Math.round((c.totalMinor / total) * 100);
              return (
                <Pressable
                  key={c.categoryId}
                  onPress={() => (onOpenCategory ? onOpenCategory(c.categoryId) : onOpenReports())}
                  accessibilityRole="button"
                  accessibilityLabel={`View ${c.name} category, ${formatMoney(c.totalMinor)}, ${share}% of spending`}
                  style={withPressed([styles.category, stacked && styles.full])}
                >
                  <View style={styles.identity}>
                    <View
                      style={[styles.icon, { backgroundColor: shade(c.color ?? theme.colors.textMuted, 88) }]}
                    >
                      <MaterialCommunityIcons
                        name={(iconFor(c.categoryId) ?? 'tag') as McIconName}
                        size={18}
                        color={theme.colors.textPrimary}
                      />
                    </View>
                    <Text style={styles.name}>{c.name}</Text>
                  </View>
                  <Text style={styles.amount}>{formatMoney(c.totalMinor)}</Text>
                  <Text style={styles.meta}>{share}% of spending</Text>
                </Pressable>
              );
            })}
          </View>
          {breakdown.some((c) => c.totalMinor < 0) && (
            <Text style={styles.meta}>
              Shares show categories with positive net spending; refunds are included in the period total.
            </Text>
          )}
        </>
      ) : (
        <>
          <Text style={styles.name}>{spentMinor < 0 ? 'Refunds exceed spending' : 'No spending yet'}</Text>
          <Text style={styles.meta}>
            {spentMinor < 0
              ? 'See your net spending and refunds in Reports.'
              : 'Your categories appear after an expense.'}
          </Text>
          <Pressable
            style={withPressed(styles.linkButton)}
            onPress={onAddExpense}
            accessibilityRole="button"
            accessibilityLabel="Add expense"
          >
            <Text style={styles.link}>Add expense</Text>
          </Pressable>
        </>
      )}
      <Pressable
        onPress={onOpenReports}
        style={withPressed(styles.linkButton)}
        accessibilityRole="button"
        accessibilityLabel="All categories in Reports"
      >
        <Text style={styles.link}>Explore all categories</Text>
        <Feather name="arrow-right" size={16} color={theme.colors.link} />
      </Pressable>
    </View>
  );
}
const styles = StyleSheet.create({
  section: { marginHorizontal: 16, padding: 14, borderRadius: 24, gap: 8 },
  label: { fontFamily: theme.font.bodyMedium, fontSize: 12.5, color: theme.colors.textSecondary },
  bar: { flexDirection: 'row', gap: 2, borderRadius: 4, overflow: 'hidden', marginVertical: 4 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  stacked: { flexDirection: 'column' },
  category: {
    flexBasis: '47%',
    flexGrow: 1,
    minWidth: 0,
    padding: 10,
    gap: 4,
    borderRadius: 16,
    backgroundColor: theme.colors.white,
    minHeight: 44,
  },
  full: { flexBasis: 'auto', width: '100%' },
  identity: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  icon: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  name: { flexShrink: 1, fontFamily: theme.font.bodyBold, fontSize: 13, color: theme.colors.textPrimary },
  amount: {
    fontFamily: theme.font.bodyBold,
    fontVariant: ['tabular-nums'],
    fontSize: 16,
    color: theme.colors.textPrimary,
  },
  meta: { fontFamily: theme.font.body, fontSize: 12, lineHeight: 18, color: theme.colors.textSecondary },
  linkButton: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  link: { flexShrink: 1, fontFamily: theme.font.bodyBold, fontSize: 12, color: theme.colors.link },
});

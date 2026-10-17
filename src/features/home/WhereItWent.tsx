import { useState } from 'react';
import { View, Pressable, StyleSheet } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Text } from '@/components/Text';
import { cardSurface } from '@/components/CardSurface';
import { GLASS } from '@/components/Glass';
import type { McIconName } from '@/components/iconName';
import type { CategoryBreakdownItem } from '@/db/reports';
import { theme } from '@/constants/theme';
import { formatMoney } from '@/lib/money';
import { haptics } from '@/lib/haptics';
import { withPressed } from '@/lib/pressed';
import { useAccent } from '@/theme/AccentContext';
import { homeInk } from './homeInk';

/** How many categories get their own button before the "all categories" one. */
const SHOWN = 4;

/**
 * Where the month's money went: a row of the biggest categories (the picked one is a dark pill with its
 * share), and under it that category, one tap from its page. The month's total is not repeated here: the
 * month card above already says it.
 */
export function WhereItWent({
  breakdown,
  iconFor,
  spentMinor,
  onOpenReports,
  onOpenCategory,
  onAddExpense,
}: {
  breakdown: CategoryBreakdownItem[];
  iconFor: (categoryId: string) => string | undefined;
  spentMinor: number;
  onOpenReports: () => void;
  onOpenCategory?: (categoryId: string) => void;
  onAddExpense?: () => void;
}) {
  const positive = breakdown.filter((c) => c.totalMinor > 0).sort((a, b) => b.totalMinor - a.totalMinor);
  const top = positive.slice(0, SHOWN);
  const total = positive.reduce((sum, c) => sum + c.totalMinor, 0);
  const [picked, setPicked] = useState(top[0]?.categoryId);
  const index = Math.max(
    0,
    top.findIndex((c) => c.categoryId === picked)
  );
  const selected = top[index];
  const share = selected ? Math.round((selected.totalMinor / total) * 100) : 0;
  const { accent } = useAccent();
  const ink = homeInk(accent);

  if (!selected) {
    return (
      <View style={[styles.section, cardSurface.neutral]}>
        <Text style={styles.name}>{spentMinor < 0 ? 'Refunds exceed spending' : 'No spending yet'}</Text>
        <Text style={styles.meta}>
          {spentMinor < 0
            ? 'See your net spending and refunds in Reports.'
            : 'Your categories appear after an expense.'}
        </Text>
        <Pressable
          style={withPressed(styles.linkButton)}
          onPress={spentMinor < 0 ? onOpenReports : onAddExpense}
          accessibilityRole="button"
          accessibilityLabel={spentMinor < 0 ? 'View Reports' : 'Add expense'}
        >
          <Text style={styles.link}>{spentMinor < 0 ? 'View Reports' : 'Add expense'}</Text>
          <Feather name="arrow-right" size={16} color={theme.colors.link} />
        </Pressable>
      </View>
    );
  }

  return (
    <View style={[styles.section, cardSurface.neutral]}>
      <View style={styles.row}>
        {top.map((c, i) => {
          const on = i === index;
          const icon = (
            <MaterialCommunityIcons
              name={(iconFor(c.categoryId) ?? 'tag') as McIconName}
              size={20}
              color={on ? theme.colors.white : ink}
            />
          );
          return (
            <Pressable
              key={c.categoryId}
              style={withPressed([styles.target, on && [styles.picked, { backgroundColor: ink }]])}
              onPress={() => {
                if (!on) {
                  haptics.tap();
                  setPicked(c.categoryId);
                }
              }}
              hitSlop={3}
              accessibilityRole="button"
              accessibilityLabel={`${c.name}, ${Math.round((c.totalMinor / total) * 100)}% of spending`}
              accessibilityState={{ selected: on }}
            >
              {on && <Text style={styles.share}>{share}%</Text>}
              {icon}
            </Pressable>
          );
        })}
        <Pressable
          style={withPressed(styles.target)}
          onPress={onOpenReports}
          hitSlop={3}
          accessibilityRole="button"
          accessibilityLabel="All categories in Reports"
        >
          <Feather name="more-horizontal" size={20} color={ink} />
        </Pressable>
      </View>
      <Pressable
        style={withPressed(styles.categoryButton)}
        onPress={() => (onOpenCategory ? onOpenCategory(selected.categoryId) : onOpenReports())}
        accessibilityRole="button"
        accessibilityLabel={`View ${selected.name} category`}
      >
        <View style={styles.categoryText}>
          <Text style={styles.name} numberOfLines={1}>
            {selected.name}
          </Text>
          <Text style={styles.meta}>{`${formatMoney(selected.totalMinor)} · ${share}%`}</Text>
        </View>
        <Feather name="chevron-right" size={18} color={theme.colors.link} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    marginHorizontal: 16,
    padding: 12,
    borderRadius: 24,
    backgroundColor: GLASS.fill,
    borderWidth: 1,
    borderColor: GLASS.edge,
    gap: 8,
  },
  row: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 },
  target: {
    height: 44,
    minWidth: 44,
    borderRadius: 22,
    paddingHorizontal: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: theme.colors.white,
  },
  picked: { paddingHorizontal: 14 },
  share: { fontFamily: theme.font.bodyBold, fontSize: 12, color: theme.colors.white },
  categoryButton: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 8 },
  categoryText: { flex: 1, minWidth: 0 },
  name: { fontFamily: theme.font.bodyBold, fontSize: 13, color: theme.colors.textPrimary },
  meta: {
    fontFamily: theme.font.body,
    fontSize: 12,
    lineHeight: 18,
    color: theme.colors.textSecondary,
    marginTop: 2,
  },
  linkButton: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 6 },
  link: { flexShrink: 1, fontFamily: theme.font.bodyBold, fontSize: 12, color: theme.colors.link },
});

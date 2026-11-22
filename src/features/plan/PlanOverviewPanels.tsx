import { View, Pressable, StyleSheet } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { Text } from '@/components/Text';
import { theme } from '@/constants/theme';
import { Section } from '@/components/Section';
import { withPressed } from '@/lib/pressed';
import { formatMoney } from '@/lib/money';
import type { BudgetsSummary, DueGroup } from './planOverview';
import type { PlanTab } from './PlanNavigation';
import { themedStyles } from '@/theme/themedStyles';

type Alert = { key: string; title: string; detail: string; onPress: () => void };

export function PlanOverviewPanels({
  budgets,
  groups,
  today,
  onTab,
  onBudget,
}: {
  budgets: BudgetsSummary;
  groups: DueGroup[];
  today: string;
  onTab: (tab: PlanTab, upcomingDate?: string) => void;
  onBudget: (id: string) => void;
}) {
  const overdue = groups
    .flatMap((g) => g.items)
    .filter((item) => item.dueDate < today && (item.kind === 'bill' || item.kind === 'emi'));
  const alerts: Alert[] = [];
  if (overdue.length)
    alerts.push({
      key: 'late',
      title: `${overdue.length} overdue payment${overdue.length === 1 ? '' : 's'}`,
      detail: `${formatMoney(overdue.reduce((sum, item) => sum + item.amountMinor, 0))} due`,
      onPress: () => onTab('upcoming', today),
    });
  for (const budget of budgets.rows
    .filter((b) => b.overBudget)
    .sort((a, b) => a.remainingMinor - b.remainingMinor)
    .slice(0, 2))
    alerts.push({
      key: budget.id,
      title: budget.categoryName,
      detail: `${formatMoney(Math.max(0, -budget.remainingMinor))} over budget`,
      onPress: () => onBudget(budget.id),
    });

  if (alerts.length === 0) return null;
  return (
    <Section compact first title="Needs attention">
      <View style={s.alerts}>
        {alerts.map((alert, index) => (
          <Pressable
            key={alert.key}
            accessibilityRole="button"
            accessibilityLabel={`${alert.title}. ${alert.detail}`}
            onPress={alert.onPress}
            style={withPressed([s.alert, index > 0 && s.rowDivider])}
          >
            <Feather name="alert-circle" size={16} color={theme.colors.expenseText} />
            <View style={s.alertCopy}>
              <Text style={s.alertTitle}>{alert.title}</Text>
              <Text style={s.alertDetail}>{alert.detail}</Text>
            </View>
            <Feather name="chevron-right" size={15} color={theme.colors.expenseText} />
          </Pressable>
        ))}
      </View>
    </Section>
  );
}

const s = themedStyles(() =>
  StyleSheet.create({
    alerts: {
      marginHorizontal: 16,
      paddingHorizontal: 10,
      borderRadius: theme.radius.md,
      backgroundColor: theme.colors.expenseTint,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.colors.home.edge,
    },
    alert: {
      minHeight: 44,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      paddingVertical: 8,
    },
    alertCopy: { flex: 1, minWidth: 0, flexDirection: 'row', flexWrap: 'wrap', columnGap: 6 },
    alertTitle: { fontFamily: theme.font.bodyMedium, fontSize: 13, color: theme.colors.textPrimary },
    alertDetail: {
      flexShrink: 1,
      fontFamily: theme.font.body,
      fontSize: 13,
      color: theme.colors.home.secondaryText,
      fontVariant: ['tabular-nums'],
    },
    rowDivider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.colors.home.edge },
  })
);

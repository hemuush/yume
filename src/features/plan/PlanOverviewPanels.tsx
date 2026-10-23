import { View, Pressable, StyleSheet } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { Text } from '@/components/Text';
import { theme } from '@/constants/theme';
import { Section } from '@/components/Section';
import { withPressedTint } from '@/lib/pressed';
import { useAccent } from '@/theme/AccentContext';
import { formatMoney } from '@/lib/money';
import type { BudgetsSummary, DueGroup, LoansSummary } from './planOverview';
import type { SavingsGoal } from '@/types';
import type { PlanTab } from './PlanNavigation';
import type { Runway } from './runway';
import { dayMonth } from '@/lib/dateLabels';

type Row = {
  key: string;
  title: string;
  detail: string;
  icon: React.ComponentProps<typeof Feather>['name'];
  warning?: boolean;
  onPress: () => void;
};
function Rows({ rows }: { rows: Row[] }) {
  const { accent } = useAccent();
  return (
    <View style={s.card}>
      {rows.map((row, index) => (
        <Pressable
          key={row.key}
          accessibilityRole="button"
          accessibilityLabel={`${row.title}. ${row.detail}`}
          onPress={row.onPress}
          style={withPressedTint(accent, [s.row, index > 0 && s.divider])}
        >
          <View style={[s.icon, row.warning && s.warning]}>
            <Feather
              name={row.icon}
              size={18}
              color={row.warning ? theme.colors.expenseText : theme.colors.textSecondary}
            />
          </View>
          <View style={s.copy}>
            <Text style={s.title}>{row.title}</Text>
            <Text style={s.detail}>{row.detail}</Text>
          </View>
          <Feather name="chevron-right" size={16} color={theme.colors.textMuted} />
        </Pressable>
      ))}
    </View>
  );
}
export function PlanOverviewPanels({
  budgets,
  groups,
  loans,
  goals,
  today,
  hideAmounts,
  runway,
  onTab,
  onBudget,
}: {
  budgets: BudgetsSummary;
  groups: DueGroup[];
  loans: LoansSummary;
  goals: SavingsGoal[];
  today: string;
  hideAmounts: boolean;
  /** When its balance dips below zero, the shortfall is the first thing needing attention. */
  runway?: Runway;
  onTab: (tab: PlanTab) => void;
  onBudget: (id: string) => void;
}) {
  const overdue = groups
    .flatMap((g) => g.items)
    .filter((item) => item.dueDate < today && (item.kind === 'bill' || item.kind === 'emi'));
  const alerts: Row[] = [];
  if (runway?.short)
    alerts.push({
      key: 'short',
      title: 'Balance runs short',
      detail: `${formatMoney(runway.short.minor)} below zero on ${dayMonth(runway.short.date)}`,
      icon: 'trending-down',
      warning: true,
      onPress: () => onTab('upcoming'),
    });
  if (overdue.length)
    alerts.push({
      key: 'late',
      title: `${overdue.length} overdue payment${overdue.length === 1 ? '' : 's'}`,
      detail: 'Review the payment schedule',
      icon: 'clock',
      warning: true,
      onPress: () => onTab('upcoming'),
    });
  for (const budget of budgets.rows
    .filter((b) => b.overBudget)
    .sort((a, b) => a.remainingMinor - b.remainingMinor)
    .slice(0, 2))
    alerts.push({
      key: budget.id,
      title: budget.categoryName,
      detail: `${formatMoney(Math.max(0, -budget.remainingMinor))} over budget`,
      icon: 'alert-circle',
      warning: true,
      onPress: () => onBudget(budget.id),
    });
  const active = goals.filter((g) => !g.archived);
  const borrowed = loans.rows.filter((l) => l.direction === 'borrowed');
  const rows: Row[] = [
    {
      key: 'debt',
      title: 'Debt',
      detail: borrowed.length
        ? `${borrowed.length} active loan${borrowed.length === 1 ? '' : 's'} · view repayment progress`
        : 'Track borrowing and lending',
      icon: 'credit-card',
      onPress: () => onTab('debt'),
    },
    {
      key: 'budgets',
      title: 'Budgets',
      detail: budgets.rows.length
        ? `${budgets.rows.length} active · manage monthly limits`
        : 'Set a category spending limit',
      icon: 'pie-chart',
      onPress: () => onTab('money'),
    },
    {
      key: 'goals',
      title: 'Goals',
      detail: active.length
        ? `${active.length} active${hideAmounts ? ' · saved amounts hidden' : ` · ${active.filter((g) => g.currentAmountMinor >= g.targetAmountMinor && g.targetAmountMinor > 0).length} reached`}`
        : 'Start a savings goal',
      icon: 'flag',
      onPress: () => onTab('money'),
    },
  ];
  return (
    <>
      {alerts.length > 0 && (
        <Section compact title="Needs attention">
          <Rows rows={alerts} />
        </Section>
      )}
      <Section compact title="Your plans">
        <Rows rows={rows} />
      </Section>
    </>
  );
}
const s = StyleSheet.create({
  card: {
    marginHorizontal: 16,
    paddingHorizontal: 14,
    borderRadius: 22,
    backgroundColor: theme.colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.borderSoft,
  },
  row: { minHeight: 68, paddingVertical: 12, flexDirection: 'row', alignItems: 'center', gap: 10 },
  divider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.colors.divider },
  icon: {
    width: 34,
    height: 34,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.surfaceAlt,
  },
  warning: { backgroundColor: theme.colors.expenseTint },
  copy: { flex: 1, minWidth: 0, gap: 4 },
  title: { fontFamily: theme.font.roundedBold, fontSize: 14, color: theme.colors.textPrimary },
  detail: { fontFamily: theme.font.body, fontSize: 12, lineHeight: 18, color: theme.colors.textSecondary },
});

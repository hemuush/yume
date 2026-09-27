import { View, Pressable, StyleSheet } from 'react-native';
import Animated from 'react-native-reanimated';
import Feather from '@expo/vector-icons/Feather';
import { router } from 'expo-router';
import { Text } from '@/components/Text';
import { theme } from '@/constants/theme';
import { hexToRgba } from '@/lib/color';
import { dueDateLabel, isDueUrgent } from '@/lib/dueDate';
import { useCappedList } from '@/lib/useCappedList';
import { NextDueInstallment } from '@/db/loans';
import { BudgetProgress } from '@/db/budgets';
import { RecurringRule, SavingsGoal } from '@/types';
import { BudgetRow } from '@/features/budgets/BudgetRow';
import { GoalChip } from '@/features/goals/GoalChip';
import { HomeSwipeCard, SwipePage } from './HomeSwipeCard';
import { UpcomingRow, UpcomingMoreRow } from './UpcomingRow';
import { withPressed } from '@/lib/pressed';

export interface UpcomingItem {
  key: string;
  icon: React.ComponentProps<typeof Feather>['name'];
  iconBg: string;
  iconColor?: string;
  title: string;
  subtitle: string;
  amountMinor: number;
  sign: '+' | '-' | '';
  sortDate: string;
  route: '/loans' | '/recurring';
  urgent: boolean;
}

/**
 * Home's Upcoming list: the next loan EMI and every active recurring rule
 * (rent, subscriptions, salary), soonest first — so a bill isn't a surprise
 * just because it's a recurring rule rather than a loan. The EMI's icon is a
 * light wash of the person's own accent colour.
 */
export function buildUpcomingItems(input: {
  nextDue: NextDueInstallment | null;
  rules: RecurringRule[];
  accent: string;
  accountName: (id: string | null | undefined) => string | undefined;
  categoryName: (id: string | null) => string | undefined;
}): UpcomingItem[] {
  const items: UpcomingItem[] = [];
  const { nextDue } = input;
  if (nextDue) {
    items.push({
      key: 'loan',
      icon: 'calendar',
      iconBg: hexToRgba(input.accent, 0.18),
      iconColor: input.accent,
      title: `${nextDue.counterparty} EMI`,
      subtitle: dueDateLabel(nextDue.dueDate),
      amountMinor: nextDue.emiAmountMinor,
      sign: '-',
      sortDate: nextDue.dueDate,
      route: '/loans',
      urgent: isDueUrgent(nextDue.dueDate),
    });
  }
  for (const rule of input.rules) {
    if (!rule.active) continue;
    const isTransfer = rule.type === 'transfer';
    items.push({
      key: rule.id,
      icon: isTransfer ? 'repeat' : rule.type === 'income' ? 'arrow-down-right' : 'arrow-up-right',
      iconBg: theme.colors.secondaryTint,
      title: isTransfer
        ? `${input.accountName(rule.accountId) ?? '—'} → ${input.accountName(rule.toAccountId) ?? '—'}`
        : rule.note || input.categoryName(rule.categoryId) || 'Recurring',
      subtitle: dueDateLabel(rule.nextRunDate),
      amountMinor: rule.amountMinor,
      sign: rule.type === 'income' ? '+' : rule.type === 'expense' ? '-' : '',
      sortDate: rule.nextRunDate,
      route: '/recurring',
      urgent: isDueUrgent(rule.nextRunDate),
    });
  }
  return items.sort((a, b) => (a.sortDate < b.sortDate ? -1 : a.sortDate > b.sortDate ? 1 : 0));
}

/**
 * Home's swipe card: Upcoming first (it's the time-sensitive one), then the
 * budgets closest to their limits, then goals. A page with nothing to show
 * isn't drawn.
 */
export function HomeGlance({
  upcoming,
  budgets,
  goals,
  rowEntering,
}: {
  upcoming: UpcomingItem[];
  /** Most urgent first, as listBudgetsForMonth returns them. */
  budgets: BudgetProgress[];
  goals: SavingsGoal[];
  rowEntering: (i: number) => React.ComponentProps<typeof Animated.View>['entering'];
}) {
  const {
    shown: visibleUpcoming,
    hidden: hiddenUpcoming,
    expand: expandUpcoming,
  } = useCappedList(upcoming, 3);
  const topBudgets = budgets.slice(0, 3);
  const activeGoals = goals.filter((g) => !g.archived);
  // Capped rather than its own horizontal ScrollView — nesting a
  // horizontal-scrolling strip inside the swipe card's own horizontal
  // pager would fight the page-swipe gesture on the same axis, so this
  // page shows as many chips as comfortably fit and a "+N" tile for the
  // rest instead, the same cap-and-link pattern Budgets/Upcoming use.
  const topGoals = activeGoals.slice(0, 2);
  const hiddenGoalsCount = activeGoals.length - topGoals.length;

  const pages: SwipePage[] = [
    ...(visibleUpcoming.length > 0
      ? [
          {
            key: 'upcoming',
            label: 'Upcoming',
            // No single "see all" destination — this mixes loan EMIs (Loans
            // tab) and recurring rules (Recurring screen); each row already
            // deep-links to where it actually lives.
            content: (
              <View style={styles.pageList}>
                {visibleUpcoming.map((item, i) => (
                  <Animated.View key={item.key} entering={rowEntering(i)}>
                    <UpcomingRow
                      icon={item.icon}
                      iconBg={item.iconBg}
                      iconColor={item.iconColor}
                      title={item.title}
                      subtitle={item.subtitle}
                      amountMinor={item.amountMinor}
                      sign={item.sign}
                      onPress={() => router.push(item.route)}
                      divider={i > 0}
                      urgent={item.urgent}
                    />
                  </Animated.View>
                ))}
                {hiddenUpcoming.length > 0 && (
                  <UpcomingMoreRow count={hiddenUpcoming.length} divider onPress={expandUpcoming} />
                )}
              </View>
            ),
          },
        ]
      : []),
    ...(topBudgets.length > 0
      ? [
          {
            key: 'budgets',
            label: 'Budgets',
            onSeeAll: () => router.push('/budgets'),
            content: (
              <View style={styles.pageList}>
                {topBudgets.map((progress, i) => (
                  <Animated.View key={progress.budget.id} entering={rowEntering(i)}>
                    <BudgetRow progress={progress} divider={i > 0} onPress={() => router.push('/budgets')} />
                  </Animated.View>
                ))}
              </View>
            ),
          },
        ]
      : []),
    ...(topGoals.length > 0
      ? [
          {
            key: 'goals',
            label: 'Goals',
            onSeeAll: () => router.push('/savings-goals'),
            content: (
              <View style={styles.goalsPageRow}>
                {topGoals.map((goal, i) => (
                  <Animated.View key={goal.id} entering={rowEntering(i)}>
                    <GoalChip goal={goal} onPress={() => router.push('/savings-goals')} />
                  </Animated.View>
                ))}
                {hiddenGoalsCount > 0 && (
                  <Pressable
                    onPress={() => router.push('/savings-goals')}
                    style={withPressed(styles.goalsMoreTile)}
                    accessibilityRole="button"
                    accessibilityLabel={`${hiddenGoalsCount} more goals`}
                  >
                    <Text style={styles.goalsMoreText}>+{hiddenGoalsCount} more</Text>
                  </Pressable>
                )}
              </View>
            ),
          },
        ]
      : []),
  ];
  return <HomeSwipeCard pages={pages} />;
}

const styles = StyleSheet.create({
  // Rows inside a HomeSwipeCard page — no outer border/background of their
  // own (the card already draws that), BudgetRow/UpcomingRow already carry
  // their own horizontal padding.
  pageList: { paddingHorizontal: 2 },
  goalsPageRow: { flexDirection: 'row', gap: 10, paddingHorizontal: 14, paddingVertical: 14 },
  goalsMoreTile: {
    width: 90,
    borderRadius: theme.radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.borderSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  goalsMoreText: { fontFamily: theme.font.bodyBold, fontSize: 12, color: theme.colors.textSecondary },
});

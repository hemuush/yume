import { View, Pressable, StyleSheet } from 'react-native';
import Animated from 'react-native-reanimated';
import Feather from '@expo/vector-icons/Feather';
import { router } from 'expo-router';
import { Text } from '@/components/Text';
import { theme } from '@/constants/theme';
import { hexToRgba, shade } from '@/lib/color';
import { dueDateLabel, isDueUrgent } from '@/lib/dueDate';
import { formatMoney } from '@/lib/money';
import { addDaysToIsoDate, daysUntilIsoDate, parseLocalIsoDate, toLocalIsoDate } from '@/lib/date';
import { payCardRoute, PayCardRoute } from '@/lib/payCard';
import type { PlanCardBillInput } from '@/features/plan/planOverview';
import { BudgetProgress } from '@/db/budgets';
import { RecurringRule, SavingsGoal } from '@/types';
import { BudgetRow } from '@/features/budgets/BudgetRow';
import { GoalChip } from '@/features/goals/GoalChip';
import { HomeSwipeCard, SwipePage } from './HomeSwipeCard';
import { UpcomingRow, UpcomingMoreRow } from './UpcomingRow';
import { withPressed } from '@/lib/pressed';
import { growHref } from '@/lib/cardGrow';

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
  route: '/loans' | `/loans?pay=${string}` | '/recurring' | PayCardRoute;
  urgent: boolean;
  /** An EMI or card bill to pay: its row ends in a "Pay" pill when pinned. */
  payable: boolean;
  /** Late, or an EMI or card bill due within DUE_SOON_DAYS: listed first, under "Due soon". */
  pinned: boolean;
}

/** How far ahead Home's Upcoming looks. Overdue items are always included on top of this. */
export const UPCOMING_DAYS = 7;
/** An EMI or card bill this close (or late) is pinned to the top of Upcoming as "Due soon". */
export const DUE_SOON_DAYS = 3;
/** Rows shown before "+N more". */
export const UPCOMING_ROWS = 5;

export interface UpcomingLoanInput {
  id: string;
  name: string;
  nextDueDate: string;
  nextEmiMinor: number;
}

export interface Upcoming {
  /** Bills to pay soon (or late) first, then everything else due within UPCOMING_DAYS, each soonest first. */
  items: UpcomingItem[];
  /** The first thing due after the window, for a week with nothing in it. */
  next: UpcomingItem | null;
}

/**
 * Home's Upcoming: next 7 days of EMIs, recurring rules and unpaid card bills, overdue first.
 * Same sources as Plan's Coming up so they can't disagree; the EMI icon is a wash of the accent.
 */
export function buildUpcomingItems(input: {
  loans: UpcomingLoanInput[];
  cardBills: PlanCardBillInput[];
  rules: RecurringRule[];
  accent: string;
  /** The picked theme's secondary: a transfer or uncoloured rule's tile takes a pale wash of it. */
  secondary?: string;
  accountName: (id: string | null | undefined) => string | undefined;
  categoryName: (id: string | null) => string | undefined;
  /** A bill's date tile takes a wash of its category's own colour. */
  categoryColor?: (id: string | null) => string | undefined;
}): Upcoming {
  const all: UpcomingItem[] = [];
  for (const loan of input.loans) {
    all.push({
      key: `loan-${loan.id}`,
      icon: 'calendar',
      iconBg: hexToRgba(input.accent, 0.18),
      iconColor: input.accent,
      title: `${loan.name} EMI`,
      subtitle: dueDateLabel(loan.nextDueDate),
      amountMinor: loan.nextEmiMinor,
      sign: '-',
      sortDate: loan.nextDueDate,
      // Straight to this loan's pay sheet: "Pay" shouldn't land on the list.
      route: `/loans?pay=${loan.id}`,
      urgent: isDueUrgent(loan.nextDueDate),
      payable: true,
      pinned: daysUntilIsoDate(loan.nextDueDate) <= DUE_SOON_DAYS,
    });
  }
  for (const bill of input.cardBills) {
    if (bill.leftToPayMinor <= 0) continue;
    all.push({
      key: `card-${bill.accountId}`,
      icon: 'credit-card',
      iconBg: theme.colors.idGold,
      title: `${bill.accountName} bill`,
      subtitle: dueDateLabel(bill.dueDate),
      amountMinor: bill.leftToPayMinor,
      sign: '-',
      sortDate: bill.dueDate,
      route: payCardRoute(bill.accountId, bill.leftToPayMinor),
      urgent: isDueUrgent(bill.dueDate),
      payable: true,
      pinned: daysUntilIsoDate(bill.dueDate) <= DUE_SOON_DAYS,
    });
  }
  for (const rule of input.rules) {
    if (!rule.active) continue;
    const isTransfer = rule.type === 'transfer';
    all.push({
      key: rule.id,
      icon: isTransfer ? 'repeat' : rule.type === 'income' ? 'arrow-down-right' : 'arrow-up-right',
      iconBg: (() => {
        const c = isTransfer ? undefined : input.categoryColor?.(rule.categoryId);
        return c
          ? hexToRgba(c, 0.28)
          : input.secondary
            ? shade(input.secondary, 94)
            : theme.colors.secondaryTint;
      })(),
      title: isTransfer
        ? `${input.accountName(rule.accountId) ?? '—'} → ${input.accountName(rule.toAccountId) ?? '—'}`
        : rule.note || input.categoryName(rule.categoryId) || 'Recurring',
      subtitle: dueDateLabel(rule.nextRunDate),
      amountMinor: rule.amountMinor,
      sign: rule.type === 'income' ? '+' : rule.type === 'expense' ? '-' : '',
      sortDate: rule.nextRunDate,
      route: '/recurring',
      urgent: isDueUrgent(rule.nextRunDate),
      payable: false,
      pinned: daysUntilIsoDate(rule.nextRunDate) < 0,
    });
  }
  all.sort((a, b) =>
    a.sortDate !== b.sortDate ? (a.sortDate < b.sortDate ? -1 : 1) : b.amountMinor - a.amountMinor
  );
  const inWindow = all.filter((i) => daysUntilIsoDate(i.sortDate) <= UPCOMING_DAYS);
  // Bills to pay come first, each group still soonest first.
  const items = [...inWindow.filter((i) => i.pinned), ...inWindow.filter((i) => !i.pinned)];
  return { items, next: all.find((i) => daysUntilIsoDate(i.sortDate) > UPCOMING_DAYS) ?? null };
}

/** "8 Oct" — the last day Upcoming looks at. */
function windowEndLabel(): string {
  const end = addDaysToIsoDate(toLocalIsoDate(new Date()), UPCOMING_DAYS);
  return parseLocalIsoDate(end).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
}

/**
 * Home's swipe card pages: Upcoming (time-sensitive), then budgets nearest their limits, then goals;
 * a page with nothing to show isn't drawn.
 */
export function HomeGlance({
  upcoming,
  budgets,
  goals,
  rowEntering,
  onSeeMoreUpcoming,
  budgetAlert,
}: {
  upcoming: Upcoming;
  /** "+N more" — opens Plan's Coming up, which lists the whole fortnight by day. */
  onSeeMoreUpcoming: () => void;
  /** Most urgent first, as listBudgetsForMonth returns them. */
  budgets: BudgetProgress[];
  goals: SavingsGoal[];
  /** A budget is nearly out or over: the Budgets tab gets a red dot. */
  budgetAlert: boolean;
  rowEntering: (i: number) => React.ComponentProps<typeof Animated.View>['entering'];
}) {
  const visibleUpcoming = upcoming.items.slice(0, UPCOMING_ROWS);
  const hiddenUpcoming = upcoming.items.length - visibleUpcoming.length;
  // Labels only help when a bill is pinned: otherwise the list reads as it always did.
  const hasPinned = visibleUpcoming.some((i) => i.pinned);
  // Red only for what is due today or late; a bill a few days out is amber.
  const hasUrgent = visibleUpcoming.some((i) => i.urgent);
  // What leaves your accounts in the window — every bill and expense, not money coming in.
  const dueMinor = upcoming.items.reduce((sum, i) => (i.sign === '-' ? sum + i.amountMinor : sum), 0);
  const topBudgets = budgets.slice(0, 3);
  const activeGoals = goals.filter((g) => !g.archived);
  // Capped, not a nested horizontal ScrollView: that would fight the swipe card's own page-swipe gesture.
  // Shows as many chips as fit plus a "+N" tile, the cap-and-link pattern Budgets/Upcoming use.
  const topGoals = activeGoals.slice(0, 2);
  const hiddenGoalsCount = activeGoals.length - topGoals.length;

  const pages: SwipePage[] = [
    ...(upcoming.items.length > 0 || upcoming.next
      ? [
          {
            key: 'upcoming',
            label: 'Upcoming',
            alert: upcoming.items.some((i) => i.pinned),
            count: upcoming.items.length,
            // No "See all" footer: "+N more" already leads to Plan, and each
            // row deep-links to where it lives (Loans, Recurring, pay a card).
            content: (
              <View style={styles.pageList}>
                <View style={styles.windowCaption}>
                  <Text style={styles.windowLabel}>
                    <Text style={styles.windowBold}>Next {UPCOMING_DAYS} days</Text> · till {windowEndLabel()}
                  </Text>
                  <Text style={styles.windowCount}>
                    {upcoming.items.length > 0
                      ? `${dueMinor > 0 ? `${formatMoney(dueMinor)} · ` : ''}${upcoming.items.length} due`
                      : 'none'}
                  </Text>
                </View>
                {upcoming.items.length === 0 && (
                  <View style={styles.quiet}>
                    <Text style={styles.quietTitle}>Nothing due this week</Text>
                    <Text style={styles.quietSub}>Enjoy the quiet.</Text>
                  </View>
                )}
                {visibleUpcoming.map((item, i) => {
                  const startsGroup = hasPinned && (i === 0 || item.pinned !== visibleUpcoming[i - 1].pinned);
                  return (
                    <Animated.View key={item.key} entering={rowEntering(i)}>
                      {startsGroup && (
                        <Text
                          style={[
                            styles.groupLabel,
                            item.pinned && !hasUrgent && styles.groupLabelSoon,
                            !item.pinned && i > 0 && styles.groupLabelLater,
                          ]}
                        >
                          {item.pinned ? 'Due soon' : 'Later this week'}
                        </Text>
                      )}
                      <UpcomingRow
                        icon={item.icon}
                        iconBg={item.iconBg}
                        iconColor={item.iconColor}
                        title={item.title}
                        subtitle={item.subtitle}
                        amountMinor={item.amountMinor}
                        sign={item.sign}
                        onPress={() => router.push(item.route)}
                        divider={i > 0 && !startsGroup}
                        urgent={item.urgent}
                        soon={item.pinned && !item.urgent}
                        date={item.sortDate}
                        actionLabel={item.pinned && item.payable ? 'Pay' : undefined}
                        highlight={item.pinned}
                      />
                    </Animated.View>
                  );
                })}
                {upcoming.items.length === 0 && upcoming.next && (
                  <UpcomingRow
                    icon={upcoming.next.icon}
                    iconBg={upcoming.next.iconBg}
                    iconColor={upcoming.next.iconColor}
                    title={upcoming.next.title}
                    subtitle={`Next · ${upcoming.next.subtitle.toLowerCase()}`}
                    amountMinor={upcoming.next.amountMinor}
                    sign={upcoming.next.sign}
                    onPress={() => router.push(upcoming.next!.route)}
                    divider
                    date={upcoming.next.sortDate}
                  />
                )}
                {hiddenUpcoming > 0 && (
                  <UpcomingMoreRow count={hiddenUpcoming} divider onPress={onSeeMoreUpcoming} />
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
            alert: budgetAlert,
            count: budgets.length,
            onSeeAll: () => router.push('/budgets'),
            content: (
              <View style={styles.pageList}>
                {topBudgets.map((progress, i) => (
                  <Animated.View key={progress.budget.id} entering={rowEntering(i)}>
                    <BudgetRow
                      progress={progress}
                      divider={i > 0}
                      grow
                      onPress={() => router.push(growHref('/budgets'))}
                    />
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
            count: activeGoals.length,
            onSeeAll: () => router.push('/savings-goals'),
            content: (
              <View style={styles.goalsPageRow}>
                {topGoals.map((goal, i) => (
                  <Animated.View key={goal.id} entering={rowEntering(i)}>
                    <GoalChip goal={goal} grow onPress={() => router.push(growHref('/savings-goals'))} />
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
  windowCaption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 4,
  },
  windowLabel: { fontFamily: theme.font.body, fontSize: 13, color: theme.colors.textMuted },
  windowBold: { fontFamily: theme.font.bodyBold, color: theme.colors.textSecondary },
  windowCount: { fontFamily: theme.font.monoBold, fontSize: 13, color: theme.colors.textSecondary },
  groupLabel: {
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 4,
    fontFamily: theme.font.bodyBold,
    fontSize: 12,
    color: theme.colors.expenseText,
  },
  groupLabelSoon: { color: theme.colors.dueInk },
  groupLabelLater: {
    color: theme.colors.textMuted,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: theme.colors.divider,
  },
  quiet: { paddingHorizontal: 14, paddingTop: 12, paddingBottom: 10, gap: 2 },
  quietTitle: { fontFamily: theme.font.roundedBold, fontSize: 15, color: theme.colors.textPrimary },
  quietSub: { fontFamily: theme.font.body, fontSize: 12.5, color: theme.colors.textMuted },
  // Rows inside a HomeSwipeCard page: no outer border/background (the card draws it); BudgetRow/UpcomingRow
  // already carry their own horizontal padding.
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

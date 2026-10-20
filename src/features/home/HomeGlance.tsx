import { Section } from '@/components/Section';
import { withPressed } from '@/lib/pressed';
import { View, Pressable, StyleSheet } from 'react-native';
import Animated from 'react-native-reanimated';
import Feather from '@expo/vector-icons/Feather';
import { router } from 'expo-router';
import { Text } from '@/components/Text';
import { theme } from '@/constants/theme';
import { hexToRgba, shade } from '@/lib/color';
import { dueDateLabel, isDueUrgent } from '@/lib/dueDate';
import { daysUntilIsoDate } from '@/lib/date';
import { payCardRoute, PayCardRoute } from '@/lib/payCard';
import type { PlanCardBillInput } from '@/features/plan/planOverview';
import { RecurringRule } from '@/types';
import { UpcomingRow } from './UpcomingRow';
import { ExpectedRefund } from '@/db/refundTracking';
import { HomeRefunds } from './HomeRefunds';

interface UpcomingItem {
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

interface UpcomingLoanInput {
  id: string;
  name: string;
  nextDueDate: string;
  nextEmiMinor: number;
}

export interface Upcoming {
  /** Next occurrence from every supported schedule, before the short-window filter. */
  all?: UpcomingItem[];
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
  return { all, items, next: all.find((i) => daysUntilIsoDate(i.sortDate) > UPCOMING_DAYS) ?? null };
}

/** Rank next scheduled money-out occurrences across loans, recurring bills and unpaid cards. */
export function largestUpcomingOutgoings(upcoming: Upcoming): UpcomingItem[] {
  const candidates = upcoming.all ?? [...upcoming.items, ...(upcoming.next ? [upcoming.next] : [])];
  return [
    ...new Map(
      candidates.filter((item) => item.sign === '-' && item.amountMinor > 0).map((item) => [item.key, item])
    ).values(),
  ]
    .sort(
      (a, b) =>
        b.amountMinor - a.amountMinor || a.sortDate.localeCompare(b.sortDate) || a.key.localeCompare(b.key)
    )
    .slice(0, 3);
}

/** Next payments stay visible; detailed budgets and goals live in Plan. */
export function HomeGlance({
  upcoming,
  rowEntering,
  onSeeMoreUpcoming,
  refunds = [],
  refundError = false,
  openingRefund,
  onOpenRefund,
  onRetryRefunds,
}: {
  upcoming: Upcoming;
  rowEntering: (i: number) => React.ComponentProps<typeof Animated.View>['entering'];
  onSeeMoreUpcoming: () => void;
  refunds?: ExpectedRefund[];
  refundError?: boolean;
  openingRefund?: string | null;
  onOpenRefund?: (transactionId: string) => void;
  onRetryRefunds?: () => void;
}) {
  const visible = largestUpcomingOutgoings(upcoming);
  return (
    <>
      <Section compact title="Next up" onSeeAll={onSeeMoreUpcoming} actionLabel="View plan">
        <View style={styles.card}>
          {visible.length ? (
            visible.map((item, i) => (
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
                  soon={item.pinned && !item.urgent}
                  date={item.sortDate}
                  dueDate={item.sortDate}
                  actionLabel={item.pinned && item.payable ? 'Pay' : undefined}
                  highlight={item.pinned}
                />
              </Animated.View>
            ))
          ) : (
            <Pressable
              onPress={onSeeMoreUpcoming}
              accessibilityRole="button"
              accessibilityLabel="Nothing scheduled. Open Plan"
              style={withPressed(styles.empty)}
            >
              <Feather name="check-circle" size={20} color={theme.colors.incomeText} />
              <View style={styles.copy}>
                <Text style={styles.title}>Nothing scheduled</Text>
                <Text style={styles.hint}>Add bills and recurring payments in Plan.</Text>
              </View>
              <Feather name="chevron-right" size={16} color={theme.colors.textMuted} />
            </Pressable>
          )}
        </View>
        {(refunds.length > 0 || refundError) && (
          <View style={styles.refunds}>
            <HomeRefunds
              refunds={refunds}
              failed={refundError}
              openingId={openingRefund}
              onOpen={onOpenRefund}
              onRetry={onRetryRefunds}
              compact
            />
          </View>
        )}
      </Section>
    </>
  );
}
const styles = StyleSheet.create({
  card: {
    marginHorizontal: 16,
    paddingHorizontal: 8,
    borderRadius: 20,
    backgroundColor: theme.colors.surface,
    overflow: 'hidden',
  },
  refunds: {
    marginHorizontal: 16,
    marginTop: 8,
    borderRadius: 20,
    backgroundColor: theme.colors.surface,
  },
  empty: { minHeight: 80, flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 },
  copy: { flex: 1, minWidth: 0, gap: 5 },
  title: { fontFamily: theme.font.bodyMedium, fontSize: 13, color: theme.colors.textPrimary },
  hint: { fontFamily: theme.font.body, fontSize: 12, lineHeight: 18, color: theme.colors.textSecondary },
});

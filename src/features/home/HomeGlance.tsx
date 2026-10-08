import Feather from '@expo/vector-icons/Feather';
import { theme } from '@/constants/theme';
import { hexToRgba, shade } from '@/lib/color';
import { dueDateLabel, isDueUrgent } from '@/lib/dueDate';
import { daysUntilIsoDate } from '@/lib/date';
import { payCardRoute, PayCardRoute } from '@/lib/payCard';
import type { PlanCardBillInput } from '@/features/plan/planOverview';
import { RecurringRule } from '@/types';

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

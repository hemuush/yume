import { subscriptionTotals } from '@/db/subscriptions';
import { savingsAccountIdsOf } from '@/lib/account';
import { investmentIdsOf } from '@/lib/investment';
import { isSavingsEntry } from '@/lib/privateSummary';
import { recurringRulesInCurrency } from '@/lib/recurringScope';
import type { Account, Category, RecurringRule } from '@/types';
import { costShares, runMarks, sortRunning } from './recurring.helpers';

/**
 * What the Recurring page shows, worked out from the rules. With "hide savings & investment amounts" on, a rule that is
 * one (a SIP, a transfer to savings) is `masked` and left out of every total, share and mark. Rules in another currency
 * than the default stay out of the totals too, but still show in the list.
 */
export function buildRecurringModel({
  rules,
  accounts,
  categories,
  currency,
  hideAmounts,
  todayIso,
}: {
  rules: RecurringRule[];
  accounts: Account[];
  categories: Category[];
  currency: string;
  hideAmounts: boolean;
  todayIso: string;
}) {
  const categoriesById = new Map(categories.map((c) => [c.id, c]));
  const savingsIds = savingsAccountIdsOf(accounts);
  const masked = new Set(
    hideAmounts ? rules.filter((r) => isSavingsEntry(r, categoriesById, savingsIds)).map((r) => r.id) : []
  );
  const running = rules.filter((r) => r.active);
  const visibleRules = recurringRulesInCurrency(
    rules.filter((r) => !masked.has(r.id)),
    accounts,
    currency
  );
  return {
    categoriesById,
    masked,
    investIds: investmentIdsOf(accounts),
    /** Biggest first. */
    activeRules: sortRunning(running),
    pausedRules: rules.filter((r) => !r.active),
    totals: subscriptionTotals(visibleRules),
    shares: costShares(visibleRules, categoriesById),
    hasVisibleRules: visibleRules.length > 0,
    nextDate: visibleRules
      .filter((r) => r.active)
      .reduce<string | null>((min, r) => (min === null || r.nextRunDate < min ? r.nextRunDate : min), null),
    marks: runMarks(
      visibleRules.filter((r) => r.active),
      todayIso
    ),
    hasOtherCurrencies: running.some(
      (r) => !masked.has(r.id) && accounts.find((a) => a.id === r.accountId)?.currency !== currency
    ),
  };
}

export type RecurringModel = ReturnType<typeof buildRecurringModel>;

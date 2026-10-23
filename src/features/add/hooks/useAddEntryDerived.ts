import { useEffect, useMemo } from 'react';
import { addDaysToIsoDate, toLocalIsoDate } from '@/lib/date';
import { stagedTotals } from '@/features/add/saveEntry';
import { defaultCurrencyAccountsOf, spendableAccountsOf } from '@/lib/account';
import type { useAddEntryState } from '@/features/add/hooks/useAddEntryState';

type Input = {
  state: ReturnType<typeof useAddEntryState>;
};
export function useAddEntryDerived(input: Input) {
  const {
    categories,
    type,
    accounts,
    accountId,
    friendAccountId,
    setRepeatWarning,
    expr,
    toAccountId,
    categoryId,
    date,
    rows,
  } = input.state;

  const filteredCategories = useMemo(
    () => categories.filter((c) => c.kind === (type === 'income' ? 'income' : 'expense')),
    [categories, type]
  );

  // Savings accounts aren't directly spendable: expense/income/friend entries offer only non-savings
  // accounts, transfers all. createTransaction (src/db/ledger.ts) enforces it too.
  const spendableAccounts = useMemo(() => spendableAccountsOf(accounts), [accounts]);

  const friendAccounts = defaultCurrencyAccountsOf(spendableAccounts);

  const pickableAccounts =
    type === 'transfer' ? accounts : type === 'friend' ? friendAccounts : spendableAccounts;

  const effectiveAccountId =
    accountId && pickableAccounts.some((a) => a.id === accountId)
      ? accountId
      : (pickableAccounts[0]?.id ?? null);

  const effectiveAccount = accounts.find((a) => a.id === effectiveAccountId);

  const today = toLocalIsoDate(new Date());

  const yesterday = addDaysToIsoDate(today, -1);

  // The amount's currency: the account it's going on (a friend entry's, if cash moved).
  const currency =
    (type === 'friend'
      ? accounts.find((a) => a.id === friendAccountId)?.currency
      : effectiveAccount?.currency) ?? undefined;

  // Any change to what's being entered clears a repeat warning about the old entry.
  useEffect(() => {
    setRepeatWarning(null);
  }, [expr, type, effectiveAccountId, toAccountId, categoryId, date, setRepeatWarning]);

  const totals = stagedTotals(rows);
  return {
    filteredCategories,
    friendAccounts,
    pickableAccounts,
    effectiveAccountId,
    effectiveAccount,
    today,
    yesterday,
    currency,
    totals,
  };
}

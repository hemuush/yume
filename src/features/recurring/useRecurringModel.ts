import { useMemo } from 'react';
import { toLocalIsoDate } from '@/lib/date';
import { useStableSet, useStableValue } from '@/lib/stableData';
import type { Account, Category, RecurringRule } from '@/types';
import { buildRecurringModel } from './recurringModel';

/**
 * `buildRecurringModel`, with what the rows hold kept the same object while it holds the same things: the set of
 * investment accounts and the two lookups by account (its name, its currency), so a balance moving does not draw every rule
 * again.
 */
export function useRecurringModel(
  {
    rules,
    accounts,
    categories,
    currency,
    today,
  }: { rules: RecurringRule[]; accounts: Account[]; categories: Category[]; currency: string; today: string },
  hideAmounts: boolean
) {
  const todayIso = today || toLocalIsoDate(new Date());
  const model = useMemo(
    () => buildRecurringModel({ rules, accounts, categories, currency, hideAmounts, todayIso }),
    [rules, accounts, categories, currency, hideAmounts, todayIso]
  );
  const investIds = useStableSet(model.investIds);
  const names = useStableValue(accounts.map((a) => [a.id, a.name] as const));
  const currencies = useStableValue(accounts.map((a) => [a.id, a.currency] as const));
  const accountName = useMemo(() => {
    const byId = new Map(names);
    return (id: string) => byId.get(id) ?? '—';
  }, [names]);
  const accountCurrency = useMemo(() => {
    const byId = new Map(currencies);
    return (id: string) => byId.get(id);
  }, [currencies]);
  return { ...model, todayIso, investIds, accountName, accountCurrency };
}

import { useEffect } from 'react';
import { getLastAccountForCategory } from '@/db/ledger';
import { useAddSuggestions } from '@/features/add/useAddSuggestions';
import type { useAddEntryEnvironment } from '@/features/add/hooks/useAddEntryEnvironment';
import type { useAddEntryState } from '@/features/add/hooks/useAddEntryState';

type Input = {
  state: ReturnType<typeof useAddEntryState>;
  environment: ReturnType<typeof useAddEntryEnvironment>;
};
export function useAddEntrySuggestions(input: Input) {
  const { type, categoryId, accounts, accountId, accountPickedByHandRef, setAccountId } = input.state;
  const { editingId } = input.environment;

  const { frequentAmounts, usual } = useAddSuggestions({
    type,
    categoryId,
    editingId,
    accountCurrency: accounts.find((a) => a.id === accountId)?.currency,
  });

  // A new entry's account follows its category (the account that category was last used with) until you
  // pick an account yourself.
  useEffect(() => {
    if (editingId || accountPickedByHandRef.current || !categoryId) return;
    if (type !== 'expense' && type !== 'income') return;
    let cancelled = false;
    getLastAccountForCategory(categoryId)
      .then((id) => {
        if (cancelled || accountPickedByHandRef.current || !id) return;
        if (accounts.some((a) => a.id === id && a.type !== 'savings')) setAccountId(id);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [categoryId, type, accounts, editingId, accountPickedByHandRef, setAccountId]);
  return { frequentAmounts, usual };
}

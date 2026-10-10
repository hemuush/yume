import { useEffect, useState } from 'react';
import { getFrequentAmountsForCategory, getRepeatEntries, RepeatEntry } from '@/db/ledger';
import { toLocalIsoDate } from '@/lib/date';
import { EntryType } from './addEntry';
import { usePrivacy } from '@/theme/PrivacyContext';

/** How many "Your usual" chips Add shows. */
const USUAL_COUNT = 4;

/**
 * The two convenience rows on Add: this category's usual amounts, and "Your usual" whole entries. Both are
 * only for expense/income; both fail quietly, since they are a shortcut and not part of saving.
 */
export function useAddSuggestions({
  type,
  categoryId,
  editingId,
  accountCurrency,
}: {
  type: EntryType;
  categoryId: string | null;
  editingId: string | undefined;
  accountCurrency?: string;
}) {
  const { hideAmounts } = usePrivacy();
  const [frequentAmounts, setFrequentAmounts] = useState<number[]>([]);
  const [frequentKey, setFrequentKey] = useState('');
  const currentKey = `${type}:${categoryId}:${hideAmounts}:${accountCurrency}`;
  const [usual, setUsual] = useState<RepeatEntry[]>([]);
  const [usualKey, setUsualKey] = useState('');
  const currentUsualKey = `${type}:${editingId ?? ''}`;

  // Only expense/income have a "usual amount for this category"; transfers and friend entries (keyed to a
  // person) don't. Re-fetches on every categoryId change, which is exactly when it differs.
  useEffect(() => {
    if ((type !== 'expense' && type !== 'income') || !categoryId) {
      setFrequentAmounts([]);
      return;
    }
    let cancelled = false;
    getFrequentAmountsForCategory(categoryId, 4, toLocalIsoDate(new Date()), hideAmounts, accountCurrency)
      .then((amounts) => {
        if (!cancelled) {
          setFrequentAmounts(amounts);
          setFrequentKey(currentKey);
        }
      })
      .catch(() => {
        if (!cancelled) setFrequentAmounts([]);
      });
    return () => {
      cancelled = true;
    };
  }, [type, categoryId, hideAmounts, accountCurrency, currentKey]);

  // The entries of this type logged most in the last 90 days (category, amount and account together), one
  // tap each. New entries only.
  useEffect(() => {
    if (editingId || (type !== 'expense' && type !== 'income')) {
      setUsual([]);
      return;
    }
    let cancelled = false;
    getRepeatEntries(USUAL_COUNT, toLocalIsoDate(new Date()), type)
      .then((entries) => {
        if (!cancelled) {
          setUsual(entries);
          setUsualKey(currentUsualKey);
        }
      })
      .catch(() => {
        if (!cancelled) setUsual([]);
      });
    return () => {
      cancelled = true;
    };
  }, [type, editingId, currentUsualKey]);

  // Hide stale suggestions immediately while a privacy-aware reload is pending.
  return {
    frequentAmounts: frequentKey === currentKey ? frequentAmounts : [],
    usual: usualKey !== currentUsualKey ? [] : hideAmounts ? usual.filter((e) => !e.isSensitive) : usual,
  };
}

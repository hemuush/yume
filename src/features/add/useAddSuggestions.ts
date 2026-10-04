import { useEffect, useState } from 'react';
import { getFrequentAmountsForCategory, getRepeatEntries, RepeatEntry } from '@/db/ledger';
import { toLocalIsoDate } from '@/lib/date';
import { EntryType } from './addEntry';

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
}: {
  type: EntryType;
  categoryId: string | null;
  editingId: string | undefined;
}) {
  const [frequentAmounts, setFrequentAmounts] = useState<number[]>([]);
  const [usual, setUsual] = useState<RepeatEntry[]>([]);

  // Only expense/income have a "usual amount for this category"; transfers and friend entries (keyed to a
  // person) don't. Re-fetches on every categoryId change, which is exactly when it differs.
  useEffect(() => {
    if ((type !== 'expense' && type !== 'income') || !categoryId) {
      setFrequentAmounts([]);
      return;
    }
    let cancelled = false;
    getFrequentAmountsForCategory(categoryId)
      .then((amounts) => {
        if (!cancelled) setFrequentAmounts(amounts);
      })
      .catch(() => {
        if (!cancelled) setFrequentAmounts([]);
      });
    return () => {
      cancelled = true;
    };
  }, [type, categoryId]);

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
        if (!cancelled) setUsual(entries);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [type, editingId]);

  return { frequentAmounts, usual };
}

import { useCallback, useEffect, useRef, useState } from 'react';
import { listTransactions } from '@/db/ledger';
import { getCachedCurrency } from '@/db/settings';
import { errorMessage } from '@/lib/errorMessage';
import { isSavingsEntry } from '@/lib/privateSummary';
import type { Category, Transaction } from '@/types';

/** A moment after the finger settles on a day: touching through the days of a month reads only where it rests. */
const SETTLE_MS = 120;

/**
 * The entries of the day under the heatmap's inspector (null while they load). The heatmap leaves savings and
 * investments out while they are hidden, so the day does too. Only the newest read may land.
 */
export function useDayEntries({
  iso,
  hideAmounts,
  catById,
  savingsIds,
}: {
  iso: string;
  hideAmounts: boolean;
  catById: ReadonlyMap<string, Category>;
  savingsIds: ReadonlySet<string>;
}) {
  const [data, setData] = useState<{ iso: string; txs: Transaction[] } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [retries, setRetries] = useState(0);
  const seq = useRef(0);
  useEffect(() => {
    const mine = ++seq.current;
    setError(null);
    const timer = setTimeout(async () => {
      try {
        const txs = await listTransactions({ fromDate: iso, toDate: iso, currency: getCachedCurrency() });
        if (mine !== seq.current) return;
        setData({
          iso,
          txs: hideAmounts ? txs.filter((tx) => !isSavingsEntry(tx, catById, savingsIds)) : txs,
        });
      } catch (e) {
        if (mine === seq.current) setError(errorMessage(e));
      }
    }, SETTLE_MS);
    return () => clearTimeout(timer);
  }, [iso, hideAmounts, catById, savingsIds, retries]);
  useEffect(
    () => () => {
      ++seq.current;
    },
    []
  );
  const retry = useCallback(() => setRetries((n) => n + 1), []);
  return {
    /** The day's entries, or null while they are read (and for any other day than `iso`). */
    txs: data?.iso === iso ? data.txs : null,
    error,
    retry,
  };
}

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
  version = 0,
}: {
  iso: string;
  hideAmounts: boolean;
  catById: ReadonlyMap<string, Category>;
  savingsIds: ReadonlySet<string>;
  version?: number;
}) {
  const currency = getCachedCurrency();
  const requestKey = `${iso}|${currency}|${version}`;
  const [data, setData] = useState<{ key: string; txs: Transaction[] } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [retries, setRetries] = useState(0);
  const seq = useRef(0);
  useEffect(() => {
    const mine = ++seq.current;
    setError(null);
    const timer = setTimeout(async () => {
      try {
        const txs = await listTransactions({ fromDate: iso, toDate: iso, currency });
        if (mine !== seq.current) return;
        setData({ key: requestKey, txs });
      } catch (e) {
        if (mine === seq.current) setError(errorMessage(e));
      }
    }, SETTLE_MS);
    return () => clearTimeout(timer);
  }, [iso, currency, requestKey, retries]);
  useEffect(
    () => () => {
      ++seq.current;
    },
    []
  );
  const retry = useCallback(() => setRetries((n) => n + 1), []);
  const entries = data?.key === requestKey ? data.txs : null;
  const txs = useMemo(
    () =>
      entries && hideAmounts ? entries.filter((tx) => !isSavingsEntry(tx, catById, savingsIds)) : entries,
    [entries, hideAmounts, catById, savingsIds]
  );
  return {
    /** The day's entries, or null while they are read (and for any other day than `iso`). */
    txs,
    error,
    retry,
  };
}

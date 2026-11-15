import { useCallback, useEffect, useRef, useState } from 'react';
import { listAccounts, countTransactions } from '@/db/ledger';
import { listLoans } from '@/db/loans';
import { trackedBalanceParts, type TrackedBalanceParts } from '@/db/reports';
import { listPeople } from '@/db/people';
import { getDefaultCurrency } from '@/db/settings';
import { keepFieldsIfEqual, reuseUnchanged } from '@/lib/stableData';
import { useScreenLoad } from '@/lib/useScreenLoad';
import type { Account } from '@/types';

interface YouData {
  accounts: Account[];
  archivedAccounts: Account[];
  txCount: number;
  activeLoanCount: number;
  peopleCount: number;
  /** The three terms the tracked balance adds up, kept apart so the card can show them as a sum. */
  parts: TrackedBalanceParts;
  defaultCurrency: string;
  hasOtherCurrency: boolean;
  hasLoans: boolean;
  hasUntrackedAssetLoan: boolean;
}

const NONE: YouData = {
  accounts: [],
  archivedAccounts: [],
  txCount: 0,
  activeLoanCount: 0,
  peopleCount: 0,
  parts: { accountsMinor: 0, loansMinor: 0, peopleMinor: 0 },
  defaultCurrency: 'INR',
  hasOtherCurrency: false,
  hasLoans: false,
  hasUntrackedAssetLoan: false,
};

/**
 * What the You page reads: the accounts (active and archived), the counts for the link tiles and the tracked balance's
 * parts, reloaded when the page is shown after a write. It reads everything as one update, keeps every account that is
 * exactly as before (so its tile is not drawn again), and sets no state when nothing is new.
 */
export function useYouData() {
  const [data, setData] = useState(NONE);
  // What is held, so a reload that found nothing new sets no state at all.
  const held = useRef(NONE);
  // Only the newest load may land, and none after the page is gone.
  const request = useRef(0);
  useEffect(
    () => () => {
      request.current += 1;
    },
    []
  );
  const loadYou = useCallback(async () => {
    const id = ++request.current;
    const [accs, allAccs, txCount, loans, people, currency] = await Promise.all([
      listAccounts(),
      listAccounts(true),
      // Only the count is shown — loading every row just to take .length
      // was the single heaviest query on this screen.
      countTransactions(),
      listLoans(),
      listPeople(),
      getDefaultCurrency(),
    ]);
    if (id !== request.current) return;
    const openLoans = loans.filter((l) => l.status !== 'closed');
    const prev = held.current;
    const next = keepFieldsIfEqual(prev, {
      accounts: reuseUnchanged(prev.accounts, accs),
      archivedAccounts: reuseUnchanged(
        prev.archivedAccounts,
        allAccs.filter((a) => a.archived)
      ),
      txCount,
      activeLoanCount: loans.filter((l) => l.status === 'active').length,
      peopleCount: people.length,
      parts: trackedBalanceParts({ accounts: accs, loans, people, defaultCurrency: currency }),
      defaultCurrency: currency,
      hasOtherCurrency: accs.some((a) => a.currency !== currency),
      hasLoans: openLoans.length > 0,
      hasUntrackedAssetLoan: openLoans.some((l) => l.direction === 'borrowed' && !l.assetValueMinor),
    });
    if (next === prev) return;
    held.current = next;
    setData(next);
  }, []);
  const { loaded, hasData, loadError, reload } = useScreenLoad(loadYou);
  return { ...data, loaded, hasData, loadError, reload };
}

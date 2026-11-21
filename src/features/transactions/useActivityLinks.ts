import { useEffect, type Dispatch, type SetStateAction } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { showAlert } from '@/components/AppDialog';
import { getTransactionById } from '@/db/transactions';
import type { Transaction } from '@/types';
import type { ActivityType } from './activityFilter';

/**
 * What a link can ask of Activity: `?category=` (a category page's "See all") or `?account=` (Home's account sheet)
 * open it already filtered, with `?month=YYYY-MM`; a month alone (Home's "View all" on a past month) opens that
 * month; `?entry=` opens one entry's detail. Each is spent once it has been applied.
 */
export function useActivityLinks({
  accountsLoaded,
  closeSearch,
  setFilterType,
  setFilterCategoryIds,
  setFilterAccountIds,
  setFilterLabel,
  setDirection,
  setAnchor,
  setViewScope,
  setDetailTx,
}: {
  /** An entry link waits until the accounts are in, so its detail can name them. */
  accountsLoaded: boolean;
  closeSearch: () => void;
  setFilterType: Dispatch<SetStateAction<ActivityType>>;
  setFilterCategoryIds: Dispatch<SetStateAction<string[]>>;
  setFilterAccountIds: Dispatch<SetStateAction<string[]>>;
  setFilterLabel: Dispatch<SetStateAction<string | undefined>>;
  setDirection: Dispatch<SetStateAction<-1 | 0 | 1>>;
  setAnchor: Dispatch<SetStateAction<Date>>;
  setViewScope: Dispatch<SetStateAction<'week' | 'month'>>;
  setDetailTx: Dispatch<SetStateAction<Transaction | null>>;
}) {
  const linkParams = useLocalSearchParams<{
    category?: string;
    account?: string;
    month?: string;
    entry?: string;
  }>();
  useEffect(() => {
    const { category, account, month } = linkParams;
    // A real month that isn't in the future; anything else keeps the current view.
    const [y, m] = month && /^\d{4}-\d{2}$/.test(month) ? month.split('-').map(Number) : [0, 0];
    const now = new Date();
    const validMonth =
      m >= 1 && m <= 12 && (y < now.getFullYear() || (y === now.getFullYear() && m <= now.getMonth() + 1));
    // A month on its own (Home's "View all") opens that month; a bad one is dropped and the view
    // stays as it is.
    if (!category && !account) {
      if (!month) return;
      if (!validMonth) {
        router.setParams({ month: undefined });
        return;
      }
    }
    // A link shows its filter, not search results left open from before.
    closeSearch();
    setFilterType('all');
    setFilterCategoryIds(category ? [category] : []);
    setFilterAccountIds(account ? [account] : []);
    setFilterLabel(undefined);
    if (validMonth) {
      setDirection(0);
      setAnchor(new Date(y, m - 1, 1));
      setViewScope('month');
    }
    router.setParams({ category: undefined, account: undefined, month: undefined });
  }, [
    linkParams,
    closeSearch,
    setFilterType,
    setFilterCategoryIds,
    setFilterAccountIds,
    setFilterLabel,
    setDirection,
    setAnchor,
    setViewScope,
  ]);
  useEffect(() => {
    if (!linkParams.entry || !accountsLoaded) return;
    let live = true;
    getTransactionById(linkParams.entry)
      .then((tx) => {
        if (!live) return;
        if (tx) {
          const [year, month] = tx.date.split('-').map(Number);
          closeSearch();
          setFilterType('all');
          setFilterCategoryIds([]);
          setFilterAccountIds([]);
          setFilterLabel(undefined);
          setViewScope('month');
          setAnchor(new Date(year, month - 1, 1));
          setDetailTx(tx);
        } else showAlert('Entry unavailable', 'This entry may have been deleted.');
        router.setParams({ entry: undefined });
      })
      .catch(() => {
        if (live) {
          showAlert('Couldn’t open entry', 'Reopen it from Reports to retry.');
          router.setParams({ entry: undefined });
        }
      });
    return () => {
      live = false;
    };
  }, [
    linkParams.entry,
    accountsLoaded,
    closeSearch,
    setFilterType,
    setFilterCategoryIds,
    setFilterAccountIds,
    setFilterLabel,
    setViewScope,
    setAnchor,
    setDetailTx,
  ]);
}

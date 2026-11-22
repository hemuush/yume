import { useMemo } from 'react';
import { getCachedCurrency } from '@/db/settings';
import type { Account, Category, Transaction } from '@/types';
import { buildWeekSpendBars, buildWeeklySpendBars } from './spendChart';
import { chartTransactionsFor, filterActivity } from './transactions.helpers';

/**
 * What Activity's chart and headline are drawn from: the period's real, unfiltered entries (hidden savings and
 * investment categories left out), narrowed by the account, category and label filters (the type chips only organise
 * the list), and the bars made from them: a bar a day for a week, a bar a week for a month.
 */
export function useActivityChart({
  transactions,
  accountsById,
  categoriesById,
  categories,
  investmentIds,
  hideAmounts,
  loadedPeriod,
  today,
  filterCategoryIds,
  filterAccountIds,
  filterLabel,
}: {
  transactions: Transaction[];
  accountsById: ReadonlyMap<string, Account>;
  categoriesById: ReadonlyMap<string, Category>;
  categories: Category[];
  investmentIds: ReadonlySet<string>;
  hideAmounts: boolean;
  loadedPeriod: { scope: 'week' | 'month'; fromDate: string; toDate: string };
  /** YYYY-MM-DD. */
  today: string;
  filterCategoryIds: string[];
  filterAccountIds: string[];
  filterLabel: string | undefined;
}) {
  const chartTransactions = useMemo(
    () => chartTransactionsFor(transactions, accountsById, categoriesById, getCachedCurrency(), hideAmounts),
    [transactions, accountsById, categoriesById, hideAmounts]
  );

  // Type chips organize the timeline. Account, category and label filters also scope the spending preview.
  const hasSpendFilters = !!(filterCategoryIds.length || filterAccountIds.length || filterLabel);
  const narrowedTransactions = useMemo(() => {
    if (!hasSpendFilters) return chartTransactions;
    return filterActivity(
      chartTransactions,
      {
        type: 'all',
        categoryIds: filterCategoryIds,
        accountIds: filterAccountIds,
        expenseLabel: filterLabel,
      },
      categories,
      investmentIds
    );
  }, [
    hasSpendFilters,
    chartTransactions,
    filterCategoryIds,
    filterAccountIds,
    filterLabel,
    categories,
    investmentIds,
  ]);
  const allBars = useMemo(
    () =>
      loadedPeriod.scope === 'week'
        ? buildWeekSpendBars(
            chartTransactions,
            categories,
            { start: loadedPeriod.fromDate, end: loadedPeriod.toDate },
            today
          )
        : buildWeeklySpendBars(
            chartTransactions,
            categories,
            loadedPeriod.fromDate,
            loadedPeriod.toDate,
            today
          ),
    [chartTransactions, categories, loadedPeriod, today]
  );
  const bars = useMemo(
    () =>
      narrowedTransactions === chartTransactions
        ? allBars
        : loadedPeriod.scope === 'week'
          ? buildWeekSpendBars(
              narrowedTransactions,
              categories,
              { start: loadedPeriod.fromDate, end: loadedPeriod.toDate },
              today
            )
          : buildWeeklySpendBars(
              narrowedTransactions,
              categories,
              loadedPeriod.fromDate,
              loadedPeriod.toDate,
              today
            ),
    [allBars, narrowedTransactions, chartTransactions, categories, loadedPeriod, today]
  );

  return { chartTransactions, narrowedTransactions, hasSpendFilters, bars };
}

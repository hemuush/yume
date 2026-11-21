import { useCallback, useEffect, useRef, useState } from 'react';
import { getDefaultCurrency } from '@/db/settings';
import { listAccounts, listCategories } from '@/db/ledger';
import { listRecurringRules } from '@/db/recurring';
import { listInvestmentHistory } from '@/db/investmentHistory';
import type { InvestmentFlow, InvestmentValuation } from '@/db/investmentHistory';
import { keepIfEqual, reuseUnchanged } from '@/lib/stableData';
import { useScreenLoad } from '@/hooks/useScreenLoad';
import type { Account, Category, RecurringRule } from '@/types';

interface InvestmentsData {
  accounts: Account[];
  categories: Category[];
  rules: RecurringRule[];
  currency: string;
  history: { flows: InvestmentFlow[]; valuations: InvestmentValuation[] };
}

const NONE: InvestmentsData = {
  accounts: [],
  categories: [],
  rules: [],
  currency: 'INR',
  history: { flows: [], valuations: [] },
};

/**
 * What the Investments page reads, reloaded when the page is shown after a write: the accounts, the categories, the
 * repeating rules, the default currency and the value history. It reads everything as one update, keeps every row that
 * is exactly as before (so what is worked out from them is not worked out again), and sets no state when nothing is new.
 */
export function useInvestmentsData() {
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
  const load = useCallback(async () => {
    const id = ++request.current;
    const [currency, accounts, categories, history, rules] = await Promise.all([
      getDefaultCurrency(),
      listAccounts(),
      listCategories(true),
      listInvestmentHistory(),
      listRecurringRules(),
    ]);
    if (id !== request.current) return;
    const prev = held.current;
    const next: InvestmentsData = {
      accounts: reuseUnchanged(prev.accounts, accounts),
      categories: reuseUnchanged(prev.categories, categories),
      rules: reuseUnchanged(prev.rules, rules),
      currency,
      history: keepIfEqual(prev.history, history),
    };
    if (
      next.accounts === prev.accounts &&
      next.categories === prev.categories &&
      next.rules === prev.rules &&
      next.currency === prev.currency &&
      next.history === prev.history
    )
      return;
    held.current = next;
    setData(next);
  }, []);
  const { loaded, hasData, loadError, reload } = useScreenLoad(load);
  return { ...data, loaded, hasData, loadError, reload };
}

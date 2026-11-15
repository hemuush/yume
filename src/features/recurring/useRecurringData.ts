import { useCallback, useEffect, useRef, useState } from 'react';
import { listAccounts, listCategories } from '@/db/ledger';
import { listRecurringRules } from '@/db/recurring';
import { getDefaultCurrency, getHiddenSubscriptionSuggestions } from '@/db/settings';
import { getSubscriptionSuggestions, type SubscriptionSuggestion } from '@/db/subscriptions';
import { toLocalIsoDate } from '@/lib/date';
import { reuseUnchanged, reuseUnchangedBy } from '@/lib/stableData';
import { useScreenLoad } from '@/lib/useScreenLoad';
import type { Account, Category, RecurringRule } from '@/types';

interface RecurringData {
  rules: RecurringRule[];
  accounts: Account[];
  categories: Category[];
  suggestions: SubscriptionSuggestion[];
  currency: string;
  /** The day the figures were read: what "next 30 days" counts from. */
  today: string;
}

const NONE: RecurringData = {
  rules: [],
  accounts: [],
  categories: [],
  suggestions: [],
  currency: 'INR',
  today: '',
};

/**
 * What the Recurring page reads: the rules, the accounts and categories they use, the default currency and the
 * subscriptions Yume suggests making recurring. Reloaded when the page is shown after a write or on a new day, as one
 * update, and a row that did not change stays the very same object so only the rules that changed are drawn again.
 * `setRuleActive` and `dropSuggestion` change what is held at once, ahead of the write that follows them.
 */
export function useRecurringData() {
  const [data, setData] = useState(NONE);
  // What is held, so a reload that found nothing new sets no state at all.
  const held = useRef(NONE);
  // Only the newest load may land, and none after the page is gone: an older read that finishes late would put old
  // rules back over newer ones.
  const request = useRef(0);
  useEffect(
    () => () => {
      request.current += 1;
    },
    []
  );
  const commit = useCallback((next: RecurringData) => {
    if (next === held.current) return;
    held.current = next;
    setData(next);
  }, []);

  const loadRules = useCallback(async () => {
    const id = ++request.current;
    const [rules, allAccounts, categories, hidden, currency] = await Promise.all([
      listRecurringRules(),
      listAccounts(true),
      listCategories(true),
      getHiddenSubscriptionSuggestions(),
      getDefaultCurrency(),
    ]);
    // Archived accounts stay out, except one a rule still uses: editing that rule must keep it there, not
    // quietly move it to whichever account comes first.
    const inUse = new Set(rules.flatMap((rule) => [rule.accountId, rule.toAccountId]));
    const accounts = allAccounts.filter((a) => !a.archived || inUse.has(a.id));
    // A suggestion is a nicety — if it fails, the rules still show.
    const suggestions = await getSubscriptionSuggestions(hidden).catch(() => []);
    if (id !== request.current) return;
    const prev = held.current;
    const next: RecurringData = {
      rules: reuseUnchanged(prev.rules, rules),
      accounts: reuseUnchanged(prev.accounts, accounts),
      categories: reuseUnchanged(prev.categories, categories),
      suggestions: reuseUnchangedBy(prev.suggestions, suggestions, (s) => s.key),
      currency,
      today: toLocalIsoDate(new Date()),
    };
    const same =
      next.rules === prev.rules &&
      next.accounts === prev.accounts &&
      next.categories === prev.categories &&
      next.suggestions === prev.suggestions &&
      next.currency === prev.currency &&
      next.today === prev.today;
    if (!same) commit(next);
  }, [commit]);
  const { loaded, hasData, loadError, reload } = useScreenLoad(loadRules);

  // A change made here outranks any read that started before it, which would put the old state back.
  const setRuleActive = useCallback(
    (id: string, active: boolean) => {
      request.current += 1;
      commit({
        ...held.current,
        rules: held.current.rules.map((r) => (r.id === id ? { ...r, active } : r)),
      });
    },
    [commit]
  );
  const dropSuggestion = useCallback(
    (key: string) => {
      request.current += 1;
      commit({ ...held.current, suggestions: held.current.suggestions.filter((s) => s.key !== key) });
    },
    [commit]
  );
  return { ...data, loaded, hasData, loadError, reload, setRuleActive, dropSuggestion };
}

import { useCallback, useEffect, useRef, useState } from 'react';
import { BackHandler } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { searchTransactions } from '@/db/ledger';
import { getRecentSearches, setRecentSearches, RECENT_SEARCHES_KEPT } from '@/db/settings';
import type { Transaction } from '@/types';
import { SEARCH_MIN_CHARS, SEARCH_RESULT_LIMIT } from './searchLimits';

// Fires the actual DB query this long after the last keystroke — typing
// "zomato" shouldn't run five separate queries for "z", "zo", "zom" ...
const SEARCH_DEBOUNCE_MS = 300;
/**
 * Activity's search. It is its own mode, not a filter: it queries the whole ledger, so the period nav, chart and
 * Filter (which only apply to the loaded range) step aside while it is active. The query runs a moment after the last
 * keystroke; only the newest query may write results, so one still in flight can never land under newer text.
 */
export function useActivitySearch() {
  const [active, setActive] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  // More matched than the list shows (it holds the newest SEARCH_RESULT_LIMIT), so the list says so.
  const [capped, setCapped] = useState(false);
  // Shared by the typing effect and edits/deletes made from a search result, so the list never shows a
  // stale or deleted row. Closing/clearing the box bumps it too.
  const seq = useRef(0);
  const run = useCallback(async (trimmed: string) => {
    const mine = ++seq.current;
    setFailed(false);
    if (trimmed.length < SEARCH_MIN_CHARS) {
      setResults([]);
      setCapped(false);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      // One more than the list holds: getting it back is how we know the list is not everything.
      const found = await searchTransactions(trimmed, SEARCH_RESULT_LIMIT + 1);
      if (mine === seq.current) {
        setResults(found.slice(0, SEARCH_RESULT_LIMIT));
        setCapped(found.length > SEARCH_RESULT_LIMIT);
      }
    } catch {
      if (mine === seq.current) {
        setResults([]);
        setCapped(false);
        setFailed(true);
      }
    } finally {
      if (mine === seq.current) setLoading(false);
    }
  }, []);

  // Read through a ref by `refresh`: returning from the full add-transaction screen, or a save that doesn't leave
  // Activity, re-runs the query without re-running on every keystroke (that is the debounced effect below).
  const latest = useRef({ active, query });
  useEffect(() => {
    latest.current = { active, query };
  }, [active, query]);
  const refresh = useCallback(() => {
    if (latest.current.active) void run(latest.current.query.trim());
  }, [run]);

  // Debounced, cross-period text search — queries the whole ledger via
  // searchTransactions, independent of whatever week/month is loaded.
  useEffect(() => {
    if (!active) return;
    const trimmed = query.trim();
    // A new keystroke orphans any query still in flight, so its results can't land under the new text.
    seq.current++;
    if (trimmed.length < SEARCH_MIN_CHARS) {
      setResults([]);
      setCapped(false);
      setLoading(false);
      return;
    }
    setLoading(true);
    const handle = setTimeout(() => run(trimmed), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(handle);
  }, [active, query, run]);

  // Past searches (kept on the phone), shown before anything is typed; a search counts once it is
  // submitted or one of its results is opened.
  const [recent, setRecent] = useState<string[]>([]);
  // The latest list, so remembering a search computes from it and saves once, outside a state updater.
  const recentRef = useRef<string[]>([]);
  const showRecent = useCallback((list: string[]) => {
    recentRef.current = list;
    setRecent(list);
  }, []);
  const remember = useCallback(
    (text: string) => {
      const trimmed = text.trim();
      if (trimmed.length < SEARCH_MIN_CHARS) return;
      const next = [
        trimmed,
        ...recentRef.current.filter((p) => p.toLowerCase() !== trimmed.toLowerCase()),
      ].slice(0, RECENT_SEARCHES_KEPT);
      showRecent(next);
      void setRecentSearches(next).catch(() => {});
    },
    [showRecent]
  );
  const clearRecent = useCallback(() => {
    showRecent([]);
    void setRecentSearches([]).catch(() => {});
  }, [showRecent]);
  const open = useCallback(() => {
    setActive(true);
    getRecentSearches()
      .then(showRecent)
      .catch(() => {});
  }, [showRecent]);
  const close = useCallback(() => {
    seq.current++;
    setActive(false);
    setQuery('');
    setResults([]);
    setCapped(false);
    setLoading(false);
  }, []);
  // The phone's back button (or gesture) leaves search, as Cancel does, instead of leaving the tab with it open.
  useFocusEffect(
    useCallback(() => {
      if (!active) return;
      const sub = BackHandler.addEventListener('hardwareBackPress', () => {
        close();
        return true;
      });
      return () => sub.remove();
    }, [active, close])
  );

  return {
    active,
    query,
    /** The text to search for, without the spaces around it. */
    trimmed: query.trim(),
    setQuery,
    results,
    loading,
    failed,
    capped,
    recent,
    open,
    close,
    run,
    refresh,
    remember,
    clearRecent,
  };
}

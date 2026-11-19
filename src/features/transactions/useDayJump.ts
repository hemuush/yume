import { useCallback, useEffect, useRef } from 'react';
import type { FlatListInstance } from 'react-native';
import { addDaysToIsoDate } from '@/lib/date';
import { useReduceMotion } from '@/lib/useReduceMotion';

/**
 * Jumping the Activity list to a day (a tap on a chart bar). Days differ in height (line count, open groups), which
 * rules out `getItemLayout`, so a jump that lands past what the list has measured is retried once it has laid out
 * (`onScrollToIndexFailed`).
 */
export function useDayJump({
  scrollRef,
  collapsedHeight,
  days,
  scope,
  listKey,
}: {
  scrollRef: { current: FlatListInstance | null };
  /** How much of the page the shrunk header covers: a jump lands just under it. */
  collapsedHeight: number;
  /** The days the list holds, newest first. */
  days: { date: string }[];
  /** What a chart bar's key means: a day (week) or the start of a week (month). */
  scope: 'week' | 'month';
  /** Changes whenever the list or its period does: a retry waiting on the old one is dropped. */
  listKey: string;
}) {
  const reduceMotion = useReduceMotion();
  const retryAttempted = useRef(false);
  const retryTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (retryTimer.current) clearTimeout(retryTimer.current);
    },
    []
  );
  useEffect(() => {
    if (retryTimer.current) clearTimeout(retryTimer.current);
    retryTimer.current = null;
  }, [days, listKey]);

  const scrollToDay = useCallback(
    (key: string): boolean => {
      if (retryTimer.current) clearTimeout(retryTimer.current);
      retryTimer.current = null;
      retryAttempted.current = false;
      // Week scope: the bar key is already the group's date. Month scope: the key is a week bucket's start,
      // so jump to the first day in that week (up to 6 days on) that has a group.
      const targetDate =
        scope === 'week' ? key : days.find((g) => g.date >= key && g.date <= addDaysToIsoDate(key, 6))?.date;
      if (!targetDate) return false;
      const index = days.findIndex((g) => g.date === targetDate);
      if (index < 0) return false;
      // Lands just under the shrunk header.
      scrollRef.current?.scrollToIndex({
        index,
        animated: !reduceMotion,
        viewPosition: 0,
        viewOffset: collapsedHeight,
      });
      return true;
    },
    [scope, days, scrollRef, reduceMotion, collapsedHeight]
  );

  const onScrollToIndexFailed = useCallback(
    (info: { index: number; averageItemLength: number }) => {
      if (retryAttempted.current) return;
      retryAttempted.current = true;
      if (retryTimer.current) clearTimeout(retryTimer.current);
      scrollRef.current?.scrollToOffset({
        offset: Math.max(0, info.averageItemLength * info.index),
        animated: false,
      });
      retryTimer.current = setTimeout(() => {
        scrollRef.current?.scrollToIndex({
          index: info.index,
          animated: !reduceMotion,
          viewPosition: 0,
          viewOffset: collapsedHeight,
        });
      }, 250);
    },
    [scrollRef, reduceMotion, collapsedHeight]
  );

  return { scrollToDay, onScrollToIndexFailed };
}
